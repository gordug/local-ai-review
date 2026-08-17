# RevFlow Local — Local-First AI Code Review & GitHub Intelligence Platform

RevFlow Local is an ultra-private, local-first code review and repository intelligence web application that connects directly to GitHub to provide automated, multi-vector AI reviews for Pull Requests, merge conflict & branch comparison intelligence, and issue expansion/summaries.

It features zero cloud data storage, direct Bring-Your-Own-Model (BYOM) support for local engines (Ollama, LM Studio) and cloud APIs (Google Gemini, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter), plus an offline $0-compute deterministic static AST analysis engine and a context-aware interactive conversational assistant.

---

## Key Features

- **Dual-Mode GitHub Integration**:
  - OAuth App redirect sign-in & Device Flow support.
  - Personal Access Token (PAT) fallback with live permission & rate-limit validation.
  - Public repository direct explorer mode (no login required for public open-source repos).
- **Pull Request Deep Code Reviews**:
  - High-precision Unified and Split (Side-by-Side) Diff Viewer with line numbers and file trees.
  - Multi-category AI audits: Security vulnerabilities (OWASP/CWE, SQLi, XSS, Secret Leaks), Performance & Concurrency, Bug Risks & Code Smells, Missing Error Handling.
  - Inline line-by-line review comments with one-click copy.
  - Risk Score Gauge (Low / Medium / High / Critical) and Merge Readiness percentage.
  - Recommended unit/integration test cases with copyable test plans.
  - Ready-to-apply diff patch generation.
  - One-click export to formatted Markdown report or patch file.
- **Branch Merge Comparator & Breaking Change Analyzer**:
  - Compare any two branches (`Base` vs `Compare`) to inspect ahead/behind metrics, commit logs, and cumulative diffs.
  - Conflict hotspot prediction and breaking API/schema change detection.
  - Merge safety score and recommended rebase/validation workflow.
- **Issue Triage & Technical PRD Spec Generator**:
  - Auto-expand vague bug reports or feature requests into comprehensive technical specifications.
  - Generates root-cause hypotheses, affected modules, suspected source files, interactive implementation task checklists, and acceptance criteria.
- **Universal BYOM (Bring Your Own Model) Engine**:
  - **Local AI (100% Private, Zero Cloud)**: Connects to localhost **Ollama** (`http://127.0.0.1:11434`) with automatic model discovery (`/api/tags`), **LM Studio** (`http://127.0.0.1:1234/v1`), and custom endpoints.
  - **Direct Cloud APIs (BYOK)**: Browser-to-provider calls with zero intermediate proxy servers for **Google Gemini** (Gemini 2.5 Flash / Pro), **OpenAI** (GPT-4o, GPT-4o-mini), **Anthropic Claude** (Claude 3.5 / 3.7 Sonnet), **Groq** (Llama 3.3 70B, Qwen 2.5 Coder 32B), **DeepSeek** (DeepSeek-V3 / R1), and **OpenRouter**.
  - **$0 Compute Deterministic Static AST Engine**: Built-in regex and AST static analysis engine that checks for hardcoded credentials, debug leftovers, injection hazards, and code smells without requiring an active AI model or internet connection.
- **Context-Aware Conversational Assistant**:
  - Multi-turn interactive chat drawer continuously synchronized with the active PR diff, branch comparison, or issue context.
  - Quick action prompt chips: *"Audit Security"*, *"Write Unit Tests"*, *"Find Edge Cases"*, *"Explain Diff"*, *"Draft PR Review Comment"*, *"Generate Commit Message"*.
  - Full conversation transcript export and copy buttons.
- **Zero-Cloud Local-First Privacy**:
  - All tokens, review history, saved prompts, repo rules, and chat histories are stored strictly inside the browser's `IndexedDB`.
  - Full JSON backup export and restore.
  - Complete data wipe capability.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open your browser to `http://localhost:5173`.

### 3. Build for Production
```bash
npm run build
npm run preview
```

---

## Architecture

```
src/
├── components/
│   ├── layout/       # Header, Sidebar, Navigation
│   ├── pr/           # PRListView, PRDetailView, DiffViewer, AIReviewReportView
│   ├── branch/       # BranchCompareView (ahead/behind, merge readiness, diffs)
│   ├── issues/       # IssueExpansionView (triage, PRD specs, task checklists)
│   ├── chat/         # ChatDrawer (interactive multi-turn assistant)
│   ├── settings/     # SettingsModal (GitHub auth, BYOM configs, privacy)
│   ├── saved/        # SavedReviewsView (offline cached audits)
│   ├── rules/        # RepoRulesView (system prompts & coding guidelines)
│   └── common/       # RiskGauge, Icons, Badges
├── services/
│   ├── github/       # githubAuth, githubClient, diffParser
│   ├── ai/           # aiRouter, prompts, providers (ollama, lmStudio, gemini, openai, anthropic, deterministic)
│   └── storage/      # localDb (IndexedDB storage & backup manager)
└── types/            # github, ai, storage TypeScript contracts
```

---

## License

MIT © [gordug](https://github.com/gordug)
