// Minimal state for the proxy
export interface State {
  githubToken?: string;
  copilotToken?: string;
  accountType: "individual" | "business" | "enterprise";
  vsCodeVersion: string;
}

export const state: State = {
  accountType: "individual",
  vsCodeVersion: "1.104.3",
};
