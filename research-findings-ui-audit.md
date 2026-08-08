# UI Audit — CodeSheriff (web + CLI) against the installed design skills

**Wayfinder ticket:** [Research: Audit the whole UI against the installed design skills](https://github.com/amaan-ur-raheman/codesheriff/issues/74)
**Map:** [Map: Agency-Grade UI Redesign — Brand Pass, Design System, All Surfaces + CLI](https://github.com/amaan-ur-raheman/codesheriff/issues/73)
**Date:** 2026-08-08 · **Method:** evidence-based read-through + pattern scans + computed WCAG contrast, measured against the `impeccable` skill's rules and `improve-ui`'s evidence-first method.

---

## 1. Surface inventory

| # | Surface | Files |
|---|---------|-------|
| 1 | Landing + marketing | `modules/landing/components/*` (navbar, hero-section, features-section, how-it-works, pricing-section, cta-section, footer) |
| 2 | Auth / login | `modules/auth/components/login-ui.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/layout.tsx` |
| 3 | Dashboard shell | `app/dashboard/layout.tsx`, `components/app-sidebar.tsx`, `components/ui/sidebar.tsx`, command palette, notification bell, review-status-tracker |
| 4 | Dashboard | `modules/dashboard/components/*` (stat cards, health-score-card, contribution-graph, bar chart) |
| 5 | Repository | `modules/repository/components/*` |
| 6 | Reviews | `modules/review/components/*` (reviews-page-client, inline-suggestions, review-flow-canvas, review-feedback, verify-status-badge, review-status-tracker) |
| 7 | Integrations | `modules/integrations/components/*`, `modules/vcs/components/vcs-provider-selector.tsx` |
| 8 | Organizations / Teams | `modules/organization/components/*` |
| 9 | Subscriptions | `modules/payment/components/subscription-page-client.tsx` |
| 10 | Settings | `modules/settings/components/*` |
| 11 | Admin | `modules/admin/components/admin-page-client.tsx` |
| 12 | Device verification | `app/device/page.tsx` |
| 13 | CLI TUI | `packages/cli/src/components/*` (landing, repo-list, pr-list, review-layout, review-progress) + `lib/auth.ts` (chalk) |

**Stack:** Next.js 16 App Router · React 19 · Tailwind v4 (CSS-first tokens in `app/globals.css`) · shadcn/ui (new-york, neutral base) · `motion` · recharts · @xyflow/react · react-activity-calendar · streamdown · Ink (CLI).

---

## 2. Token & typography audit

### 2.1 The single biggest finding: the palette is the 2026 AI default
- Light `--background: #fafaf9` (warm stone, L≈0.96) with `--primary: #7c5e4a` (copper/brown) — `app/globals.css:4,10`.
- Dark `--primary: #e8a87c` (peach) — `app/globals.css:65`.
- `impeccable` flags this explicitly: *"The cream / sand / beige body bg is the saturated AI default of 2026… token names like `--paper`, `--cream`, `--sand` are tells."* A warm-neutral body + brown/copper accent is the textbook reflex pairing for "warm, traditional, AI-built" products. This is the root cause of the template feel — it is the second-order reflex (an "AI workflow tool that's not SaaS-cream" should not land on warm-copper).

### 2.2 Font wiring gap — the intended typeface never renders
- `app/layout.tsx:20-28` loads Geist + Geist_Mono into `--font-geist-sans` / `--font-geist-mono` and applies them to `<body>` as `geistSans.variable geistMono.variable`.
- But `--font-sans` / `--font-mono` in `globals.css:40-46,97-103` are the **system stacks**, and nothing maps `--font-geist-*` → `--font-sans`. Tailwind's `font-sans` therefore resolves to the system stack everywhere. **The designed typeface is silently dead.**
- `--font-serif` is defined but has zero usages (scan: 0 matches).

### 2.3 Everything else tokens-wise
- Radius `0.625rem` (10px) base — sensible; cards use `rounded-2xl` (16px) — fine, no over-rounding found (`rounded-[24-49px]` scan: 0 matches). Keep it that way.
- Shadows are fully tokenized (light + dark) — good infrastructure; but several components pair a 1px border with `shadow-xl`/`shadow-2xl` (blur ≥16px) — the "ghost-card" codex tell (see §4).
- Chart tokens exist (`--chart-1..5`) and are used by recharts.

---

## 3. Contrast / a11y spot checks (computed, WCAG 2.1)

All core token pairs **pass AA (≥4.5:1)** in both themes — a genuinely good foundation to preserve:

```
light: foreground/background          18.92 PASS   light: primary/background             5.65 PASS
light: muted-foreground/background     4.59 PASS*  light: primary-foreground/primary      5.90 PASS
light: muted-foreground/card           4.80 PASS   light: secondary-foreground/secondary  8.38 PASS
dark:  foreground/background          19.06 PASS   dark:  primary/background              9.78 PASS
dark:  muted-foreground/background     7.76 PASS   dark:  primary-foreground/primary      9.25 PASS
dark:  muted-foreground/card           7.47 PASS   dark:  secondary-foreground/secondary  8.60 PASS
```
\* `muted-foreground` on `background` in light mode is **4.59 — barely over 4.5**. Thin margin; any darkening of the bg or lightening of the muted token breaks it. Treat the *current* contrast as a floor, not a given.

Hardcoded non-token colors that bypass the system (contrast unverified): `text-green-600 dark:text-green-400` diff colors (hero-section:105-160), `text-red-500/70` + `text-emerald-500/70` suggestion labels (inline-suggestions:99,109), `bg-amber-500` pulse (review-status-tracker:39), `text-red-600`/`bg-emerald-500/10`/`text-emerald-600` (device/page.tsx). These should become semantic tokens in the redesign.

No `prefers-reduced-motion` handling anywhere (pulse/spin/bounce/motion reveals all run unconditionally).

---

## 4. Per-surface problems (file:line evidence)

### 4.1 Landing + marketing (brand register)
- **Hero** (`hero-section.tsx`):
  - Pulsing-dot badge "Powered by Advanced AI" — `:22` (slop tell; the ubiquitous "live AI" pill).
  - "2,400+ developers" + avatar stack — `:63-73` (**hero-metric template**: big number, small label, supporting stats).
  - Decorative glow blobs — `:11-12` (`bg-primary/5 blur-[128px]`) + gradient hairline dividers.
  - Gradient glow ring around the code card — `:81` (`-inset-4 bg-gradient-to-r … blur-xl`).
  - Code mockup uses hardcoded diff greens — `:105-160`.
- **Features** (`features-section.tsx`): 4 **identical cards** (icon tile + title + text) — `:86-103`, each with a hover gradient overlay `:79`. The "icon-card grid" reflex.
- **How-it-works** (`how-it-works.tsx`): numbered 01/02/03 markers — *earned* here (a real 3-step sequence, so per `impeccable` this is voice, not slop); but the connector-line gradients `:44-45,73` + icon tiles keep it inside the template family.
- **Pricing** (`pricing-section.tsx`): 3 identical plan cards with "Most Popular" pill — standard SaaS shape; nothing broken, nothing distinctive.
- **CTA** (`cta-section.tsx`): full-width gradient wash + glow blob — `:10-11` (decorative gradient/glow).
- **Whole landing — the uniform reflex:** every section is `relative py-32` + centered heading + subtext + card grid with the *same* reveal animation (`whileInView`, opacity+y, `[0.16,1,0.3,1]`). One template repeated seven times is the tell that reads "AI-built" at a glance.
- Footer/navbar: structurally fine (dead `#` links are a content issue, not visual).

### 4.2 Auth + device
- **Login** (`login-ui.tsx`): three pulsing glow blobs `:28-30`, gradient hairline frame `:34-37`, gradient border ring `:46`, and the card is `rounded-2xl border border-border bg-card/80 backdrop-blur-xl … shadow-2xl shadow-primary/5` `:48` — **glassmorphism-as-default + ghost-card** (1px border + 25px-blur shadow) in one element.
- **Device** (`device/page.tsx`): cleanest auth-adjacent surface — quiet muted page bg, centered card, strong mono code input, decent success state (the `animate-bounce` success icon is the only wobble). Model for the redesign's form surfaces.

### 4.3 Dashboard shell
- **Sidebar** (`app-sidebar.tsx`): uppercase tracked "MENU" eyebrow — `:157` (eyebrow tell); "Connected Account" promo card in the header; active nav item is a full `bg-primary` filled pill (`:190-196`) — heavy; footer user dropdown is busy but functional.
- **Dashboard layout** (`app/dashboard/layout.tsx`): the header hardcodes `<h1>Dashboard</h1>` (`:19-21`) — **every dashboard page announces itself as "Dashboard"**, no breadcrumbs, no page context. Real information-hierarchy bug.

### 4.4 Dashboard page (`dashboard-page-client.tsx`)
- Four **identical stat cards** (icon + label + `text-2xl font-bold` + tiny caption) — `:69-140` (identical card grid).
- Stats show a raw `"..."` while loading (`:74`) instead of a skeleton.
- "Quick Actions" card is an empty placeholder (just one muted paragraph) — `:151-160`.
- **Recharts rendered with defaults**: dashed `CartesianGrid` + `Legend` + default tooltip — `:186-238`; bars use `var(--primary)` etc. but the chart furniture (grid, axes, legend) is unstyled stock.
- Health-score card + contribution calendar exist as real, branded-worthy components.

### 4.5 Reviews (the flagship product surface)
- **Eyebrow labels at tiny sizes**: `text-[9px] uppercase tracking-widest` badge (review-flow-canvas:52); `text-[10px] uppercase tracking-wider` red/emerald status labels (inline-suggestions:99,109,229) — micro-eyebrow tells + hardcoded colors.
- **Graph nodes** (`review-flow-canvas.tsx:13`): `border-2 border-primary/50 bg-card/90 shadow-lg backdrop-blur-md` — glass on a node.
- review-status-tracker uses a pulsing amber dot (`:39`).
- Structure is genuinely rich (collapsible suggestions, list/graph tabs, feedback, verify badges) — this surface deserves the most care in the redesign; it is the product's face.

### 4.6 Admin / settings / orgs / subscriptions / integrations
- Admin: `uppercase tracking-wide` h3 eyebrows (`admin-page-client.tsx:154,177`) + a 4-wide identical stat grid (`:110`).
- Everywhere: identical `animate-pulse space-y-4` → `bg-muted rounded` skeleton blocks (33 spinner/pulse matches across modules) — consistent but generic; no shared skeleton language, and no shimmer/entrance polish.
- Forms/settings/integrations are functional shadcn defaults — fine as infrastructure, generic as design.

### 4.7 CLI (Ink TUI)
- **No brand linkage**: raw `chalk` defaults (cyan/green/yellow/red/gray) in `lib/auth.ts`, `index.ts`, and every component; the web brand (copper/stone, logo) never appears in the terminal.
- **Landing** (`cli/src/components/landing.tsx`): ASCII-art "CODE SHERIFF" banner in cyan + emoji 🐴 + "TUI Reviewer" tagline; instruction list with 👉 emoji. Functional, but reads "hobby CLI", not part of the same product.
- **Review layout** (`cli/src/components/review-layout.tsx`): the strongest CLI surface — split panes (files 30% / suggestions 70%), round borders, `❯` active marker, diff previews (red − / green +), status bar with keymap. Good IA; bad skin. Mixed border styles (single vs round), `🤠` in the header, gray-on-white default text.
- The device-flow link to the web (`app/device/page.tsx`) is the web↔CLI brand hand-off — both ends should speak the same visual language.

---

## 5. What's already good — preserve this

1. **Contrast passes WCAG AA on every core token pair, both themes** (computed, §3). The redesign must keep this bar or raise it.
2. **Both themes are fully wired** through semantic tokens; Tailwind v4 CSS-first config + `tw-animate-css` — solid foundation to rebuild tokens on.
3. **Motion discipline is mostly good**: `motion` used with a proper ease `[0.16,1,0.3,1]`, `whileInView` with `once: true` + margin, staggered `container/item` variants. No layout-animation abuse. (Add `prefers-reduced-motion`; break the uniform per-section reflex.)
4. **The reviews surface is feature-rich** (inline suggestions, flow canvas, feedback, verify badges) — the redesign should amplify this, not flatten it.
5. **The device-flow page** is quietly the best-designed page today — quiet, focused, strong typography. Use it as the benchmark for form/auth surfaces.
6. **CLI IA** (split-pane review, diff previews, keymap status bar) is solid product thinking — it needs a skin, not a restructure.
7. Radius discipline (no over-rounding) and a complete shadow token scale — keep both.

---

## 6. What the direction grilling (#75) should react to

The audit narrows the aesthetic question: the current copper-on-cream is the AI-default pairing, the typeface is dead, the landing is one template repeated, and the product surfaces (reviews, dashboard, CLI) are stronger than the marketing. The direction proposals should be judged on: (a) a palette that escapes the warm-neutral reflex band without losing developer-tool credibility; (b) making the type actually render (wire Geist or swap the stack deliberately); (c) giving the landing a non-template rhythm; (d) a data-viz + component language that the reviews/dashboard surfaces inherit; (e) a CLI palette + banner treatment that carries the same brand.
