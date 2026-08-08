import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { Review, CodeSuggestion } from "../types.js";
import { applyFixLocally } from "../lib/fix.js";
import { copyToClipboard } from "../lib/clipboard.js";
import { color, lockup } from "../theme.js";

interface ReviewLayoutProps {
	review: Review;
	onBack: () => void;
}

export const ReviewLayout = ({ review, onBack }: ReviewLayoutProps) => {
	// Group suggestions by file
	const filesWithSuggestions = useMemo(() => {
		const groups: Record<string, CodeSuggestion[]> = {};
		review.suggestions?.suggestions.forEach((s) => {
			if (!groups[s.filePath]) {
				groups[s.filePath] = [];
			}
			groups[s.filePath].push(s);
		});
		return Object.entries(groups);
	}, [review]);

	const [activeFileIndex, setActiveFileIndex] = useState(0);
	const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const currentFileEntry = filesWithSuggestions[activeFileIndex];
	const currentSuggestions = currentFileEntry ? currentFileEntry[1] : [];
	const currentSuggestion = currentSuggestions[activeSuggestionIndex];

	// Flash a status message on screen
	const flashStatus = (msg: string) => {
		setStatusMessage(msg);
		setTimeout(() => setStatusMessage(null), 3000);
	};

	// Handle keyboard controls
	useInput(async (input, key) => {
		if (key.escape || input.toLowerCase() === "b") {
			onBack();
			return;
		}

		if (key.upArrow) {
			// Navigate files list
			if (activeFileIndex > 0) {
				setActiveFileIndex(activeFileIndex - 1);
				setActiveSuggestionIndex(0); // reset suggestion index
			}
		}

		if (key.downArrow) {
			// Navigate files list
			if (activeFileIndex < filesWithSuggestions.length - 1) {
				setActiveFileIndex(activeFileIndex + 1);
				setActiveSuggestionIndex(0); // reset suggestion index
			}
		}

		if (key.leftArrow) {
			// Navigate suggestions within selected file
			if (activeSuggestionIndex > 0) {
				setActiveSuggestionIndex(activeSuggestionIndex - 1);
			}
		}

		if (key.rightArrow) {
			// Navigate suggestions within selected file
			if (activeSuggestionIndex < currentSuggestions.length - 1) {
				setActiveSuggestionIndex(activeSuggestionIndex + 1);
			}
		}

		if (input.toLowerCase() === "c" && currentSuggestion) {
			// Copy suggested code
			await copyToClipboard(currentSuggestion.suggestedCode);
			flashStatus("Copied suggested code to clipboard.");
		}

		if (input.toLowerCase() === "z" && currentSuggestion) {
			// Auto apply fix to local disk file
			flashStatus("Applying fix locally...");
			const res = await applyFixLocally(
				currentSuggestion.filePath,
				currentSuggestion.originalCode,
				currentSuggestion.suggestedCode,
				currentSuggestion.startLine,
				currentSuggestion.endLine
			);

			if (res.success) {
				flashStatus("Local fix applied successfully.");
			} else {
				flashStatus(`Error applying fix: ${res.message}`);
			}
		}
	});

	if (filesWithSuggestions.length === 0) {
		return (
			<Box padding={2} flexDirection="column">
				<Text color={color.verified}>No issues found in this review.</Text>
				<Box marginTop={1}>
					<Text color={color.muted}>Press Escape/Back to return.</Text>
				</Box>
			</Box>
		);
	}

	const severityColor = (severity: CodeSuggestion["severity"]) =>
		severity === "error" ? color.destructive : severity === "warning" ? color.warning : color.brand;

	return (
		<Box flexDirection="column" height={22} padding={1}>
			{/* Top Header */}
			<Box justifyContent="space-between" borderStyle="single" borderColor={color.brand} paddingX={1} marginBottom={1}>
				<Text bold>
					{lockup} — #{review.prNumber} {review.prTitle}
				</Text>
				<Text color={color.muted}>{review.status.toUpperCase()}</Text>
			</Box>

			{/* Central Split Layout */}
			<Box flexDirection="row" flexGrow={1} gap={2}>
				{/* Left Pane: Files Selection list */}
				<Box flexDirection="column" width="30%" borderStyle="single" borderColor={color.muted} padding={1}>
					<Box marginBottom={1}>
						<Text bold color={color.muted}>
							FILES ({filesWithSuggestions.length})
						</Text>
					</Box>
					{filesWithSuggestions.map(([filePath, sugs], index) => {
						const isActive = index === activeFileIndex;
						return (
							<Text key={filePath} wrap="truncate" color={isActive ? color.brand : color.default} bold={isActive}>
								{isActive ? "❯ " : "  "}
								{filePath.split("/").pop()}
								<Text color={isActive ? color.brand : color.muted}> ({sugs.length})</Text>
							</Text>
						);
					})}
				</Box>

				{/* Right Pane: Suggestions Display Details */}
				<Box flexDirection="column" width="70%" borderStyle="single" borderColor={color.brand} padding={1}>
					{currentSuggestion ? (
						<Box flexDirection="column" flexGrow={1}>
							<Box justifyContent="space-between" marginBottom={1}>
								<Text bold color={color.warning}>
									Issue {activeSuggestionIndex + 1}/{currentSuggestions.length}: {currentSuggestion.title}
								</Text>
								<Text color={severityColor(currentSuggestion.severity)}>
									[{currentSuggestion.severity.toUpperCase()}]
								</Text>
							</Box>

							<Box marginBottom={1}>
								<Text color={color.muted} italic>
									File: {currentSuggestion.filePath}:L{currentSuggestion.startLine}
								</Text>
							</Box>

							<Box flexGrow={1} borderStyle="single" borderColor={color.muted} paddingX={1} marginBottom={1}>
								<Text wrap="wrap" color={color.default}>
									{currentSuggestion.description}
								</Text>
							</Box>

							{/* Diff previews if small */}
							<Box flexDirection="row" gap={1} height={4} overflowY="hidden" marginBottom={1}>
								<Box width="50%" flexDirection="column" borderStyle="single" borderColor={color.destructive} paddingX={1}>
									<Text color={color.destructive} wrap="truncate">
										- {currentSuggestion.originalCode.substring(0, 100).trim()}
									</Text>
								</Box>
								<Box width="50%" flexDirection="column" borderStyle="single" borderColor={color.verified} paddingX={1}>
									<Text color={color.verified} wrap="truncate">
										+ {currentSuggestion.suggestedCode.substring(0, 100).trim()}
									</Text>
								</Box>
							</Box>
						</Box>
					) : (
						<Text color={color.destructive}>No suggestion selected</Text>
					)}
				</Box>
			</Box>

			{/* Status Bar */}
			<Box height={1} marginTop={1} justifyContent="space-between">
				{statusMessage ? (
					<Text color={color.verified} bold>
						{statusMessage}
					</Text>
				) : (
					<Text color={color.muted}>
						[↑/↓] Change File  [←/→] Change Suggestion  [c] Copy Fix  [z] Apply Fix  [Esc/B] Back
					</Text>
				)}
			</Box>
		</Box>
	);
};
