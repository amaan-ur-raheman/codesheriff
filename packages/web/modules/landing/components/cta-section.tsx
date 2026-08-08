"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { gsap, EASE, REVEAL_TRIGGER, ScrollTrigger } from "../lib/gsap";

export function CTASection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				gsap.from(".cta-inner", {
					opacity: 0,
					y: 24,
					duration: 0.8,
					ease: EASE,
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
		<section ref={rootRef} className="relative border-t border-border py-28">
			<div className="mx-auto max-w-7xl px-6">
				<div className="cta-inner mx-auto max-w-3xl text-center">
					<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-text">
						Final word
					</p>
					<h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-6xl">
						Ready to ship{" "}
						<span className="font-medium italic text-brand">
							better code?
						</span>
					</h2>
					<p className="mx-auto mt-7 max-w-lg leading-relaxed text-muted-foreground">
						Connect a repository and the first review lands in
						minutes. No credit card required.
					</p>
					<div className="mt-10 flex flex-wrap items-center justify-center gap-8">
						<Button size="lg" className="rounded-none px-8" asChild>
							<a href="/login">
								Get started
								<ArrowRight className="ml-2 h-4 w-4" />
							</a>
						</Button>
					</div>
					<p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Setup takes about four minutes
					</p>
				</div>
			</div>
		</section>
	);
}
