import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../config";
import { db } from "../db";
import { getHfSettings } from "./hf-settings";

type TtsResult =
  | { ok: true; buffer: Uint8Array; contentType: string }
  | { ok: false; status: number; message: string; loading?: boolean };

type SuccessfulTtsResult = Extract<TtsResult, { ok: true }> & { model: string };
type FailedTtsResult = Extract<TtsResult, { ok: false }> & { model?: string };

const DEFAULT_TTS_MODELS = [
  "hexgrad/Kokoro-82M",
  "facebook/mms-tts-eng",
];

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

function buildModelCandidates(...models: Array<string | undefined>) {
  return [...new Set(
    models
      .flatMap((model) => (model ? [model] : []))
      .concat(DEFAULT_TTS_MODELS)
      .map((model) => model.trim())
      .filter(Boolean),
  )];
}

async function requestTtsAudio(models: string[], token: string, text: string): Promise<SuccessfulTtsResult | FailedTtsResult> {
  const payloads = [
    { inputs: text },
    { text_inputs: text },
  ];

  let lastError: FailedTtsResult | null = null;
  let loadingSeen = false;

  for (const model of models) {
    const endpoint = `https://router.huggingface.co/hf-inference/models/${model}`;
    for (const payload of payloads) {
      try {
        const result = await requestTtsFromEndpoint(endpoint, token, payload);
        if (result.ok) {
          return { ...result, model };
        }
        lastError = { ...result, model };
        if (result.loading) {
          loadingSeen = true;
          break;
        }
      } catch (error) {
        lastError = {
          ok: false,
          status: 500,
          message: error instanceof Error ? error.message : "unknown TTS error",
          model,
        };
      }
    }
  }

  if (loadingSeen) {
    return {
      ok: false,
      status: 503,
      message: "All configured TTS models are currently loading on HuggingFace.",
      loading: true,
      model: lastError?.model,
    };
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

      const modelCandidates = buildModelCandidates(customModel, hfSettings.ttsModel, config.huggingface.ttsModel);
      const requestedModel = modelCandidates[0];

      if (cached && cached.audioUrl && cached.model === requestedModel) {
        return { audioUrl: cached.audioUrl, cached: true };
      }

      try {
        const result = await requestTtsAudio(modelCandidates, hfSettings.apiToken, normalizedText);
        if (!result.ok) {
          console.error(`[hf-tts] error from ${result.model || requestedModel}:`, result.status, result.message.slice(0, 300));

          if (result.loading) {
            set.status = 503;
            return { error: "Model is loading on HuggingFace, try again in a moment." };
          }

          set.status = 502;
          return { error: "Speech generation failed" };
        }

        let cacheItem = cached;
        if (!cacheItem) {
          cacheItem = await db.create("EnglishSoundCache", { text: normalizedText, model: result.model });
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
        await db.update("EnglishSoundCache", cacheItem.id, { audioUrl, model: result.model });

        return { audioUrl, cached: false, model: result.model };
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
