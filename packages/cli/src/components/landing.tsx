import React from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";

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
		<Box flexDirection="column" padding={2} borderStyle="round" borderColor="cyan">
			<Box flexDirection="column" alignItems="center" marginBottom={1}>
				<Text color="cyan" bold>
					{`
   ____          _         _   _                      
  / ___|___   __| | ___   | | | | ___  _ __ ___  ___ 
 | |   / _ \\ / _\` |/ _ \\  | |_| |/ _ \\| '__/ __|/ _ \\
 | |__| (_) | (_| |  __/  |  _  | (_) | |  \\__ \\  __/
  \\____\\___/ \\__,_|\\___|  |_| |_|\\___/|_|  |___/\\___|
                    🐴 TUI Reviewer
					`}
				</Text>
				<Text italic color="gray">
					AI-Powered Code Review Companion
				</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				{username ? (
					<Box flexDirection="row" gap={1}>
						<Text>Logged in as:</Text>
						<Text color="green" bold>
							{username}
						</Text>
					</Box>
				) : (
					<Text color="yellow">Not logged in. Use 'codehorse login' first, or start to log in.</Text>
				)}
			</Box>

			<Box flexDirection="column" gap={0.5}>
				<Text>👉 Press <Text color="green" bold>Enter</Text> to start browsing repositories</Text>
				{username && (
					<Text>👉 Press <Text color="yellow" bold>L</Text> to log out</Text>
				)}
				<Text>👉 Press <Text color="red" bold>Q</Text> to quit</Text>
			</Box>
		</Box>
	);
};
