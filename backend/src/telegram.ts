import { config } from "./config";

export interface TelegramButton {
  text: string;
  url?: string | null;
  callbackData?: string | null;
}

interface TelegramMessageParams {
  botToken?: string;
  chatId: string | number;
  text: string;
  imageUrl?: string | null;
  buttons?: TelegramButton[] | null;
  // Legacy single-button support
  buttonText?: string | null;
  buttonUrl?: string | null;
  callbackData?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildTelegramPostText(input: {
  title?: string | null;
  message: string;
}): string {
  const title = input.title?.trim();
  const message = input.message.trim();

  if (!title) {
    return escapeHtml(message);
  }

  return `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}`;
}

function buildInlineKeyboard(
  buttons?: TelegramButton[] | null,
  legacyButtonText?: string | null,
  legacyButtonUrl?: string | null,
  legacyCallbackData?: string | null,
): { inline_keyboard: object[][] } | undefined {
  const allButtons: TelegramButton[] = [];

  if (buttons && buttons.length > 0) {
    allButtons.push(...buttons);
  } else if (legacyButtonText && (legacyButtonUrl || legacyCallbackData)) {
    allButtons.push({
      text: legacyButtonText,
      url: legacyButtonUrl,
      callbackData: legacyCallbackData,
    });
  }

  if (!allButtons.length) return undefined;

  const keyboard = allButtons.map((btn) => [
    btn.url
      ? { text: btn.text, url: btn.url }
      : { text: btn.text, callback_data: btn.callbackData ?? btn.text },
  ]);

  return { inline_keyboard: keyboard };
}

export async function sendTelegramMessage(
  params: TelegramMessageParams,
): Promise<void>;
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
): Promise<void>;
export async function sendTelegramMessage(
  input: TelegramMessageParams | string | number,
  textArg?: string,
): Promise<void> {
  const params: TelegramMessageParams =
    typeof input === "object"
      ? input
      : {
          botToken: config.TELEGRAM_BOT_TOKEN,
          chatId: input,
          text: textArg ?? "",
        };

  const {
    botToken = config.TELEGRAM_MAILING_BOT_TOKEN,
    chatId,
    text,
    imageUrl,
    buttons,
    buttonText,
    buttonUrl,
    callbackData,
  } = params;

  if (!botToken) {
    throw new Error("Telegram bot token is not configured");
  }

  const replyMarkup = buildInlineKeyboard(buttons, buttonText, buttonUrl, callbackData);
  const apiBase = `https://api.telegram.org/bot${botToken}`;

  if (imageUrl) {
    // Send photo with caption
    const response = await fetch(`${apiBase}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: imageUrl,
        caption: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Telegram API error: ${response.status} ${await response.text()}`,
      );
    }
  } else {
    // Send plain text message
    const response = await fetch(`${apiBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Telegram API error: ${response.status} ${await response.text()}`,
      );
    }
  }
}

/** Returns true if the error is a "bot was blocked by user" Telegram error */
export function isBotBlockedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /\b403\b|Forbidden|bot was blocked|user is deactivated|chat not found/i.test(msg);
}
