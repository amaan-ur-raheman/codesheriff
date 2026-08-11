/**
 * Shared motion language for the Editorial Paper design system.
 *
 * One ease curve, a small duration register, stagger defaults, and the
 * reduced-motion policy — the single source of truth for every animation
 * in the app. See DESIGN.md → Layout → Motion register.
 *
 * Values are locked: change one here and it changes app-wide. Add a new
 * animation by composing these tokens; only add a token when the register
 * genuinely lacks the role you need.
 */

/** The single motion curve (≈ cubic-bezier(0.16, 1, 0.3, 1)). */
export const EASE = "power3.out" as const;

/**
 * Duration register (seconds), named by role, not element — so the same
 * reveal feels the same everywhere. Extracted from the landing choreography
 * with zero value change.
 */
export const DURATION = {
	/** micro-interaction pop: tooltip / small hover reveals */
	micro: 0.22,
	/** micro entrances: hero kicker, hero CTA row */
	fast: 0.5,
	/** standard reveals: hero sub, feature rows */
	base: 0.6,
	/** dense cells: pipeline stages, pricing cells, testimonial cells */
	cell: 0.65,
	/** hero stats row */
	stats: 0.55,
	/** section-head reveals */
	section: 0.7,
	/** closing CTA band */
	cta: 0.8,
	/** hero headline masks + review sheet */
	hero: 0.9,
	/** stat count-up */
	count: 1.3,
} as const;

/** Stagger defaults (seconds between items in a sequence). */
export const STAGGER = {
	/** hero headline lines */
	heroLines: 0.13,
	/** hero CTA row */
	heroCta: 0.09,
} as const;

/**
 * Reduced-motion policy. Animations only run when the user allows motion:
 * every effect is gated on this query (gsap.matchMedia or CSS media query).
 * Respecting it is the app-wide rule, not a per-surface nicety.
 */
export const MOTION_PREFERRED_QUERY =
	"(prefers-reduced-motion: no-preference)" as const;

/**
 * One-shot scroll reveal config: plays exactly once when its trigger enters
 * and can never leave content hidden on a re-enter or reverse.
 */
export const REVEAL_TRIGGER = {
	start: "top 85%",
	once: true,
	toggleActions: "play none none none",
} as const;
