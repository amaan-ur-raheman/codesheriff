import React from "react";
import { Box, Text, useInput } from "ink";
import { useRepositories } from "../hooks/use-api.js";
import { Repository } from "../types.js";
import { EditorialSelectInput } from "./editorial-select.js";
import { color } from "../theme.js";

interface RepoListProps {
	onSelect: (repo: Repository) => void;
	onBack: () => void;
}

export const RepoList = ({ onSelect, onBack }: RepoListProps) => {
	useInput((input, key) => {
		if (key.escape || input.toLowerCase() === "b") {
			onBack();
		}
	});
	const { repos, loading, error } = useRepositories();

	if (loading) {
		return (
			<Box padding={2}>
				<Text color={color.muted}>Loading repositories...</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box padding={2} flexDirection="column">
				<Text color={color.destructive}>Error loading repositories: {error}</Text>
				<Text color={color.muted}>Press Esc/Back to return to landing.</Text>
			</Box>
		);
	}

	if (repos.length === 0) {
		return (
			<Box padding={2} flexDirection="column">
				<Text color={color.warning}>No connected repositories found.</Text>
				<Text color={color.muted}>Connect a repository on the dashboard (http://localhost:3000) first.</Text>
				<Box marginTop={1}>
					<Text color={color.warning}>Press Escape/Back to return.</Text>
				</Box>
			</Box>
		);
	}

	const items = repos.map((repo) => ({
		label: `${repo.owner}/${repo.name}`,
		value: repo.id,
		key: repo.id,
	}));

	const handleSelect = (item: { value: string }) => {
		const repo = repos.find((r) => r.id === item.value);
		if (repo) {
			onSelect(repo);
		}
	};

	return (
		<Box flexDirection="column" padding={2}>
			<Box marginBottom={1}>
				<Text bold color={color.brand}>
					Select a connected repository:
				</Text>
			</Box>

			<EditorialSelectInput items={items} onSelect={handleSelect} />

			<Box marginTop={1} borderStyle="single" borderColor={color.muted} paddingLeft={1}>
				<Text color={color.muted}>[↑/↓] Navigate  [Enter] Select  [Esc/B] Back</Text>
			</Box>
		</Box>
	);
};
