# Research Findings: E2B Network-Egress Disable (Spec 0001 AC-1)

**Ticket**: Research: Confirm E2B network-egress-disable knob (AC-1)
**Date**: 2026-08-07
**Repo**: `amaan-ur-raheman/codesheriff`
**Scope**: Informs whether the shipped E2B sandbox path satisfies Spec 0001 AC-1 (no network egress per verify) and what must change.

---

## TL;DR / Headline answer

The E2B JS SDK (v2.x, package `e2b`) **does** expose a first-class network-egress knob on `Sandbox.create()`: `allowInternetAccess: false` disables all outbound traffic, and a finer-grained `network: { allowOut, denyOut }` rule object supports allow/deny lists by domain/IP/CIDR. **However, the current `e2b-runner.ts` sets NO network policy — `Sandbox.create()` is called with only `timeoutMs` + `metadata`, so sandboxes today have full internet access (the SDK default). AC-1 is currently NOT satisfied by the shipped code.**

## 1. Exact API (from E2B docs / SDK reference)

Simple on/off:

```ts
import { Sandbox } from "e2b";

// No network egress at all
const sandbox = await Sandbox.create({ allowInternetAccess: false });
```

Fine-grained allow/deny:

```ts
const sandbox = await Sandbox.create({
  network: {
    allowOut: ["*.github.com", "registry.npmjs.org", "*.npmjs.org"],
    denyOut: ({ allTraffic }) => [allTraffic], // allTraffic === "0.0.0.0/0"
  },
});
```

- Network rules are applied at **sandbox runtime instantiation** via `Sandbox.create()` options (or updated dynamically via `sandbox.updateNetwork(...)`), not baked into the template.
- Domain rules inspect HTTP Host headers (port 80) and TLS SNI (port 443); CIDR/IP rules work at the network layer.

## 2. Whole-sandbox vs selective

- **Whole sandbox**: `allowInternetAccess: false` (or `denyOut` on `0.0.0.0/0`) blocks ALL outbound egress.
- **Selective**: allow/deny lists (domains, IPs, CIDRs) — e.g. allow only `github.com` and the npm registry, deny everything else.

## 3. Impact on the clone → install → test flow

- **With egress fully disabled**: `git clone` from GitHub **fails** (needs outbound TCP to `github.com`) and `npm install` **fails** (needs the npm registry). So "disable everything" breaks the current flow.
- **Workable options**:
  - **Selective egress**: allow `*.github.com` + npm registry, deny the rest. Still lets a malicious test script exfiltrate to those hosts (weakens AC-1 but is a strict improvement).
  - **Bake deps into a template**: run `git clone` + `npm install` at template build time (build has internet), then spawn sandboxes with `allowInternetAccess: false` — code and `node_modules` are already present at runtime, so tests run fully offline. This is the only way to satisfy AC-1 *as written* (no egress during the verify run). Trade-off: a per-repo or per-language template lifecycle, and stale-dependency risk between template builds.
  - **Hybrid**: keep the current clone-at-runtime flow but with selective allow-list (github + registry) — pragmatic middle ground, documents that AC-1 is "no egress except clone/install hosts".

## 4. Credential-helper clone with no egress

The credential-helper mechanism (token in a 0700 helper file, never in the URL) is orthogonal to network policy — it authenticates the clone when network is allowed. With `allowInternetAccess: false` + template-baked repo, no clone happens at runtime at all, so the helper is unnecessary there; with selective egress the helper works as today.

## 5. What the shipped code does today

`e2b-runner.ts`:

```ts
sandbox = await Sandbox.create({
  timeoutMs: config.timeoutMs,
  metadata: { app: "codesheriff", owner, repo, maxMemoryMB: ... },
});
```

- **No `allowInternetAccess`, no `network` option** → sandbox gets default full internet access. **AC-1 is not met today.**
- The runner clones at runtime, installs at runtime (`npm install`/`bun install`), runs tests per suggestion, kills the sandbox in `finally`. Full egress is currently relied upon for all three.

## 6. What must change to satisfy AC-1

1. **Decide the isolation posture** (grilling/execution): template-baked (true no-egress) vs selective allow-list (clone/install hosts only) vs accept current behavior with documented gap.
2. **If template-baked**: create an E2B template that pre-clones/pre-installs; change `Sandbox.create({ allowInternetAccess: false })`; the per-review repo varies (PR branch) — so the template would need to be per-repo or clone-then-disable via `updateNetwork` after clone+install completes.
3. **If selective**: `Sandbox.create({ network: { allowOut: ["*.github.com", "registry.npmjs.org", "*.npmjs.org", "api.github.com"], denyOut: ({ allTraffic }) => [allTraffic] } })`.
4. **If `updateNetwork` is used**: after the install step completes, flip the sandbox to `allowInternetAccess: false` before running tests — tests run offline, clone/install had network. This matches the spec's "verify runs with no network egress" most closely while keeping the current architecture. Confirm `updateNetwork` semantics in the SDK before relying on it.

## Open questions

- Exact `updateNetwork(...)` API shape (options + whether it can downgrade egress post-create) — verify against the SDK reference.
- Whether domain allow-lists cover all GitHub clone hosts (`codeload.github.com` for tarballs, `github.com` for git smart HTTP) — include both in any allow-list.
- Whether npm install needs `registry.npmjs.org` + `*.npmjs.org` only, or also `objects.githubusercontent.com` (for some tarballs) — audit during implementation.

## Sources

- E2B docs: `e2b.dev/docs/network/internet-access` (egress control), `e2b.dev/docs/network/ip-tunneling` (proxy/tunnel), `e2b.dev/docs/sdk-reference/js-sdk/v2.25.0/sandbox` (SDK reference).
- Repo: `packages/web/modules/ai/lib/sandbox/e2b-runner.ts`, `config.ts`.
- Prior art: `research-findings-deploy-target-isolation.md` (flagged the network-docs 404; now resolved with the correct URLs above).
