#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { Command } from "commander";
import { App } from "./app.js";
import { login, logout } from "./lib/auth.js";
import { getToken } from "./lib/config.js";
import { brand, destructive, bold } from "./theme.js";

const program = new Command();

program
	.name("codesheriff")
	.description("Code Sheriff Interactive AI Pull Request Reviewer")
	.version("0.1.0");

// Default action (if no command is specified)
program
	.action(async () => {
		const token = getToken();

		if (!token) {
			console.log(destructive("\n! You are not logged in."));
			console.log(`Run ${brand(bold("codesheriff login"))} to connect your account first.\n`);
			process.exit(1);
		}

		// Renders the Ink TUI
		const { waitUntilExit } = render(React.createElement(App));
		await waitUntilExit();
	});

program
	.command("login")
	.description("Authenticate Code Sheriff CLI via browser device code flow")
	.action(async () => {
		await login();
		process.exit(0);
	});

program
	.command("logout")
	.description("Disconnect your Code Sheriff account credentials from this machine")
	.action(() => {
		logout();
		process.exit(0);
	});

program.parse(process.argv);
