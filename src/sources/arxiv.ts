import fetch from "node-fetch";
import type { Paper } from "../core/store.js";

export async function searchArxiv(q: string, limit = 20): Promise<Paper[]> {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=${limit}`;
  const xml = await (await fetch(url)).text();
  const entries = xml.split("<entry>").slice(1);
  return entries.map(e => {
    const pick = (tag: string) =>
      (e.match(new RegExp(`<${tag}.*?>([\\s\\S]*?)</${tag}>`)) || [])[1]?.trim();
    const idUrl = pick("id") || "";
    const id = "arxiv:" + (idUrl.split("/abs/")[1] || idUrl);
    const title = (pick("title") || "").replace(/\s+/g, " ").trim();
    const summary = (pick("summary") || "").replace(/\s+/g, " ").trim();
    const authors = Array.from(e.matchAll(/<name>(.*?)<\/name>/g)).map(m => m[1]);
    const year = +(pick("published") || "").slice(0, 4) || undefined;
    return {
      id,
      title,
      authors,
      year,
      url: idUrl,
      abstract: summary,
      addedAt: new Date().toISOString()
    } as Paper;
  });
}
