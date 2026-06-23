"use client";

import { motion } from "motion/react";
import { GitBranch, Sparkles, Rocket } from "lucide-react";

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

const container = {
	hidden: {},
	show: { transition: { staggerChildren: 0.2 } },
};

const item = {
	hidden: { opacity: 0, y: 30 },
	show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
};

export function HowItWorks() {
	return (
		<section id="how-it-works" className="relative py-32">
			<div className="absolute inset-0">
				<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
				<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
			</div>

			<div className="max-w-7xl mx-auto px-6">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6 }}
					className="text-center mb-20"
				>
					<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
						Up and running in{" "}
						<span className="text-primary">three steps</span>
					</h2>
					<p className="text-muted-foreground max-w-xl mx-auto text-lg">
						No complex setup. No steep learning curve. Just better
						code reviews.
					</p>
				</motion.div>

				<motion.div
					variants={container}
					initial="hidden"
					whileInView="show"
					viewport={{ once: true, margin: "-100px" }}
					className="relative grid md:grid-cols-3 gap-12"
				>
					<div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px bg-gradient-to-r from-primary/30 via-primary/10 to-primary/30" />

					{steps.map((step) => (
						<motion.div
							key={step.number}
							variants={item}
							className="relative text-center"
						>
							<div className="relative mx-auto mb-8">
								<div className="w-24 h-24 rounded-2xl border border-border bg-card flex items-center justify-center mx-auto relative z-10">
									<step.icon className="w-10 h-10 text-primary" />
								</div>
								<div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center z-20">
									{step.number}
								</div>
							</div>
							<h3 className="text-xl font-semibold mb-3">
								{step.title}
							</h3>
							<p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
								{step.description}
							</p>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
