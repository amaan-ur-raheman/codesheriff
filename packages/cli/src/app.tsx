import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Landing } from "./components/landing.js";
import { RepoList } from "./components/repo-list.js";
import { PRList } from "./components/pr-list.js";
import { ReviewProgress } from "./components/review-progress.js";
import { ReviewLayout } from "./components/review-layout.js";
import { Repository, PullRequest, Review, ViewState } from "./types.js";
import { getUser, getToken } from "./lib/config.js";
import { logout } from "./lib/auth.js";

export const App = () => {
	const [view, setView] = useState<ViewState>("landing");
	const [user, setUser] = useState<any>(null);
	const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
	const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
	const [review, setReview] = useState<Review | null>(null);

	// Load user config on mount
	useEffect(() => {
		const token = getToken();
		const configUser = getUser();
		if (token && configUser) {
			setUser(configUser);
		}
	}, [view]);

	const handleLogout = () => {
		logout();
		setUser(null);
		setView("landing");
	};

	const handleExit = () => {
		process.exit(0);
	};

	return (
		<Box flexDirection="column" padding={1}>
			{view === "landing" && (
				<Landing
					username={user?.name}
					onStart={() => {
						if (getToken()) {
							setView("repo-list");
						} else {
							setView("landing");
						}
					}}
					onLogout={handleLogout}
					onExit={handleExit}
				/>
			)}

			{view === "repo-list" && (
				<RepoList
					onSelect={(repo) => {
						setSelectedRepo(repo);
						setView("pr-list");
					}}
					onBack={() => setView("landing")}
				/>
			)}

			{view === "pr-list" && selectedRepo && (
				<PRList
					repo={selectedRepo}
					onSelect={(pr) => {
						setSelectedPR(pr);
						setView("review-progress");
					}}
					onBack={() => setView("repo-list")}
				/>
			)}

			{view === "review-progress" && selectedRepo && selectedPR && (
				<ReviewProgress
					repo={selectedRepo}
					pr={selectedPR}
					onComplete={(completedReview) => {
						setReview(completedReview);
						setView("review-layout");
					}}
					onBack={() => setView("pr-list")}
				/>
			)}

			{view === "review-layout" && review && (
				<ReviewLayout
					review={review}
					onBack={() => setView("pr-list")}
				/>
			)}
		</Box>
	);
};
