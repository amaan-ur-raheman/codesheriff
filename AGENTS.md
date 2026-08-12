# CodeSheriff

AI-powered automated code review platform. Monorepo with two packages:

- `packages/web` — Next.js 16 (App Router) web app: GitHub webhook ingestion, Inngest review pipeline, RAG (Pinecone), sandboxed suggestion verification, Polar billing, Slack/Discord integrations.
- `packages/cli` — interactive terminal TUI (Ink) for browsing repos, PRs, and reviews.

## Stack

- **Language / Runtime**: TypeScript, Node 20; Bun as package manager and task runner
- **Framework**: Next.js 16 (App Router) with React 19; the CLI uses Ink (React for terminals)
- **Key dependencies**: Prisma + PostgreSQL, Inngest, Pinecone, AI SDK, better-auth, Polar, E2B
- **Package manager**: Bun (single bun.lock at the repo root)

## Build approach

<TBD, set by /scope>

## Commands

```bash
# Install
bun install

# Dev: web only
bun web:dev

# Dev: web + inngest + ngrok together
bun web:dev:all

# Build
bun web:build    # packages/web
bun cli:build    # packages/cli

# Test
bun test                        # web (vitest)
bun --filter codesheriff-cli test

# Lint / typecheck
bun lint
bun typecheck
```

## Specs

Stored in `docs/specs/web/`. Format: `docs/specs/web/NNNN-title.md`.

## Rules

- Domain logic lives in `packages/web/modules/<area>/` (review, ai, github, vcs, payment, auth, organization, and more), each with its own actions, components, lib, and types as needed.
- The review pipeline is Inngest driven: webhook to diff to RAG retrieval to AI generation to sandbox verification to write back. Functions live in `packages/web/inngest/functions/`.
- Use domain terms from `CONTEXT.md` exactly (Review, Suggestion, Repository, Organization, pipeline stages). Do not drift to synonyms.
- Web tests run with Vitest in jsdom; test files live in `__tests__/**/*.test.ts(x)`. The `@` alias points at the package root.
- The Prisma schema lives at `packages/web/prisma/schema.prisma`; `prisma generate` runs on install.
- ADRs live in `docs/adr/`; the design direction (Editorial Paper) is locked in ADR-0001 and DESIGN.md.
- Env shape is documented in `.env.example`; the full app needs PostgreSQL, Pinecone, GitHub OAuth, and Polar keys.

## Agent skills

### Issue tracker

Issues and specs are tracked as GitHub issues on `amaan-ur-raheman/codesheriff` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map 1:1 to labels of the same name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root plus ADRs in `docs/adr/`. See `docs/agents/domain.md`.

## Context files

- [packages/web/AGENTS.md](packages/web/AGENTS.md): Next.js web app, review pipeline, database, tests
- [packages/cli/AGENTS.md](packages/cli/AGENTS.md): Ink terminal UI for browsing repos, PRs, and reviews

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
