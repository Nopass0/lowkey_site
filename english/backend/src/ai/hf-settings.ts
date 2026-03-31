import { config } from "../config";
import { db } from "../db";

const HF_SETTINGS_KEY = "huggingface";
const SETTINGS_COLLECTION = "EnglishSiteSettings";

type StoredHfSettings = {
  id: string;
  key: string;
  hfApiToken?: string;
  ttsModel?: string;
  speechModel?: string;
  updatedAt?: string;
};

export type HfSettings = {
  apiToken: string;
  ttsModel: string;
  speechModel: string;
  updatedAt: string | null;
  source: "database" | "environment" | "default";
};

function normalizedString(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function maskToken(token: string) {
  if (!token) return null;
  if (token.length <= 8) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

async function getStoredHfSettings() {
  return db.findOne(SETTINGS_COLLECTION, [
    db.filter.eq("key", HF_SETTINGS_KEY),
  ]) as Promise<StoredHfSettings | null>;
}

function resolveSource(stored: StoredHfSettings | null) {
  if (stored?.hfApiToken || stored?.ttsModel || stored?.speechModel) {
    return "database";
  }
  if (process.env.HF_API_TOKEN || process.env.HF_TTS_MODEL || process.env.HF_SPEECH_MODEL) {
    return "environment";
  }
  return "default";
}

function resolveSettings(stored: StoredHfSettings | null): HfSettings {
  return {
    apiToken: normalizedString(stored?.hfApiToken, config.huggingface.apiToken),
    ttsModel: normalizedString(stored?.ttsModel, config.huggingface.ttsModel),
    speechModel: normalizedString(stored?.speechModel, config.huggingface.speechModel),
    updatedAt: stored?.updatedAt || null,
    source: resolveSource(stored),
  };
}

export async function getHfSettings() {
  return resolveSettings(await getStoredHfSettings());
}

export async function getPublicHfSettings() {
  const settings = await getHfSettings();
  return {
    ttsModel: settings.ttsModel,
    speechModel: settings.speechModel,
    hasApiToken: Boolean(settings.apiToken),
    maskedApiToken: maskToken(settings.apiToken),
    source: settings.source,
    updatedAt: settings.updatedAt,
  };
}

export async function saveHfSettings(input: {
  apiToken?: string;
  clearApiToken?: boolean;
  ttsModel?: string;
  speechModel?: string;
}) {
  const existing = await getStoredHfSettings();
  const current = resolveSettings(existing);

  const nextToken = input.clearApiToken
    ? ""
    : (typeof input.apiToken === "string" && input.apiToken.trim()) || existing?.hfApiToken || "";

  const payload = {
    key: HF_SETTINGS_KEY,
    hfApiToken: nextToken,
    ttsModel: normalizedString(input.ttsModel, current.ttsModel),
    speechModel: normalizedString(input.speechModel, current.speechModel),
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    await db.update(SETTINGS_COLLECTION, existing.id, payload);
  } else {
    await db.create(SETTINGS_COLLECTION, payload);
  }

  return getPublicHfSettings();
}
