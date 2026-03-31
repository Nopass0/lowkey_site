import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../config";
import { db } from "../db";
import { getHfSettings } from "./hf-settings";

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

      const cached = await db.findOne("EnglishSoundCache", [
        db.filter.eq("text", normalizedText),
      ]);

      if (cached && cached.audioUrl) {
        return { audioUrl: cached.audioUrl, cached: true };
      }

      const hfSettings = await getHfSettings();
      if (!hfSettings.apiToken) {
        set.status = 503;
        return { error: "HuggingFace API token not set in admin" };
      }

      const model = customModel || hfSettings.ttsModel;

      try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfSettings.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: normalizedText }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[hf-tts] error from ${model}:`, response.status, errText.slice(0, 300));
          
          if (response.status === 503 && errText.includes("loading")) {
            set.status = 503;
            return { error: "Model is loading on HuggingFace, try again in a moment." };
          }
          
          set.status = 502;
          return { error: "Speech generation failed" };
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "audio/flac";

        let cacheItem = cached;
        if (!cacheItem) {
          cacheItem = await db.create("EnglishSoundCache", { text: normalizedText, model });
        }
        
        if (!cacheItem) {
          throw new Error("Failed to create cache item");
        }

        const ref = await db.uploadFile("EnglishSoundCache", cacheItem.id, "audio", buffer, {
          filename: `tts_${cacheItem.id}.flac`,
          contentType,
        });

        const audioUrl = await db.blobUrl("EnglishSoundCache", ref);
        await db.update("EnglishSoundCache", cacheItem.id, { audioUrl });

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
