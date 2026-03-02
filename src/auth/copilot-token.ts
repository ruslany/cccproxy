import { GITHUB_API_BASE_URL, githubHeaders } from "../config";
import { state } from "../state";

interface CopilotTokenResponse {
  expires_at: number;
  refresh_in: number;
  token: string;
}

export async function getCopilotToken(): Promise<CopilotTokenResponse> {
  const response = await fetch(
    `${GITHUB_API_BASE_URL}/copilot_internal/v2/token`,
    {
      headers: githubHeaders(state),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get Copilot token: ${response.status}`);
  }

  return (await response.json()) as CopilotTokenResponse;
}
