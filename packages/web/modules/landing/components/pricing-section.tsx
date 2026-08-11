"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { gsap, EASE, REVEAL_TRIGGER, DURATION, STAGGER, MOTION_PREFERRED_QUERY, ScrollTrigger } from "../lib/gsap";

const plans = [
	{
		name: "Free",
		price: "$0",
		period: "forever",
		description: "For individual developers getting started.",
		features: [
			"3 repositories",
			"50 reviews / month",
			"Basic AI analysis",
			"Email notifications",
			"Community support",
		],
		cta: "Start free",
		highlight: false,
	},
	{
		name: "Pro",
		price: "$19",
		period: "/ month",
		description: "For teams that ship fast.",
		features: [
			"Unlimited repositories",
			"Unlimited reviews",
			"Advanced AI suggestions",
			"Slack / Discord integration",
			"Custom review rules",
			"Health score tracking",
			"Priority support",
		],
		cta: "Get Pro",
		highlight: true,
		badge: "Most popular",
	},
	{
		name: "Enterprise",
		price: "Custom",
		period: "",
		description: "For organizations with advanced needs.",
		features: [
			"Everything in Pro",
			"Self-hosted option",
			"SSO / SAML",
			"Audit logs",
			"Dedicated support",
			"Custom integrations",
			"SLA guarantee",
		],
		cta: "Contact sales",
		highlight: false,
	},
];

export function PricingSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add(MOTION_PREFERRED_QUERY, () => {
				gsap.from(".pricing-head", {
					opacity: 0,
					y: 20,
					duration: DURATION.section,
					ease: EASE,
					scrollTrigger: { trigger: ".pricing-head", ...REVEAL_TRIGGER },
				});
				// Batch-reveal the pricing cells: one shared trigger, staggered
				// onEnter, so the three tiers enter as a register instead of
				// each managing its own ScrollTrigger. Explicit initial states
				// (never `from`) per the landing safety rule, cleared on
				// complete so no inline styles survive.
				gsap.set(".pricing-cell", { opacity: 0, y: 24 });
				ScrollTrigger.batch(".pricing-cell", {
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
		<section id="pricing" ref={rootRef} className="relative py-28">
			<div className="mx-auto max-w-7xl px-6">
				<div className="pricing-head max-w-2xl">
					{/* hairline-led header: no kicker, a brand hairline carries the mark */}
					<div className="h-px w-16 bg-brand" />
					<h2 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-5xl">
						Start free. Upgrade when the team grows.
					</h2>
					<p className="mt-6 max-w-lg leading-relaxed text-muted-foreground">
						No hidden fees, no per-seat surprises, cancel anytime.
					</p>
				</div>

				<div className="mt-16 grid border border-border divide-y md:divide-y-0 md:divide-x divide-border md:grid-cols-3">
					{plans.map((plan) => (
						<div
							key={plan.name}
							className={`pricing-cell relative p-8 sm:p-10 ${
								plan.highlight ? "bg-card" : "bg-background"
							}`}
						>
							{plan.highlight && (
								<div
									aria-hidden="true"
									className="absolute top-0 left-0 right-0 h-[3px] bg-brand"
								/>
							)}

							<div className="flex items-baseline justify-between gap-3">
								<h3 className="text-base font-semibold">
									{plan.name}
								</h3>
								{plan.badge && (
									<span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-text">
										{plan.badge}
									</span>
								)}
							</div>

							<div className="mt-6 flex items-baseline gap-1.5">
								<span className="font-display text-5xl font-semibold tracking-tight">
									{plan.price}
								</span>
								{plan.period && (
									<span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
										{plan.period}
									</span>
								)}
							</div>
							<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
								{plan.description}
							</p>

							<ul className="mt-8 space-y-2.5 border-t border-border pt-8">
								{plan.features.map((feature) => (
									<li
										key={feature}
										className="flex items-start gap-2.5 text-sm"
									>
										<Check
											className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand"
											strokeWidth={2.5}
										/>
										<span className="text-muted-foreground">
											{feature}
										</span>
									</li>
								))}
							</ul>

							<Button
								variant={plan.highlight ? "default" : "outline"}
								className="mt-8 w-full rounded-none"
								asChild
							>
								<a href="/login">{plan.cta}</a>
							</Button>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
