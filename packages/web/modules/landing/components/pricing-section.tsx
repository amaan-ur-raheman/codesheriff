"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

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

const container = {
	hidden: {},
	show: { transition: { staggerChildren: 0.1 } },
};

const item = {
	hidden: { opacity: 0, y: 24 },
	show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export function PricingSection() {
	return (
		<section id="pricing" className="relative py-32">
			<div className="max-w-7xl mx-auto px-6">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6 }}
					className="text-center mb-16"
				>
					<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
						Simple, transparent{" "}
						<span className="text-primary">pricing</span>
					</h2>
					<p className="text-muted-foreground max-w-xl mx-auto text-lg">
						Start free, scale as you grow. No hidden fees.
					</p>
				</motion.div>

				<motion.div
					variants={container}
					initial="hidden"
					whileInView="show"
					viewport={{ once: true, margin: "-100px" }}
					className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
				>
					{plans.map((plan) => (
						<motion.div
							key={plan.name}
							variants={item}
							className={`relative p-8 rounded-2xl border transition-all duration-500 ${
								plan.highlight
									? "border-primary/30 bg-primary/[0.05] shadow-lg shadow-primary/5"
									: "border-white/5 bg-white/[0.02] hover:border-white/10"
							}`}
						>
							{plan.badge && (
								<div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
									{plan.badge}
								</div>
							)}

							<div className="mb-8">
								<h3 className="text-lg font-semibold mb-2">
									{plan.name}
								</h3>
								<div className="flex items-baseline gap-1 mb-3">
									<span className="text-4xl font-bold">
										{plan.price}
									</span>
									{plan.period && (
										<span className="text-muted-foreground text-sm">
											{plan.period}
										</span>
									)}
								</div>
								<p className="text-sm text-muted-foreground">
									{plan.description}
								</p>
							</div>

							<ul className="space-y-3 mb-8">
								{plan.features.map((feature) => (
									<li
										key={feature}
										className="flex items-start gap-3 text-sm"
									>
										<Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
										<span className="text-muted-foreground">
											{feature}
										</span>
									</li>
								))}
							</ul>

							<Button
								className={`w-full ${
									plan.highlight
										? "bg-primary text-primary-foreground hover:bg-primary/90"
										: "bg-white/5 text-foreground hover:bg-white/10 border border-white/10"
								}`}
								asChild
							>
								<a href="/login">{plan.cta}</a>
							</Button>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
