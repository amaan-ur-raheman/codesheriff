import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Motion tokens are canonical in @/lib/motion (see DESIGN.md → Motion
// register). This file re-exports them so landing sections keep one import
// path alongside gsap/ScrollTrigger, and bootstraps the ScrollTrigger setup
// that the landing needs. New tokens belong in lib/motion.ts, not here.
export {
	EASE,
	DURATION,
	STAGGER,
	MOTION_PREFERRED_QUERY,
	REVEAL_TRIGGER,
} from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

// Recalculate trigger positions once the page has fully settled (fonts,
// images, lazy-loaded chunks). Without this, a layout shift after trigger
// creation can leave scroll-reveal targets stuck at their hidden state.
if (typeof window !== "undefined") {
	const refresh = () => ScrollTrigger.refresh();
	if (document.readyState === "complete") refresh();
	else window.addEventListener("load", refresh, { once: true });
}

export { gsap, ScrollTrigger };
