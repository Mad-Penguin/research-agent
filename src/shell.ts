// src/shell.ts
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { authStatus } from "./commands/auth.js";
import { createProject, openProjectStrict, projectExists, showProject } from "./commands/project.js";
import { searchAndMaybeAdd } from "./commands/search.js";
import { summarizePaper } from "./commands/paper.js";
import { summarizeProject } from "./commands/projectSummary.js";

import { startSpinner } from "./utils/spinner.js";


type Ctx = { projectName?: string };

function prompt(ctx: Ctx) {
  return ctx.projectName ? `research-agent\\${ctx.projectName}> ` : "research-agent> ";
}

// tiny parser with quoted args + --flags
function parse(line: string) {
  const tokens = Array.from(line.matchAll(/"([^"]+)"|(\S+)/g)).map(m => m[1] ?? m[2]);
  const cmd = (tokens.shift() || "").toLowerCase();
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const t of tokens) {
    if (t.startsWith("--")) {
      const [k, v] = t.slice(2).split("=");
      flags[k] = v === undefined ? true : v;
    } else {
      args.push(t);
    }
  }
  return { cmd, args, flags };
}

export async function startShell() {
  const rl = createInterface({ input, output, historySize: 1000 });
  const ctx: Ctx = {};

  console.log("Welcome to research-agent shell. Type 'help' for commands, 'exit' to quit.");
  while (true) {
    let line = "";
    try { line = (await rl.question(prompt(ctx))).trim(); } catch { break; } // Ctrl+D
    if (!line) continue;

    const { cmd, args, flags } = parse(line);

    try {
      if (cmd === "exit" || cmd === "quit") break;

      if (cmd === "help") {
        console.log(`
        Commands:
        create "Project Name"     Create a project
        open "Project Name"       Open project (prompts to create if missing)
        show                      Show papers in the current project
        search "query" [--limit=20] [--add]
        paper "arxiv:ID"          Summarize one paper in current project
        summary                   Synthesize current project
        coverage "claim" [--topk=8]
                                    Estimate whether the claim follows from the project's papers,
                                    with overall % coverage and per-paper % breakdown
        auth                      Show auth status
        clear                     Clear screen
        help / exit
        Tips:
        - Use quotes for names or queries with spaces.
        - Example: search "permutation flowshop scheduling" --limit=10 --add
        - Example: coverage "RD-path lower bounds improve PFSP by >10%" --topk=8
        `); continue;
    }


      if (cmd === "clear") { console.clear(); continue; }

      if (cmd === "auth") { console.log(authStatus()); continue; }

      // >>> CREATE (new) <<<
      if (cmd === "create") {
        const name = args.join(" ").trim().replace(/^"|"$/g,"");
        if (!name) { console.log('Usage: create "Project Name"'); continue; }
        if (projectExists(name)) { console.log(`Project "${name}" already exists.`); continue; }
        createProject(name);
        console.log(`Created project "${name}".`);
        continue;
      }

      if (cmd === "open") {
        const name = args.join(" ").trim().replace(/^"|"$/g,"");
        if (!name) { console.log('Usage: open "Project Name"'); continue; }
        if (!projectExists(name)) {
          const ans = (await rl.question(`Project "${name}" not found. Create it? [Y/N] `)).trim().toLowerCase();
          if (ans === "y") {
            createProject(name);
            console.log(`Created project "${name}".`);
          } else { console.log(ans, ans === "y"); console.log("Aborted."); continue; }
        }
        const store = openProjectStrict(name);
        ctx.projectName = name;
        console.log(`Opened project "${store.name}". Papers: ${store.papers.length}`);
        continue;
      }

    if (cmd === "coverage") {
      if (!ctx.projectName) { console.log('No project. Use: open "Project Name"'); continue; }
      const claim = args.join(" ").trim().replace(/^"|"$/g,"");
      if (!claim) { console.log('Usage: coverage "claim text" [--topk=8]'); continue; }
      const topk = Number(flags.topk ?? 8);
      const store = openProjectStrict(ctx.projectName);
      const { GeminiLLM } = await import("./core/gemini.js");
      const llm = new GeminiLLM();

      const stop = startSpinner("Analyzing claim against selected papers");
      try {
        const { evaluateCoverage } = await import("./commands/coverage.js");
        const res = await evaluateCoverage(llm, store, claim, topk);
        stop("Analysis complete.");

        console.log(`Overall: ${res.overall.follows ? "FOLLOWS" : "DOES NOT FOLLOW"} | ` +
                    `coverage ${Math.round(res.overall.coverage_percent)}% | conf ${res.overall.confidence.toFixed(2)}`);
        console.log(res.overall.explanation);
        console.log("\nPer-paper coverage:");
        res.per_paper.forEach(p => {
          console.log(`- ${p.title} [${p.id}]`);
          console.log(`  ${p.verdict.toUpperCase()} | ${Math.round(p.coverage_percent)}%`);
          console.log(`  ${p.rationale}`);
        });
      } catch (e: any) {
        stop("Failed.");
        console.error("Error:", e?.message ?? e);
      }
      continue;
    }

      if (!ctx.projectName) {
        console.log('No project. Use: create "Name" or open "Name"');
        continue;
      }

      if (cmd === "show") {
        const store = openProjectStrict(ctx.projectName);
        console.log(showProject(store));
        continue;
      }

      if (cmd === "search") {
        const q = args.join(" ");
        if (!q) { console.log('Usage: search "query" [--limit=20] [--add]'); continue; }
        const store = openProjectStrict(ctx.projectName);
        const limit = Number(flags.limit ?? 20);
        const add = Boolean(flags.add);
        const res = await searchAndMaybeAdd(store, q, limit, add);
        if (add) console.log(`Added ${res.length} paper(s).`);
        res.forEach((r, i) => {
          console.log(`[${i+1}] ${r.id} | ${r.title} (${r.year ?? "n/a"}) — ${r.authors.slice(0,3).join(", ")}`);
        });
        continue;
      }

      if (cmd === "paper") {
        const id = args[0];
        if (!id) { console.log("Usage: paper arxiv:YYYY.NNNNN"); continue; }
        const store = openProjectStrict(ctx.projectName);
        const p = store.find(id);
        if (!p) { console.log("Paper not found in this project."); continue; }
        const { GeminiLLM } = await import("./core/gemini.js");
        const llm = new GeminiLLM();
        console.log(await summarizePaper(llm, p));
        continue;
      }

      if (cmd === "summary") {
        const store = openProjectStrict(ctx.projectName);
        const { GeminiLLM } = await import("./core/gemini.js");
        const llm = new GeminiLLM();
        console.log(await summarizeProject(llm, store));
        continue;
      }

      console.log(`Unknown command: ${cmd}. Type 'help'.`);
    } catch (err: any) {
      console.error("Error:", err?.message ?? err);
    }
  }

  rl.close();
}
