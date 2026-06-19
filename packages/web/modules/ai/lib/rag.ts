import { pineconeIndex } from "@/lib/pinecone";

import { embed } from "ai";
import { google } from "@ai-sdk/google";

/**
 * Generates text embeddings using Google's text-embedding-004 model
 * @param text - Text content to embed
 * @returns Promise resolving to embedding vector (768 dimensions)
 */
export async function generateEmbedding(text: string) {
	const { embedding } = await embed({
		model: google.textEmbedding("gemini-embedding-001"),
		value: text,
		providerOptions: {
			google: {
				outputDimensionality: 3072,
				taskType: "SEMANTIC_SIMILARITY",
			},
		},
	});

	return embedding;
}

/**
 * Indexes a codebase by generating embeddings for each file and storing them in Pinecone.
 *
 * This function:
 * 1. Iterates through the provided files.
 * 2. Truncates content to fit context limits (8000 chars).
 * 3. Generates embeddings for the file content.
 * 4. Upserts the vectors to Pinecone in batches.
 *
 * @param repoId - The unique identifier for the repository (e.g., "owner/repo").
 * @param files - Array of file objects containing path and content.
 */
/**
 * Indexes codebase files into Pinecone vector database for RAG
 * @param repoId - Repository identifier
 * @param files - Array of file objects with path and content
 */
export async function indexCodebase(
	repoId: string,
	files: { path: string; content: string }[],
) {
	const vectors = [];

	for (const file of files) {
		const content = `File: ${file.path}\n\n${file.content}`;
		const truncatedContent = content.slice(0, 8000);

		try {
			const embedding = await generateEmbedding(truncatedContent);
			vectors.push({
				id: `${repoId}-${file.path.replace(/\//g, "_")}`,
				values: embedding,
				metadata: {
					repoId,
					filePath: file.path,
					content: truncatedContent,
				},
			});
		} catch (error) {
			console.error(`Failed to embed ${file.path}:`, error);
		}
	}

	if (vectors.length > 0) {
		const batchSize = 100;

		for (let i = 0; i < vectors.length; i += batchSize) {
			const batch = vectors.slice(i, i + batchSize);
			await pineconeIndex.upsert(batch);
		}
	}

	console.log("Indexing completed");
}

/**
 * Retrieves relevant context from the vector database for a given query.
 *
 * @param query - The search query (e.g., PR title + description).
 * @param repoId - The repository ID to filter results by.
 * @param topK - The number of results to retrieve (default: 5).
 * @returns An array of matching code snippets (strings).
 */
/**
 * Retrieves relevant code context from vector database using semantic search
 * @param query - Search query text
 * @param repoId - Repository identifier to filter results
 * @param topK - Number of top results to return (default: 5)
 * @returns Promise resolving to array of relevant code snippets
 */
export async function retrieveContext(
	query: string,
	repoId: string,
	topK: number = 5,
) {
	const embedding = await generateEmbedding(query);

	const results = await pineconeIndex.query({
		vector: embedding,
		filter: { repoId },
		topK,
		includeMetadata: true,
	});

	return results.matches
		.map((match) => match.metadata?.content as string)
		.filter(Boolean);
}
