import type { LLM } from "../core/llm.js";
import type { Paper } from "../core/store.js";

const SYS = `You are a concise academic assistant. Be faithful to the input text. No speculation.`;

export async function summarizePaper(llm: LLM, p: Paper) {
  const user = `Summarize this paper in 6 short bullets (<=20 words each).
Include: problem, method/idea, domain/datasets, key results, limitations, and contribution.
If abstract is missing, say "No abstract available".

Title: ${p.title}
Authors: ${p.authors.join(", ")}
Year: ${p.year ?? "n/a"}
Abstract: ${p.abstract ?? "(no abstract)"}`
  ;
  const out = await llm.chat(
    [{ role: "system", content: SYS }, { role: "user", content: user }],
    { temperature: 0.2 }
  );
  return out.trim();
}
