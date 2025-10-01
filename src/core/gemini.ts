// src/core/gemini.ts
import fetch from "node-fetch";
import type { LLM, ChatMsg } from "./llm.js";
import { GoogleAuth } from "google-auth-library";

const BASE = process.env.GEMINI_REST_BASE || "https://generativelanguage.googleapis.com/v1";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "models/gemini-2.5-pro";
const API_KEY = process.env.GEMINI_API_KEY || "";
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_PROJECT_ID || "";

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function toGemini(messages: ChatMsg[]) {
  return {
    contents: messages.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }))
  };
}

// Detect if the user likely configured OAuth (ADC/gcloud) instead of API key
function wantsOAuth(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || // path to a service-account or user creds JSON
    process.env.CLOUDSDK_CONFIG ||                // gcloud config dir hint
    process.env.GCLOUD_PROJECT ||                 // old env var some setups still use
    process.env.GOOGLE_CLOUD_PROJECT              // project id for x-goog-user-project
  );
}


export class GeminiLLM implements LLM {
  constructor(private model = DEFAULT_MODEL) {}

    private async authHeaders(): Promise<Record<string, string>> {
    // Prefer OAuth (ADC) if signs of it are present
    if (wantsOAuth()) {
      try {
        const { GoogleAuth } = await import("google-auth-library");
        const auth = new GoogleAuth({
          scopes: [
            "https://www.googleapis.com/auth/cloud-platform",
            "https://www.googleapis.com/auth/generative-language.retriever",
          ],
        });
        const client = await auth.getClient();

        const raw = await client.getRequestHeaders();

        let headers: Record<string, string>;
        if (typeof (raw as any).entries === "function") {
          headers = Object.fromEntries((raw as any).entries());
        } else {
          headers = raw as unknown as Record<string, string>;
        }

        if (GCP_PROJECT) {
          headers["x-goog-user-project"] = GCP_PROJECT;
        }
        return headers;
      } catch (e) {
        if (!API_KEY) {
          throw new Error(
            "OAuth requested but 'google-auth-library' not installed and GEMINI_API_KEY not set.\n" +
            "Fix: npm i google-auth-library  OR  set GEMINI_API_KEY."
          );
        }
        // fall through to API key
      }
    }

    if (!API_KEY) {
      throw new Error("No auth configured: set GEMINI_API_KEY or configure OAuth (ADC).");
    }
    return { "x-goog-api-key": API_KEY };
  }


  async chat(messages: ChatMsg[], opts?: { temperature?: number }): Promise<string> {
    const url = `${BASE}/${this.model}:generateContent`;
    const body = {
      ...toGemini(messages),
      generationConfig: { temperature: opts?.temperature ?? 0.2 }
    };
    const headers = { "Content-Type": "application/json", ...(await this.authHeaders()) };
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Gemini ${r.status} ${await r.text()}`);
    const data = (await r.json()) as GeminiResponse;
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() ?? "";
  }
}
