/**
 * Guaranteed-flip 3-state theme cycle for the ThemeToggle.
 *
 * A naive `light → dark → system → light` ring has a dead click whenever the
 * stored preference and the OS agree: e.g. stored `dark` on a dark OS stepping
 * to `system` resolves back to dark, so the page visibly doesn't change and
 * the user has to click twice to see anything happen.
 *
 * This cycle instead guarantees that EVERY click changes the visible
 * appearance while keeping all three states reachable, by remembering the
 * previously stored preference (`last`).
 *
 * The ring on a dark OS is: dark → light → system → light → dark — each step
 * flips the resolved appearance (system resolves to the OS), with `light`
 * visited twice per full pass. On a light OS it is the mirror:
 * light → dark → system → dark → light.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ThemeAppearance = "light" | "dark";

export interface ThemeCycleInput {
	/** Current stored preference (`theme` from next-themes). */
	theme: ThemePreference | undefined;
	/** OS color-scheme preference (from `prefers-color-scheme`). */
	os: ThemeAppearance;
	/** The stored preference before the current one, if known. */
	last: ThemePreference | undefined;
}

/** The appearance a stored preference resolves to on a given OS. */
export function resolveAppearance(
	pref: ThemePreference | undefined,
	os: ThemeAppearance
): ThemeAppearance {
	if (pref === "system") return os;
	if (pref === "dark") return "dark";
	return "light";
}

/**
 * Compute the next stored preference for a click, guaranteed to flip the
 * visible appearance.
 *
 * - From `system` or from the literal matching the OS → the opposite literal
 *   (always a visible flip).
 * - From the literal forced opposite to the OS → `system` (its appearance
 *   flips toward the OS), unless `system` is where we just came from — then
 *   back to the OS-matching literal to keep the full ring turning.
 *
 * `last` only needs to be approximately right (it tracks the previous stored
 * value as seen by this component); even if a separate control such as the
 * ThemeMenu changes the theme directly, the ring self-corrects on the next
 * click and every transition still flips.
 */
export function computeNextTheme({
	theme,
	os,
	last,
}: ThemeCycleInput): ThemePreference {
	const current: ThemePreference =
		theme === "dark" || theme === "system" ? theme : "light";
	const opposite: ThemePreference = os === "dark" ? "light" : "dark";

	if (current === "system" || current === os) return opposite;

	return last === "system" ? os : "system";
}
