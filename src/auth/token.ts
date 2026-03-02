import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getDeviceCode, pollAccessToken } from "./device-code";
import { getCopilotToken } from "./copilot-token";
import { state } from "../state";

const APP_DIR = path.join(os.homedir(), ".local", "share", "copilot-api");
const GITHUB_TOKEN_PATH = path.join(APP_DIR, "github_token");

async function ensurePaths(): Promise<void> {
  await fs.mkdir(APP_DIR, { recursive: true });
  try {
    await fs.access(GITHUB_TOKEN_PATH, fs.constants.W_OK);
  } catch {
    await fs.writeFile(GITHUB_TOKEN_PATH, "");
    await fs.chmod(GITHUB_TOKEN_PATH, 0o600);
  }
}

async function readGithubToken(): Promise<string> {
  return fs.readFile(GITHUB_TOKEN_PATH, "utf8");
}

async function writeGithubToken(token: string): Promise<void> {
  await fs.writeFile(GITHUB_TOKEN_PATH, token);
}

export async function setupGitHubToken(): Promise<void> {
  await ensurePaths();

  try {
    const githubToken = await readGithubToken();

    if (githubToken) {
      state.githubToken = githubToken;
      console.log("Using saved GitHub token");
      return;
    }
  } catch {
    // Token doesn't exist, continue to auth flow
  }

  console.log("Not logged in, starting authentication flow...");
  const deviceCode = await getDeviceCode();

  console.log(
    `Please enter the code "${deviceCode.user_code}" at ${deviceCode.verification_uri}`
  );

  const token = await pollAccessToken(deviceCode);
  await writeGithubToken(token);
  state.githubToken = token;

  console.log("GitHub authentication successful");
}

export async function setupCopilotToken(): Promise<void> {
  const { token, refresh_in } = await getCopilotToken();
  state.copilotToken = token;
  console.log("Copilot token fetched successfully");

  // Auto-refresh token before it expires
  const refreshInterval = (refresh_in - 60) * 1000;
  setInterval(async () => {
    try {
      const { token } = await getCopilotToken();
      state.copilotToken = token;
      console.log("Copilot token refreshed");
    } catch (error) {
      console.error("Failed to refresh Copilot token:", error);
    }
  }, refreshInterval);
}
