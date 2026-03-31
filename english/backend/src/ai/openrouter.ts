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
      const res = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
          "HTTP-Referer": settings.siteUrl,
          "X-Title": settings.siteName,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: opts.maxTokens ?? settings.maxTokens,
          temperature: opts.temperature ?? settings.temperature,
        }),
      });

      if (!res.ok) {
        const details = await res.text().catch(() => "");
        console.error(
          "[openrouter] API error %d for model %s: %s",
          res.status,
          model,
          details.slice(0, 500),
        );

        if (res.status === 401 || res.status === 403) {
          return null;
        }

        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      if (content) {
        return content;
      }
    } catch (error) {
      console.error(`[openrouter] fetch failed for model ${model}:`, error);
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
