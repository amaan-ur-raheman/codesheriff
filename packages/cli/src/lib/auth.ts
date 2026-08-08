import open from "open";
import ora from "ora";
import { fetchInitiateDeviceFlow, fetchPollDeviceFlow } from "./api.js";
import { setToken, setUser, clearToken, clearUser } from "./config.js";
import { brand, bold, destructive, verified, warning, underline, lockup } from "../theme.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function login(): Promise<void> {
	const spinner = ora({ text: "Connecting to Code Sheriff...", color: "yellow" }).start();

	try {
		const deviceFlow = await fetchInitiateDeviceFlow();
		spinner.stop();

		console.log(bold(`\n${lockup} — Authorization`));
		console.log("-----------------------------------------");
		console.log(`1. Visit the following URL in your browser:\n   ${brand(underline(deviceFlow.verification_uri))}`);
		console.log(`2. Enter the verification code:\n   ${verified(bold(deviceFlow.user_code))}`);
		console.log("-----------------------------------------\n");

		// Open browser automatically
		await open(deviceFlow.verification_uri).catch(() => {
			console.log(warning("Could not open browser automatically. Please open the link manually."));
		});

		const pollSpinner = ora({ text: "Waiting for authorization...", color: "yellow" }).start();
		const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

		while (Date.now() < expiresAt) {
			await sleep(5000); // Poll every 5s

			try {
				const response = await fetchPollDeviceFlow(deviceFlow.device_code);

				if (response.status === "success" && response.token && response.user) {
					setToken(response.token);
					setUser(response.user);
					pollSpinner.succeed(verified(bold(" Successfully logged in!")));
					console.log(`Welcome back, ${brand(response.user.name)}!`);
					return;
				}

				if (response.status === "expired_token") {
					pollSpinner.fail(destructive("Authorization expired. Please run login again."));
					return;
				}
			} catch {
				// Silently retry polling failures
			}
		}

		pollSpinner.fail(destructive("Authorization timed out. Please try again."));
	} catch (error: any) {
		spinner.fail(destructive("Failed to initiate login flow."));
		console.error(destructive(error.message));
	}
}

export function logout(): void {
	clearToken();
	clearUser();
	console.log(verified("Logged out of Code Sheriff CLI."));
}
