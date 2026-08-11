"use client";

import { useEffect, useRef } from "react";
import { gsap, EASE, REVEAL_TRIGGER, DURATION, STAGGER, MOTION_PREFERRED_QUERY, ScrollTrigger } from "../lib/gsap";

const featured = {
	quote:
		"CodeSheriff flagged a race condition in our billing service the morning it shipped. We would have found it in production.",
	attribution: "Staff engineer · B2B SaaS",
	meta: "PR #482 · 6 files · 2 verified fixes",
};

const quotes = [
	{
		quote:
			"The sandbox verification is the part that sells itself. The only suggestions that reach our PRs are the ones that compile and pass.",
		attribution: "Tech lead · fintech platform",
	},
	{
		quote:
			"It reads a diff like a senior reviewer who already knows our codebase. The health score gave the team a number to chase.",
		attribution: "Engineering manager · e-commerce",
	},
];

export function TestimonialsSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add(MOTION_PREFERRED_QUERY, () => {
				gsap.from(".testimonials-head", {
					opacity: 0,
					y: 20,
					duration: DURATION.section,
					ease: EASE,
					scrollTrigger: {
						trigger: ".testimonials-head",
						...REVEAL_TRIGGER,
					},
				});
				// Batch-reveal the pull-quotes: the featured quote and the two
				// secondary quotes enter as one staggered register. Explicit
				// initial states (never `from`) per the landing safety rule,
				// cleared on complete so no inline styles survive.
				gsap.set(".testimonial-cell", { opacity: 0, y: 20 });
				ScrollTrigger.batch(".testimonial-cell", {
					start: "top 88%",
					once: true,
					onEnter: (batch) =>
						gsap.to(batch, {
							opacity: 1,
							y: 0,
							duration: DURATION.cell,
							ease: EASE,
							stagger: STAGGER.heroCta,
							clearProps: "opacity,transform",
						}),
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
		<section ref={rootRef} className="border-t border-border py-28">
			<div className="mx-auto max-w-7xl px-6">
				<div className="testimonials-head max-w-2xl">
					<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-text">
						Field notes
					</p>
					<h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-5xl">
						Trusted by teams that ship
					</h2>
				</div>

				<div className="mt-16 border-t border-border">
					{/* featured pull-quote */}
					<figure className="testimonial-cell grid gap-8 border-b border-border py-14 lg:grid-cols-12 lg:gap-10">
						<blockquote className="lg:col-span-8">
							<p className="font-display text-2xl font-medium italic leading-snug tracking-[-0.01em] text-balance sm:text-[2rem]">
								“{featured.quote}”
							</p>
						</blockquote>
						<figcaption className="lg:col-span-4 lg:text-right">
							<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
								{featured.attribution}
							</p>
							<p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
								{featured.meta}
							</p>
						</figcaption>
					</figure>

					{/* two-column quote grid */}
					<div className="grid md:grid-cols-2 md:divide-x divide-y md:divide-y-0 divide-border">
						{quotes.map((item) => (
							<figure
								key={item.attribution}
								className="testimonial-cell py-12 pr-0 md:pr-12"
							>
								<blockquote>
									<p className="font-display text-xl font-medium italic leading-snug text-balance">
										“{item.quote}”
									</p>
								</blockquote>
								<figcaption className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									{item.attribution}
								</figcaption>
							</figure>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
