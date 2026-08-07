/**
 * Suggestion file paths come from AI-generated review output — untrusted
 * input. Both sandbox runners build repo paths from them, so a `..` or
 * absolute path must never be allowed to escape the checkout.
 */

export class UnsafeFilePathError extends Error {
	constructor(filePath: string) {
		super(`Unsafe file path rejected: ${filePath}`);
		this.name = "UnsafeFilePathError";
	}
}

const SAFE_PATH = /^[a-zA-Z0-9_./-]+$/;

/** Throws UnsafeFilePathError unless filePath is a safe relative repo path. */
export function assertSafeRepoPath(filePath: string): void {
	if (
		!filePath ||
		filePath.startsWith("/") ||
		filePath.includes("..") ||
		!SAFE_PATH.test(filePath)
	) {
		throw new UnsafeFilePathError(filePath);
	}
}
