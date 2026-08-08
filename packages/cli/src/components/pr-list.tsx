import React from "react";
import { Box, Text, useInput } from "ink";
import { usePullRequests } from "../hooks/use-api.js";
import { PullRequest, Repository } from "../types.js";
import { EditorialSelectInput } from "./editorial-select.js";
import { color } from "../theme.js";

interface PRListProps {
	repo: Repository;
	onSelect: (pr: PullRequest) => void;
	onBack: () => void;
}

export const PRList = ({ repo, onSelect, onBack }: PRListProps) => {
	useInput((input, key) => {
		if (key.escape || input.toLowerCase() === "b") {
			onBack();
		}
	});
	const { prs, loading, error } = usePullRequests(repo.owner, repo.name);

	if (loading) {
		return (
			<Box padding={2}>
				<Text color={color.muted}>Loading open Pull Requests...</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box padding={2} flexDirection="column">
				<Text color={color.destructive}>Error loading Pull Requests: {error}</Text>
				<Text color={color.muted}>Press Esc/Back to return to repository selection.</Text>
			</Box>
		);
	}

	if (prs.length === 0) {
		return (
			<Box padding={2} flexDirection="column">
				<Text color={color.warning}>No open Pull Requests found for {repo.fullName}.</Text>
				<Box marginTop={1}>
					<Text color={color.warning}>Press Escape/Back to return.</Text>
				</Box>
			</Box>
		);
	}

	const items = prs.map((pr) => ({
		label: `#${pr.number} ${pr.title}`,
		value: String(pr.number),
		key: String(pr.number),
	}));

	const handleSelect = (item: { value: string }) => {
		const pr = prs.find((p) => String(p.number) === item.value);
		if (pr) {
			onSelect(pr);
		}
	};

	return (
		<Box flexDirection="column" padding={2}>
			<Box marginBottom={1}>
				<Text bold color={color.brand}>
					Select a Pull Request to review ({repo.owner}/{repo.name}):
				</Text>
			</Box>

			<EditorialSelectInput items={items} onSelect={handleSelect} />

			<Box marginTop={1} borderStyle="single" borderColor={color.muted} paddingLeft={1}>
				<Text color={color.muted}>[↑/↓] Navigate  [Enter] Review PR  [Esc/B] Back</Text>
			</Box>
		</Box>
	);
};
