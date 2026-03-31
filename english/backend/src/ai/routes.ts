import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../config";
import { db } from "../db";
import { callOpenRouter, parseJsonFromAi } from "./openrouter";
import { getHfSettings } from "./hf-settings";
import { optimizeImageUpload } from "../media";

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

function buildFallbackPronunciationAnalysis(targetText: string, spokenText: string, targetIpa?: string) {
  const score = spokenText ? calculateTextScore(targetText, spokenText) : 35;
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
    spokenText,
  };
}

async function transcribeAudioWithHf(file: File) {
  const settings = await getHfSettings();
  if (!settings.apiToken) {
    return null;
  }

  const endpoints = [
    `https://router.huggingface.co/hf-inference/models/${settings.speechModel}`,
    `https://api-inference.huggingface.co/models/${settings.speechModel}`,
  ];

  const payload = await file.arrayBuffer();
  const contentType = file.type || "audio/webm";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
          "Content-Type": contentType,
        },
        body: payload,
      });

      const raw = await response.text();
      if (!response.ok) {
        console.error("[hf-asr] error from %s: %d %s", settings.speechModel, response.status, raw.slice(0, 300));
        continue;
      }

      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed.trim();
      if (typeof parsed?.text === "string") return parsed.text.trim();
      if (Array.isArray(parsed) && typeof parsed[0]?.text === "string") return parsed[0].text.trim();
      if (typeof parsed?.generated_text === "string") return parsed.generated_text.trim();
    } catch (error) {
      console.error("[hf-asr] transcription failed:", error);
    }
  }

  return null;
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
    const prompt = `Create an association game round for ${difficulty} level English learner.
${excludeWords ? `Avoid these recently used words: ${excludeWords}` : ""}
Create 4 progressive clues (from hard to easy) that help guess the target word.
Choose an interesting, useful everyday English word.`;

    const aiResponse = await callOpenRouter(prompt, systemPrompt);

    let gameData;
    if (aiResponse) {
      gameData = parseJsonFromAi(aiResponse, null);
    }

    if (!gameData) {
      // Fallback word list
      const fallbacks = [
        { targetWord: "ambiguous", clues: ["Not clear", "Can be interpreted multiple ways", "Causes confusion", "Neither yes nor no"], category: "adjectives", definition: "open to more than one interpretation", translation: "неоднозначный", pronunciation: "/æmˈbɪɡjuəs/", examples: ["The message was ambiguous."] },
        { targetWord: "resilient", clues: ["Bounces back", "Strong character", "Doesn't give up easily", "Like rubber"], category: "adjectives", definition: "able to recover quickly from difficulties", translation: "стойкий", pronunciation: "/rɪˈzɪliənt/", examples: ["She is very resilient."] },
      ];
      gameData = fallbacks[Math.floor(Math.random() * fallbacks.length)];
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
    const user = await getUser(headers, jwt, set);
    const { word, transcription } = body;

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

    if (!file || !targetText) {
      set.status = 400;
      return { error: "file and targetText are required" };
    }

    const spokenText = (await transcribeAudioWithHf(file)) || "";
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
