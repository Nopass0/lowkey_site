import axios from "axios";
import { getAiSettings } from "./settings";

export type CallOptions = {
  maxTokens?: number;
  temperature?: number;
};

/**
 * Shared OpenRouter caller used across grammar, AI, dictionary, etc.
 * Returns the AI text content or `null` when unavailable.
 */
export async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  opts: CallOptions = {},
): Promise<string | null> {
  const settings = await getAiSettings();
  const models = [
    settings.model,
    process.env.OPENROUTER_MODEL || process.env.OPENROUTER_DEFAULT_MODEL || "",
    "openai/gpt-4o-mini",
  ]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);

  if (!settings.apiKey) {
    console.warn("[openrouter] call skipped - API key is not configured (source: %s)", settings.source);
    return null;
  }

  if (models.length === 0) {
    console.warn("[openrouter] call skipped - model is not configured (source: %s)", settings.source);
    return null;
  }

  for (const model of models) {
    try {
      const res = await axios.post(
        `${settings.baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: opts.maxTokens ?? settings.maxTokens,
          temperature: opts.temperature ?? settings.temperature,
        },
        {
          adapter: "http",
          timeout: 120_000,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.apiKey}`,
            "HTTP-Referer": settings.siteUrl,
            "X-Title": settings.siteName,
          },
        },
      );

      const content = res.data?.choices?.[0]?.message?.content || "";
      if (content) {
        return content;
      }
    } catch (error) {
      const response = (error as any)?.response;
      if (response) {
        const details = typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data || {});
        console.error(
          "[openrouter] API error %d for model %s: %s",
          response.status,
          model,
          details.slice(0, 500),
        );

        if (response.status === 401 || response.status === 403) {
          return null;
        }
      } else {
        console.error(`[openrouter] request failed for model ${model}:`, error);
      }
    }
  }

  return null;
}

/**
 * Try to parse JSON from an AI response. Handles markdown code fences.
 */
export function parseJsonFromAi<T = any>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "");
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const match = arrayMatch || objectMatch;
    return match ? JSON.parse(match[0]) : fallback;
  } catch {
    return fallback;
  }
}
