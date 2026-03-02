import {
  GITHUB_BASE_URL,
  GITHUB_CLIENT_ID,
  GITHUB_APP_SCOPES,
  standardHeaders,
} from "../config";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export async function getDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(`${GITHUB_BASE_URL}/login/device/code`, {
    method: "POST",
    headers: standardHeaders(),
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: GITHUB_APP_SCOPES,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get device code: ${response.status}`);
  }

  return (await response.json()) as DeviceCodeResponse;
}

export async function pollAccessToken(
  deviceCode: DeviceCodeResponse
): Promise<string> {
  const sleepDuration = (deviceCode.interval + 1) * 1000;

  while (true) {
    const response = await fetch(
      `${GITHUB_BASE_URL}/login/oauth/access_token`,
      {
        method: "POST",
        headers: standardHeaders(),
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      }
    );

    if (!response.ok) {
      await Bun.sleep(sleepDuration);
      continue;
    }

    const json = (await response.json()) as { access_token?: string };

    if (json.access_token) {
      return json.access_token;
    }

    await Bun.sleep(sleepDuration);
  }
}
