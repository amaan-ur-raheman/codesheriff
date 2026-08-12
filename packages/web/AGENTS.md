# packages/web (code-sheriff)

## Overview

The web application for CodeSheriff. A Next.js 16 App Router app that ingests GitHub webhooks, runs the Inngest review pipeline with RAG retrieval and sandbox verification, and hosts the dashboard, billing, and integrations UI.

## Key files

| File | Owns |
|---|---|
| app/ | App Router routes: dashboard pages, API routes (auth, webhooks, reviews, repos), landing |
| modules/ | Domain modules: review, ai, github, vcs, payment, auth, organization, settings, and more |
| inngest/functions/ | Review and indexing pipeline functions |
| prisma/schema.prisma | Database schema (PostgreSQL) |
| lib/db.ts, lib/auth.ts, lib/pinecone.ts | Shared database, auth, and vector index access |
| __tests__/ | Vitest tests (jsdom), mirroring modules and lib |

## Commands

```bash
# From the repo root
bun web:dev                      # next dev
bun web:build                    # next build
bun --filter code-sheriff test   # vitest run
bun --filter code-sheriff lint
bun --filter code-sheriff typecheck
```

## Conventions

- Domain logic lives in `modules/<area>/` with actions, components, lib, and types subfolders.
- The review pipeline decomposes into typed steps: webhook to diff to RAG to AI to sandbox verification to write back (see CONTEXT.md and `docs/specs/web/`).
- The Prisma schema is the single source for the database shape; run `prisma generate` after schema edits (postinstall does it).
- The `@` import alias resolves to the package root (tsconfig and vitest both configured).
- Tests live in `__tests__/` and use testing library style queries with jsdom.

## Gotchas

- Webhook events are signed with `GITHUB_WEBHOOK_SECRET`; if keys rotate, resecure with `bun webhook:resecure`.
- Sandbox verification runs in E2B with an exec fallback; `SANDBOX_MODE` controls it.
- Billing runs through Polar; org seats (Spec 0003) depend on Polar product IDs from env.
- Design tokens come from DESIGN.md (Editorial Paper, ADR-0001); the design doc job in CI enforces the contract.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
