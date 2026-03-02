import { events } from "fetch-event-stream";
import { copilotHeaders, copilotBaseUrl } from "../config";
import { state } from "../state";

// Payload types
export interface ChatCompletionsPayload {
  messages: Message[];
  model: string;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
  stop?: string | string[] | null;
  stream?: boolean | null;
  tools?: Tool[] | null;
  tool_choice?:
    | "none"
    | "auto"
    | "required"
    | { type: "function"; function: { name: string } }
    | null;
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool" | "developer";
  content: string | ContentPart[] | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type ContentPart = TextPart | ImagePart;

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImagePart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

// Response types
export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChoiceNonStreaming[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
      cached_tokens: number;
    };
  };
}

interface ChoiceNonStreaming {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter";
}

// Streaming types
export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      content?: string | null;
      role?: string;
      tool_calls?: {
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }[];
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
      cached_tokens: number;
    };
  };
}

export async function createChatCompletions(payload: ChatCompletionsPayload) {
  if (!state.copilotToken) throw new Error("Copilot token not found");

  const enableVision = payload.messages.some(
    (x) =>
      typeof x.content !== "string" &&
      x.content?.some((x) => x.type === "image_url")
  );

  // Determine if any message is from an agent
  const isAgentCall = payload.messages.some((msg) =>
    ["assistant", "tool"].includes(msg.role)
  );

  const headers: Record<string, string> = {
    ...copilotHeaders(state, enableVision),
    "X-Initiator": isAgentCall ? "agent" : "user",
  };

  const response = await fetch(`${copilotBaseUrl(state)}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Copilot API error ${response.status}: ${text}`);
  }

  if (payload.stream) {
    return events(response);
  }

  return (await response.json()) as ChatCompletionResponse;
}
