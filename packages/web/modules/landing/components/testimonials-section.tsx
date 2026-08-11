"use client";

import { useEffect, useRef } from "react";
import { gsap, EASE, REVEAL_TRIGGER, DURATION, STAGGER, MOTION_PREFERRED_QUERY, ScrollTrigger } from "../lib/gsap";

const featured = {
	quote:
		"CodeSheriff flagged a race condition in our billing service the morning it shipped. We would have found it in production.",
	attribution: "Staff engineer · B2B SaaS",
	// #8: mono-letter avatar initials anchoring the quote
	initials: "SE",
	meta: "PR #482 · 6 files · 2 verified fixes",
};

const quotes = [
	{
		quote:
			"The sandbox verification is the part that sells itself. The only suggestions that reach our PRs are the ones that compile and pass.",
		attribution: "Tech lead · fintech platform",
		initials: "TL",
	},
	{
		quote:
			"It reads a diff like a senior reviewer who already knows our codebase. The health score gave the team a number to chase.",
		attribution: "Engineering manager · e-commerce",
		initials: "EM",
	},
];

export function TestimonialsSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add(MOTION_PREFERRED_QUERY, () => {
				const belowFold = (el: Element) =>
					el.getBoundingClientRect().top > window.innerHeight * 0.95;

				const testHead = rootRef.current?.querySelector(".testimonials-head");
				if (testHead && belowFold(testHead)) {
					gsap.set(".testimonials-head", { opacity: 0, y: 20 });
				}
				gsap.to(".testimonials-head", {
					opacity: 1,
					y: 0,
					duration: DURATION.section,
					ease: EASE,
					clearProps: "opacity,transform",
					scrollTrigger: { trigger: ".testimonials-head", ...REVEAL_TRIGGER },
				});
				const cells = gsap.utils.toArray<HTMLElement>(".testimonial-cell");
				const hiddenCells = cells.filter(belowFold);
				if (hiddenCells.length) gsap.set(hiddenCells, { opacity: 0, y: 20 });
				ScrollTrigger.batch(".testimonial-cell", {
					start: "top 92%",
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
		<section ref={rootRef} className="border-t border-border py-20 lg:py-28">
			<div className="mx-auto max-w-7xl px-6">
				<div className="testimonials-head max-w-2xl">
					<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-text">
						Field notes
					</p>
					<h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-5xl">
						Trusted by teams that ship
					</h2>
				</div>

				<p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
					Illustrative quotes from beta users
				</p>
				<div className="mt-16 border-t border-border">
					{/* featured pull-quote */}
					<figure className="testimonial-cell grid gap-8 border-b border-border py-8 lg:py-14 lg:grid-cols-12 lg:gap-10">
						<blockquote className="lg:col-span-8">
							<p className="font-display text-2xl font-medium italic leading-snug tracking-[-0.01em] text-balance sm:text-[2rem]">
								“{featured.quote}”
							</p>
						</blockquote>
						<figcaption className="lg:col-span-4 lg:text-right">
							<div className="flex items-center gap-3 lg:justify-end">
								{/* mono-letter avatar — same border/bg treatment as the sidebar connected account block */}
								<div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted font-mono text-[11px] font-medium text-foreground">
									{featured.initials}
								</div>
								<div>
									<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
										{featured.attribution}
									</p>
									<p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
										{featured.meta}
									</p>
								</div>
							</div>
						</figcaption>
					</figure>

					{/* two-column quote grid */}
					<div className="grid md:grid-cols-2 md:divide-x divide-y md:divide-y-0 divide-border">
						{quotes.map((item) => (
							<figure
								key={item.attribution}
								className="testimonial-cell py-8 lg:py-12 pr-0 md:pr-12"
							>
								<blockquote>
								<p className="font-display text-xl font-medium italic leading-snug text-balance">
									“{item.quote}”
								</p>
								</blockquote>
								<figcaption className="mt-6 flex items-center gap-3">
									<div className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-muted font-mono text-[10px] font-medium text-foreground">
										{item.initials}
									</div>
									<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										{item.attribution}
									</span>
								</figcaption>
							</figure>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
