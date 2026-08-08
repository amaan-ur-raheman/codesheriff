import chalk from "chalk";

/**
 * Editorial Paper — 16-color ANSI-safe terminal palette.
 *
 * A faithful port of the web design tokens (packages/web/app/globals.css)
 * constrained to the 16 ANSI colors so the TUI renders identically on any
 * terminal, with no truecolor (24-bit) escape sequences.
 *
 *   web light: paper #f7f4ee / ink #231d15 / brand #fc4c02 / verified #0b7a55 /
 *              destructive #b3261e / muted #6b6150
 *   web dark:  ink #17130d / warm #efe9dd / brand #ff6b35 / verified #34d399 /
 *              destructive #ff6b5c / muted #a89c86
 *
 * ANSI approximation: signal-orange → yellowBright, amber text → yellow,
 * verified → green, destructive → red, muted → gray.
 */

/** Signal-orange accent — use surgically (the web rule: <10% of surfaces). */
export const brand = chalk.yellowBright;

/** Verified / success. */
export const verified = chalk.green;

/** Errors / failures. */
export const destructive = chalk.red;

/** Warnings / attention. */
export const warning = chalk.yellow;

/** Secondary text. */
export const muted = chalk.gray;

export const bold = chalk.bold;
export const underline = chalk.underline;

/**
 * Color names for Ink `<Text color>` / `<Box borderColor>` — aligned with the
 * palette. `brand` is `yellowBright` so JSX surfaces match the chalk `brand`
 * function (SGR 93) rather than rendering a duller plain yellow.
 */
export const color = {
	brand: "yellowBright",
	muted: "gray",
	destructive: "red",
	verified: "green",
	warning: "yellow",
	default: "white",
} as const;

/**
 * Brand lockup — the star/badge motif redrawn geometric, replacing the old
 * ASCII-art horse banner and emoji branding. Mirrors the web wordmark.
 */
export const lockup = `${brand("★")} ${bold("CODE SHERIFF")}`;

/** Short product voice line, echoes the web login's "Your code, under review." */
export const tagline = "Your code, under review.";
