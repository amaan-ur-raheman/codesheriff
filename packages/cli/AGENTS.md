# packages/cli (codesheriff-cli)

## Overview

Interactive terminal UI for browsing repos, PRs, and reviews. Built with Ink (React for terminals) on React 18, with commander for CLI wiring.

## Key files

| File | Owns |
|---|---|
| src/index.ts | Entry point, CLI wiring |
| src/app.tsx | Top level TUI component |
| src/components/ | UI components: repo list, PR list, review layout, progress, landing |
| src/hooks/ | Data hooks: use-api, use-review |
| src/lib/ | api, auth, config, clipboard, fix utilities |
| src/theme.ts | Terminal theme tokens |

## Commands

```bash
# From the repo root
bun cli:build                       # tsc to dist
bun cli:start                       # node dist/index.js
bun --filter codesheriff-cli test   # bun test
bun --filter codesheriff-cli lint
```

## Conventions

- Plain TypeScript with no bundler; tsc emits to dist.
- Talks to the web API using a device token (`ch_...`), stored via conf.
- lib modules are tested with bun test.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
