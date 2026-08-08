"use client";

import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, GitPullRequest, ShieldCheck } from "lucide-react";

export function HeroSection() {
	const reduce = useReducedMotion();

	return (
		<section className="relative min-h-[100dvh] flex items-center overflow-hidden pt-16">
			<div className="mx-auto w-full max-w-7xl px-6 py-12 grid lg:grid-cols-2 gap-16 items-center">
				<motion.div
					initial={reduce ? false : { opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
				>
					<p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground mb-6">
						<ShieldCheck className="w-4 h-4 text-primary" />
						AI code review on every pull request
					</p>

					<h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.04em] leading-[1.02] text-balance mb-6">
						Your code,{" "}
						<span className="text-primary">under review.</span>
					</h1>

					<p className="text-lg text-muted-foreground max-w-md leading-relaxed mb-10">
						Automated reviews that catch bugs and enforce your
						standards before code hits production.
					</p>

					<div className="flex flex-wrap gap-4">
						<Button size="lg" className="px-8" asChild>
							<a href="/login">
								Get Started Free
								<ArrowRight className="ml-2 w-4 h-4" />
							</a>
						</Button>
						<Button size="lg" variant="outline" asChild>
							<a href="#how-it-works">See how it works</a>
						</Button>
					</div>
				</motion.div>

				<motion.div
					initial={reduce ? false : { opacity: 0, y: 32 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
					className="relative"
				>
					{/* Real component preview: a review-result card */}
					<div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
						<div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
							<div className="flex items-center gap-2.5 min-w-0">
								<div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
									<GitPullRequest className="w-4 h-4" />
								</div>
								<div className="min-w-0">
									<p className="text-sm font-medium leading-tight truncate">
										acme/web-app
									</p>
									<p className="text-xs text-muted-foreground">
										pull request #347
									</p>
								</div>
							</div>
							<Badge
								variant="outline"
								className="text-primary border-primary/40 bg-primary/5 shrink-0"
							>
								AI Review
							</Badge>
						</div>

						<div className="px-4 py-3 font-mono text-[13px] leading-relaxed space-y-0.5">
							<div className="flex gap-3">
								<span className="text-muted-foreground/40 w-4 shrink-0 select-none">+</span>
								<span className="text-verified">
									const validateInput = (data: UserInput) =&gt; {"{"}
								</span>
							</div>
							<div className="flex gap-3">
								<span className="text-muted-foreground/40 w-4 shrink-0 select-none">+</span>
								<span className="text-verified">
									{"  "}if (!data.email) throw new ValidationError();
								</span>
							</div>
							<div className="flex gap-3">
								<span className="text-muted-foreground/40 w-4 shrink-0 select-none">+</span>
								<span className="text-verified">
									{"  "}return sanitize(data);
								</span>
							</div>
							<div className="flex gap-3">
								<span className="text-muted-foreground/40 w-4 shrink-0 select-none">+</span>
								<span className="text-verified">{"}"}</span>
							</div>
						</div>

						<div className="mx-4 mb-4 rounded-lg border border-border bg-muted/40 p-3.5">
							<div className="flex items-center justify-between gap-2 mb-2">
								<p className="text-xs font-medium">Input validation missing</p>
								<span className="inline-flex items-center gap-1 text-[11px] font-medium text-verified shrink-0">
									<CheckCircle2 className="w-3 h-3" />
									Sandbox verified
								</span>
							</div>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Add <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground">isEmail()</code>{" "}
								validation before data reaches the database layer.
							</p>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
