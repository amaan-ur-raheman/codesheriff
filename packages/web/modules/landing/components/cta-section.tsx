"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { gsap, EASE, REVEAL_TRIGGER, DURATION, MOTION_PREFERRED_QUERY, ScrollTrigger } from "../lib/gsap";

export function CTASection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add(MOTION_PREFERRED_QUERY, () => {
				const belowFold = (el: Element) =>
					el.getBoundingClientRect().top > window.innerHeight * 0.95;

				const inner = rootRef.current?.querySelector(".cta-inner");
				if (inner && belowFold(inner)) {
					gsap.set(".cta-inner", { opacity: 0, y: 24 });
				}
				gsap.to(".cta-inner", {
					opacity: 1,
					y: 0,
					duration: DURATION.cta,
					ease: EASE,
					clearProps: "opacity,transform",
					scrollTrigger: { trigger: ".cta-inner", ...REVEAL_TRIGGER },
				});
			});
		}, rootRef);
		const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
		return () => {
			cancelAnimationFrame(raf);
			ctx.revert();
		};
	}, []);

	return (
		<section ref={rootRef} className="relative border-t border-border py-20 lg:py-28">
			<div className="mx-auto max-w-7xl px-6">
				<div className="cta-inner mx-auto max-w-3xl text-center">
					<h2 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-balance sm:text-6xl">
						Ready to ship{" "}
						<span className="font-medium italic text-brand">
							better code?
						</span>
					</h2>
					<p className="mx-auto mt-7 max-w-lg leading-relaxed text-muted-foreground">
						Connect a repository and the first review lands in
						minutes. Free tier requires no credit card.
					</p>
					<div className="mt-10 flex flex-wrap items-center justify-center gap-8">
						<Button size="lg" className="rounded-none px-8 active:scale-[0.98] transition-transform duration-100" asChild>
							<a href="/login">
								Get started
								<ArrowRight className="ml-2 h-4 w-4" />
							</a>
						</Button>
					</div>
					<p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Start free · no credit card needed
					</p>
				</div>
			</div>
		</section>
	);
}
