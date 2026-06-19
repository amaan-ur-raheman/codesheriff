import { useState, useEffect } from "react";
import { fetchRepositories, fetchPullRequests } from "../lib/api.js";
import { Repository, PullRequest } from "../types.js";

export function useRepositories() {
	const [repos, setRepos] = useState<Repository[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refetch = async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchRepositories();
			setRepos(data);
		} catch (err: any) {
			setError(err.message || "Failed to load repositories");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		refetch();
	}, []);

	return { repos, loading, error, refetch };
}

export function usePullRequests(owner: string, repo: string) {
	const [prs, setPrs] = useState<PullRequest[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refetch = async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchPullRequests(owner, repo);
			setPrs(data);
		} catch (err: any) {
			setError(err.message || "Failed to load PRs");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		refetch();
	}, [owner, repo]);

	return { prs, loading, error, refetch };
}
