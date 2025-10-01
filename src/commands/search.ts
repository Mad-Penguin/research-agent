import { ProjectStore } from "../core/store.js";
import type { Paper } from "../core/store.js";
import { searchArxiv } from "../sources/arxiv.js";

export async function searchAndMaybeAdd(
  store: ProjectStore,
  topic: string,
  limit = 20,
  add = false
) {
  const results = await searchArxiv(topic, limit);
  if (add) results.forEach((p: Paper) => store.upsert(p));
  return results;
}
