import type { LLM } from "../core/llm.js";
import { ProjectStore } from "../core/store.js";
import { summarizePaper } from "./paper.js";

const SYS = `You are an expert reviewer. Produce a faithful, well-structured synthesis. Cite papers by [#].`;

export async function summarizeProject(llm: LLM, store: ProjectStore, maxPapers = 10) {
  if (!store.papers.length) return "No papers in project.";

  const subset = store.papers.slice(0, maxPapers);
  const bullets = await Promise.all(subset.map(p => summarizePaper(llm, p)));

  const numbered = subset
    .map((p, i) => `[${i + 1}] ${p.title}\n${bullets[i]}`)
    .join("\n\n");

  const user = `Using ONLY the bullet summaries below, synthesize a 250-300 word literature review.
Include: (1) consensus, (2) disagreements, (3) gaps/opportunities, (4) concrete next steps.
Refer to specific papers by [#].

Summaries:
${numbered}`;

  const out = await llm.chat(
    [{ role: "system", content: SYS }, { role: "user", content: user }],
    { temperature: 0.2 }
  );
  return out.trim();
}
