# CodeSheriff

AI-powered automated code review platform. Monorepo with two packages:

- `packages/web` — Next.js 16 (App Router) web app: GitHub webhook ingestion, Inngest review pipeline, RAG (Pinecone), sandboxed suggestion verification, Polar billing, Slack/Discord integrations.
- `packages/cli` — interactive terminal TUI (Ink) for browsing repos, PRs, and reviews.

## Agent skills

### Issue tracker

Issues and specs are tracked as GitHub issues on `amaan-ur-raheman/codesheriff` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map 1:1 to labels of the same name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root plus ADRs in `docs/adr/`. See `docs/agents/domain.md`.
