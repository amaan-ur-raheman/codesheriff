import React from "react";
import { Box, Text, useInput } from "ink";
import { lockup, tagline, color } from "../theme.js";

interface LandingProps {
	username?: string;
	onStart: () => void;
	onLogout: () => void;
	onExit: () => void;
}

export const Landing = ({ username, onStart, onLogout, onExit }: LandingProps) => {
	useInput((input, key) => {
		if (key.return) {
			onStart();
		} else if (input.toLowerCase() === "l") {
			onLogout();
		} else if (input.toLowerCase() === "q") {
			onExit();
		}
	});

	return (
		<Box flexDirection="column" padding={2} borderStyle="single" borderColor={color.brand}>
			<Box flexDirection="column" alignItems="center" marginBottom={1}>
				<Text>{lockup}</Text>
				<Text italic color={color.muted}>
					{tagline}
				</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				{username ? (
					<Box flexDirection="row" gap={1}>
						<Text>Logged in as:</Text>
						<Text color={color.verified} bold>
							{username}
						</Text>
					</Box>
				) : (
					<Text color={color.warning}>Not logged in. Use 'codesheriff login' first, or start to log in.</Text>
				)}
			</Box>

			<Box flexDirection="column" gap={0.5}>
				<Text>
					[Enter] <Text color={color.brand} bold>Start</Text> browsing repositories
				</Text>
				{username && (
					<Text>
						[L] <Text color={color.brand} bold>Log out</Text>
					</Text>
				)}
				<Text>
					[Q] <Text color={color.destructive} bold>Quit</Text>
				</Text>
			</Box>
		</Box>
	);
};
