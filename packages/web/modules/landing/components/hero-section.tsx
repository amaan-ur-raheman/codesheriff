"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function HeroSection() {
	return (
		<section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
			<div className="absolute inset-0">
				<div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/8 rounded-full blur-[128px]" />
				<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
			</div>

			<div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
				>
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-8">
						<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
						Powered by Advanced AI
					</div>

					<h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-balance mb-6">
						Ship better code,{" "}
						<span className="text-primary">faster.</span>
					</h1>

					<p className="text-lg text-muted-foreground max-w-lg leading-relaxed mb-10">
						AI-powered code reviews on every pull request. Catch bugs,
						enforce best practices, and ship with confidence — before
						it hits production.
					</p>

					<div className="flex flex-wrap gap-4">
						<Button
							size="lg"
							className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
							asChild
						>
							<a href="/login">
								Get Started Free
								<ArrowRight className="ml-2 w-4 h-4" />
							</a>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="border-white/10 hover:border-white/20 hover:bg-white/5"
						>
							<Play className="mr-2 w-4 h-4" />
							See it in action
						</Button>
					</div>

					<div className="mt-12 flex items-center gap-6 text-sm text-muted-foreground">
						<div className="flex items-center gap-2">
							<div className="flex -space-x-2">
								{[...Array(4)].map((_, i) => (
									<div
										key={i}
										className="w-7 h-7 rounded-full border-2 border-background bg-gradient-to-br from-primary/40 to-primary/10"
										style={{ zIndex: 4 - i }}
									/>
								))}
							</div>
							<span>2,400+ developers</span>
						</div>
						<div className="w-px h-4 bg-white/10" />
						<span>No credit card required</span>
					</div>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 40, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
					className="relative"
				>
					<div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/5 to-primary/20 rounded-2xl blur-xl opacity-50" />
					<div className="relative rounded-2xl border border-white/10 bg-card/50 backdrop-blur-sm overflow-hidden shadow-2xl">
						<div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
							<div className="flex gap-1.5">
								<div className="w-3 h-3 rounded-full bg-white/10" />
								<div className="w-3 h-3 rounded-full bg-white/10" />
								<div className="w-3 h-3 rounded-full bg-white/10" />
							</div>
							<span className="text-xs text-muted-foreground ml-2 font-mono">
								pull-request #347
							</span>
							<span className="ml-auto text-xs text-primary font-medium">
								AI Review
							</span>
						</div>

						<div className="p-5 font-mono text-sm space-y-3">
							<div className="flex items-center gap-3 text-muted-foreground">
								<span className="text-white/30 w-5">+</span>
								<span className="text-green-400/90">
									const validateInput = (data: UserInput) =&gt; &#123;
								</span>
							</div>
							<div className="flex items-center gap-3 text-muted-foreground">
								<span className="text-white/30 w-5">+</span>
								<span className="text-green-400/90">
									{"  "}if (!data.email) &#123;
								</span>
							</div>
							<div className="flex items-center gap-3 text-muted-foreground">
								<span className="text-white/30 w-5">+</span>
								<span className="text-green-400/90">
									{"    "}throw new ValidationError(&quot;Email required&quot;);
								</span>
							</div>
							<div className="flex items-center gap-3 text-muted-foreground">
								<span className="text-white/30 w-5">+</span>
								<span className="text-green-400/90">{"  "}&#125;</span>
							</div>
							<div className="flex items-center gap-3 text-muted-foreground">
								<span className="text-white/30 w-5">+</span>
								<span className="text-green-400/90">{"  "}return sanitize(data);</span>
							</div>
							<div className="flex items-center gap-3 text-muted-foreground">
								<span className="text-white/30 w-5">+</span>
								<span className="text-green-400/90">&#125;</span>
							</div>
						</div>

						<div className="mx-5 mb-5 p-3 rounded-lg border border-primary/20 bg-primary/5">
							<div className="flex items-center gap-2 mb-2">
								<div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
									<span className="text-[10px] font-bold text-primary">AI</span>
								</div>
								<span className="text-xs font-medium text-primary">
									Review Suggestion
								</span>
							</div>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Consider adding{" "}
								<code className="px-1 py-0.5 rounded bg-white/5 text-primary text-[11px]">
									isEmail()
								</code>{" "}
								validation from <code className="px-1 py-0.5 rounded bg-white/5 text-primary text-[11px]">zod</code>{" "}
								to prevent invalid email formats from reaching the
								database layer.
							</p>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
