import { Github, Twitter } from "lucide-react";

const footerLinks = {
	Product: [
		{ label: "Features", href: "#features" },
		{ label: "Pricing", href: "#pricing" },
		{ label: "Changelog", href: "#" },
		{ label: "Documentation", href: "#" },
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
			<div className="max-w-7xl mx-auto px-6 py-16">
				<div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
					<div className="col-span-2">
						<a
							href="/"
							className="flex items-center gap-2.5 font-bold text-lg text-foreground mb-4"
						>
							<div className="relative w-7 h-7 flex items-center justify-center shrink-0">
								<img src="/logo-32.png" alt="Code Sheriff Logo" className="object-contain w-full h-full" />
							</div>
							CodeSheriff
						</a>
						<p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
							AI-powered code reviews that help your team ship
							better code, faster.
						</p>
						<div className="flex gap-3">
							<a
								href="#"
								className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
							>
								<Github className="w-4 h-4" />
							</a>
							<a
								href="#"
								className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
							>
								<Twitter className="w-4 h-4" />
							</a>
						</div>
					</div>

					{Object.entries(footerLinks).map(([category, links]) => (
						<div key={category}>
							<h4 className="text-sm font-semibold mb-4">
								{category}
							</h4>
							<ul className="space-y-3">
								{links.map((link) => (
									<li key={link.label}>
										<a
											href={link.href}
											className="text-sm text-muted-foreground hover:text-foreground transition-colors"
										>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
					<p className="text-xs text-muted-foreground">
						© {new Date().getFullYear()} CodeSheriff. All rights
						reserved.
					</p>
					<p className="text-xs text-muted-foreground">
						Built with care for developers who ship.
					</p>
				</div>
			</div>
		</footer>
	);
}
