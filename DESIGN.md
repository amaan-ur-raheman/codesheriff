---
version: alpha
name: Editorial Paper
description: Light-first print-editorial design system for Code Sheriff — warm paper and ink, a single signal-orange accent, Fraunces display, hairline rules, sharp corners, quiet motion.
colors:
  background: "#f7f4ee"
  foreground: "#231d15"
  card: "#fcfaf5"
  card-foreground: "#231d15"
  popover: "#fcfaf5"
  popover-foreground: "#231d15"
  primary: "#231d15"
  primary-foreground: "#f7f4ee"
  secondary: "#efeade"
  secondary-foreground: "#3b3226"
  muted: "#efeade"
  muted-foreground: "#6b6150"
  accent: "#f0ebe0"
  accent-foreground: "#231d15"
  destructive: "#b3261e"
  destructive-foreground: "#fff8f2"
  verified: "#0b7a55"
  verified-foreground: "#ffffff"
  brand: "#fc4c02"
  brand-text: "#b33900"
  brand-soft: "#fde6d6"
  border: "#e2dbc9"
  input: "#d6cdb9"
  ring: "#fc4c02"
  chart-1: "#fc4c02"
  chart-2: "#8a5a1f"
  chart-3: "#2e7d5b"
  chart-4: "#6b6150"
  chart-5: "#b3261e"
  sidebar: "#f7f4ee"
  sidebar-foreground: "#231d15"
  sidebar-primary: "#231d15"
  sidebar-primary-foreground: "#f7f4ee"
  sidebar-accent: "#f0ebe0"
  sidebar-accent-foreground: "#231d15"
  sidebar-border: "#e5decb"
  sidebar-ring: "#d6cdb9"
typography:
  sans:
    fontFamily: Geist
  mono:
    fontFamily: Geist Mono
  display:
    fontFamily: Fraunces
  serif:
    fontFamily: Fraunces
rounded:
  base: 0px
spacing:
  base: 0.25rem
---

## Overview

Code Sheriff is an AI-powered automated code review platform: GitHub webhooks feed an Inngest review pipeline, reviews land back as PR comments, and a companion CLI TUI serves the same workflow in the terminal. The product voice is dry-witty sheriff; the interface speaks **Editorial Paper** — a light-first print-editorial language of warm paper grounds, ink text, one signal-orange accent, Fraunces display type, hairline rules, sharp corners, and quiet motion. Marketing surfaces are loud; product surfaces are calm. This is the locked system every surface builds on.

Tokens live in `packages/web/app/globals.css` under `:root` (light) and `.dark`, re-exposed to Tailwind through the `@theme inline` block as `--color-*`, `--font-*`, and `--radius-*` utilities. The CLI mirrors the same semantic roles in a 16-color ANSI-safe palette (`packages/cli/src/theme.ts`) so the language holds in the terminal too.

## Colors

The palette is warm neutral paper and ink, with a single accent. The default theme is light; dark swaps every role in place via the `.dark` class (see Themes).

- **Paper** (`background`) and **Ink** (`foreground`) are the ground and the primary text. `card` and `popover` sit a half-step lighter than the page for floating surfaces.
- **Signal orange** (`brand`) is the only accent and must stay sparse — use it on no more than ~10% of any surface: primary actions, focus rings (`ring`), hover emphasis, and small highlights. On light, `brand-text` is the darkened AA-compliant variant for small brand-colored text; `brand-soft` is the tint wash for selected/hover fills. Never put body copy in raw `brand`.
- **Verified** (green) and **Destructive** (red) carry status meaning only — they never compete with the brand accent.
- **Border** hairlines and **Input** edges are warm neutrals, one step off the paper; the whole system reads as hairline-drawn rather than filled or shadowed.
- **Chart** ramp (chart-1…5) leads with the brand orange so data visualization stays on-identity.

Rules of use: prefer tokens over raw values everywhere; when a component needs a new surface, derive it from this set rather than inventing a hex. `brand` for emphasis, `brand-text` for legible small text, `brand-soft` for washes.

## Themes

Light is the default (frontmatter holds the light values). Dark is a full role swap applied by the `.dark` class, wired through `next-themes` with `defaultTheme="light"` and `enableSystem`. Exact dark values:

| Token | Dark value |
|---|---|
| background | `#17130d` |
| foreground | `#efe9dd` |
| card | `#1d1811` |
| card-foreground | `#efe9dd` |
| popover | `#1d1811` |
| popover-foreground | `#efe9dd` |
| primary | `#efe9dd` |
| primary-foreground | `#17130d` |
| secondary | `#241e15` |
| secondary-foreground | `#d9cdba` |
| muted | `#241e15` |
| muted-foreground | `#a89c86` |
| accent | `#262018` |
| accent-foreground | `#efe9dd` |
| destructive | `#ff6b5c` |
| destructive-foreground | `#2a0d08` |
| verified | `#34d399` |
| verified-foreground | `#04261b` |
| brand | `#ff6b35` |
| brand-text | `#ff9e6b` |
| brand-soft | `#3a2315` |
| border | `#2e271b` |
| input | `#3a3122` |
| ring | `#ff6b35` |
| chart-1…5 | `#ff6b35`, `#d9a05b`, `#34d399`, `#a89c86`, `#ff8f6b` |
| sidebar | `#17130d` |
| sidebar-foreground | `#efe9dd` |
| sidebar-primary | `#efe9dd` |
| sidebar-primary-foreground | `#17130d` |
| sidebar-accent | `#262018` |
| sidebar-accent-foreground | `#efe9dd` |
| sidebar-border | `#2a2318` |
| sidebar-ring | `#4a3a24` |

Dark keeps the same structural rules: sparse brand, hairlines, sharp corners, Fraunces display. Both themes must hold WCAG AA on computed text contrast.

## Typography

Three families are loaded once in `packages/web/app/layout.tsx` via `next/font/google` (Geist, Geist Mono, Fraunces) and exposed as `font-sans`, `font-mono`, `font-display`, and `font-serif` utilities.

- **Fraunces** (`display`/`serif`) is the voice — use it for headlines, hero, section titles, and any surface header. It carries the editorial personality; keep weights in the medium range and let the serif do the talking.
- **Geist** (`sans`) is the workhorse for body copy, labels, buttons, tables, and everything interactive.
- **Geist Mono** (`mono`) is the "system voice" — kickers and eyebrows above headlines, metadata, paths, statuses, PR numbers, and code-level detail. The canonical header pattern is a mono kicker line, then a Fraunces headline, then Geist body.

## Layout

Spacing runs on a 4px base (`spacing.base`, the Tailwind `--spacing` unit) — compose with the standard Tailwind scale rather than arbitrary values. Structure is editorial: hairline rules (`border`) separate sections, rows, and cells instead of heavy fills; asymmetric composition and generous whitespace carry the print feel. A section is typically a bordered feature row or a sharp-cornered card with a mono kicker and a serif heading.

### Motion register

Motion is quiet and purposeful; nothing bounces or lingers.

- **Shared curve**: `power3.out` (≈ `cubic-bezier(0.16, 1, 0.3, 1)`), exported as `EASE` from `modules/landing/lib/gsap.ts` — one curve for the whole system.
- **Reveals**: one-shot scroll reveals with `REVEAL_TRIGGER` (`start: "top 85%"`, `once: true`, `toggleActions: "play none none none"`) — content plays in once and can never be left hidden on re-enter. Durations run 0.5–0.9s with gentle staggers (hero 0.13 / 0.09).
- **Marquee**: the scrolling band animates `translateX(0 → -50%)` over 44s linear, with an edge-fade mask and a pause on hover/focus.
- **Reduced motion**: `prefers-reduced-motion` kills the marquee animation (falling back to a static wrapped list) and neutralizes transforms — every animated surface must have a static fallback.

## Elevation & Depth

Flat by default: separation comes from hairlines and paper tone, not shadow. The shadow scale exists but stays quiet — subtle warm shadows on light, slightly deeper black shadows on dark, reserved for floating elements (popovers, dialogs) and deliberate lift. If a design reads as needing a card, prefer a hairline-bordered panel before reaching for a shadow.

## Shapes

Sharp corners everywhere. `rounded.base` is `0px` and every radius utility maps to `0px` — no pills, no rounded cards, no border-radius on any surface. The sharp corner is a brand marker; introducing rounding on one element reads as a mistake.

## Components

- **Section header**: mono kicker → Fraunces headline → body. Recurring across landing, dashboard, and auth.
- **Buttons**: primary is ink-on-paper (`primary`/`primary-foreground`) or paper-on-ink in dark, sharp-cornered, with a `ring` focus; secondary is a hairline-bordered panel; brand accent appears only on primary CTAs or key highlights.
- **Marquee band**: the one continuous-motion component, always edge-masked and paused on hover, with a static reduced-motion fallback.
- **CLI**: the TUI mirrors web roles in a 16-color ANSI-safe palette — brand amber for selection/emphasis, verified green, destructive red, muted gray — and uses the `★ CODE SHERIFF` lockup plus "Your code, under review." tagline instead of emoji or ASCII art.

## Do's and Don'ts

**Do**

- Lead with a mono kicker above a Fraunces headline; keep body in Geist.
- Keep signal orange sparse (~10% max per surface): `brand` for emphasis, `brand-text` for small legible text, `brand-soft` for washes.
- Draw structure with hairlines and whitespace; use quiet `power3.out` motion with reduced-motion fallbacks.
- Use tokens from this document (`colors.*`, `typography.*`, `spacing.base`) rather than raw values.

**Don't**

- Don't round corners — the system is sharp everywhere (`rounded.base: 0px`).
- Don't add glow, gradients, or backdrop blur — the sweep removed them; flat paper + hairline is the language.
- Don't invent new hexes or use raw named colors where a token exists.
- Don't use emoji or ASCII-art branding in the CLI — the lockup and tagline are the identity.
