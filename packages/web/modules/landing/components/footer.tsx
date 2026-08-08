import Image from "next/image";
import { Github, Twitter } from "lucide-react";

const footerLinks = {
	Product: [
		{ label: "Features", href: "#features" },
		{ label: "Pricing", href: "#pricing" },
		{ label: "Documentation", href: "#" },
		{ label: "Changelog", href: "#" },
	],
	Company: [
		{ label: "About", href: "#" },
		{ label: "Blog", href: "#" },
		{ label: "Careers", href: "#" },
		{ label: "Contact", href: "#" },
	],
	Legal: [
		{ label: "Privacy Policy", href: "#" },
		{ label: "Terms of Service", href: "#" },
		{ label: "Security", href: "#" },
	],
};

export function Footer() {
	return (
		<footer className="border-t border-border bg-background">
			<div className="mx-auto max-w-7xl px-6 py-16">
				{/* masthead row */}
				<div className="flex flex-wrap items-center justify-between gap-4 pb-10">
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
					<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Edition 01 · Automated code review, since 2026
					</p>
				</div>

				<div className="grid grid-cols-2 gap-10 border-t border-border py-12 md:grid-cols-5">
					<div className="col-span-2">
						<p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
							AI-powered code review that catches bugs before they
							reach production and verifies every fix before it
							reaches your branch.
						</p>
						<div className="mt-6 flex gap-3">
							<a
								href="#"
								className="flex h-9 w-9 items-center justify-center border border-border text-muted-foreground transition-colors duration-200 hover:border-brand hover:text-brand"
								aria-label="GitHub"
							>
								<Github className="h-4 w-4" />
							</a>
							<a
								href="#"
								className="flex h-9 w-9 items-center justify-center border border-border text-muted-foreground transition-colors duration-200 hover:border-brand hover:text-brand"
								aria-label="Twitter"
							>
								<Twitter className="h-4 w-4" />
							</a>
						</div>
					</div>

					{Object.entries(footerLinks).map(([category, links]) => (
						<div key={category}>
							<h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
								{category}
							</h4>
							<ul className="mt-5 space-y-3">
								{links.map((link) => (
									<li key={link.label}>
										<a
											href={link.href}
											className="text-sm text-muted-foreground underline-offset-[6px] decoration-border transition-colors duration-200 hover:text-foreground hover:decoration-brand"
										>
											<span className="underline decoration-inherit">
												{link.label}
											</span>
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
					<p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
						© {new Date().getFullYear()} CodeSheriff. All rights
						reserved.
					</p>
					<p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
						Set in Fraunces &amp; Geist
					</p>
				</div>
			</div>
		</footer>
	);
}
