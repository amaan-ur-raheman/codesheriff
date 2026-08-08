# ADR-0001: Aesthetic direction - Editorial Paper

## Status

Accepted (2026-08-08). Decision of the wayfinder grilling ticket "Grilling: Pick the aesthetic direction from 2-3 design-skill proposals" (issue 75) on the map "Map: Agency-Grade UI Redesign - Brand Pass, Design System, All Surfaces + CLI" (issue 73).

**Revised (2026-08-08, prototype iteration 2):** the accent family changed from signal orange to **Dispatch emerald** after the user rejected the orange take on the prototype (issue 77).

**Revised (2026-08-08, prototype iteration 3):** the accent family changed from Dispatch emerald to **Cyber Noir magenta** (tweakcn cyberpunk preset) after the emerald take was rejected as "too generic".

**Revised (2026-08-08, prototype iteration 4 — current):** the direction itself changed. The user rejected three consecutive dark-first + single-accent takes as "generic" and asked for a full redesign from scratch using the impeccable, hallmark, design-taste-frontend, and emil-design-eng skills. Hallmark's diversification rule flagged the real failure: all three takes shared one *genre* (dark paper + grotesk sans + single neon accent + centered card grids) with different colors. The direction is now **Editorial Paper** — light-first print editorial — which is categorically different on every axis (paper band, display face, layout, accent, motion). Only the palette/typography sections below supersede the magenta values.

## Context

The UI audit (`research-findings-ui-audit.md`) found the current look is the 2026 AI-default pairing: warm-neutral `#fafaf9` background with a copper `#7c5e4a` primary. Contrast must pass WCAG AA on every core token pair in both themes (computed) as a hard floor. The effort destination is a full brand pass + design system + redesign of every surface (web + CLI), UI-only, shipped in place.

Three candidate directions were originally proposed: **Signal** (dark precision instrument), **The Docket** (light editorial + indigo), **Wanted** (bold poster energy). After three rejected dark iterations, the light-first editorial register — the category that had never been tried — became the answer.

## Decision

**Editorial Paper — light-first print editorial.** The page is set like a broadsheet: warm paper, serif display type, hairline rules instead of card borders, asymmetric composition, generous whitespace, and one surgical accent used as a highlighter, never wallpaper.

- **Palette (warm oat anchor, hue ≈ 80):**
  - Light (default): warm paper `#F7F4EE`, ink `#231D15`, raised surface `#FCFAF5`, hairlines `#E2DBC9`. Accent: signal orange `#FC4C02` (display only, 3.10:1 on paper — large-text AA) with `--brand-text` `#B33900` (4.99–5.75:1) for small text and `--brand-soft` `#FDE6D6` for tints. All 30 computed token pairs pass AA.
  - Dark: warm charcoal `#17130D` (never pure black), warm off-white ink `#EFE9DD`, hairlines `#2E271B`, accent brightened `#FF6B35` / `#FF9E6B`. Same anchor hue; only lightness and chroma move between modes.
  - Semantic status colors stay reserved: `--verified` (`#0B7A55` light / `#34D399` dark), destructive red for failures.
- **Type — the 2+1 rule:** **Fraunces** (display serif, normal + italic, via next/font) + **Geist** (body) + **Geist Mono** (outlier: kickers, meta, code, captions). Wordmark is Fraunces. This fixes a pre-existing bug: the `@theme inline` font keys referenced themselves (`--font-sans: var(--font-sans)`), so body text fell back to the system stack; they now reference the `--font-geist-*` / `--font-fraunces` variables directly, and a base rule pins body to the Geist stack.
- **Macrostructure:** typographic editorial hero (hairline meta row, Fraunces line-mask headline, review card as a print "specimen sheet"); features as an asymmetric editorial ledger (sticky serif head, hairline rows, no cards); pipeline as a numbered editorial sequence (large italic serif numerals, hairline dividers); pricing as a rate-card table (divide-x hairlines, brand top-rule on Pro); editorial close + colophon footer.
- **Motion:** quiet — one orchestrated entrance (line-mask reveal with `set`+`to`+`clearProps`, StrictMode-safe), per-element `once` scroll reveals, reduced-motion renders static. The Three.js star field was removed: it is dark-space vocabulary that fights light paper, and the hero is now typographic.
- **Themes:** light is the new default (`defaultTheme="light"`, an app-wide brand decision — existing users keep their saved preference, system preference is honored). Dark mode is fully designed with the same design language.
- **Volume:** the landing carries the loudest identity; product surfaces inherit the tokens with quiet confidence. **Voice:** specific, hand-set, slightly literary (Hallmark editorial register); no "empower/unleash/supercharge" marketing verbs, no em-dash meta lines.

## Consequences

- **Positive:** categorically different from the rejected dark+neon genre and from every AI-default palette; the serif display + hairline discipline is the "modern agency" register literally; fixes the latent Geist-body-font bug app-wide; light default aligns the brand's first impression with the new identity.
- **Trade-offs:** editorial is a quieter register — the previous Three.js hero animation is gone by design (motion serves perception; one orchestrated entrance beats ten small ones). Body text depends on the `--font-geist-sans` variable resolving on `body` (verified in dev and build). The `defaultTheme="light"` flip changes the first impression of dashboard/auth surfaces for visitors without a saved preference — revertible in one line in `app/layout.tsx` if undesired.
- **Rejected alternatives:** Cyber Noir magenta (iteration 3) — dark+neon genre the user rejected; tweakcn Bold Tech violet (the Linear/Sentry cluster) and Quantum Rose; ui-ux-pro-max's Editorial black+pink (kept only as a fallback accent family). The dark-first direction remains available as a campaign register.
- **Follow-ups:** the prototype ticket (issue 77) applies Editorial Paper as tokens + the landing take; the scope ticket (issue 76) locks surfaces, ship order, and definition of done; the CLI derives an ANSI-safe subset of the palette. Screenshots: `/tmp/cs-editorial-hero.png`, `/tmp/cs-editorial-hero-dark.png`, `/tmp/cs-editorial-ledger.png`.
