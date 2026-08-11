"use client";

import { useEffect, useRef } from "react";
import { gsap, MOTION_PREFERRED_QUERY } from "../lib/gsap";

/**
 * Scroll-progress hairline — a 1px brand line pinned to the top of the
 * viewport that tracks page progress (the editorial reading of Skiper's
 * scrollbar pattern, kept to a single quiet rule).
 *
 * Scrub-driven, so it's pure scroll choreography on the shared power3-out
 * curve via ScrollTrigger. The element starts collapsed via inline style
 * and GSAP only ever writes the transform inside the reduced-motion gate —
 * under prefers-reduced-motion the line simply stays hidden.
 */
export function ScrollProgress() {
	const barRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add(MOTION_PREFERRED_QUERY, () => {
				gsap.fromTo(
					barRef.current,
					{ scaleX: 0 },
					{
						scaleX: 1,
						ease: "none",
						scrollTrigger: {
							trigger: document.documentElement,
							start: "top top",
							end: "bottom bottom",
							scrub: 0.3,
						},
					},
				);
			});
		}, barRef);
		return () => ctx.revert();
	}, []);

	return (
		<div
			ref={barRef}
			aria-hidden="true"
			className="fixed top-0 left-0 right-0 z-[60] h-px origin-left bg-brand"
			style={{ transform: "scaleX(0)" }}
		/>
	);
}
