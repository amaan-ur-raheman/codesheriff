"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Menu, X } from "lucide-react";

const navLinks = [
	{ label: "Features", href: "#features" },
	{ label: "How it works", href: "#how-it-works" },
	{ label: "Pricing", href: "#pricing" },
];

export function Navbar() {
	const [isOpen, setIsOpen] = useState(false);
	const toggleRef = useRef<HTMLButtonElement>(null);

	// Navigation disclosure pattern: Escape closes the menu from anywhere on
	// the page, returning focus to the toggle. Registered on the document so
	// it fires even after the user has moved focus outside the menu.
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setIsOpen(false);
				toggleRef.current?.focus();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen]);

	return (
		<header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
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
							className="link-underline text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
						>
							{link.label}
						</a>
					))}
				</nav>

				<div className="hidden md:flex items-center gap-6">
					<ThemeToggle />
					<a
						href="/login"
						className="link-underline text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
					>
						Log in
					</a>
					<Button size="sm" className="rounded-none px-5 active:scale-[0.98] transition-transform duration-100" asChild>
						<a href="/login">Get started</a>
					</Button>
				</div>

				<button
					ref={toggleRef}
					onClick={() => setIsOpen(!isOpen)}
					className="md:hidden p-3 -mr-1 text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Toggle menu"
					aria-expanded={isOpen}
					aria-controls="mobile-nav"
				>
					{isOpen ? <X size={20} /> : <Menu size={20} />}
				</button>
			</div>

			{/* Mobile menu — grid-rows transition matches the FAQ accordion pattern */}
			<div
				id="mobile-nav"
				aria-hidden={!isOpen}
				inert={!isOpen}
				className={`md:hidden border-t border-border bg-background/95 backdrop-blur-sm grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out ${
					isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
				}`}
			>
				<div className="overflow-hidden">
					<div className="px-6 py-4 space-y-4">
						{navLinks.map((link) => (
							<a
								key={link.href}
								href={link.href}
								onClick={() => setIsOpen(false)}
								className="block text-sm py-2 text-muted-foreground hover:text-foreground transition-colors"
							>
								{link.label}
							</a>
						))}
						<div className="flex items-center justify-between border-t border-border pt-4">
							<div className="flex items-center gap-4">
								<ThemeToggle />
								<a
									href="/login"
									onClick={() => setIsOpen(false)}
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Log in
								</a>
							</div>
							<Button size="sm" className="rounded-none" asChild>
								<a href="/login">Get started</a>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
