import fs from "fs/promises";
import path from "path";

export interface FixResult {
	success: boolean;
	message: string;
}

/**
 * Applies a code suggestion directly to a file on the local disk.
 * Prioritizes exact string matching of originalCode for safety,
 * falling back to line range replacements if code drift occurs.
 */
export async function applyFixLocally(
	filePath: string,
	originalCode: string,
	suggestedCode: string,
	startLine: number,
	endLine: number
): Promise<FixResult> {
	try {
		const absolutePath = path.resolve(process.cwd(), filePath);

		// Verify file exists
		try {
			await fs.access(absolutePath);
		} catch {
			return {
				success: false,
				message: `File not found: ${filePath}`,
			};
		}

		const fileContent = await fs.readFile(absolutePath, "utf-8");

		// Normalize line endings to avoid CRLF mismatch crashes
		const normalizedContent = fileContent.replace(/\r\n/g, "\n");
		const normalizedOriginal = originalCode.replace(/\r\n/g, "\n").trim();
		const normalizedSuggested = suggestedCode.replace(/\r\n/g, "\n");

		// Attempt 1: Exact string replacement
		if (normalizedOriginal && normalizedContent.includes(normalizedOriginal)) {
			const updatedContent = normalizedContent.replace(normalizedOriginal, normalizedSuggested);
			await fs.writeFile(absolutePath, updatedContent, "utf-8");
			return {
				success: true,
				message: `Successfully applied fix to ${filePath}`,
			};
		}

		// Attempt 2: Fallback to line range replacement
		const lines = normalizedContent.split("\n");
		if (startLine > 0 && startLine <= lines.length) {
			const startIdx = startLine - 1;
			const endIdx = Math.min(endLine - 1, lines.length - 1);

			// Splice in the suggestion
			lines.splice(startIdx, endIdx - startIdx + 1, normalizedSuggested.trim());
			const updatedContent = lines.join("\n");

			await fs.writeFile(absolutePath, updatedContent, "utf-8");
			return {
				success: true,
				message: `Applied fix to ${filePath} via line range L${startLine}-L${endLine}`,
			};
		}

		return {
			success: false,
			message: "Could not apply fix: Original code block mismatch and line range invalid",
		};
	} catch (error: any) {
		return {
			success: false,
			message: `Failed to write fix: ${error.message || "Unknown error"}`,
		};
	}
}
