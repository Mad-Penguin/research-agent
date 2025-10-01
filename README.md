# Research-Agent: Project Proposal 

## Goal
Build an open-source terminal agent that speeds up early-stage literature review and exploration. The final product aims to integrate **multiple literature sources** (e.g., arXiv, Crossref, OpenAlex, publisher APIs, local PDFs) and support **multiple LLM backends** (e.g., Gemini, OpenAI, local/Ollama) for summarization, synthesis, and reasoning—while remaining private, scriptable, and easy to extend.

## Capabilities (Intended Final Product)
- **Project workspace**: create/open/show projects; store curated papers with de-duplication (DOI first; arXiv fallback) and numeric IDs.
- **Search & ingest**: query across sources; rank/merge results; optional add-to-project.
- **Summarize**: concise bullet summaries per paper; **project synthesis** (short literature review).
- **<span style="color:red">[Novelty]</span> Idea Coverage**: given a claim, estimate overall support (%) and per-paper coverage with rationales.
- **Two modes**: scriptable CLI commands and an interactive shell with project-aware prompt.

## Reduced Scope (MVP)
- **Sources**: arXiv only; abstracts only (no PDF parsing yet).
- **Models**: Gemini (cloud) via API key. For fast deploy of prototype and easy non-dowload setup.
- **UX**: terminal CLI + shell (no GUI).
- **Focus**: correctness of basic workflow (create → search → add → summarize → coverage) with clear errors and JSON outputs. 

<video src="Demo/demo.mp4" controls width="720" muted>
  Sorry, your browser doesn't support embedded videos.
  <a href="Demo/demo.mp4">Download the video</a>.
</video>

---

## Features

- **Project management**
  - `project:create`, `project:open`, `project:show`
  - Projects live under `lit/<Project_Name>/papers.json`

- **Search (arXiv)**
  - `search "<query>" --limit N [--add]`
  - DOI-first de-duplication; arXiv versions are collapsed (v2 updates v1)

- **Summaries**
  - `paper:summary` — 6 bullets (problem, method, datasets, results, limits, contribution)
  - `project:summary` — 250–300-word synthesis across top papers

- **Novelty: Idea coverage**
  - `idea:coverage "claim text"` — estimates whether the claim **follows** from your papers, with an **overall coverage %**, **confidence**, and **per-paper %** + rationale

- **Two ways to use**
  - **CLI commands** (scriptable)
  - **Interactive shell** (`research-agent shell`) with project-aware prompt:
    ```
    research-agent\My Project>
    ```

---

## Installation

> Requires **Node 18+**

```bash
npm i -g research-agent-openblock
```

### Authentication (Gemini API key)

Create a key in Google AI Studio, then set:

**Windows (PowerShell):**
```powershell
setx GEMINI_API_KEY "YOUR_KEY"
```


Verify:
```bash
research-agent auth
```

---

## Quick start

```bash

research-agent project:create "PFSP"
research-agent search -p "PFSP" "permutation flowshop scheduling" --limit 8 --add
research-agent project:show -p "PFSP"
research-agent paper:summary -p "PFSP" --id 1
research-agent project:summary -p "PFSP"
research-agent idea:coverage -p "PFSP"   "Geometric lower bounds via RD-path improve PFSP optimality gaps on Taillard instances"
```

Or use the **interactive shell**:

```bash
research-agent shell
# research-agent> create "PFSP"
# research-agent\PFSP> search "permutation flowshop scheduling" --limit=8 --add
# research-agent\PFSP> show
# research-agent\PFSP> paper 1
# research-agent\PFSP> summary
# research-agent\PFSP> coverage "RD-path bounds improve PFSP by >10%"
```


---

## Roadmap

- Crossref/semantic sources & better ranking
- PDF parsing and section-aware summaries
- Local LLM support (Ollama) for offline/private mode
- Export to BibTeX/Markdown/CSV
- Idea coverage over **selected subset** of papers
- Command history & tab-completion in the shell

---

## Difference vs. other projects

- **Gemini CLI**: general-purpose agent; this project is a focused **research workflow** with project storage and idea coverage.
- **PaperQA**: strong Q&A over papers; **research-agent** emphasizes **fast collection**, **compact summaries**, and **claim coverage** from abstracts with a clean terminal UX.

