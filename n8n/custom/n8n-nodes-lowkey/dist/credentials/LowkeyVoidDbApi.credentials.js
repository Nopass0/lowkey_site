"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LowkeyVoidDbApi = void 0;
class LowkeyVoidDbApi {
  constructor() {
    this.name = "lowkeyVoidDbApi";
    this.displayName = "Lowkey VoidDB API";
    this.documentationUrl = "https://nopass0.github.io/void_ts/";
    this.properties = [
      {
        displayName: "Base URL",
        name: "baseUrl",
        type: "string",
        required: true,
        default: "https://db.lowkey.su",
        description: "VoidDB server URL, for example https://db.lowkey.su or http://voiddb:7700",
      },
      {
        displayName: "Authentication",
        name: "authMode",
        type: "options",
        default: "token",
        options: [
          {
            name: "Token",
            value: "token",
          },
          {
            name: "Username / Password",
            value: "password",
          },
        ],
      },
      {
        displayName: "Token",
        name: "token",
        type: "string",
        typeOptions: {
          password: true,
        },
        default: "",
        displayOptions: {
          show: {
            authMode: ["token"],
          },
        },
      },
      {
        displayName: "Username",
        name: "username",
        type: "string",
        default: "admin",
        displayOptions: {
          show: {
            authMode: ["password"],
          },
        },
      },
      {
        displayName: "Password",
        name: "password",
        type: "string",
        typeOptions: {
          password: true,
        },
        default: "",
        displayOptions: {
          show: {
            authMode: ["password"],
          },
        },
      },
      {
        displayName: "Timeout (ms)",
        name: "timeout",
        type: "number",
        default: 30000,
        description: "HTTP request timeout for the VoidDB client",
      },
    ];
    this.test = {
      request: {
        baseURL: "={{$credentials.baseUrl}}",
        url: "/health",
        method: "GET",
        timeout: 10000,
      },
      rules: [
        {
          type: "responseCode",
          properties: {
            value: 200,
            message: "Failed to reach the VoidDB server. Check the base URL and network access.",
          },
        },
      ],
    };
  }
}
exports.LowkeyVoidDbApi = LowkeyVoidDbApi;
