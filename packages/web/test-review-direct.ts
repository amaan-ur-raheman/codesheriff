import { reviewPullRequest } from "./modules/ai/actions";

async function main() {
  console.log("Invoking reviewPullRequest directly...");
  const result = await reviewPullRequest(
    "amaan-ur-raheman",
    "codesheriff",
    27
  );
  console.log("Execution Result:", result);
}

main().catch((err) => {
  console.error("Direct Execution Failed with Error:");
  console.error(err);
});
