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
					y: 30,
					duration: 0.8,
					ease: EASE,
					scrollTrigger: {
						trigger: ".cta-inner",
						...REVEAL_TRIGGER,
					},
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
		<section ref={rootRef} className="relative py-32">
			<div className="mx-auto max-w-7xl px-6">
				<div className="cta-inner relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-20 text-center">
					{/* faint emerald radial, well under any text */}
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
					/>

					<div className="relative">
						<h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
							Ready to ship better code?
						</h2>
						<p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
							Join developers catching bugs before they reach
							production. Get started in minutes — no credit card
							required.
						</p>
						<div className="mt-10 flex flex-wrap justify-center gap-4">
							<Button size="lg" className="px-8" asChild>
								<a href="/login">
									Get Started Free
									<ArrowRight className="ml-2 h-4 w-4" />
								</a>
							</Button>
						</div>
						<p className="mt-6 font-mono text-xs text-muted-foreground">
							Connect a repo · review lands in minutes
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
