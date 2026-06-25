import { describe, it, expect } from "vitest";

describe("Comment Degradation Logic", () => {
	it("should clean the suggestion block from the comment body when degrading to a single line", () => {
		const s = {
			filePath: "src/index.ts",
			startLine: 10,
			endLine: 15,
			severity: "error",
			title: "Critical Security Issue",
			description: "Fix this immediately",
			suggestedCode: "const clean = true;\nrunClean();",
		};

		// 1. Map phase (recreated exactly from review.ts map logic)
		const severityText = s.severity === "error" 
			? "⚠️ Potential issue | 🔴 Critical" 
			: s.severity === "warning" 
				? "⚠️ Potential issue | 🟡 Major" 
				: "ℹ️ Suggestion";
		
		const title = s.title ? `### ${severityText}\n**${s.title}**\n\n` : `### ${severityText}\n\n`;
		const description = s.description ? `${s.description}\n\n` : "";
		
		let suggestionBlock = "";
		if (s.suggestedCode !== undefined && s.suggestedCode !== null) {
			suggestionBlock = `\`\`\`suggestion\n${s.suggestedCode}\n\`\`\`\n\n`;
		}

		const promptBlock = `<details>\n<summary>🤖 Prompt for AI Agents</summary>\n\nVerify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.\n\nIn \`@${s.filePath}\` at line ${s.startLine}, ${s.title ? `${s.title}: ` : ""}${s.description || ""}\n</details>\n\n`;

		const endLine = s.endLine || s.startLine;
		const commentObj: any = {
			path: s.filePath,
			line: endLine,
			side: "RIGHT",
			body: `${title}${description}${suggestionBlock}${promptBlock}`,
		};

		if (s.startLine && s.endLine && s.startLine < s.endLine) {
			commentObj.start_line = s.startLine;
			commentObj.start_side = "RIGHT";
		}

		// Verify initial state has suggestion block
		expect(commentObj.body).toContain("```suggestion");

		// Mock fileValidLines: endLine (15) is in diff, but startLine (10) is NOT in diff
		const fileValidLines = new Set([15]);

		// 2. Filter phase (recreated exactly from review.ts filter logic)
		const line = commentObj.line;
		const startLine = commentObj.start_line;

		if (startLine && !fileValidLines.has(startLine)) {
			delete commentObj.start_line;
			delete commentObj.start_side;
			// Remove the suggestion block to avoid posting an invalid multi-line suggestion on a single-line comment
			commentObj.body = commentObj.body.replace(/```suggestion\r?\n[\s\S]*?\r?\n```\r?\n\r?\n/, "");
		}

		// Verify suggestion block was removed but other parts of the comment remain intact
		expect(commentObj.start_line).toBeUndefined();
		expect(commentObj.start_side).toBeUndefined();
		expect(commentObj.body).not.toContain("```suggestion");
		expect(commentObj.body).toContain("### ⚠️ Potential issue | 🔴 Critical");
		expect(commentObj.body).toContain("Fix this immediately");
		expect(commentObj.body).toContain("🤖 Prompt for AI Agents");
	});

	it("should NOT clean the suggestion block if startLine is in fileValidLines", () => {
		const s = {
			filePath: "src/index.ts",
			startLine: 10,
			endLine: 15,
			severity: "error",
			title: "Critical Security Issue",
			description: "Fix this immediately",
			suggestedCode: "const clean = true;\nrunClean();",
		};

		const severityText = s.severity === "error" 
			? "⚠️ Potential issue | 🔴 Critical" 
			: s.severity === "warning" 
				? "⚠️ Potential issue | 🟡 Major" 
				: "ℹ️ Suggestion";
		
		const title = s.title ? `### ${severityText}\n**${s.title}**\n\n` : `### ${severityText}\n\n`;
		const description = s.description ? `${s.description}\n\n` : "";
		
		let suggestionBlock = "";
		if (s.suggestedCode !== undefined && s.suggestedCode !== null) {
			suggestionBlock = `\`\`\`suggestion\n${s.suggestedCode}\n\`\`\`\n\n`;
		}

		const promptBlock = `<details>\n<summary>🤖 Prompt for AI Agents</summary>\n\nVerify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.\n\nIn \`@${s.filePath}\` at line ${s.startLine}, ${s.title ? `${s.title}: ` : ""}${s.description || ""}\n</details>\n\n`;

		const endLine = s.endLine || s.startLine;
		const commentObj: any = {
			path: s.filePath,
			line: endLine,
			side: "RIGHT",
			body: `${title}${description}${suggestionBlock}${promptBlock}`,
		};

		if (s.startLine && s.endLine && s.startLine < s.endLine) {
			commentObj.start_line = s.startLine;
			commentObj.start_side = "RIGHT";
		}

		// Mock fileValidLines: both startLine (10) and endLine (15) are in diff
		const fileValidLines = new Set([10, 15]);

		const line = commentObj.line;
		const startLine = commentObj.start_line;

		if (startLine && !fileValidLines.has(startLine)) {
			delete commentObj.start_line;
			delete commentObj.start_side;
			commentObj.body = commentObj.body.replace(/```suggestion\r?\n[\s\S]*?\r?\n```\r?\n\r?\n/, "");
		}

		// Verify comment retains its start line and the suggestion block remains intact
		expect(commentObj.start_line).toBe(10);
		expect(commentObj.start_side).toBe("RIGHT");
		expect(commentObj.body).toContain("```suggestion");
		expect(commentObj.body).toContain("const clean = true;");
	});

	it("should fallback to empty string when description is missing/undefined in promptBlock", () => {
		const s = {
			filePath: "src/index.ts",
			startLine: 10,
			endLine: 10,
			severity: "info",
			title: "Minor info",
			description: undefined,
			suggestedCode: null,
		};

		const promptBlock = `<details>\n<summary>🤖 Prompt for AI Agents</summary>\n\nVerify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.\n\nIn \`@${s.filePath}\` at line ${s.startLine}, ${s.title ? `${s.title}: ` : ""}${s.description || ""}\n</details>\n\n`;

		expect(promptBlock).not.toContain("undefined");
		expect(promptBlock).toContain("In `@src/index.ts` at line 10, Minor info: \n");
	});
});
