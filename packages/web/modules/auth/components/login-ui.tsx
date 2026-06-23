"use client";

import { signIn } from "@/lib/auth-client";
import { GithubIcon, ArrowRight } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

const LoginUI = () => {
	const [isLoading, setIsLoading] = useState(false);

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
		<div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute top-[15%] left-[20%] w-[400px] h-[400px] bg-primary/6 rounded-full blur-[100px] animate-pulse" />
				<div className="absolute bottom-[20%] right-[15%] w-[350px] h-[350px] bg-primary/4 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
				<div className="absolute top-[60%] left-[60%] w-[250px] h-[250px] bg-primary/3 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: "4s" }} />
			</div>

			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
				<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
				<div className="absolute top-0 bottom-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/10 to-transparent" />
				<div className="absolute top-0 bottom-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/10 to-transparent" />
			</div>

			<motion.div
				initial={{ opacity: 0, y: 20, scale: 0.98 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
				className="relative w-full max-w-md"
			>
				<div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-primary/20 via-primary/5 to-primary/10 opacity-60" />

				<div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-10 shadow-2xl shadow-primary/5">
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15, duration: 0.5 }}
						className="text-center mb-10"
					>
						<a href="/" className="inline-flex items-center gap-2.5 font-bold text-xl text-foreground mb-6">
							<div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
							<span className="text-sm font-black text-primary-foreground">CS</span>
						</div>
						CodeSheriff
						</a>
						<h1 className="text-2xl font-bold tracking-tight mb-2">
							Welcome back
						</h1>
						<p className="text-sm text-muted-foreground">
							Sign in to continue to your dashboard
						</p>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.25, duration: 0.5 }}
					>
						<button
							onClick={handleGithubLogin}
							disabled={isLoading}
							className="group w-full py-3 px-4 bg-foreground text-background rounded-xl font-semibold hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-foreground/10 hover:shadow-foreground/20 hover:scale-[1.01] active:scale-[0.99]"
						>
							{isLoading ? (
								<div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
							) : (
								<GithubIcon size={20} />
							)}
							{isLoading ? "Signing in..." : "Continue with GitHub"}
							{!isLoading && (
								<ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
							)}
						</button>
					</motion.div>

					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.4, duration: 0.5 }}
						className="mt-8 pt-6 border-t border-border"
					>
						<p className="text-center text-xs text-muted-foreground mb-4">
							New to CodeSheriff?{" "}
							<a
								href="/login"
								className="text-primary hover:text-primary/80 font-medium transition-colors"
							>
								Create an account
							</a>
						</p>
						<div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
							<a href="#" className="hover:text-foreground transition-colors">
								Terms
							</a>
							<span className="text-border">·</span>
							<a href="#" className="hover:text-foreground transition-colors">
								Privacy
							</a>
							<span className="text-border">·</span>
							<a href="#" className="hover:text-foreground transition-colors">
								Support
							</a>
						</div>
					</motion.div>
				</div>
			</motion.div>

			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.6, duration: 0.8 }}
				className="absolute bottom-6 left-0 right-0 text-center"
			>
				<a
					href="/"
					className="text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					← Back to home
				</a>
			</motion.div>
		</div>
	);
};

export default LoginUI;
