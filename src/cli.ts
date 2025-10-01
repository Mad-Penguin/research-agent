#!/usr/bin/env node
import { Command } from "commander";
import { createProject, openProjectStrict, projectExists, showProject } from "./commands/project.js";
import { searchAndMaybeAdd } from "./commands/search.js";
import { summarizePaper } from "./commands/paper.js";
import { summarizeProject } from "./commands/projectSummary.js";
import { GeminiLLM } from "./core/gemini.js";
import { authStatus, authGuide } from "./commands/auth.js";
import { startShell } from "./shell.js";
import { evaluateCoverage } from "./commands/coverage.js";
import { startSpinner } from "./utils/spinner.js";


const program = new Command();
program
  .name("research-agent")
  .description("Research helper (Lite = Gemini cloud; no downloads required)")
  .version("0.1.0");

function out(obj: any, asJson?: boolean) {
  if (asJson) console.log(JSON.stringify(obj, null, 2));
  else if (typeof obj === "string") console.log(obj);
  else console.log(obj);
}

program.command("shell")
  .description("Start interactive shell")
  .action(async () => { await startShell(); });

/** NEW: create */
program.command("project:create")
  .argument("<name>", "project name")
  .option("--overwrite", "overwrite if exists", false)
  .option("--json", "machine-readable output")
  .description("Create a new project")
  .action((name, opts) => {
    try {
      const store = createProject(name, { overwrite: Boolean(opts.overwrite) });
      out({ project: store.name, path: store.baseDir, created: true }, opts.json);
    } catch (e: any) {
      console.error(e.message);
      process.exit(1);
    }
  });

/** NEW: open (no auto-create; suggests creation) */
program.command("project:open")
  .argument("<name>", "project name")
  .option("--json", "machine-readable output")
  .description("Open an existing project (suggest creation if missing)")
  .action(async (name, opts) => {
    if (!projectExists(name)) {
      // simple prompt without extra deps
      const prompt = process.stdin.isTTY ? "Project not found. Create it now? [Y/N] " : "";
      if (!prompt) {
        console.error(`Project "${name}" not found. Run: research-agent project:create "${name}"`);
        process.exit(1);
      }
      process.stdout.write(prompt);
      const answer = await new Promise<string>(res => {
        process.stdin.once("data", d => res(String(d).trim().toLowerCase()));
      });
      if (answer === "y") {
        const store = createProject(name);
        out({ project: store.name, path: store.baseDir, created: true }, opts.json);
        return;
      }
      console.error(`Aborted. To create: research-agent project:create "${name}"`);
      process.exit(1);
    }
    const store = openProjectStrict(name);
    out({ project: store.name, path: store.baseDir, opened: true }, opts.json);
  });

/** (Optional) keep the old 'project' as an alias to create */
program.command("project")
  .argument("<name>", "project name")
  .option("--json", "machine-readable output")
  .description("(alias) Create project (use 'project:create' going forward)")
  .action((name, opts) => {
    try {
      const store = createProject(name);
      out({ project: store.name, path: store.baseDir, created: true, alias: true }, opts.json);
    } catch (e: any) {
      console.error(e.message);
      process.exit(1);
    }
  });

program.command("project:show")
  .requiredOption("-p, --project <name>", "project")
  .option("--json", "JSON output")
  .action((opts) => {
    const store = openProjectStrict(opts.project);
    out(showProject(store), opts.json);
  });

program.command("search")
  .requiredOption("-p, --project <name>", "project")
  .argument("<query>", "topic to search")
  .option("--limit <n>", "max results", "20")
  .option("--add", "add found papers to project", false)
  .option("--dry-run", "simulate add without writing", false)
  .option("--json", "JSON output", false)
  .action(async (query, opts) => {
    const store = openProjectStrict(opts.project);
    const res = await searchAndMaybeAdd(store, query, +opts.limit, opts.add && !opts["dryRun"]);
    const simple = res.map(r => ({ id:r.id, title:r.title, year:r.year, authors:r.authors.slice(0,3) }));
    if (opts["dryRun"] && opts.add) simple.unshift({ note: "Dry run: would add these papers" } as any);
    out(simple, opts.json);
  });

program.command("paper:summary")
  .requiredOption("-p, --project <name>", "project")
  .requiredOption("--id <paperId>", "paper id (arxiv:YYYY.NNNNN)")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const store = openProjectStrict(opts.project);
    const p = store.find(opts.id);
    if (!p) { console.error("Paper not found in project."); process.exit(1); }
    const llm = new GeminiLLM();
    const s = await summarizePaper(llm, p);
    out({ id: p.id, summary: s }, opts.json);
  });

program.command("project:summary")
  .requiredOption("-p, --project <name>", "project")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const store = openProjectStrict(opts.project);
    const llm = new GeminiLLM();
    const s = await summarizeProject(llm, store);
    out(s, opts.json);
  });

program.command("auth")
  .description("Show authentication status and setup instructions")
  .option("--guide", "print setup instructions")
  .action((opts) => {
    if (opts.guide) console.log(authGuide());
    else {
      console.log(authStatus());
      console.log("\nTip: run `research-agent auth --guide` for setup steps.");
    }
  });

program.command("idea:coverage")
  .requiredOption("-p, --project <name>", "project")
  .argument("<claim>", "claim/result/idea to evaluate")
  .option("--topk <n>", "papers to consider", "8")
  .option("--json", "JSON output", false)
  .description("Estimate whether the claim follows from project papers; report overall and per-paper coverage (%)")
  .action(async (claim, opts) => {
    const store = openProjectStrict(opts.project);
    const llm = new GeminiLLM();

    // --- spinner start ---
    const stop = startSpinner("Analyzing claim against selected papers");
    // ---------------------

    let res;
    try {
      res = await evaluateCoverage(llm, store, claim, Number(opts.topk || 8));
    } finally {
      // --- spinner stop (always) ---
      stop("Analysis complete.");
      // -----------------------------
    }

    if (opts.json) {
      console.log(JSON.stringify(res, null, 2));
      return;
    }

    console.log(`Overall: ${res.overall.follows ? "FOLLOWS" : "DOES NOT FOLLOW"} ` +
      `| coverage ${Math.round(res.overall.coverage_percent)}% | confidence ${res.overall.confidence.toFixed(2)}`);
    console.log(res.overall.explanation);
    console.log("\nPer-paper coverage:");
    for (const pp of res.per_paper) {
      console.log(`- ${pp.title} [${pp.id}]`);
      console.log(`  ${pp.verdict.toUpperCase()} | ${Math.round(pp.coverage_percent)}%`);
      console.log(`  ${pp.rationale}`);
    }
  });


program.parseAsync(process.argv);