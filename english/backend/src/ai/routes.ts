import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import axios from "axios";
import { config } from "../config";
import { db } from "../db";
import { callOpenRouter, parseJsonFromAi } from "./openrouter";
import { getHfSettings } from "./hf-settings";
import { optimizeImageUpload } from "../media";

const DEFAULT_SPEECH_MODELS = [
  "openai/whisper-large-v3",
];

const UNSUPPORTED_SPEECH_MODELS = new Set([
  "openai/whisper-small.en",
  "openai/whisper-small",
]);

const SUPPORTED_FAL_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
];

type ProviderMappingEntry = {
  provider: string;
  providerId: string;
  hfModelId?: string;
  task?: string;
  status?: string;
};

type SpeechAttempt = {
  model: string;
  provider: string;
  status: number;
  message: string;
};

type SpeechRequestResult =
  | { ok: true; text: string; provider: string }
  | { ok: false; status: number; message: string; provider: string };

type SpeechTranscription = {
  text: string;
  model: string | null;
  provider: string | null;
  attempts: SpeechAttempt[];
  usedHint: boolean;
};

const speechProviderMappingCache = new Map<string, { expiresAt: number; mappings: ProviderMappingEntry[] }>();

async function getUser(headers: any, jwtInstance: any, set: any) {
  const token = headers.authorization?.replace("Bearer ", "");
  if (!token) { set.status = 401; throw new Error("Unauthorized"); }
  const payload = await jwtInstance.verify(token);
  if (!payload) { set.status = 401; throw new Error("Invalid token"); }
  const user = await db.findOne("EnglishUsers", [db.filter.eq("id", (payload as any).userId)]);
  if (!user) { set.status = 404; throw new Error("Not found"); }
  return user;
}

// callOpenRouter is now imported from ./openrouter

function fallbackCardGeneration(word: string) {
  return {
    front: word,
    back: `[Translation of "${word}"]`,
    pronunciation: `/${word}/`,
    examples: [`I use the word "${word}" in a sentence.`, `Another example with "${word}".`],
    tags: ["generated", "vocabulary"],
  };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, "").replace(/\s+/g, " ");
}

function tokenizeNormalizedWords(value: string) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function calculateTextScore(target: string, spoken: string) {
  const normalizedTarget = normalizeText(target);
  const normalizedSpoken = normalizeText(spoken);

  if (!normalizedTarget || !normalizedSpoken) {
    return 0;
  }

  const targetWords = normalizedTarget.split(" ");
  const spokenWords = normalizedSpoken.split(" ");
  const matchedWords = targetWords.filter((word) => spokenWords.includes(word)).length;
  const wordScore = matchedWords / Math.max(targetWords.length, 1);

  let charMatches = 0;
  const maxLength = Math.max(normalizedTarget.length, normalizedSpoken.length, 1);
  for (let index = 0; index < Math.min(normalizedTarget.length, normalizedSpoken.length); index += 1) {
    if (normalizedTarget[index] === normalizedSpoken[index]) {
      charMatches += 1;
    }
  }

  const charScore = charMatches / maxLength;
  return Math.max(0, Math.min(100, Math.round((wordScore * 0.7 + charScore * 0.3) * 100)));
}

function buildPronunciationBreakdown(targetText: string, spokenText: string, targetIpa?: string) {
  const targetWords = tokenizeNormalizedWords(targetText);
  const spokenWords = tokenizeNormalizedWords(spokenText);

  return targetWords
    .map((expected, index) => {
      if (spokenWords[index] === expected) {
        return null;
      }

      const matchingWordElsewhere = spokenWords.find((word) => word === expected);
      const actual = spokenWords[index] || matchingWordElsewhere || "";
      const tip = targetIpa && targetWords.length === 1
        ? `Сравни с эталонной IPA: ${targetIpa}`
        : actual
          ? `Проверь слово "${expected}" в этом участке записи и повтори его отдельно.`
          : `Слово "${expected}" не распознано. Повтори фразу медленнее и ближе к микрофону.`;

      return {
        expected,
        actual: actual || "не распознано",
        tip,
      };
    })
    .filter(Boolean);
}

function buildFallbackPronunciationAnalysis(targetText: string, spokenText: string, targetIpa?: string) {
  const score = spokenText ? calculateTextScore(targetText, spokenText) : 35;
  const phonemeErrors = score >= 85 ? [] : buildPronunciationBreakdown(targetText, spokenText, targetIpa);
  const suggestions = score >= 85
    ? ["Повтори фразу в обычном темпе и затем ускорься.", "Закрепи произношение в связной речи."]
    : [
        "Слушай эталон и повторяй по частям.",
        "Сначала проговори медленно, затем в обычном темпе.",
        targetIpa ? `Ориентируйся на IPA: ${targetIpa}` : "Сконцентрируйся на ударении и гласных.",
      ];

  return {
    score,
    feedback: score >= 85
      ? "Произношение близко к эталону."
      : score >= 65
        ? "Есть хорошие совпадения, но стоит точнее проговорить отдельные слова."
        : "Пока слышно заметное расхождение с эталонной фразой.",
    suggestions,
    improvements: suggestions,
    phonemeErrors: score >= 85
      ? []
      : [{
          expected: targetText,
          actual: spokenText || "не распознано",
          tip: targetIpa ? `Сравни с эталонной IPA: ${targetIpa}` : "Сравни свою запись с эталонным озвучиванием.",
        }],
    phonemeErrors,
    spokenText,
  };
}

function normalizeAnalysisItems(value: unknown, fallback: Array<{ expected: string; actual: string; tip: string }>) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const expected = typeof (item as any).expected === "string" ? (item as any).expected.trim() : "";
      const actual = typeof (item as any).actual === "string" ? (item as any).actual.trim() : "";
      const tip = typeof (item as any).tip === "string" ? (item as any).tip.trim() : "";
      if (!expected && !actual && !tip) {
        return null;
      }

      return {
        expected: expected || "segment",
        actual: actual || "not recognized",
        tip: tip || "Compare this segment with the reference and repeat it separately.",
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

async function buildPronunciationAnalysis(targetText: string, spokenText: string, targetIpa?: string) {
  const fallback = buildFallbackPronunciationAnalysis(targetText, spokenText, targetIpa);
  if (!spokenText.trim()) {
    return fallback;
  }

  const systemPrompt = `You are an English pronunciation coach.
Return ONLY valid JSON with this exact shape:
{
  "score": 78,
  "feedback": "Short user-facing summary in Russian.",
  "suggestions": ["Russian suggestion 1", "Russian suggestion 2"],
  "improvements": ["Russian suggestion 1", "Russian suggestion 2"],
  "phonemeErrors": [
    {
      "expected": "target word or segment",
      "actual": "what the learner likely said",
      "tip": "Specific correction in Russian"
    }
  ]
}
Base the score on the difference between the target text and the recognized spoken text.
Do not invent acoustic details you cannot infer from the transcript.
If the phrase contains several words, point out the specific mismatching words or segments.`;

  const prompt = `Target text: "${targetText}"
Recognized spoken text: "${spokenText}"
${targetIpa ? `Reference IPA: "${targetIpa}"` : ""}

Analyze where the learner deviated from the target.
Keep the feedback concise, practical, and in Russian.`;

  const aiResponse = await callOpenRouter(prompt, systemPrompt, {
    maxTokens: 1200,
    temperature: 0.2,
  });

  if (!aiResponse) {
    return fallback;
  }

  const parsed = parseJsonFromAi<any>(aiResponse, null);
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  const nextScore = typeof parsed.score === "number"
    ? Math.max(0, Math.min(100, Math.round(parsed.score)))
    : fallback.score;
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : fallback.suggestions;
  const improvements = Array.isArray(parsed.improvements)
    ? parsed.improvements.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : suggestions;

  return {
    score: nextScore,
    feedback: typeof parsed.feedback === "string" && parsed.feedback.trim()
      ? parsed.feedback.trim()
      : fallback.feedback,
    suggestions: suggestions.length > 0 ? suggestions : fallback.suggestions,
    improvements: improvements.length > 0 ? improvements : suggestions,
    phonemeErrors: normalizeAnalysisItems(parsed.phonemeErrors, fallback.phonemeErrors),
    spokenText,
  };
}

function buildSpeechModelCandidates(...models: Array<string | undefined>) {
  return [...new Set(
    models
      .flatMap((model) => (model ? [model] : []))
      .concat(DEFAULT_SPEECH_MODELS)
      .map((model) => model.trim())
      .filter((model) => !UNSUPPORTED_SPEECH_MODELS.has(model))
      .filter(Boolean),
  )];
}

function readProviderErrorBody(body: unknown) {
  if (typeof body === "string") {
    return body;
  }

  if (body && typeof body === "object") {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }

  return "";
}

function normalizeProviderMappings(input: unknown): ProviderMappingEntry[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input as ProviderMappingEntry[];
  }

  if (typeof input === "object") {
    return Object.entries(input as Record<string, any>)
      .map(([provider, value]) => ({
        provider,
        providerId: value?.providerId || value?.modelId || value?.id || "",
        hfModelId: value?.hfModelId,
        task: value?.task,
        status: value?.status,
      }))
      .filter((entry) => entry.providerId);
  }

  return [];
}

async function fetchInferenceProviderMappings(model: string, token: string) {
  const cached = speechProviderMappingCache.get(model);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.mappings;
  }

  try {
    const response = await axios.get(`https://huggingface.co/api/models/${model}`, {
      adapter: "http",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      params: {
        "expand[]": "inferenceProviderMapping",
      },
      timeout: 30_000,
    });

    const mappings = normalizeProviderMappings(response.data?.inferenceProviderMapping);
    speechProviderMappingCache.set(model, {
      mappings,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return mappings;
  } catch (error) {
    console.error(`[hf-asr] failed to fetch provider mapping for ${model}:`, error);
    return [];
  }
}

function selectSpeechMappings(mappings: ProviderMappingEntry[]) {
  const supportedProviders = ["hf-inference", "replicate", "fal-ai"];

  return mappings
    .filter((entry) => entry.task === "automatic-speech-recognition" && entry.status !== "staging")
    .sort((left, right) => {
      const leftIndex = supportedProviders.indexOf(left.provider);
      const rightIndex = supportedProviders.indexOf(right.provider);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    });
}

function parseSpeechResponse(raw: string) {
  if (!raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed.trim();
    if (typeof parsed?.text === "string") return parsed.text.trim();
    if (Array.isArray(parsed) && typeof parsed[0]?.text === "string") return parsed[0].text.trim();
    if (typeof parsed?.generated_text === "string") return parsed.generated_text.trim();
  } catch {
    return raw.trim();
  }

  return null;
}

function buildAudioDataUrl(file: File, bytes: Uint8Array) {
  return `data:${file.type || "audio/webm"};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function requestHfInferenceAsr(
  mapping: ProviderMappingEntry,
  token: string,
  file: File,
  bytes: Uint8Array,
): Promise<SpeechRequestResult> {
  try {
    const response = await axios.post(
      `https://router.huggingface.co/hf-inference/models/${mapping.providerId}`,
      bytes,
      {
        adapter: "http",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type || "audio/webm",
        },
        timeout: 120_000,
      },
    );

    const raw = typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data || {});
    const parsed = parseSpeechResponse(raw);
    if (parsed) {
      return { ok: true, text: parsed, provider: mapping.provider };
    }

    return {
      ok: false,
      status: response.status,
      message: "Malformed hf-inference ASR response",
      provider: mapping.provider,
    };
  } catch (error) {
    const axiosError = error as any;
    return {
      ok: false,
      status: axiosError?.response?.status || 500,
      message: [
        axiosError?.message,
        readProviderErrorBody(axiosError?.response?.data),
      ].filter(Boolean).join(" ").trim() || "hf-inference ASR request failed",
      provider: mapping.provider,
    };
  }
}

async function requestReplicateAsr(
  mapping: ProviderMappingEntry,
  token: string,
  file: File,
  bytes: Uint8Array,
): Promise<SpeechRequestResult> {
  try {
    const usesVersionRoute = mapping.providerId.includes(":");
    const url = usesVersionRoute
      ? "https://router.huggingface.co/replicate/v1/predictions"
      : `https://router.huggingface.co/replicate/v1/models/${mapping.providerId}/predictions`;

    const response = await axios.post(
      url,
      {
        input: {
          audio: buildAudioDataUrl(file, bytes),
        },
        version: usesVersionRoute ? mapping.providerId.split(":")[1] : undefined,
      },
      {
        adapter: "http",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          Prefer: "wait",
          "Content-Type": "application/json",
        },
        timeout: 120_000,
      },
    );

    const output = response.data?.output;
    if (typeof output === "string") {
      return { ok: true, text: output.trim(), provider: mapping.provider };
    }
    if (Array.isArray(output) && typeof output[0] === "string") {
      return { ok: true, text: output[0].trim(), provider: mapping.provider };
    }
    if (typeof output?.transcription === "string") {
      return { ok: true, text: output.transcription.trim(), provider: mapping.provider };
    }
    if (typeof output?.translation === "string") {
      return { ok: true, text: output.translation.trim(), provider: mapping.provider };
    }

    return {
      ok: false,
      status: response.status,
      message: "Malformed replicate ASR response",
      provider: mapping.provider,
    };
  } catch (error) {
    const axiosError = error as any;
    return {
      ok: false,
      status: axiosError?.response?.status || 500,
      message: [
        axiosError?.message,
        readProviderErrorBody(axiosError?.response?.data),
      ].filter(Boolean).join(" ").trim() || "replicate ASR request failed",
      provider: mapping.provider,
    };
  }
}

async function requestFalAiAsr(
  mapping: ProviderMappingEntry,
  token: string,
  file: File,
  bytes: Uint8Array,
): Promise<SpeechRequestResult> {
  const contentType = file.type || "audio/webm";
  if (!SUPPORTED_FAL_AUDIO_TYPES.includes(contentType)) {
    return {
      ok: false,
      status: 415,
      message: `fal-ai does not support ${contentType}`,
      provider: mapping.provider,
    };
  }

  try {
    const response = await axios.post(
      `https://router.huggingface.co/fal-ai/${mapping.providerId}`,
      {
        audio_url: buildAudioDataUrl(file, bytes),
      },
      {
        adapter: "http",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 120_000,
      },
    );

    if (typeof response.data?.text === "string") {
      return { ok: true, text: response.data.text.trim(), provider: mapping.provider };
    }

    return {
      ok: false,
      status: response.status,
      message: "Malformed fal-ai ASR response",
      provider: mapping.provider,
    };
  } catch (error) {
    const axiosError = error as any;
    return {
      ok: false,
      status: axiosError?.response?.status || 500,
      message: [
        axiosError?.message,
        readProviderErrorBody(axiosError?.response?.data),
      ].filter(Boolean).join(" ").trim() || "fal-ai ASR request failed",
      provider: mapping.provider,
    };
  }
}

async function requestSpeechFromMapping(
  mapping: ProviderMappingEntry,
  token: string,
  file: File,
  bytes: Uint8Array,
) {
  if (mapping.provider === "hf-inference") {
    return requestHfInferenceAsr(mapping, token, file, bytes);
  }

  if (mapping.provider === "replicate") {
    return requestReplicateAsr(mapping, token, file, bytes);
  }

  if (mapping.provider === "fal-ai") {
    return requestFalAiAsr(mapping, token, file, bytes);
  }

  return {
    ok: false,
    status: 501,
    message: `Unsupported ASR provider: ${mapping.provider}`,
    provider: mapping.provider,
  } satisfies SpeechRequestResult;
}

async function transcribeAudioWithHf(file: File, spokenTextHint?: string): Promise<SpeechTranscription> {
  const settings = await getHfSettings();
  if (!settings.apiToken) {
    return {
      text: spokenTextHint?.trim() || "",
      model: null,
      provider: null,
      attempts: [],
      usedHint: Boolean(spokenTextHint?.trim()),
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const models = buildSpeechModelCandidates(settings.speechModel, config.huggingface.speechModel);
  const attempts: SpeechAttempt[] = [];

  for (const model of models) {
    const mappings = selectSpeechMappings(await fetchInferenceProviderMappings(model, settings.apiToken));
    if (mappings.length === 0) {
      attempts.push({
        model,
        provider: "router",
        status: 404,
        message: "No supported automatic-speech-recognition provider mapping found",
      });
      continue;
    }

    for (const mapping of mappings) {
      const result = await requestSpeechFromMapping(mapping, settings.apiToken, file, bytes);
      if (result.ok && result.text) {
        return {
          text: result.text,
          model,
          provider: mapping.provider,
          attempts,
          usedHint: false,
        };
      }

      attempts.push({
        model,
        provider: mapping.provider,
        status: result.status,
        message: result.message,
      });
      console.error("[hf-asr] error from %s@%s: %d %s", model, mapping.provider, result.status, result.message.slice(0, 300));
    }
  }

  const hint = spokenTextHint?.trim() || "";
  return {
    text: hint,
    model: null,
    provider: null,
    attempts,
    usedHint: Boolean(hint),
  };
}

export const aiRoutes = new Elysia({ prefix: "/ai" })
  .use(jwt({ name: "jwt", secret: config.jwtSecret }))

  // Generate flashcard from word
  .post("/generate-card", async ({ headers, body, jwt, set }) => {
    const user = await getUser(headers, jwt, set);
    const { word, targetLanguage = "Russian", context } = body;

    const systemPrompt = `You are an English language teacher creating flashcards for Russian-speaking learners.
Return ONLY valid JSON in this exact format:
{
  "front": "English word or phrase",
  "back": "Russian translation",
  "pronunciation": "IPA transcription",
  "examples": ["example sentence 1", "example sentence 2"],
  "tags": ["category1", "category2"]
}`;

    const prompt = `Create a flashcard for the English word/phrase: "${word}"
${context ? `Context: ${context}` : ""}
Target translation language: ${targetLanguage}
Include 2 example sentences, IPA pronunciation, and relevant tags (e.g., noun, verb, business, everyday, etc.)`;

    const aiResponse = await callOpenRouter(prompt, systemPrompt);

    let cardData;
    if (aiResponse) {
      cardData = parseJsonFromAi(aiResponse, fallbackCardGeneration(word));
    } else {
      cardData = fallbackCardGeneration(word);
    }

    return { ...cardData, aiGenerated: true };
  }, {
    body: t.Object({
      word: t.String(),
      targetLanguage: t.Optional(t.String()),
      context: t.Optional(t.String()),
    }),
  })

  .post("/generate-image", async ({ headers, body, jwt, set }) => {
    const user = await getUser(headers, jwt, set);
    const { prompt, kind = "card" } = body;
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      set.status = 400;
      return { error: "Prompt is required" };
    }

    try {
      const response = await fetch(
        `https://image.pollinations.ai/prompt/${encodeURIComponent(normalizedPrompt)}?width=1024&height=1024&nologo=true`,
      );

      if (!response.ok) {
        set.status = 502;
        return { error: "Image generation failed" };
      }

      const optimized = await optimizeImageUpload(await response.arrayBuffer(), {
        width: 1024,
        height: 1024,
        fit: "cover",
        quality: 86,
      });
      const asset = await db.create("EnglishGeneratedImages", {
        userId: user.id,
        prompt: normalizedPrompt,
        kind,
        imageUrl: "",
      });
      const ref = await db.uploadFile("EnglishGeneratedImages", asset.id, "image", optimized.buffer, {
        filename: `${asset.id}.${optimized.extension}`,
        contentType: optimized.contentType,
        bucket: "english-media",
      });
      const imageUrl = await db.blobUrl("EnglishGeneratedImages", ref);
      await db.update("EnglishGeneratedImages", asset.id, { imageUrl });
      return { id: asset.id, imageUrl };
    } catch (error) {
      console.error("[ai-image] generation failed:", error);
      set.status = 500;
      return { error: "Image generation failed" };
    }
  }, {
    body: t.Object({
      prompt: t.String({ minLength: 3 }),
      kind: t.Optional(t.String()),
    }),
  })

  // Generate multiple cards from text
  .post("/generate-cards-bulk", async ({ headers, body, jwt, set }) => {
    const user = await getUser(headers, jwt, set);
    if (!user.isPremium && user.role !== "admin") {
      set.status = 403;
      return { error: "Premium required for bulk generation" };
    }
    const { text, count = 10 } = body;

    const systemPrompt = `You are an English language teacher. Extract key vocabulary from the provided text and create flashcards for Russian-speaking learners.
Return ONLY valid JSON array:
[{"front": "word", "back": "перевод", "pronunciation": "/word/", "examples": ["..."], "tags": ["..."]}]`;

    const prompt = `Extract ${count} key English vocabulary words/phrases from this text and create flashcards:\n\n${text}`;

    const aiResponse = await callOpenRouter(prompt, systemPrompt);

    let cards = [];
    if (aiResponse) {
      cards = parseJsonFromAi<any[]>(aiResponse, []);
    }

    return { cards: cards.map((c: any) => ({ ...c, aiGenerated: true })) };
  }, {
    body: t.Object({
      text: t.String(),
      count: t.Optional(t.Number()),
    }),
  })

  // AI association game word
  .post("/association-game", async ({ headers, body, jwt, set }) => {
    const user = await getUser(headers, jwt, set);
    const { words, difficulty = "medium" } = body;

    const systemPrompt = `You are creating an English word association game for language learners.
Return ONLY valid JSON in this format:
{
  "targetWord": "word to guess",
  "clues": ["clue1", "clue2", "clue3", "clue4"],
  "category": "category name",
  "definition": "brief definition",
  "translation": "Russian translation",
  "pronunciation": "/pronunciation/",
  "examples": ["example sentence"]
}`;

    const excludeWords = words?.join(", ") || "";
    const excludedWords = new Set((words || []).map((word) => normalizeText(word)));
    const prompt = `Create an association game round for ${difficulty} level English learner.
${excludeWords ? `Avoid these recently used words: ${excludeWords}` : ""}
Create 4 progressive clues (from hard to easy) that help guess the target word.
Choose an interesting, useful everyday English word.`;

    const aiResponse = await callOpenRouter(prompt, systemPrompt);

    let gameData;
    if (aiResponse) {
      gameData = parseJsonFromAi(aiResponse, null);
    }

    if (gameData?.targetWord && excludedWords.has(normalizeText(gameData.targetWord))) {
      gameData = null;
    }

    if (!gameData) {
      // Fallback word list
      const fallbacks = [
        { targetWord: "ambiguous", clues: ["Not clear", "Can be interpreted multiple ways", "Causes confusion", "Neither yes nor no"], category: "adjectives", definition: "open to more than one interpretation", translation: "неоднозначный", pronunciation: "/æmˈbɪɡjuəs/", examples: ["The message was ambiguous."] },
        { targetWord: "resilient", clues: ["Bounces back", "Strong character", "Doesn't give up easily", "Like rubber"], category: "adjectives", definition: "able to recover quickly from difficulties", translation: "стойкий", pronunciation: "/rɪˈzɪliənt/", examples: ["She is very resilient."] },
      ];
      fallbacks.push(
        { targetWord: "curious", clues: ["Wants to know more", "Asks many questions", "Interested in discovering things", "Opposite of indifferent"], category: "adjectives", definition: "eager to know or learn something", translation: "любопытный", pronunciation: "/ˈkjʊəriəs/", examples: ["Children are naturally curious."] },
        { targetWord: "journey", clues: ["A trip from one place to another", "Longer than a simple walk", "Travel with a destination", "You can take it by train or car"], category: "nouns", definition: "an act of traveling from one place to another", translation: "путешествие", pronunciation: "/ˈdʒɜːrni/", examples: ["The journey took three hours."] },
      );
      gameData = fallbacks.find((item) => !excludedWords.has(normalizeText(item.targetWord))) || fallbacks[0];
    }

    return gameData;
  }, {
    body: t.Object({
      words: t.Optional(t.Array(t.String())),
      difficulty: t.Optional(t.String()),
    }),
  })

  // Analyze pronunciation recording
  .post("/analyze-pronunciation", async ({ headers, body, jwt, set }) => {
    await getUser(headers, jwt, set);
    const { word, transcription } = body;
    return buildPronunciationAnalysis(word, transcription, body.correctIpa);

    const systemPrompt = `You are an English pronunciation coach analyzing a learner's pronunciation attempt.
Return ONLY valid JSON:
{
  "score": 75,
  "feedback": "General feedback",
  "corrections": ["specific correction 1", "specific correction 2"],
  "tips": ["improvement tip 1", "improvement tip 2"],
  "phonemes": [{"sound": "/æ/", "correct": true, "note": "..."}]
}`;

    const prompt = `The learner tried to pronounce the word "${word}".
Their phonetic attempt: "${transcription}"
Correct IPA: "${body.correctIpa || word}"
Analyze their pronunciation accuracy (score 0-100) and provide constructive feedback in Russian.`;

    const aiResponse = await callOpenRouter(prompt, systemPrompt);

    let analysis = { score: 70, feedback: "Хорошая попытка! Продолжайте практиковаться.", corrections: [], tips: ["Слушайте носителей языка", "Практикуйтесь каждый день"], phonemes: [] };

    if (aiResponse) {
      const parsed = parseJsonFromAi(aiResponse, null);
      if (parsed) analysis = parsed;
    }

    return analysis;
  }, {
    body: t.Object({
      word: t.String(),
      transcription: t.String(),
      correctIpa: t.Optional(t.String()),
    }),
  })

  .post("/analyze-pronunciation-audio", async ({ headers, jwt, set, request }) => {
    await getUser(headers, jwt, set);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const targetText = String(formData.get("targetText") || "").trim();
    const targetIpa = String(formData.get("targetIpa") || "").trim();
    const spokenTextHint = String(formData.get("spokenTextHint") || "").trim();

    if (!file || !targetText) {
      set.status = 400;
      return { error: "file and targetText are required" };
    }

    const transcription = await transcribeAudioWithHf(file, spokenTextHint);
    const analysis = await buildPronunciationAnalysis(targetText, transcription.text, targetIpa);
    return {
      ...analysis,
      transcriptionModel: transcription.model,
      transcriptionProvider: transcription.provider,
      transcriptionUsedHint: transcription.usedHint,
      transcriptionAttempts: transcription.attempts,
    };

    const spokenText = (await transcribeAudioWithHf(file, spokenTextHint)) || "";
    return buildFallbackPronunciationAnalysis(targetText, spokenText, targetIpa);
  })

  // Writing analysis
  .post("/analyze-writing", async ({ headers, body, jwt, set }) => {
    const user = await getUser(headers, jwt, set);

    const systemPrompt = `You are an expert English writing coach. Analyze the student's English text and return a detailed JSON analysis.
Return ONLY valid JSON matching this schema:
{
  "score": 85,
  "grade": "B+",
  "wordCount": 42,
  "readabilityLevel": "Intermediate (B1)",
  "correctedText": "...",
  "errors": [
    {
      "text": "he go",
      "correction": "he goes",
      "explanation": "Third person singular requires -s ending",
      "type": "grammar",
      "offset": 12,
      "length": 5
    }
  ],
  "strengths": ["Good vocabulary range", "Clear sentence structure"],
  "improvements": ["Work on verb conjugation", "Use more connectors"]
}
Error types: "grammar", "spelling", "style", "punctuation".
offset/length point to the exact position in the original text.
Provide explanations in Russian. Keep strengths/improvements in Russian.`;

    const prompt = `Analyze this English text written by a ${user.level || "intermediate"} learner:\n\n"${body.text}"`;

    const aiResponse = await callOpenRouter(prompt, systemPrompt);

    const words = body.text.trim().split(/\s+/).length;
    let result = {
      score: 75, grade: "C+", wordCount: words,
      readabilityLevel: "Intermediate (B1)",
      correctedText: body.text,
      errors: [] as any[],
      strengths: ["Хорошая попытка", "Понятная структура"],
      improvements: ["Продолжайте практиковаться"],
    };

    if (aiResponse) {
      const parsed = parseJsonFromAi(aiResponse, null);
      if (parsed) result = { ...result, ...parsed };
    }

    return result;
  }, {
    body: t.Object({ text: t.String({ minLength: 10 }) }),
  })

  // Daily learning plan
  .get("/daily-plan", async ({ headers, jwt, set }) => {
    const user = await getUser(headers, jwt, set);

    const today = new Date().toISOString().split("T")[0];
    const progress = await db.findOne("EnglishProgress", [
      db.filter.eq("userId", user.id),
      db.filter.eq("date", today),
    ]);

    const dueCards = await db.findMany("EnglishCards", {
      filters: [db.filter.eq("userId", user.id)],
      limit: 200,
    });

    const now = new Date();
    const dueCount = dueCards.filter(c => !c.nextReview || new Date(c.nextReview) <= now || c.status === "new").length;

    return {
      dueCards: dueCount,
      dailyGoal: user.dailyGoal || 20,
      studiedToday: progress?.cardsStudied || 0,
      xpToday: progress?.xpEarned || 0,
      streak: user.studyStreak || 0,
      level: user.level || "beginner",
      suggestions: [
        dueCount > 0 ? `Повторите ${Math.min(dueCount, user.dailyGoal || 20)} карточек` : "Все карточки повторены!",
        "Сыграйте в игру ассоциаций для запоминания новых слов",
        "Запишите произношение 3 сложных слов",
      ].filter(Boolean),
    };
  });
