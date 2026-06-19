const DEFAULT_SERVER_URL = "http://localhost:3000";

const getServerUrl = (): string => {
	return process.env.CODEHORSE_SERVER_URL || DEFAULT_SERVER_URL;
};

import { getToken } from "./config.js";

export async function fetchInitiateDeviceFlow() {
	const res = await fetch(`${getServerUrl()}/api/auth/device?action=initiate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
	});
	if (!res.ok) throw new Error("Failed to initiate login flow");
	return res.json() as Promise<{ device_code: string; user_code: string; verification_uri: string }>;
}

export async function fetchPollDeviceFlow(deviceCode: string) {
	const res = await fetch(`${getServerUrl()}/api/auth/device?action=poll`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ device_code: deviceCode }),
	});
	if (!res.ok) throw new Error("Polling request failed");
	return res.json() as Promise<{ status: string; token?: string; user?: any }>;
}

export async function fetchRepositories() {
	const token = getToken();
	if (!token) throw new Error("Not logged in");

	const res = await fetch(`${getServerUrl()}/api/repos`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!res.ok) throw new Error("Failed to fetch repositories");
	const data = await res.json() as any;
	return data.repositories || [];
}

export async function fetchPullRequests(owner: string, repo: string) {
	const token = getToken();
	if (!token) throw new Error("Not logged in");

	const res = await fetch(`${getServerUrl()}/api/repos/${owner}/${repo}/prs`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!res.ok) throw new Error("Failed to fetch pull requests");
	const data = await res.json() as any;
	return data.pullRequests || [];
}

export async function triggerReview(owner: string, repo: string, prNumber: number) {
	const token = getToken();
	if (!token) throw new Error("Not logged in");

	const res = await fetch(`${getServerUrl()}/api/reviews/trigger`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ owner, repo, prNumber }),
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || "Failed to trigger review");
	}
	return res.json();
}

export async function fetchReviewStatus(reviewId: string) {
	const token = getToken();
	if (!token) throw new Error("Not logged in");

	const res = await fetch(`${getServerUrl()}/api/reviews/${reviewId}`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!res.ok) throw new Error("Failed to fetch review status");
	const data = await res.json() as any;
	return data.review;
}

export async function fetchLatestReview(owner: string, repo: string, prNumber: number) {
	const token = getToken();
	if (!token) throw new Error("Not logged in");

	const res = await fetch(`${getServerUrl()}/api/reviews?owner=${owner}&repo=${repo}&pr=${prNumber}`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!res.ok) throw new Error("Failed to fetch latest review");
	const data = await res.json() as any;
	return data.review;
}
