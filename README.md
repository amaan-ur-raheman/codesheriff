# Code Sheriff 🤠

<p align="center">
  <img src="./public/codesheriff-poster.png" alt="Code Sheriff Poster" width="100%" style="border-radius: 12px" />
</p>

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://codesheriff.amaanurraheman.qzz.io)

**Code Sheriff** is a premium, AI-powered automated code review platform designed to elevate code quality and accelerate development workflows. Organized as a monorepo workspace, Code Sheriff contains both a high-fidelity Next.js web application and an interactive terminal-based TUI (Text User Interface) built with React.

By monitoring GitHub webhooks, Code Sheriff automatically responds to pull requests, leveraging Retrieval-Augmented Generation (RAG) to embed full repository context, run suggestions in an isolated sandbox, and post inline recommendations.

---

## 📸 Platform Walkthrough & Screenshot Grid

To see the platform features in action, view the walkthrough below:

<table>
  <tr>
    <td valign="top" width="50%">
      <p align="center"><strong>1. Landing Page</strong></p>
      <img src="./public/landing-page.png" alt="Landing Page" width="100%" />
      <p><small>The entrance detailing Code Sheriff's core value proposition and integrations.</small></p>
    </td>
    <td valign="top" width="50%">
      <p align="center"><strong>2. Sign In / Authentication</strong></p>
      <img src="./public/login-page.png" alt="Login Page" width="100%" />
      <p><small>Better Auth sign-in screen supporting GitHub OAuth and terminal CLI credentials pairing.</small></p>
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <p align="center"><strong>3. Main Dashboard</strong></p>
      <img src="./public/dashboard-page.png" alt="Dashboard Page" width="100%" />
      <p><small>Central hub showcasing connected repos, recent PR audits, and an interactive contribution calendar.</small></p>
    </td>
    <td valign="top" width="50%">
      <p align="center"><strong>4. Organizations & Workspaces</strong></p>
      <img src="./public/organizations-page.png" alt="Organizations Page" width="100%" />
      <p><small>Isolate and manage project teams, repository boundaries, and developer seats.</small></p>
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <p align="center"><strong>5. Connected Repositories</strong></p>
      <img src="./public/repository-page.png" alt="Repository Page" width="100%" />
      <p><small>Link your GitHub repos and trigger Pinecone vector indexing for deep codebase search context.</small></p>
    </td>
    <td valign="top" width="50%">
      <p align="center"><strong>6. AI Reviews</strong></p>
      <img src="./public/reviews-page.png" alt="Reviews Page" width="100%" />
      <p><small>Examine automated audit summaries, severity rankings, and sandboxed recommendations.</small></p>
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <p align="center"><strong>7. Integrations Hub</strong></p>
      <img src="./public/integrations-page.png" alt="Integrations Page" width="100%" />
      <p><small>Broadcast review outcomes to channels like Slack and Discord via custom webhooks.</small></p>
    </td>
    <td valign="top" width="50%">
      <p align="center"><strong>8. Preferences & Settings</strong></p>
      <img src="./public/settings-page.png" alt="Settings Page" width="100%" />
      <p><small>Customize notification preferences, email alerts, and fine-tune AI severity triggers.</small></p>
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <p align="center"><strong>9. Subscription Limits</strong></p>
      <img src="./public/subscription-page.png" alt="Subscription Page" width="100%" />
      <p><small>Track active usage tiers and billing records synchronized via Polar.sh checkout portals.</small></p>
    </td>
    <td valign="top" width="50%">
      <!-- Spacer for 2-column alignment -->
    </td>
  </tr>
</table>

---

## 🚀 Core Workflows & Architecture

### 1. Code Review Generation Pipeline
```
[GitHub PR Event] ──> [Github Webhook Route] ──> [Inngest Worker]
                                                      │
     ┌────────────────────────────────────────────────┘
     ▼
[Fetch Diff] ──> [RAG Pinecone Search] ──> [Gemini Review Generation] ──> [Commit PR Status]
```
1.  **Webhook Ingestion**: GitHub triggers a `pull_request` payload to `/api/webhooks/github`.
2.  **Inngest Orchestration**: Handled asynchronously via `pr.review.requested` function in [review.ts](file:///Users/amaan/Desktop/Programming/next-js/code-horse/packages/web/inngest/functions/review.ts).
3.  **Context Retrieval (RAG)**: Generates query embeddings using `gemini-embedding-001` and retrieves relevant files from Pinecone.
4.  **LLM Verification**: Code changes and retrieved snippets are passed to Gemini to draft actionable reviews.
5.  **GitHub Status Write**: Commits status updates (pending, success, failure) back to the GitHub PR commit check run.

### 2. Codebase Vector Indexing
*   Files are split and truncated to fit LLM constraints (up to 8,000 chars).
*   Vectors (3072 dimensions) are upserted into Pinecone (`codehorse-vector-embedding-v3`) with filters scoped to `repoId`.

---

## 🔒 Sandbox Verification Engine
Unlike simple AI review setups that generate untested suggestions, Code Sheriff verifies recommended changes before displaying them:
1.  **Shallow Clone**: Checks out the head branch ref of the PR into a temporary `/tmp/codesheriff-sandbox-[timestamp]` folder.
2.  **Auto-Detect Lockfiles**: Checks for package files (e.g. `bun.lock` vs `package-lock.json`) to choose the correct manager (`bun install` vs `npm install`).
3.  **Apply Suggestions**: Replaces original code blocks inline with suggested modifications.
4.  **Execute Tests**: Triggers test scripts (`bun test` or `npm run test`). If compilation or execution fails, the error log (`stderr`/`stdout`) is captured and flag-marked as a failed warning in the review report to notify developers before commit merges.
5.  **Rollback & Cleanup**: Discards the sandbox change, proceeds to verify the next suggestion, and deletes the directory when complete.

---

## 📊 Database Schema Architecture (Prisma)
Code Sheriff utilizes a structured PostgreSQL schema optimized for workspaces, usage tracking, and multi-tenant organizations.

| Table Model | Purpose | Core Fields |
| :--- | :--- | :--- |
| **`User`** | Platform users & auth profile. | `subscriptionTier`, `polarCustomerId`, `emailNotifications`, `role` |
| **`Repository`** | Connected repositories per account. | `githubId`, `name`, `owner`, `fullName`, `url` |
| **`Review`** | Records of generated PR reviews. | `prNumber`, `prTitle`, `review` (markdown body), `status`, `suggestions` (JSON), `healthScore` |
| **`ReviewConfig`** | Repository custom review filters. | `focusAreas` (security, performance, etc.), `minSeverity`, `autoReview`, `customPrompt` |
| **`CustomReviewRule`** | Repo-specific custom rules. | `name`, `ruleContent` (strict conditions), `isActive` |
| **`UserUsage`** | Running counters for limit enforcement. | `repositoryCount`, `reviewCounts` (JSON repository map) |
| **`Organization`** | Workspaces for developer groups. | `name`, `slug`, `ownerId` |
| **`ApiKey`** | Device tokens for CLI authorization. | `key`, `expiresAt`, `lastUsed` |
| **`IntegrationConfig`** | Custom webhook notifications. | `type` (Slack/Discord), `config` (webhook URL details), `isActive` |

---

## 💳 Subscription Tiers & Usage Limits
Limits are automatically checked and incremented upon repository linking or PR review triggers:

*   **`FREE` Tier**:
    *   Maximum Connected Repositories: **5**
    *   Maximum Automated Reviews: **5 per repository**
    *   Email notification warning triggered when reaching **80%** usage threshold.
*   **`PRO` Tier**:
    *   Maximum Connected Repositories: **Unlimited**
    *   Maximum Automated Reviews: **Unlimited**
    *   Billing portal checks and checkouts handled securely via Polar.sh webhook triggers.

---

## 🛠️ Monorepo Package Structure

### 🌐 Web App (`packages/web`)
*   **Framework:** [Next.js 16](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
*   **AI Engine:** [Vercel AI SDK](https://sdk.vercel.ai/) backed by Google Generative AI (Gemini)
*   **Database:** PostgreSQL with [Prisma ORM](https://www.prisma.io/)
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
*   **State:** TanStack React Query v5

### 💻 Interactive CLI TUI (`packages/cli`)
*   **Ink Engine:** Renders interactive, state-driven React layouts straight in your command terminal.
*   **Commands**:
    *   `codesheriff` - Launch the interactive terminal dashboard (TUI) to monitor repo updates.
    *   `codesheriff login` - Sign in using browser device code flow pairing.
    *   `codesheriff logout` - Flush local session configs from this machine.

---

## 🏁 Getting Started

### Prerequisites
*   Node.js (v18+) & Bun (recommended)
*   PostgreSQL Database
*   GitHub OAuth Credentials
*   Pinecone API Key & index (`codehorse-vector-embedding-v3`)
*   Google AI API Key (Gemini)

### 1. Installation & Environment Config
Clone and install dependencies from the monorepo root:
```bash
git clone https://github.com/amaan-ur-raheman/code-sheriff.git
cd code-sheriff
bun install
```

Configure your environment variables in `.env` inside the workspace root:
```env
NEXT_PUBLIC_APP_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

DATABASE_URL="postgresql://user:password@localhost:5432/codesheriff"
BETTER_AUTH_SECRET="your_secret_key"
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
PINECONE_DB_API_KEY="your_pinecone_key"
GOOGLE_GENERATIVE_AI_API_KEY="your_gemini_key"
```

### 2. Database Migration
```bash
npx prisma generate
npx prisma migrate dev
```

### 3. Startup Scripts
*   **Run All (Next.js + Inngest + dev tools via mprocs):**
    ```bash
    bun web:dev:all
    ```
*   **Run Next.js App:**
    ```bash
    bun web:dev
    ```
*   **Run Inngest Dev Server:**
    ```bash
    bun inngest:dev
    ```
*   **Start the Terminal CLI UI:**
    ```bash
    bun cli:build && bun cli:start
    ```

---

## 📄 License
Licensed under the MIT License - see the [LICENSE](LICENSE) file for details.