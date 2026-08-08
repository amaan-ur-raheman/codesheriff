# ADR-0001: Aesthetic direction - Signal

## Status

Accepted (2026-08-08). Decision of the wayfinder grilling ticket "Grilling: Pick the aesthetic direction from 2-3 design-skill proposals" (issue 75) on the map "Map: Agency-Grade UI Redesign - Brand Pass, Design System, All Surfaces + CLI" (issue 73).

## Context

The UI audit (`research-findings-ui-audit.md`) found the current look is the 2026 AI-default pairing: warm-neutral `#fafaf9` background with a copper `#7c5e4a` primary (peach `#e8a87c` in dark). The intended Geist typeface never renders (`--font-sans` in `app/globals.css` falls back to the system stack; `--font-geist-*` from `app/layout.tsx` is never mapped). Contrast passes WCAG AA on every core token pair in both themes (computed) and must be preserved as a floor. The effort destination is a full brand pass + design system + redesign of every surface (web + CLI), UI-only, shipped in place.

Three candidate directions were proposed and grilled with the user: **Signal** (dark precision instrument), **The Docket** (light editorial + indigo), **Wanted** (bold poster energy).

## Decision

**Signal - dark precision instrument.** The brand is a precision instrument, not a website: near-black ink, one signal color, type as the interface.

- **Palette strategy:** committed but restrained. The signal accent covers under 10% of surfaces.
  - Dark (default): background `#0A0B0E`, surfaces `#131418` / `#1C1E24` (cool neutrals, zero warmth), border hairlines around `#26282F`.
  - Light: paper `#F7F7F5` (chroma 0, deliberately not cream), ink `#101114`, surfaces `#FFFFFF` / `#EFEFEC`.
  - Accent: signal orange `#FF5A2A` (light) and a matching high-contrast variant in dark. Chosen over copper (the reflex) and over a conventional blue (the dev-tool default); it is the one signal color and doubles as the badge-star color.
  - Semantic status colors (verify pass/fail) stay reserved for real state only.
- **Type:** Geist Sans + Geist Mono, wired for real: map `--font-geist-sans` / `--font-geist-mono` into `--font-sans` / `--font-mono` in `app/globals.css`. No new font downloads; the `next/font` load already exists.
- **Motif:** lean into the sheriff identity. The star/badge is redrawn as a clean geometric mark; the wordmark is built around it.
- **Themes:** dark default (the current default stays), with a fully designed light theme. The identity must hold in both modes; WCAG AA contrast is a hard floor (light `muted-foreground` at 4.59 is the thin edge to watch when tuning tokens).
- **Volume:** the landing carries the loudest identity (hero, type, motion); product surfaces (dashboard shell, pages, CLI) inherit the tokens with quiet confidence.
- **Voice:** dry-witty sheriff tone, used sparingly on the landing and CLI; product UI copy stays neutral and clear.

## Consequences

- **Positive:** escapes the warm-copper AI-default pairing and the "another blue dev tool" default; zero new font cost (wiring fix only); the sheriff star/badge becomes the brand's distinctive asset; the AA contrast floor is preserved by construction as long as token edits keep muted/border neutrals cool.
- **Trade-offs:** signal orange on ink is a commitment. Muted-foreground and borders must stay cool-neutral or the palette drifts warm. The landing's "loud" register must not leak into product density (the volume rule enforces this). Orange competes with the semantic red for attention if status colors are not kept strictly semantic.
- **Rejected alternatives:** The Docket (light editorial + indigo): calm and distinctive, but a light-first identity weakens the developer-tool credibility this product sells. Wanted (bold poster): the strongest agency showpiece, but the loudest to keep disciplined across product surfaces. Both remain available as future campaign/landing registers.
- **Follow-ups:** the prototype ticket (issue 77) applies Signal as tokens + a landing hero and dashboard shell take; the scope ticket (issue 76) locks surfaces, ship order, and definition of done; the CLI derives an ANSI-safe subset of the Signal palette.
