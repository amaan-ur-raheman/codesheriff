"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export default function DeviceVerifyClient() {
	const [code, setCode] = useState("");
	const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [errorMsg, setErrorMsg] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!code.trim()) return;

		setStatus("loading");
		setErrorMsg("");

		try {
			const res = await fetch("/api/auth/device?action=verify", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ user_code: code.trim().toUpperCase() }),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || "Failed to verify code");
			}

			setStatus("success");
		} catch (err: unknown) {
			setStatus("error");
			setErrorMsg(
				err instanceof Error ? err.message : "An error occurred"
			);
		}
	};

	return (
		<div className="min-h-dvh bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-md border-border bg-card">
				<CardHeader className="text-center space-y-3 pt-10 pb-2">
					<div className="mx-auto w-12 h-12 border border-border bg-accent flex items-center justify-center text-foreground">
						<ShieldCheck className="w-6 h-6" />
					</div>
					<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-text">
						Device authorization
					</p>
					<CardTitle className="font-display text-2xl tracking-tight">
						Connect a device
					</CardTitle>
					<CardDescription>
						Enter the code shown on your terminal to authorize the Code Sheriff CLI.
					</CardDescription>
				</CardHeader>
				<CardContent className="pb-10">
					{status === "success" ? (
						<div className="text-center py-6 space-y-4">
							<div className="mx-auto w-14 h-14 bg-brand-soft flex items-center justify-center text-brand-text">
								<CheckCircle2 className="w-8 h-8" />
							</div>
							<div className="space-y-1">
								<h3 className="font-display text-xl text-foreground">
									Device authorized
								</h3>
								<p className="text-sm text-muted-foreground">
									You can close this tab now and return to your terminal.
								</p>
							</div>
							<div className="flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-brand-text">
								<Sparkles className="w-3.5 h-3.5" />
								Happy reviewing
							</div>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Input
									placeholder="ABCD-EFGH"
									value={code}
									onChange={(e) => setCode(e.target.value)}
									disabled={status === "loading"}
									className="text-center text-xl font-mono tracking-widest uppercase h-12"
									maxLength={9}
									required
								/>
							</div>

							{status === "error" && (
								<div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/30 p-3">
									<AlertCircle className="w-4 h-4 shrink-0" />
									<span>{errorMsg}</span>
								</div>
							)}

							<Button
								type="submit"
								className="w-full h-11 text-sm font-medium"
								disabled={status === "loading" || !code.trim()}
							>
								{status === "loading" ? "Authorizing..." : "Authorize Device"}
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
