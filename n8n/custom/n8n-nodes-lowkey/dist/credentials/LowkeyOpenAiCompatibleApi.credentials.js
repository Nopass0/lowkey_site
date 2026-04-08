"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LowkeyOpenAiCompatibleApi = void 0;
class LowkeyOpenAiCompatibleApi {
  constructor() {
    this.name = "lowkeyOpenAiCompatibleApi";
    this.displayName = "OpenAI Compatible API";
    this.documentationUrl = "https://github.com/microsoft/BitNet";
    this.properties = [
      {
        displayName: "Base URL",
        name: "baseUrl",
        type: "string",
        required: true,
        default: "http://bitnet:8080/v1",
        description: "Base API URL. Examples: http://bitnet:8080/v1 or https://api.openai.com/v1",
      },
      {
        displayName: "API Key",
        name: "apiKey",
        type: "string",
        typeOptions: {
          password: true,
        },
        default: "",
        description: "Optional. Leave empty for local BitNet unless you enable auth in front of it.",
      },
      {
        displayName: "Timeout (ms)",
        name: "timeout",
        type: "number",
        default: 120000,
      },
    ];
  }
}
exports.LowkeyOpenAiCompatibleApi = LowkeyOpenAiCompatibleApi;
