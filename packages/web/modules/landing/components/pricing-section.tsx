"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { gsap, EASE } from "../lib/gsap";

const plans = [
	{
		name: "Free",
		price: "$0",
		period: "forever",
		description: "Perfect for individual developers.",
		features: [
			"3 repositories",
			"50 reviews / month",
			"Basic AI analysis",
			"Email notifications",
			"Community support",
		],
		cta: "Start Free",
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
		badge: "Most Popular",
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
		cta: "Contact Sales",
		highlight: false,
	},
];

export function PricingSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				gsap.from(".pricing-head", {
					opacity: 0,
					y: 24,
					duration: 0.7,
					ease: EASE,
					scrollTrigger: { trigger: ".pricing-head", start: "top 80%" },
				});
				gsap.from(".pricing-card", {
					opacity: 0,
					y: 36,
					duration: 0.7,
					stagger: 0.12,
					ease: EASE,
					// Drop GSAP's inline transform on complete so the Pro card's
					// scale/lift and the hover lifts survive.
					clearProps: "transform",
					scrollTrigger: {
						trigger: ".pricing-grid",
						start: "top 80%",
					},
				});
			});
		}, rootRef);
		return () => ctx.revert();
	}, []);

	return (
		<section id="pricing" ref={rootRef} className="relative py-32">
			<div className="mx-auto max-w-7xl px-6">
				<div className="pricing-head mb-16 max-w-2xl">
					<p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
						Pricing
					</p>
					<h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
						Simple, transparent pricing
					</h2>
					<p className="mt-4 text-lg text-muted-foreground">
						Start free, scale as you grow. No hidden fees.
					</p>
				</div>

				<div className="pricing-grid mx-auto grid max-w-5xl gap-6 md:grid-cols-3 md:items-center">
					{plans.map((plan) => (
						<div
							key={plan.name}
							className={`pricing-card relative rounded-2xl border p-8 transition-all duration-300 ${
								plan.highlight
									? "border-primary/40 bg-card ring-1 ring-primary/20 md:-translate-y-2 md:scale-[1.03] hover:shadow-xl"
									: "border-border bg-card hover:border-primary/25 hover:-translate-y-1"
							}`}
						>
							{plan.badge && (
								<div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 font-mono text-[11px] font-semibold text-primary-foreground">
									{plan.badge}
								</div>
							)}

							<div className="mb-8">
								<h3 className="mb-2 text-lg font-semibold">
									{plan.name}
								</h3>
								<div className="mb-3 flex items-baseline gap-1">
									<span className="text-4xl font-bold">
										{plan.price}
									</span>
									{plan.period && (
										<span className="text-sm text-muted-foreground">
											{plan.period}
										</span>
									)}
								</div>
								<p className="text-sm text-muted-foreground">
									{plan.description}
								</p>
							</div>

							<ul className="mb-8 space-y-3">
								{plan.features.map((feature) => (
									<li
										key={feature}
										className="flex items-start gap-3 text-sm"
									>
										<Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										<span className="text-muted-foreground">
											{feature}
										</span>
									</li>
								))}
							</ul>

							<Button
								variant={plan.highlight ? "default" : "outline"}
								className="w-full"
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
