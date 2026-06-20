/**
 * Pinecone Client Configuration
 *
 * This file initializes the Pinecone client and exports a reference to the main index.
 * Pinecone is used as the vector database for storing and retrieving code embeddings
 * to support RAG (Retrieval-Augmented Generation).
 */

import { Pinecone } from "@pinecone-database/pinecone";

const apiKey = process.env.PINECONE_DB_API_KEY;
if (!apiKey) {
	throw new Error("PINECONE_DB_API_KEY environment variable is required");
}

export const pinecone = new Pinecone({
	apiKey,
});

// The specific index used for Code Horse embeddings
export const pineconeIndex = pinecone.Index("codehorse-vector-embedding-v3");
