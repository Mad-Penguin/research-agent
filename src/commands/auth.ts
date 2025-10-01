// src/commands/auth.ts
function wantsOAuth(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.CLOUDSDK_CONFIG ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT
  );
}

function redact(s: string, keep = 4) {
  if (!s) return "";
  return s.length <= keep ? "****" : `${"*".repeat(Math.max(0, s.length - keep))}${s.slice(-keep)}`;
}

export function authStatus(): string {
  const usingOAuth = wantsOAuth();
  const key = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "models/gemini-2.5-pro";
  const proj = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_PROJECT_ID || "";

  const lines = [
    "Auth status:",
    `  Engine: Gemini REST`,
    `  Model: ${model}`,
    `  Method: ${usingOAuth ? "OAuth (gcloud ADC)" : (key ? "API Key" : "None detected")}`,
  ];

  if (key) lines.push(`  GEMINI_API_KEY: ${redact(key)}`);
  if (proj) lines.push(`  GOOGLE_CLOUD_PROJECT: ${proj}`);

  if (!usingOAuth && !key) {
    lines.push("");
    lines.push("No credentials detected.");
  }
  return lines.join("\n");
}

export function authGuide(): string {
  return `
Setup options:

[Option A] API Key (fastest)
  1) Create a key in Google AI Studio
  2) Set environment variables:
     - Windows (PowerShell):
         setx GEMINI_API_KEY "YOUR_KEY"
         setx GEMINI_MODEL "models/gemini-2.5-pro"
         # open a NEW terminal
     - macOS/Linux:
         export GEMINI_API_KEY="YOUR_KEY"
         export GEMINI_MODEL="models/gemini-2.5-pro"

[Option B] Login with Google (OAuth/ADC via gcloud)
  1) Enable "Google Generative Language API" in your GCP project
  2) Login and create Application Default Credentials:
         gcloud auth application-default login
  3) Set your project id (used as x-goog-user-project):
     - Windows (PowerShell):
         setx GOOGLE_CLOUD_PROJECT "your-project-id"
         # open a NEW terminal
     - macOS/Linux:
         export GOOGLE_CLOUD_PROJECT="your-project-id"

Notes:
  • The CLI prefers OAuth if ADC is detected; otherwise it uses GEMINI_API_KEY.
  • Never commit keys; use env vars or a local .env (gitignored).
`.trim();
}
