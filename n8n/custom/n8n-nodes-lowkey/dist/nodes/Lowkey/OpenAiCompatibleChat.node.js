"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiCompatibleChat = void 0;

function parseJsonInput(rawValue, parameterName, { allowEmpty = false, expectArray = false, expectObject = false } = {}) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    if (allowEmpty) {
      return undefined;
    }

    throw new Error(`${parameterName} is required.`);
  }

  const value = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;

  if (expectArray && !Array.isArray(value)) {
    throw new Error(`${parameterName} must be a JSON array.`);
  }

  if (expectObject && (value === null || typeof value !== "object" || Array.isArray(value))) {
    throw new Error(`${parameterName} must be a JSON object.`);
  }

  return value;
}

function normalizeBaseUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim().replace(/\/+$/, "");

  if (!trimmed) {
    throw new Error("Base URL is required.");
  }

  if (/\/v\d+$/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}/v1`;
}

function buildHeaders(credentials) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (credentials.apiKey) {
    headers.Authorization = `Bearer ${credentials.apiKey}`;
  }

  return headers;
}

function extractTextContent(message) {
  if (!message || message.content === undefined || message.content === null) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          return String(part.text || "");
        }

        return JSON.stringify(part);
      })
      .filter(Boolean)
      .join("\n");
  }

  return JSON.stringify(message.content);
}

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

class OpenAiCompatibleChat {
  constructor() {
    this.description = {
      displayName: "OpenAI / BitNet Chat",
      name: "lowkeyOpenAiCompatibleChat",
      icon: "file:lowkey.svg",
      group: ["transform"],
      version: 1,
      description: "Call OpenAI-compatible chat APIs, including the local BitNet server",
      defaults: {
        name: "OpenAI / BitNet Chat",
      },
      codex: {
        categories: ["AI"],
        subcategories: {
          AI: ["Language Models"],
        },
      },
      inputs: ["main"],
      outputs: ["main"],
      credentials: [
        {
          name: "lowkeyOpenAiCompatibleApi",
          required: true,
        },
      ],
      properties: [
        {
          displayName: "Operation",
          name: "operation",
          type: "options",
          default: "chat",
          options: [
            { name: "Chat Completion", value: "chat" },
            { name: "List Models", value: "listModels" },
          ],
        },
        {
          displayName: "Model",
          name: "model",
          type: "string",
          default: "bitnet_b1_58-large",
          required: true,
          displayOptions: {
            show: {
              operation: ["chat"],
            },
          },
        },
        {
          displayName: "Message Input",
          name: "messageInputMode",
          type: "options",
          default: "prompt",
          options: [
            { name: "System + User Prompt", value: "prompt" },
            { name: "Messages JSON", value: "messagesJson" },
          ],
          displayOptions: {
            show: {
              operation: ["chat"],
            },
          },
        },
        {
          displayName: "System Message",
          name: "systemMessage",
          type: "string",
          default: "",
          typeOptions: {
            rows: 3,
          },
          displayOptions: {
            show: {
              operation: ["chat"],
              messageInputMode: ["prompt"],
            },
          },
        },
        {
          displayName: "User Message",
          name: "userMessage",
          type: "string",
          default: "",
          typeOptions: {
            rows: 6,
          },
          description: "If empty, the node falls back to the current item's JSON payload",
          displayOptions: {
            show: {
              operation: ["chat"],
              messageInputMode: ["prompt"],
            },
          },
        },
        {
          displayName: "Messages JSON",
          name: "messagesJson",
          type: "string",
          default: "[\n  {\n    \"role\": \"user\",\n    \"content\": \"Hello\"\n  }\n]",
          typeOptions: {
            rows: 8,
          },
          description: "Full messages array for the chat/completions payload",
          displayOptions: {
            show: {
              operation: ["chat"],
              messageInputMode: ["messagesJson"],
            },
          },
        },
        {
          displayName: "Temperature",
          name: "temperature",
          type: "number",
          default: 0.2,
          displayOptions: {
            show: {
              operation: ["chat"],
            },
          },
        },
        {
          displayName: "Top P",
          name: "topP",
          type: "number",
          default: 1,
          displayOptions: {
            show: {
              operation: ["chat"],
            },
          },
        },
        {
          displayName: "Max Tokens",
          name: "maxTokens",
          type: "number",
          default: 800,
          displayOptions: {
            show: {
              operation: ["chat"],
            },
          },
        },
        {
          displayName: "Additional Body JSON",
          name: "extraBodyJson",
          type: "string",
          default: "",
          typeOptions: {
            rows: 6,
          },
          description: "Optional JSON object merged into the request body",
          displayOptions: {
            show: {
              operation: ["chat"],
            },
          },
        },
      ],
    };
  }

  async execute() {
    const items = this.getInputData();
    const returnData = [];
    const credentials = await this.getCredentials("lowkeyOpenAiCompatibleApi");
    const baseUrl = normalizeBaseUrl(credentials.baseUrl);
    const headers = buildHeaders(credentials);
    const timeout = Number(credentials.timeout || 120000);

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      try {
        const operation = this.getNodeParameter("operation", itemIndex);

        if (operation === "listModels") {
          const response = await this.helpers.httpRequest({
            method: "GET",
            url: `${baseUrl}/models`,
            headers,
            json: true,
            timeout,
          });
          const models = Array.isArray(response && response.data) ? response.data : [];

          for (const model of models) {
            returnData.push({
              json: toJson(model),
              pairedItem: { item: itemIndex },
            });
          }

          continue;
        }

        const model = String(this.getNodeParameter("model", itemIndex));
        const messageInputMode = this.getNodeParameter("messageInputMode", itemIndex);
        const temperature = Number(this.getNodeParameter("temperature", itemIndex));
        const topP = Number(this.getNodeParameter("topP", itemIndex));
        const maxTokens = Number(this.getNodeParameter("maxTokens", itemIndex));
        const extraBodyJson = this.getNodeParameter("extraBodyJson", itemIndex, "");

        let messages;

        if (messageInputMode === "messagesJson") {
          messages = parseJsonInput(
            this.getNodeParameter("messagesJson", itemIndex),
            "Messages JSON",
            { expectArray: true },
          );
        } else {
          const systemMessage = String(this.getNodeParameter("systemMessage", itemIndex, ""));
          const userMessage =
            String(this.getNodeParameter("userMessage", itemIndex, "")) ||
            JSON.stringify(items[itemIndex].json);

          messages = [];

          if (systemMessage) {
            messages.push({
              role: "system",
              content: systemMessage,
            });
          }

          messages.push({
            role: "user",
            content: userMessage,
          });
        }

        const extraBody = parseJsonInput(extraBodyJson, "Additional Body JSON", {
          allowEmpty: true,
          expectObject: true,
        });
        const body = {
          model,
          messages,
          stream: false,
          temperature,
          top_p: topP,
          max_tokens: maxTokens,
          ...(extraBody || {}),
        };
        const response = await this.helpers.httpRequest({
          method: "POST",
          url: `${baseUrl}/chat/completions`,
          headers,
          body,
          json: true,
          timeout,
        });
        const firstChoice = response && Array.isArray(response.choices) ? response.choices[0] : undefined;
        const message = firstChoice && firstChoice.message ? firstChoice.message : null;

        returnData.push({
          json: {
            id: response.id || null,
            object: response.object || null,
            model: response.model || model,
            content: extractTextContent(message),
            message: toJson(message),
            finishReason: firstChoice ? firstChoice.finish_reason || null : null,
            usage: toJson(response.usage || null),
            raw: toJson(response),
          },
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : String(error),
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        throw error;
      }
    }

    return [returnData];
  }
}

exports.OpenAiCompatibleChat = OpenAiCompatibleChat;
