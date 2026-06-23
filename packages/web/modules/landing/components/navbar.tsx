"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const navLinks = [
	{ label: "Features", href: "#features" },
	{ label: "How It Works", href: "#how-it-works" },
	{ label: "Pricing", href: "#pricing" },
];

export function Navbar() {
	const [isOpen, setIsOpen] = useState(false);
	const [isScrolled, setIsScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => setIsScrolled(window.scrollY > 20);
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<motion.nav
			style={{
				backgroundColor: isScrolled
					? "color-mix(in srgb, var(--background) 95%, transparent)"
					: "transparent",
			}}
			className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-xl transition-colors duration-300"
		>
			<div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
				<a href="/" className="flex items-center gap-2.5 font-bold text-lg text-foreground">
					<div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
						<span className="text-xs font-black text-primary-foreground">CS</span>
					</div>
					CodeSheriff
				</a>

				<div className="hidden md:flex items-center gap-8">
					{navLinks.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
						>
							{link.label}
						</a>
					))}
				</div>

				<div className="hidden md:flex items-center gap-3">
					<Button variant="ghost" size="sm" asChild>
						<a href="/login">Log in</a>
					</Button>
					<Button size="sm" asChild>
						<a href="/login">Get Started</a>
					</Button>
				</div>

				<button
					onClick={() => setIsOpen(!isOpen)}
					className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
				>
					{isOpen ? <X size={20} /> : <Menu size={20} />}
				</button>
			</div>

			{isOpen && (
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					exit={{ opacity: 0, height: 0 }}
					className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl"
				>
					<div className="px-6 py-4 space-y-3">
						{navLinks.map((link) => (
							<a
								key={link.href}
								href={link.href}
								onClick={() => setIsOpen(false)}
								className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								{link.label}
							</a>
						))}
						<div className="pt-3 border-t border-border flex flex-col gap-2">
							<Button variant="ghost" size="sm" asChild>
								<a href="/login">Log in</a>
							</Button>
							<Button size="sm" asChild>
								<a href="/login">Get Started</a>
							</Button>
						</div>
					</div>
				</motion.div>
			)}
		</motion.nav>
	);
}
