import React, { useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { useReview } from "../hooks/use-review.js";
import { Repository, PullRequest, Review } from "../types.js";

interface ReviewProgressProps {
	repo: Repository;
	pr: PullRequest;
	onComplete: (review: Review) => void;
	onBack: () => void;
}

export const ReviewProgress = ({ repo, pr, onComplete, onBack }: ReviewProgressProps) => {
	useInput((input, key) => {
		if (key.escape || input.toLowerCase() === "b") {
			onBack();
		}
	});
	const { review, status, error, startReview } = useReview(repo.owner, repo.name, pr.number);

	useEffect(() => {
		startReview();
	}, []);

	useEffect(() => {
		if (status === "completed" && review) {
			onComplete(review);
		}
	}, [status, review]);

	return (
		<Box flexDirection="column" padding={2} borderStyle="round" borderColor="yellow">
			<Box marginBottom={1}>
				<Text bold color="yellow">
					Reviewing PR #{pr.number} — {pr.title}
				</Text>
			</Box>

			<Box flexDirection="row" gap={1} marginBottom={1}>
				<Text>Status:</Text>
				{status === "requesting" && <Text color="cyan">Triggering review on server...</Text>}
				{status === "pending" && <Text color="yellow">AI is analyzing changes (this can take 10-20 seconds)...</Text>}
				{status === "completed" && <Text color="green">Complete! Loading review layout...</Text>}
				{status === "failed" && <Text color="red">Review failed.</Text>}
			</Box>

			{error && (
				<Box borderStyle="single" borderColor="red" padding={1} marginBottom={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			<Box>
				<Text color="gray">[Esc/B] Cancel and go back</Text>
			</Box>
		</Box>
	);
};
