"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { gsap, EASE, REVEAL_TRIGGER, DURATION, MOTION_PREFERRED_QUERY, ScrollTrigger } from "../lib/gsap";

const features = [
	{
		title: "AI code review",
		description:
			"Deep analysis of every diff: bugs, security holes, dead code, and smells, flagged before they ship.",
	},
	{
		title: "Inline PR comments",
		description:
			"Actionable suggestions posted on the exact lines of your pull request, ready for one-click apply.",
	},
	{
		title: "Health scores",
		description:
			"Code quality trends tracked over time: issue density, review completion rates, and team velocity.",
	},
	{
		title: "Every language you ship",
		description:
			"One reviewer fluent in TypeScript, Python, Go, Rust, Java, Ruby, and the rest of your stack.",
	},
];

export function FeaturesSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add(MOTION_PREFERRED_QUERY, () => {
				gsap.from(".features-head", {
					opacity: 0,
					y: 20,
					duration: DURATION.section,
					ease: EASE,
					scrollTrigger: { trigger: ".features-head", ...REVEAL_TRIGGER },
				});
				// Per-row triggers so a stale position can never leave a row
				// hidden behind its initial state.
				gsap.utils
					.toArray<HTMLElement>(".feature-row")
					.forEach((row) => {
						gsap.from(row, {
							opacity: 0,
							y: 18,
							duration: DURATION.base,
							ease: EASE,
							// Drop GSAP's inline transform on complete so the
							// hover shift keeps working.
							clearProps: "transform",
							scrollTrigger: { trigger: row, ...REVEAL_TRIGGER },
						});
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
		<section id="features" ref={rootRef} className="relative py-28">
			<div className="mx-auto max-w-7xl px-6">
				<div className="grid gap-14 lg:grid-cols-12">
					{/* ---- sticky head ---- */}
					<div className="features-head lg:col-span-5">
						<div className="lg:sticky lg:top-28">
							<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-text">
								What it does
							</p>
							<h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-5xl">
								A second pair of eyes on every pull request
							</h2>
							<p className="mt-6 max-w-sm leading-relaxed text-muted-foreground">
								It fits the workflow you already have. Open a PR,
								get a review. No new tools, no context switching,
								no CI config to babysit.
							</p>
							<a
								href="#how-it-works"
								className="mt-8 inline-block text-sm font-medium text-foreground underline decoration-border underline-offset-[6px] transition-colors duration-200 hover:decoration-brand"
							>
								See the pipeline below
							</a>
						</div>
					</div>

					{/* ---- ledger ---- */}
					<div className="lg:col-span-6 lg:col-start-7">
						<div className="border-t border-border">
							{features.map((feature) => (
								<div
									key={feature.title}
									className="feature-row group border-b border-border py-10 transition-colors duration-300"
								>
									<div className="flex items-start justify-between gap-6">
										<h3 className="font-display text-[1.75rem] font-medium leading-tight tracking-[-0.01em] text-foreground transition-colors duration-300 group-hover:text-brand">
											{feature.title}
										</h3>
										<ArrowUpRight
											className="mt-2 h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
											strokeWidth={1.5}
										/>
									</div>
									<p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
										{feature.description}
									</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
