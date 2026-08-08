# ADR-0002: Delivery contract for the Signal redesign

## Status

Accepted (2026-08-08). Decision of the wayfinder grilling ticket "Grilling: Lock the surface scope, priorities, and definition of done" (issue 76) on the map "Map: Agency-Grade UI Redesign - Brand Pass, Design System, All Surfaces + CLI" (issue 73).

## Context

The direction is locked as Signal (ADR-0001). All surfaces are in scope (landing + marketing, auth, dashboard shell + pages, CLI) and the hard constraints are fixed (UI-only, both themes, WCAG AA, performance gates, ship in place). What remained open was the delivery contract: the order surfaces ship in, the verification bar that makes a Surface "done", and how the CLI carries the brand inside a terminal.

## Decision

- **Ship order:** landing + marketing, then auth/login, then dashboard shell + dashboard, then reviews, then integrations / settings / organizations / subscriptions / admin / device, then the CLI. Each Surface ships in place as its own PR to main. The prototype (issue 77) demonstrates the landing + dashboard shell first, and the landing execution ticket is the first graduate from fog.
- **Definition of done (strict bar), per Surface:**
  - Computed WCAG AA contrast on every new color pair.
  - Lighthouse performance and accessibility scores >= 90.
  - Both themes (dark default + light) visually QA'd.
  - Design-skill pre-flight passes: max 1 eyebrow per 3 sections, no identical card grids, no ghost-card border + wide-shadow pairings, no decorative glow blobs or gradient hairlines, no hardcoded non-token colors.
  - Empty / loading / error states present; `prefers-reduced-motion` handled.
  - Zero behavior change: routes, ids, and labels stay stable.
- **CLI brand:** full Signal port to the terminal. A 16-color-safe ANSI palette (ink/surface, signal orange, semantic status colors), the ASCII-art banner and emoji branding replaced by a small brand lockup line, consistent border styles, same information architecture (split-pane review, diff previews, keymap status bar).

## Consequences

- **Positive:** the order front-loads brand visibility and defers low-traffic surfaces; the strict DoD keeps the AA contrast floor and blocks slop-tell regression surface by surface; the CLI finally reads as the same product as the web.
- **Trade-offs:** the strict DoD costs velocity (Lighthouse gate + skill pre-flight on every surface); landing-first means the dashboard keeps its current look a little longer. Both accepted.
- **Follow-ups:** the landing execution ticket (created 2026-08-08) is the first Surface graduate, blocked on the prototype; the remaining Surfaces graduate from map fog as each prior Surface ships.
