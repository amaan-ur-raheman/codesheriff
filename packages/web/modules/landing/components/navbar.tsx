"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const navLinks = [
	{ label: "Features", href: "#features" },
	{ label: "How it works", href: "#how-it-works" },
	{ label: "Pricing", href: "#pricing" },
];

export function Navbar() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
				<a
					href="/"
					className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-foreground"
				>
					<Image
						src="/logo-32.png"
						alt="CodeSheriff"
						width={26}
						height={26}
						className="object-contain"
					/>
					CodeSheriff
				</a>

				<nav className="hidden md:flex items-center gap-9">
					{navLinks.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="text-sm text-muted-foreground underline-offset-[6px] decoration-border transition-colors duration-200 hover:text-foreground hover:decoration-brand"
						>
							<span className="underline decoration-inherit">
								{link.label}
							</span>
						</a>
					))}
				</nav>

				<div className="hidden md:flex items-center gap-6">
					<a
						href="/login"
						className="text-sm text-muted-foreground underline-offset-[6px] decoration-border transition-colors duration-200 hover:text-foreground hover:decoration-brand"
					>
						<span className="underline decoration-inherit">Log in</span>
					</a>
					<Button size="sm" className="rounded-none px-5" asChild>
						<a href="/login">Get started</a>
					</Button>
				</div>

				<button
					onClick={() => setIsOpen(!isOpen)}
					className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Toggle menu"
				>
					{isOpen ? <X size={20} /> : <Menu size={20} />}
				</button>
			</div>

			{isOpen && (
				<div className="md:hidden border-t border-border bg-background">
					<div className="px-6 py-4 space-y-4">
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
						<div className="flex items-center justify-between border-t border-border pt-4">
							<a
								href="/login"
								onClick={() => setIsOpen(false)}
								className="text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								Log in
							</a>
							<Button size="sm" className="rounded-none" asChild>
								<a href="/login">Get started</a>
							</Button>
						</div>
					</div>
				</div>
			)}
		</header>
	);
}
