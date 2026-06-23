import open from "open";
import ora from "ora";
import chalk from "chalk";
import { fetchInitiateDeviceFlow, fetchPollDeviceFlow } from "./api.js";
import { setToken, setUser, clearToken, clearUser } from "./config.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function login(): Promise<void> {
	const spinner = ora("Connecting to Code Sheriff...").start();

	try {
		const deviceFlow = await fetchInitiateDeviceFlow();
		spinner.stop();

		console.log(chalk.bold("\n🤠 Code Sheriff Authorization"));
		console.log("-----------------------------------------");
		console.log(`1. Visit the following URL in your browser:\n   ${chalk.cyan.underline(deviceFlow.verification_uri)}`);
		console.log(`2. Enter the verification code:\n   ${chalk.green.bold(deviceFlow.user_code)}`);
		console.log("-----------------------------------------\n");

		// Open browser automatically
		await open(deviceFlow.verification_uri).catch(() => {
			console.log(chalk.yellow("Could not open browser automatically. Please open the link manually."));
		});

		const pollSpinner = ora("Waiting for authorization...").start();
		const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

		while (Date.now() < expiresAt) {
			await sleep(5000); // Poll every 5s

			try {
				const response = await fetchPollDeviceFlow(deviceFlow.device_code);

				if (response.status === "success" && response.token && response.user) {
					setToken(response.token);
					setUser(response.user);
					pollSpinner.succeed(chalk.green.bold(" Successfully logged in!"));
					console.log(`Welcome back, ${chalk.cyan(response.user.name)}!`);
					return;
				}

				if (response.status === "expired_token") {
					pollSpinner.fail(chalk.red("Authorization expired. Please run login again."));
					return;
				}
			} catch (pollErr) {
				// Silently retry polling failures
			}
		}

		pollSpinner.fail(chalk.red("Authorization timed out. Please try again."));
	} catch (error: any) {
		spinner.fail(chalk.red("Failed to initiate login flow."));
		console.error(chalk.red(error.message));
	}
}

export function logout(): void {
	clearToken();
	clearUser();
	console.log(chalk.green("👋 Successfully logged out of Code Sheriff CLI."));
}
