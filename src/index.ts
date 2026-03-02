import { parseArgs } from "util";

import { setupGitHubToken, setupCopilotToken } from "./auth/token";
import { state } from "./state";
import app from "./server";

// Parse command line arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    port: {
      type: "string",
      short: "p",
      default: "4141",
    },
    "account-type": {
      type: "string",
      short: "a",
      default: "individual",
    },
    "github-token": {
      type: "string",
      short: "g",
    },
    help: {
      type: "boolean",
      short: "h",
      default: false,
    },
  },
});

if (values.help) {
  console.log(`
Copilot API Proxy (minimal) - Claude Code backend using GitHub Copilot

Usage: bun run src/index.ts [options]

Options:
  -p, --port <port>           Port to listen on (default: 4141)
  -a, --account-type <type>   Account type: individual, business, enterprise (default: individual)
  -g, --github-token <token>  GitHub token (or use GH_TOKEN env var)
  -h, --help                  Show this help message
`);
  process.exit(0);
}

const port = parseInt(values.port!, 10);
const accountType = values["account-type"] as "individual" | "business" | "enterprise";

async function main() {
  console.log("Starting Copilot API Proxy (minimal)...");

  // Set account type
  state.accountType = accountType;

  // Check for GitHub token from CLI or environment
  const githubToken = values["github-token"] || process.env.GH_TOKEN;

  if (githubToken) {
    state.githubToken = githubToken;
    console.log("Using provided GitHub token");
  } else {
    await setupGitHubToken();
  }

  // Get Copilot token
  await setupCopilotToken();

  // Start server
  console.log(`Server starting on port ${port}...`);
  console.log(`Anthropic API endpoint: http://localhost:${port}/v1/messages`);

  Bun.serve({
    port,
    hostname: "127.0.0.1", // Bind to localhost only for security
    fetch: app.fetch,
  });

  console.log(`
To use with Claude Code, set these environment variables:
  ANTHROPIC_BASE_URL=http://localhost:${port}
  ANTHROPIC_AUTH_TOKEN=dummy
  ANTHROPIC_MODEL=claude-sonnet-4

Or create .claude/settings.json with:
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:${port}",
    "ANTHROPIC_AUTH_TOKEN": "dummy",
    "ANTHROPIC_MODEL": "claude-sonnet-4"
  }
}
`);
}

main().catch(console.error);
