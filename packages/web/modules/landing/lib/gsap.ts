import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Shared motion curve for the editorial design system (≈ cubic-bezier(0.16, 1, 0.3, 1)). */
export const EASE = "power3.out" as const;

// Recalculate trigger positions once the page has fully settled (fonts,
// images, lazy-loaded chunks). Without this, a layout shift after trigger
// creation can leave scroll-reveal targets stuck at their hidden state.
if (typeof window !== "undefined") {
	const refresh = () => ScrollTrigger.refresh();
	if (document.readyState === "complete") refresh();
	else window.addEventListener("load", refresh, { once: true });
}

export { gsap, ScrollTrigger };

/**
 * Shared config for one-shot scroll reveals. `once: true` + explicit
 * `toggleActions` means a reveal plays exactly once when its trigger enters
 * and can never leave content hidden on a re-enter or reverse.
 */
export const REVEAL_TRIGGER = {
	start: "top 85%",
	once: true,
	toggleActions: "play none none none",
} as const;
