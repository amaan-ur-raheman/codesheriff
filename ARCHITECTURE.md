# Architecture Overview

This document provides a high-level overview of the Code Sheriff architecture. Code Sheriff is a Next.js application designed to automate code reviews using AI.

## Directory Structure

The project follows a modular structure to separate concerns and improve maintainability.

- **`app/`**: Contains the Next.js App Router pages and API routes.
  - `(auth)/`: Authentication-related pages.
  - `dashboard/`: The main user interface for logged-in users.
  - `api/`: Backend API endpoints (webhooks, auth, etc.).
- **`components/`**: Reusable UI components.
  - `ui/`: Generic UI components (likely from Shadcn UI).
  - `ai-elements/`: Custom components specifically for AI interactions and visualizations.
- **`lib/`**: Core utilities and configuration.
  - `auth.ts`: Better Auth configuration.
  - `db.ts`: Prisma client instance.
  - `pinecone.ts`: Pinecone vector database client.
- **`modules/`**: Feature-specific logic. This is where the core business logic resides.
  - `ai/`: AI generation and RAG (Retrieval-Augmented Generation) logic.
  - `github/`: GitHub API integration (fetching repos, PRs, posting comments).
  - `payment/`: Subscription and payment handling via Polar.sh.
  - `repository/`, `review/`, `settings/`: Domain-specific logic.
- **`inngest/`**: Background job definitions and client configuration.
  - `functions/`: The actual background jobs (e.g., generating reviews).
- **`prisma/`**: Database schema and migrations.

## Key Workflows

### 1. Code Review Generation

The core feature of Code Sheriff is the automated code review. This process is event-driven:

1.  **Webhook Trigger**: GitHub sends a `pull_request` webhook to `/api/webhooks/github`.
2.  **Event Ingestion**: Inngest captures this event.
3.  **Job Execution**: The `generate-review` function in `inngest/functions/review.ts` is triggered.
    - **Fetch Data**: Retrieves PR diff and metadata using GitHub API.
    - **Context Retrieval**: Uses RAG to find relevant code snippets from the codebase (stored in Pinecone).
    - **AI Analysis**: Sends the diff + context to an LLM (via Vercel AI SDK & Google Gemini) to generate a review.
    - **Post Review**: Posts the generated review as a comment on the Pull Request.
    - **Save Record**: Stores the review details in the PostgreSQL database.

### 2. Authentication & User Management

- **Better Auth** handles user sessions and OAuth with GitHub.
- User data is stored in PostgreSQL via Prisma.
- Subscription status is synchronized with Polar.sh.

### 3. Repository Management

- Users can import repositories from GitHub.
- When a repository is imported, its codebase can be indexed (embedded and stored in Pinecone) to support RAG-based reviews.

## Data Layer

- **PostgreSQL**: Primary transactional database (Users, Repositories, Reviews, Subscriptions).
- **Pinecone**: Vector database for code embeddings (used for context retrieval).
- **Prisma**: ORM for type-safe database access.

## Background Processing

**Inngest** is used for:
- Reliable execution of long-running tasks (like AI review generation).
- Handling webhooks asynchronously to avoid timeouts.
- Managing retries and failures.
