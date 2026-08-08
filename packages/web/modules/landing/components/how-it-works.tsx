"use client";

import { useEffect, useRef } from "react";
import { GitBranch, Sparkles, Rocket } from "lucide-react";
import { gsap, EASE, REVEAL_TRIGGER, ScrollTrigger } from "../lib/gsap";

const steps = [
	{
		icon: GitBranch,
		number: "01",
		title: "Connect Your Repo",
		description:
			"Link your GitHub, GitLab, or Bitbucket repository in seconds. One-click setup, zero configuration.",
	},
	{
		icon: Sparkles,
		number: "02",
		title: "Get AI Reviews",
		description:
			"Every pull request is automatically analyzed. Code suggestions, bug detection, and best practice enforcement.",
	},
	{
		icon: Rocket,
		number: "03",
		title: "Ship with Confidence",
		description:
			"Merge knowing your code has been thoroughly reviewed. Track health scores and team progress over time.",
	},
];

export function HowItWorks() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				gsap.from(".hiw-head", {
					opacity: 0,
					y: 24,
					duration: 0.7,
					ease: EASE,
					scrollTrigger: {
						trigger: ".hiw-head",
						...REVEAL_TRIGGER,
					},
				});
				gsap.fromTo(
					".hiw-line",
					{ scaleX: 0 },
					{
						scaleX: 1,
						transformOrigin: "left center",
						ease: "none",
						scrollTrigger: {
							trigger: ".hiw-grid",
							start: "top 75%",
							end: "bottom 65%",
							scrub: 0.6,
							once: true,
						},
					},
				);
				// Per-step triggers so a stale grid position can never leave
				// individual steps hidden.
				gsap.utils.toArray<HTMLElement>(".hiw-step").forEach((step) => {
					gsap.from(step, {
						opacity: 0,
						y: 32,
						duration: 0.7,
						ease: EASE,
						scrollTrigger: {
							trigger: step,
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
		<section id="how-it-works" ref={rootRef} className="relative py-32">
			<div className="mx-auto max-w-7xl px-6">
				<div className="hiw-head mb-20 max-w-2xl">
					<p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
						Workflow
					</p>
					<h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
						Up and running in three steps
					</h2>
					<p className="mt-4 text-lg text-muted-foreground">
						No complex setup. No steep learning curve. Just better code
						reviews.
					</p>
				</div>

				<div className="hiw-grid relative grid gap-12 md:grid-cols-3">
					{/* Connector line, drawn as you scroll */}
					<div className="absolute top-8 right-[16.66%] left-[16.66%] hidden h-px bg-border md:block" />
					<div className="hiw-line absolute top-8 right-[16.66%] left-[16.66%] hidden h-px bg-primary/60 md:block" />

					{steps.map((step) => (
						<div key={step.number} className="hiw-step relative text-center">
							<div className="relative mx-auto mb-8 inline-block">
								<div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-card">
									<step.icon className="h-7 w-7 text-primary" />
								</div>
								<span className="absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-background font-mono text-[11px] font-semibold text-primary">
									{step.number}
								</span>
							</div>
							<h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
							<p className="mx-auto max-w-xs leading-relaxed text-muted-foreground">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
