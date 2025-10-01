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
    fs.mkdirSync(this.baseDir, { recursive: true });
    if (fs.existsSync(this.metaPath)) {
      this.papers = JSON.parse(fs.readFileSync(this.metaPath, "utf8"));
    }
  }

  save() { fs.writeFileSync(this.metaPath, JSON.stringify(this.papers, null, 2)); }

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
