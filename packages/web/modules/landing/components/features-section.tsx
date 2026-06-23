"use client";

import { motion } from "motion/react";
import { Bot, MessageSquare, Activity, Globe } from "lucide-react";

const features = [
	{
		icon: Bot,
		title: "AI Code Review",
		description:
			"Deep analysis of every pull request. Catches bugs, security issues, and code smells before they reach production.",
	},
	{
		icon: MessageSquare,
		title: "Auto PR Comments",
		description:
			"Inline suggestions posted directly on your pull requests. Your team gets actionable feedback without leaving GitHub.",
	},
	{
		icon: Activity,
		title: "Health Scores",
		description:
			"Track code quality trends over time. Monitor completion rates, issue density, and team performance at a glance.",
	},
	{
		icon: Globe,
		title: "Multi-language Support",
		description:
			"Works across your entire stack. JavaScript, TypeScript, Python, Go, Rust, and more — all reviewed by the same AI.",
	},
];

const container = {
	hidden: {},
	show: {
		transition: { staggerChildren: 0.12 },
	},
};

const item = {
	hidden: { opacity: 0, y: 24 },
	show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export function FeaturesSection() {
	return (
		<section id="features" className="relative py-32">
			<div className="max-w-7xl mx-auto px-6">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6 }}
					className="text-center mb-16"
				>
					<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
						Everything you need to{" "}
						<span className="text-primary">review smarter</span>
					</h2>
					<p className="text-muted-foreground max-w-2xl mx-auto text-lg">
						Powerful AI tools that fit into your existing workflow.
						No context switching, no learning curve.
					</p>
				</motion.div>

				<motion.div
					variants={container}
					initial="hidden"
					whileInView="show"
					viewport={{ once: true, margin: "-100px" }}
					className="grid sm:grid-cols-2 gap-6"
				>
					{features.map((feature) => (
						<motion.div
							key={feature.title}
							variants={item}
							className="group relative p-8 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-300"
						>
							<div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
							<div className="relative">
								<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors duration-300">
									<feature.icon className="w-6 h-6 text-primary" />
								</div>
								<h3 className="text-lg font-semibold mb-2">
									{feature.title}
								</h3>
								<p className="text-muted-foreground leading-relaxed">
									{feature.description}
								</p>
							</div>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
