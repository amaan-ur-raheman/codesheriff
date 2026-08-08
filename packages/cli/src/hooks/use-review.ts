import { useState, useEffect } from "react";
import { triggerReview, fetchLatestReview } from "../lib/api.js";
import { Review } from "../types.js";

export function useReview(owner: string, repo: string, prNumber: number) {
	const [review, setReview] = useState<Review | null>(null);
	const [status, setStatus] = useState<"idle" | "requesting" | "pending" | "completed" | "failed">("idle");
	const [error, setError] = useState<string | null>(null);

	const startReview = async () => {
		setStatus("requesting");
		setError(null);
		try {
			await triggerReview(owner, repo, prNumber);
			setStatus("pending");
		} catch (err: any) {
			setError(err.message || "Failed to trigger review");
			setStatus("failed");
		}
	};

	useEffect(() => {
		if (status !== "pending") return;

		const poll = async () => {
			try {
				const latestReview = await fetchLatestReview(owner, repo, prNumber);

				if (latestReview) {
					setReview(latestReview);
					if (latestReview.status === "completed") {
						setStatus("completed");
						clearInterval(intervalId);
					} else if (latestReview.status === "failed") {
						setStatus("failed");
						setError("Review processing failed on server");
						clearInterval(intervalId);
					}
				}
			} catch {
				// Ignore transient polling fetch errors
			}
		};

		// `intervalId` is only referenced inside `poll` after an await, so the
		// const is fully initialized before any clearInterval runs.
		poll();
		const intervalId = setInterval(poll, 3000);

		return () => clearInterval(intervalId);
	}, [status, owner, repo, prNumber]);

	return { review, status, error, startReview };
}
