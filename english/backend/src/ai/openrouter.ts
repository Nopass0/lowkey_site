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

  if (!settings.apiKey) {
    console.warn("[openrouter] call skipped — API key is not configured (source: %s)", settings.source);
    return null;
  }

  if (!settings.model) {
    console.warn("[openrouter] call skipped — model is not configured (source: %s)", settings.source);
    return null;
  }

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
        model: settings.model,
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
        settings.model,
        details.slice(0, 500),
      );
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("[openrouter] fetch failed:", error);
    return null;
  }
}

/**
 * Try to parse JSON from an AI response. Handles markdown code fences.
 */
export function parseJsonFromAi<T = any>(text: string, fallback: T): T {
  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "");
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const match = arrayMatch || objectMatch;
    return match ? JSON.parse(match[0]) : fallback;
  } catch {
    return fallback;
  }
}
