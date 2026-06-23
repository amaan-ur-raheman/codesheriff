# Code Sheriff 🤠

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://codesheriff.vercel.app)

![Code Sheriff Poster](./public/codesheriff-poster.png)

**Code Sheriff** is an intelligent, AI-powered code review assistant designed to streamline your development workflow. By connecting directly with your GitHub repositories, Code Sheriff automatically analyzes pull requests, providing instant, context-aware feedback to help maintain code quality and catch issues early.

## 🚀 Key Features

*   **🤖 AI-Powered Code Reviews:** Leverages advanced LLMs (via Vercel AI SDK) to provide deep, meaningful code analysis on every PR.
*   **🧠 RAG Context Awareness:** Utilizes Pinecone and Retrieval-Augmented Generation (RAG) to understand the full context of your codebase, not just the diff.
*   **🔗 Seamless GitHub Integration:** Connects easily with your GitHub account to import repositories and monitor pull requests automatically.
*   **📊 Interactive Dashboard:** A comprehensive overview of your repositories, review history, and coding activity.
*   **💳 Subscription Management:** Integrated with **Polar.sh** for seamless subscription handling and usage limits.
*   **⚡ Real-time Updates:** Powered by Inngest for reliable background job processing and event handling.

## 🛠️ Tech Stack

*   **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
*   **UI Components:** [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/), [Shadcn UI](https://ui.shadcn.com/)
*   **Database:** [PostgreSQL](https://www.postgresql.org/) (via [Prisma ORM](https://www.prisma.io/))
*   **Authentication:** [Better Auth](https://better-auth.com/)
*   **AI & Vector:** [Vercel AI SDK](https://sdk.vercel.ai/), [Pinecone](https://www.pinecone.io/)
*   **Background Jobs:** [Inngest](https://www.inngest.com/)
*   **Payments:** [Polar.sh](https://polar.sh/)
*   **State Management:** [TanStack Query](https://tanstack.com/query/latest)

> For a deeper dive into the system architecture and data flow, check out [ARCHITECTURE.md](./ARCHITECTURE.md).

## 📸 Screenshots

### Dashboard
Overview of your coding activity and review status.
![Dashboard Page](./public/dashboard-page.png)

### Repositories
Manage your connected GitHub repositories.
![Repository Page](./public/repository-page.png)

### Reviews
Detailed AI-generated feedback on your pull requests.
![Reviews Page](./public/reviews-page.png)

### Settings
Configure your preferences and account details.
![Settings Page](./public/settings-page.png)

### Subscriptions
Manage your plan and usage limits.
![Subscription Page](./public/subscription-page.png)

## 🏁 Getting Started

### Prerequisites

*   Node.js (v18+)
*   pnpm, npm, or bun
*   PostgreSQL database
*   GitHub OAuth App credentials
*   Pinecone API Key
*   Google AI API Key (Gemini)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/amaan-ur-raheman/code-sheriff.git
    cd code-sheriff
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    pnpm install
    # or
    bun install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the root directory and add the following variables:

    ```env
    # Database
    DATABASE_URL="postgresql://user:password@localhost:5432/code_sheriff?schema=public"

    # Authentication (Better Auth)
    BETTER_AUTH_SECRET="your_secret_key"
    BETTER_AUTH_URL="http://localhost:3000"

    # GitHub OAuth
    GITHUB_CLIENT_ID="your_github_client_id"
    GITHUB_CLIENT_SECRET="your_github_client_secret"

    # AI (Google Gemini)
    GOOGLE_GENERATIVE_AI_API_KEY="your_google_api_key"

    # Vector DB (Pinecone)
    PINECONE_API_KEY="your_pinecone_api_key"

    # Background Jobs (Inngest)
    INNGEST_EVENT_KEY="your_inngest_event_key"
    INNGEST_SIGNING_KEY="your_inngest_signing_key"

    # Payments (Polar.sh)
    POLAR_ACCESS_TOKEN="your_polar_access_token"
    ```

4.  **Database Setup:**
    Run the Prisma migrations to set up your database schema.
    ```bash
    npx prisma generate
    npx prisma migrate dev
    ```

5.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    pnpm dev
    # or
    bun dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

6.  **Run Inngest Dev Server:**
    In a separate terminal, run Inngest to handle background jobs.
    ```bash
    npx inngest-cli@latest dev
    ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.