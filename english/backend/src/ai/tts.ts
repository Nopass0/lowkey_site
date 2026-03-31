import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../config";
import { db } from "../db";
import { getHfSettings } from "./hf-settings";

type TtsResult =
  | { ok: true; buffer: Uint8Array; contentType: string }
  | { ok: false; status: number; message: string; loading?: boolean };

async function requestTtsFromEndpoint(
  url: string,
  token: string,
  payload: Record<string, string>,
): Promise<TtsResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";
  if (response.ok && !contentType.includes("application/json")) {
    return {
      ok: true,
      buffer: new Uint8Array(await response.arrayBuffer()),
      contentType: contentType || "audio/flac",
    };
  }

  const errorText = await response.text().catch(() => "");
  return {
    ok: false,
    status: response.status,
    message: errorText,
    loading: response.status === 503 && /loading/i.test(errorText),
  };
}

async function requestTtsAudio(model: string, token: string, text: string): Promise<TtsResult> {
  const endpoints = [
    `https://router.huggingface.co/hf-inference/models/${model}`,
    `https://api-inference.huggingface.co/models/${model}`,
  ];
  const payloads = [
    { inputs: text },
    { text_inputs: text },
  ];

  let lastError: TtsResult | null = null;

  for (const endpoint of endpoints) {
    for (const payload of payloads) {
      try {
        const result = await requestTtsFromEndpoint(endpoint, token, payload);
        if (result.ok) {
          return result;
        }
        lastError = result;
        if (result.loading) {
          return result;
        }
      } catch (error) {
        lastError = {
          ok: false,
          status: 500,
          message: error instanceof Error ? error.message : "unknown TTS error",
        };
      }
    }
  }

  return lastError || {
    ok: false,
    status: 500,
    message: "Unknown TTS error",
  };
}

export const ttsRoutes = new Elysia({ prefix: "/tts" })
  .use(jwt({ name: "jwt", secret: config.jwtSecret }))

  .post(
    "/",
    async ({ headers, body, jwt, set }) => {
      const token = headers.authorization?.replace("Bearer ", "");
      if (!token) {
        set.status = 401;
        throw new Error("Unauthorized");
      }
      const payload = await jwt.verify(token);
      if (!payload) {
        set.status = 401;
        throw new Error("Invalid token");
      }

      const { text, model: customModel } = body;
      const normalizedText = text.trim();

      const cached = await db.findOne("EnglishSoundCache", [db.filter.eq("text", normalizedText)]);
      const hfSettings = await getHfSettings();
      if (!hfSettings.apiToken) {
        set.status = 503;
        return { error: "HuggingFace API token not set in admin" };
      }

      const model = customModel || hfSettings.ttsModel;

      if (cached && cached.audioUrl && cached.model === model) {
        return { audioUrl: cached.audioUrl, cached: true };
      }

      try {
        const result = await requestTtsAudio(model, hfSettings.apiToken, normalizedText);
        if (!result.ok) {
          console.error(`[hf-tts] error from ${model}:`, result.status, result.message.slice(0, 300));

          if (result.loading) {
            set.status = 503;
            return { error: "Model is loading on HuggingFace, try again in a moment." };
          }

          set.status = result.status >= 500 ? 502 : result.status;
          return { error: "Speech generation failed" };
        }

        let cacheItem = cached;
        if (!cacheItem) {
          cacheItem = await db.create("EnglishSoundCache", { text: normalizedText, model });
        }
        
        if (!cacheItem) {
          throw new Error("Failed to create cache item");
        }

        const extension = result.contentType.includes("mpeg")
          ? "mp3"
          : result.contentType.includes("wav")
            ? "wav"
            : result.contentType.includes("ogg")
              ? "ogg"
              : "flac";

        const ref = await db.uploadFile("EnglishSoundCache", cacheItem.id, "audio", result.buffer, {
          filename: `tts_${cacheItem.id}.${extension}`,
          contentType: result.contentType,
          bucket: "english-sounds",
        });

        const audioUrl = await db.blobUrl("EnglishSoundCache", ref);
        await db.update("EnglishSoundCache", cacheItem.id, { audioUrl, model });

        return { audioUrl, cached: false };
      } catch (error) {
        console.error("[hf-tts] exception:", error);
        set.status = 500;
        return { error: "Internal error during TTS generation" };
      }
    },
    {
      body: t.Object({
        text: t.String({ minLength: 1, maxLength: 500 }),
        model: t.Optional(t.String()),
      }),
    }
  );
