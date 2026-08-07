import { Polar } from "@polar-sh/sdk";

/**
 * Polar environment: "production" or "sandbox".
 *
 * Fail-safe default: real billing is OPT-IN. Only POLAR_ENV=production
 * points the client at api.polar.sh (live charges); anything unset or
 * unrecognized stays on sandbox so a misconfiguration can never charge
 * real money by accident.
 */
const polarServer = process.env.POLAR_ENV === "production" ? "production" : "sandbox";

export const polarClient = new Polar({
	accessToken: process.env.POLAR_ACCESS_TOKEN!,
	server: polarServer,
});
