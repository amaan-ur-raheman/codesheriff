"use client";

import { signIn } from "@/lib/auth-client";
import Image from "next/image";
import { GithubIcon, ArrowRight } from "lucide-react";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const LoginUI = () => {
	const [isLoading, setIsLoading] = useState(false);
	// Respect the app-wide reduced-motion policy (see lib/motion.ts): the
	// entrance runs as an instant reveal instead of a slide/fade.
	const prefersReducedMotion = useReducedMotion();

	const handleGithubLogin = async () => {
		setIsLoading(true);
		try {
			await signIn.social({
				provider: "github",
			});
		} catch (error) {
			console.error("GitHub login failed:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-dvh bg-background grid lg:grid-cols-2">
			{/* Editorial panel — the print specimen half */}
			<aside className="hidden lg:flex flex-col justify-between border-r border-border p-12 xl:p-16">
				<a
					href="/"
					className="inline-flex items-center gap-2.5 font-display text-xl tracking-tight text-foreground"
				>
					<div className="relative w-8 h-8 flex items-center justify-center shrink-0">
						<Image src="/logo-64.png" alt="Code Sheriff Logo" width={64} height={64} className="object-contain w-full h-full" />
					</div>
					CodeSheriff
				</a>

				<div className="max-w-md">
					<p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-text mb-6">
						Automated code review
					</p>
					<div className="h-px w-12 bg-brand mb-10" />
					<h1 className="font-display text-6xl xl:text-7xl leading-[1.04] tracking-tight text-foreground">
						Your code,{" "}
						<em className="italic text-brand-text">under review.</em>
					</h1>
					<p className="mt-8 text-base leading-relaxed text-muted-foreground max-w-sm">
						AI reviews every pull request against your team&apos;s standards: surfaced as inline comments, verified in a sandbox, shipped without the busywork.
					</p>
				</div>

				<div className="border-t border-border pt-6 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
					<span>GitHub-native</span>
					<span>Private by default</span>
					<span>Sandbox-verified</span>
				</div>
			</aside>

			{/* Sign-in side */}
			<div className="flex items-center justify-center p-6 sm:p-12">
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={
						prefersReducedMotion
							? { duration: 0 }
							: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
					}
					className="w-full max-w-sm"
				>
					<a
						href="/"
						className="lg:hidden inline-flex items-center gap-2.5 font-display text-xl tracking-tight text-foreground mb-12"
					>
						<div className="relative w-8 h-8 flex items-center justify-center shrink-0">
							<Image src="/logo-64.png" alt="Code Sheriff Logo" width={64} height={64} className="object-contain w-full h-full" />
						</div>
						CodeSheriff
					</a>

					<p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-text mb-4">
						Sign in
					</p>
					<h1 className="font-display text-3xl tracking-tight text-foreground">
						Welcome back
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Sign in to continue to your dashboard.
					</p>

					<button
						onClick={handleGithubLogin}
						disabled={isLoading}
						className="group mt-10 w-full h-12 bg-foreground text-background font-medium hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-3 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
					>
						{isLoading ? (
							<div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
						) : (
							<GithubIcon size={18} />
						)}
						{isLoading ? "Signing in..." : "Continue with GitHub"}
						{!isLoading && (
							<ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-[transform,opacity] duration-200" />
						)}
					</button>

					<div className="mt-10 pt-6 border-t border-border">
						<p className="text-center text-sm text-muted-foreground mb-6">
							New to CodeSheriff? Signing in with GitHub creates your account automatically.
						</p>
						<div className="flex items-center justify-center gap-5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							<a href="#" className="hover:text-foreground transition-colors">
								Terms
							</a>
							<span className="text-border">/</span>
							<a href="#" className="hover:text-foreground transition-colors">
								Privacy
							</a>
							<span className="text-border">/</span>
							<a href="#" className="hover:text-foreground transition-colors">
								Support
							</a>
						</div>
					</div>

					<div className="mt-10 text-center">
						<a
							href="/"
							className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							← Back to home
						</a>
					</div>
				</motion.div>
			</div>
		</div>
	);
};

export default LoginUI;
