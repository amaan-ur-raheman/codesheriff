"use client";

import { useEffect, useRef } from "react";
import { gsap, EASE, REVEAL_TRIGGER, DURATION, MOTION_PREFERRED_QUERY, ScrollTrigger } from "../lib/gsap";

const stages = [
	{
		number: "01",
		kicker: "Trigger",
		title: "A pull request opens",
		body: "The webhook fires the moment a PR is created or updated. Nothing to install in CI, no YAML to maintain.",
		meta: "webhook: pull_request.opened",
	},
	{
		number: "02",
		kicker: "Analyze",
		title: "The AI reads the diff",
		body: "Every changed file is analyzed against your codebase context, project standards, and a library of known bug patterns.",
		meta: "diff: 47 files · 1,203 lines",
	},
	{
		number: "03",
		kicker: "Verify",
		title: "Suggestions run in a sandbox",
		body: "Every fix is executed in an isolated sandbox first. If the suggested patch doesn't compile and pass, it never reaches your PR.",
		meta: "sandbox: e2b · 14s",
	},
	{
		number: "04",
		kicker: "Deliver",
		title: "Comments land on the PR",
		body: "Verified, inline suggestions appear on the exact lines, ready for one-click apply. Your team reviews less and ships more.",
		meta: "3 comments · 1 verified fix",
	},
];

export function PipelineSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add(MOTION_PREFERRED_QUERY, () => {
				gsap.from(".pipeline-head", {
					opacity: 0,
					y: 20,
					duration: DURATION.section,
					ease: EASE,
					scrollTrigger: {
						trigger: ".pipeline-head",
						...REVEAL_TRIGGER,
					},
				});
				gsap.utils
					.toArray<HTMLElement>(".pipeline-stage")
					.forEach((stage) => {
						gsap.from(stage, {
							opacity: 0,
							y: 22,
							duration: DURATION.cell,
							ease: EASE,
							clearProps: "transform",
							scrollTrigger: {
								trigger: stage,
								...REVEAL_TRIGGER,
							},
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
		<section
			id="how-it-works"
			ref={rootRef}
			className="relative border-y border-border bg-muted/30 py-28"
		>
			<div className="mx-auto max-w-7xl px-6">
				<div className="pipeline-head max-w-2xl">
					<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-text">
						How it runs
					</p>
					<h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-5xl">
						From push to merge, fully automatic
					</h2>
					<p className="mt-6 max-w-lg leading-relaxed text-muted-foreground">
						Four stages run behind the scenes on every pull request.
						You only ever see the result.
					</p>
				</div>

				<div className="mt-16 border-t border-border">
					{stages.map((stage) => (
						<div
							key={stage.number}
							className="pipeline-stage group grid gap-6 border-b border-border py-12 transition-colors duration-300 sm:grid-cols-12 sm:gap-10"
						>
							<div className="sm:col-span-2">
								<p className="font-display text-5xl font-light italic leading-none text-foreground/15 transition-colors duration-300 group-hover:text-brand">
									{stage.number}
								</p>
							</div>
							<div className="sm:col-span-7">
								<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									{stage.kicker}
								</p>
								<h3 className="mt-3 font-display text-2xl font-medium tracking-tight sm:text-3xl">
									{stage.title}
								</h3>
								<p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
									{stage.body}
								</p>
							</div>
							<div className="sm:col-span-3 sm:text-right">
								<span className="inline-block border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
									{stage.meta}
								</span>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
