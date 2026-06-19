"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export default function DeviceVerificationPage() {
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
		} catch (err: any) {
			setStatus("error");
			setErrorMsg(err.message || "An error occurred");
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
			<Card className="w-full max-w-md border-border/80 shadow-xl bg-card">
				<CardHeader className="text-center space-y-2">
					<div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
						<ShieldCheck className="w-6 h-6" />
					</div>
					<CardTitle className="text-2xl font-bold tracking-tight">
						Connect a Device
					</CardTitle>
					<CardDescription>
						Enter the code shown on your terminal to authorize the Code Horse CLI.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{status === "success" ? (
						<div className="text-center py-6 space-y-4">
							<div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 animate-bounce">
								<CheckCircle2 className="w-10 h-10" />
							</div>
							<div className="space-y-1">
								<h3 className="text-lg font-semibold text-foreground">
									Device Authorized!
								</h3>
								<p className="text-sm text-muted-foreground">
									You can close this tab now and return to your terminal.
								</p>
							</div>
							<div className="flex items-center justify-center gap-1.5 text-xs text-primary/70 font-medium">
								<Sparkles className="w-3.5 h-3.5" />
								Happy reviewing!
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
								<div className="flex items-center gap-2 text-sm text-red-600 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
									<AlertCircle className="w-4 h-4 shrink-0" />
									<span>{errorMsg}</span>
								</div>
							)}

							<Button
								type="submit"
								className="w-full h-11 text-base font-semibold"
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
