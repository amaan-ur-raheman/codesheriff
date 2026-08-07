import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pinecone", () => ({
	pineconeIndex: {
		query: vi.fn(),
		upsert: vi.fn(),
		deleteMany: vi.fn(),
	},
}));

vi.mock("ai", () => ({
	embed: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
	google: {
		textEmbedding: vi.fn(() => "mock-embedding-model"),
	},
}));

import { pineconeIndex } from "@/lib/pinecone";
import { retrieveContext, indexCodebase, deleteCodebaseFiles } from "@/modules/ai/lib/rag";
import { embed } from "ai";

const mockPineconeIndex = pineconeIndex as unknown as {
	query: ReturnType<typeof vi.fn>;
	upsert: ReturnType<typeof vi.fn>;
	deleteMany: ReturnType<typeof vi.fn>;
};
const mockEmbed = embed as unknown as ReturnType<typeof vi.fn>;

describe("RAG context retrieval", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("retrieveContext", () => {
		it("returns matching content from search results", async () => {
			mockEmbed.mockResolvedValue({
				embedding: new Array(3072).fill(0.1),
			} as never);

			mockPineconeIndex.query.mockResolvedValue({
				matches: [
					{
						metadata: { content: "function hello() {}" },
					},
					{
						metadata: { content: "class World {}" },
					},
				],
			} as never);

			const results = await retrieveContext("hello world", "repo-1", 5);

			expect(results).toEqual(["function hello() {}", "class World {}"]);
			expect(mockEmbed).toHaveBeenCalledOnce();
			expect(mockPineconeIndex.query).toHaveBeenCalledWith({
				vector: expect.any(Array),
				filter: { repoId: "repo-1" },
				topK: 5,
				includeMetadata: true,
			});
		});

		it("filters out empty metadata", async () => {
			mockEmbed.mockResolvedValue({
				embedding: new Array(3072).fill(0.1),
			} as never);

			mockPineconeIndex.query.mockResolvedValue({
				matches: [
					{ metadata: { content: "valid content" } },
					{ metadata: {} },
					{ metadata: { content: "" } },
				],
			} as never);

			const results = await retrieveContext("query", "repo-1");

			expect(results).toEqual(["valid content"]);
		});

		it("returns empty array when no matches found", async () => {
			mockEmbed.mockResolvedValue({
				embedding: new Array(3072).fill(0.1),
			} as never);

			mockPineconeIndex.query.mockResolvedValue({
				matches: [],
			} as never);

			const results = await retrieveContext("nonexistent", "repo-1");

			expect(results).toEqual([]);
		});
	});

	describe("indexCodebase", () => {
		it("indexes files in batches", async () => {
			mockEmbed.mockResolvedValue({
				embedding: new Array(3072).fill(0.1),
			} as never);

			mockPineconeIndex.upsert.mockResolvedValue({} as never);

			const files = [
				{ path: "src/index.ts", content: "const x = 1;" },
				{ path: "src/utils.ts", content: "export const y = 2;" },
			];

			await indexCodebase("repo-1", files);

			expect(mockEmbed).toHaveBeenCalledTimes(2);
			expect(mockPineconeIndex.upsert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: "repo-1-src_index.ts",
						values: expect.any(Array),
						metadata: expect.objectContaining({
							repoId: "repo-1",
							filePath: "src/index.ts",
						}),
					}),
				])
			);
		});

		it("truncates long content to 8000 chars", async () => {
			const longContent = "x".repeat(10000);
			mockEmbed.mockResolvedValue({
				embedding: new Array(3072).fill(0.1),
			} as never);

			mockPineconeIndex.upsert.mockResolvedValue({} as never);

			await indexCodebase("repo-1", [
				{ path: "big.ts", content: longContent },
			]);

			expect(mockEmbed).toHaveBeenCalledWith(
				expect.objectContaining({
					value: expect.stringContaining("File: big.ts"),
				})
			);

			const callArgs = mockEmbed.mock.calls[0][0] as { value: string };
			expect(callArgs.value.length).toBeLessThanOrEqual(8000 + 20);
		});

		it("does not upsert when no files embed successfully", async () => {
			mockEmbed.mockRejectedValue(new Error("API error"));

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			await indexCodebase("repo-1", [
				{ path: "fail.ts", content: "bad" },
			]);

			expect(mockPineconeIndex.upsert).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("deleteCodebaseFiles", () => {
		it("deletes vectors by the same stable id rule as indexCodebase", async () => {
			mockPineconeIndex.deleteMany.mockResolvedValue({} as never);

			await deleteCodebaseFiles("repo-1", ["src/gone.ts", "src/deep/nested.ts"]);

			expect(mockPineconeIndex.deleteMany).toHaveBeenCalledWith({
				ids: ["repo-1-src_gone.ts", "repo-1-src_deep_nested.ts"],
			});
		});

		it("batches deletes of more than 100 ids", async () => {
			mockPineconeIndex.deleteMany.mockResolvedValue({} as never);

			const paths = Array.from({ length: 150 }, (_, i) => `src/file-${i}.ts`);
			await deleteCodebaseFiles("repo-1", paths);

			expect(mockPineconeIndex.deleteMany).toHaveBeenCalledTimes(2);
			const firstCall = mockPineconeIndex.deleteMany.mock.calls[0][0] as {
				ids: string[];
			};
			const secondCall = mockPineconeIndex.deleteMany.mock.calls[1][0] as {
				ids: string[];
			};
			expect(firstCall.ids).toHaveLength(100);
			expect(secondCall.ids).toHaveLength(50);
		});

		it("does not call deleteMany for an empty path list", async () => {
			await deleteCodebaseFiles("repo-1", []);
			expect(mockPineconeIndex.deleteMany).not.toHaveBeenCalled();
		});
	});
});
