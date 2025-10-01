import fs from "fs";
import path from "path";

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  url?: string;
  abstract?: string;
  addedAt: string;
};

export class ProjectStore {
  baseDir: string;
  metaPath: string;
  papers: Paper[] = [];

  constructor(public name: string) {
    const safe = name.replace(/[^\w.-]/g, "_");
    this.baseDir = path.resolve("lit", safe);
    this.metaPath = path.join(this.baseDir, "papers.json");
    if (fs.existsSync(this.metaPath)) {
      this.papers = JSON.parse(fs.readFileSync(this.metaPath, "utf8"));
    }
  }

  save() {
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.writeFileSync(this.metaPath, JSON.stringify(this.papers, null, 2));
  }

  upsert(p: Paper) {
    const i = this.papers.findIndex(x => x.id === p.id);
    if (i >= 0) this.papers[i] = { ...this.papers[i], ...p };
    else this.papers.push(p);
    this.save();
  }

  find(id: string) {
    return this.papers.find(p => p.id === id) || null;
  }
}


function safeBaseDir(name: string) {
  const safe = name.replace(/[^\w.-]/g, "_");
  return path.resolve("lit", safe);
}
export function projectExists(name: string) {
  const base = safeBaseDir(name);
  return fs.existsSync(path.join(base, "papers.json"));
}


export function createProject(name: string, opts: { overwrite?: boolean } = {}) {
  const store = new ProjectStore(name);
  const exists = projectExists(name);
  if (exists && !opts.overwrite) {
    throw new Error(`Project "${name}" already exists.`);
  }
  // ensure folder + empty metadata (preserve if overwrite true and file exists)
  if (!exists || opts.overwrite) {
    store.papers = store.papers || [];
    store.save();
  }
  return store;
}


export function openProjectStrict(name: string) {
  if (!projectExists(name)) {
    throw new Error(`Project "${name}" not found.`);
  }
  return new ProjectStore(name);
}

export function showProject(store: ProjectStore) {
  if (!store.papers.length) return `Project "${store.name}" — no papers yet.`;
  const rows = store.papers
    .map(p => `- ${p.id} | ${p.title} (${p.year ?? "n/a"}) — ${p.authors.slice(0,3).join(", ")}`);
  return `Project "${store.name}"\nPapers: ${store.papers.length}\n\n${rows.join("\n")}`;
}
