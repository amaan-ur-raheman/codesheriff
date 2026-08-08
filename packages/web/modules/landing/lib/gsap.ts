import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Shared motion curve for the Dispatch design system (≈ cubic-bezier(0.16, 1, 0.3, 1)). */
export const EASE = "power3.out" as const;

export { gsap, ScrollTrigger };
