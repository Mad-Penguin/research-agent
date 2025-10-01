import type { LLM } from "../core/llm.js";
import { ProjectStore, type Paper } from "../core/store.js";

/** crude relevance: shared word count between claim and (title + abstract) */
function relevanceScore(claim: string, p: Paper): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const q = new Set(norm(claim));
  const txt = norm(`${p.title} ${p.abstract ?? ""}`);
  let score = 0;
  for (const w of txt) if (q.has(w)) score++;
  // tiny boost for year recency and exact phrase in title
  if (p.title.toLowerCase().includes(claim.toLowerCase().slice(0, 30))) score += 5;
  if (p.year) score += Math.max(0, Math.min(5, p.year - 2015)); // +0..+5
  return score;
}

function topKByRelevance(store: ProjectStore, claim: string, k: number): Paper[] {
  return [...store.papers]
    .map(p => ({ p, s: relevanceScore(claim, p) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(x => x.p);
}

type CoverageResult = {
  overall: {
    follows: boolean;
    coverage_percent: number;   // 0–100
    confidence: number;         // 0–1
    explanation: string;
  };
  per_paper: Array<{
    id: string;
    title: string;
    coverage_percent: number;   // 0–100
    verdict: "supports" | "partial" | "contradicts" | "irrelevant";
    rationale: string;
  }>;
};

function toModelInput(p: Paper) {
  // keep prompts small; abstracts can be long
  const abstract = (p.abstract ?? "").slice(0, 1200);
  return {
    id: p.id,
    title: p.title,
    year: p.year ?? "n/a",
    authors: p.authors.slice(0, 5).join(", "),
    abstract
  };
}

function safeParseJSON(text: string): CoverageResult | null {
  // try direct parse
  try { return JSON.parse(text) as CoverageResult; } catch {}
  const m = text.match(/```json([\s\S]*?)```/i) || text.match(/({[\s\S]*})/);
  if (m) {
    try { return JSON.parse(m[1]) as CoverageResult; } catch {}
  }
  return null;
}

export async function evaluateCoverage(
  llm: LLM,
  store: ProjectStore,
  claim: string,
  topK = 8
): Promise<CoverageResult> {
  const papers = topKByRelevance(store, claim, topK);
  if (papers.length === 0) {
    return {
      overall: {
        follows: false,
        coverage_percent: 0,
        confidence: 0.2,
        explanation: "No papers in project."
      },
      per_paper: []
    };
  }

  const items = papers.map(toModelInput);

  const system = `You are a careful scientific reviewer. Be faithful to the provided paper metadata.
Rate how much the claim is supported by the listed papers. Do not invent sources.`;

  const user = `Claim:
${claim}

Papers (metadata only):
${items.map((it,i)=>`[${i+1}] ${it.title} (${it.year}) by ${it.authors}
ID: ${it.id}
Abstract: ${it.abstract}`).join("\n\n")}

Task:
1) For each paper, rate coverage_percent (0-100): how much this paper supports/substantiates the claim. Add a short rationale and a verdict in {"supports","partial","contradicts","irrelevant"}.
2) Give an overall judgment: does the claim "follow" from the joint evidence? Provide coverage_percent (0-100), a confidence (0-1), and a brief explanation grounded in the above.

Output STRICT JSON ONLY, no prose, matching this schema:

{
  "overall": {
    "follows": boolean,
    "coverage_percent": number,
    "confidence": number,
    "explanation": string
  },
  "per_paper": [
    {
      "id": string,
      "title": string,
      "coverage_percent": number,
      "verdict": "supports" | "partial" | "contradicts" | "irrelevant",
      "rationale": string
    }
  ]
}

Use the given paper "id" and "title" in each item.`;

  const raw = await llm.chat(
    [{ role: "system", content: system }, { role: "user", content: user }],
    { temperature: 0.2 }
  );

  const parsed = safeParseJSON(raw);
  if (parsed) return parsed;

  return {
    overall: {
      follows: false,
      coverage_percent: 0,
      confidence: 0.2,
      explanation: "Model returned non-JSON output; unable to score."
    },
    per_paper: items.map(it => ({
      id: it.id,
      title: it.title,
      coverage_percent: 0,
      verdict: "irrelevant",
      rationale: "No JSON result."
    }))
  };
}
