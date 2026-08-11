"use client";

/**
 * Theme toggle button — a port of Skiper UI's `skiper26` ("Theme toggle btn")
 * into the Editorial Paper system.
 *
 * Source: https://skiper-ui.com/v1/skiper26 (free to use and modify; credit
 * Skiper UI + rudrodip/theme-toggle-effect, the original View-Transition
 * implementation this adapts).
 *
 * The signature behaviour is the theme swap: instead of an instant flip, the
 * new theme is revealed with a View Transition API mask sweep (`circle`,
 * `circle-blur`, or a full `polygon` wipe) that emanates from the button.
 *
 * Editorial Paper adaptations (per DESIGN.md):
 * - Sharp corners — `rounded-none`, never pills.
 * - Explicit transition properties, never `transition-all` (audit P0 rule).
 * - Motion comes from the shared register: the reveal uses the system ease
 *   (≈ `cubic-bezier(0.16, 1, 0.3, 1)`) at `DURATION.section` (0.7s).
 * - Reduced-motion policy: under `prefers-reduced-motion` the view transition
 *   is skipped entirely and the theme flips instantly; the icon swap also
 *   carries `motion-reduce:transition-none`.
 * - Three-state cycle: `light → dark → system`, driven by the stored `theme`
 *   preference (`enableSystem` is on at the provider) — but every click is
 *   GUARANTEED to flip the visible appearance (see lib/theme-cycle.ts), so
 *   there are never dead clicks. The sun/moon icons always show the
 *   *effective* theme via CSS `dark:` variants — when the stored theme is
 *   `system`, next-themes resolves it and applies `.dark` from the OS, so the
 *   correct icon shows. A tiny brand dot marks the `system` state; dynamic
 *   labels are mounted-guarded for hydration safety.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
	computeNextTheme,
	type ThemeAppearance,
	type ThemePreference,
} from "@/lib/theme-cycle";
import { cn } from "@/lib/utils";
import { DURATION } from "@/lib/motion";

export type ThemeToggleVariant = "circle" | "circle-blur" | "polygon";
export type ThemeToggleStart =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "center";

interface ThemeToggleProps {
	/** Mask shape used for the View Transition reveal. Default: `circle-blur`. */
	variant?: ThemeToggleVariant;
	/** Corner the reveal emanates from. Default: `top-right` (matches the navbar). */
	start?: ThemeToggleStart;
	className?: string;
}

/** The shared Editorial Paper ease, in CSS form (≈ power3.out). */
const EASE_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

const STYLE_ID = "theme-transition-styles";

function positionCoords(start: Exclude<ThemeToggleStart, "center">) {
	switch (start) {
		case "top-left":
			return { cx: "0", cy: "0" };
		case "top-right":
			return { cx: "40", cy: "0" };
		case "bottom-left":
			return { cx: "0", cy: "40" };
		case "bottom-right":
			return { cx: "40", cy: "40" };
	}
}

function maskSvg(variant: "circle" | "circle-blur", start: Exclude<ThemeToggleStart, "center">) {
	const { cx, cy } = positionCoords(start);
	if (variant === "circle") {
		return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="${cx}" cy="${cy}" r="20" fill="white"/></svg>`;
	}
	return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><filter id="blur"><feGaussianBlur stdDeviation="2"/></filter></defs><circle cx="${cx}" cy="${cy}" r="18" fill="white" filter="url(%23blur)"/></svg>`;
}

/** Build the `::view-transition-*` styles for a given variant/start. */
function createThemeAnimation(
	variant: ThemeToggleVariant,
	start: ThemeToggleStart
): { css: string } {
	const dur = `${DURATION.section}s`;

	if (variant === "polygon") {
		return {
			css: `
::view-transition-group(root) {
  animation-duration: ${dur};
  animation-timing-function: ${EASE_CSS};
}
::view-transition-new(root) { animation-name: cs-reveal-light; }
::view-transition-old(root), .dark::view-transition-old(root) {
  animation: none;
  z-index: -1;
}
.dark::view-transition-new(root) { animation-name: cs-reveal-dark; }
@keyframes cs-reveal-dark {
  from { clip-path: polygon(50% -71%, -50% 71%, -50% 71%, 50% -71%); }
  to   { clip-path: polygon(50% -71%, -50% 71%, 50% 171%, 171% 50%); }
}
@keyframes cs-reveal-light {
  from { clip-path: polygon(171% 50%, 50% 171%, 50% 171%, 171% 50%); }
  to   { clip-path: polygon(171% 50%, 50% 171%, -50% 71%, 50% -71%); }
}
`,
		};
	}

	if (variant === "circle" && start === "center") {
		return {
			css: `
::view-transition-group(root) {
  animation-duration: ${dur};
  animation-timing-function: ${EASE_CSS};
}
::view-transition-new(root) { animation-name: cs-reveal-center; }
::view-transition-old(root), .dark::view-transition-old(root) {
  animation: none;
  z-index: -1;
}
@keyframes cs-reveal-center {
  from { clip-path: circle(0% at 50% 50%); }
  to   { clip-path: circle(100.0% at 50% 50%); }
}
`,
		};
	}

	if (start === "center") {
		// Non-center variants collapse to a centered circle sweep.
		return createThemeAnimation("circle", "center");
	}

	const svg = maskSvg(variant as "circle" | "circle-blur", start);
	const maskPosition = start.replace("-", " ");
	const transformOrigin = start.replace("-", " ");

	return {
		css: `
::view-transition-group(root) {
  animation-timing-function: ${EASE_CSS};
}
::view-transition-new(root) {
  mask: url('${svg}') ${maskPosition} / 0 no-repeat;
  mask-origin: content-box;
  animation-name: cs-mask-${start};
  animation-duration: ${dur};
  transform-origin: ${transformOrigin};
}
::view-transition-old(root), .dark::view-transition-old(root) {
  animation-name: cs-mask-${start};
  animation-duration: ${dur};
  transform-origin: ${transformOrigin};
  z-index: -1;
}
@keyframes cs-mask-${start} {
  to { mask-size: 350vmax; }
}
`,
		};
}

const THEME_LABEL: Record<string, string> = {
	light: "light",
	dark: "dark",
	system: "system (auto)",
};

export function ThemeToggle({
	variant = "circle-blur",
	start = "top-right",
	className,
}: ThemeToggleProps) {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	// Remembers the previously stored preference so the guaranteed-flip ring
	// (lib/theme-cycle.ts) can turn through all three states on a static OS.
	const lastTheme = useRef<ThemePreference | undefined>(undefined);
	// Mirror of the current stored preference — the handler computes from this
	// (never the hook value directly) so two clicks landing in the same render
	// tick can't both read a stale theme. Kept in sync with next-themes
	// changes (e.g. the ThemeMenu dropdown selecting a state directly).
	const themeRef = useRef<ThemePreference>((theme ?? "light") as ThemePreference);
	useEffect(() => {
		themeRef.current = (theme ?? "light") as ThemePreference;
	}, [theme]);

	useEffect(() => {
		setMounted(true);
	}, []);

	const animation = useMemo(
		() => createThemeAnimation(variant, start),
		[variant, start]
	);

	const handleToggle = () => {
		if (typeof window === "undefined") return;
		// Guaranteed-flip ring: every click changes the visible appearance,
		// even on a static OS, while keeping light/dark/system all reachable
		// (see lib/theme-cycle.ts for the state machine + tests).
		const os: ThemeAppearance = window.matchMedia(
			"(prefers-color-scheme: dark)"
		).matches
			? "dark"
			: "light";
		const current = themeRef.current;
		const next = computeNextTheme({
			theme: current,
			os,
			last: lastTheme.current,
		});
		lastTheme.current = current;
		themeRef.current = next;
		const apply = () => setTheme(next);

		// Reduced-motion policy: flip instantly, no view transition.
		const prefersReduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)"
		).matches;

		if (!document.startViewTransition || prefersReduced) {
			apply();
			return;
		}

		// Inject (or refresh) the transition styles, then run the reveal.
		// `.finished` rejects with AbortError when the transition is skipped
		// (rapid re-click, navigation) — swallow it; `apply` already ran.
		let styleEl = document.getElementById(
			STYLE_ID
		) as HTMLStyleElement | null;
		if (!styleEl) {
			styleEl = document.createElement("style");
			styleEl.id = STYLE_ID;
			document.head.appendChild(styleEl);
		}
		styleEl.textContent = animation.css;
		document.startViewTransition(apply).finished.catch(() => {});
	};

	const isSystem = mounted && theme === "system";

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={handleToggle}
			aria-label={
				mounted
					? `Theme: ${THEME_LABEL[theme ?? "light"] ?? "light"}`
					: "Toggle theme"
			}
			title={
				mounted
					? `Theme: ${THEME_LABEL[theme ?? "light"] ?? "light"} (click to change)`
					: "Toggle theme"
			}
			className={cn(
				"relative rounded-none border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
				className
			)}
		>
			<Sun
				className={cn(
					"size-4 scale-100 rotate-0 transition-[transform,opacity] duration-300 motion-reduce:transition-none",
					"dark:scale-0 dark:-rotate-90"
				)}
			/>
			<Moon
				className={cn(
					"absolute size-4 scale-0 -rotate-90 transition-[transform,opacity] duration-300 motion-reduce:transition-none",
					"dark:scale-100 dark:rotate-0"
				)}
			/>
			{/* Tiny brand dot marks the `system` (auto) state — sparse accent, sharp corners. */}
			{isSystem && (
				<span
					aria-hidden="true"
					className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 bg-brand"
				/>
			)}
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
