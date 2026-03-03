import type {
  ChatCompletionsPayload,
  ChatCompletionResponse,
  ContentPart,
  Message,
  Tool,
  ToolCall,
} from "../api/chat";

import type {
  AnthropicMessagesPayload,
  AnthropicMessage,
  AnthropicTextBlock,
  AnthropicUserMessage,
  AnthropicAssistantMessage,
  AnthropicToolResultBlock,
  AnthropicToolUseBlock,
  AnthropicThinkingBlock,
  AnthropicUserContentBlock,
  AnthropicAssistantContentBlock,
  AnthropicResponse,
} from "./types";

// Stop reason mapping
export function mapStopReason(
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null
): AnthropicResponse["stop_reason"] {
  if (finishReason === null) return null;
  const map = {
    stop: "end_turn",
    length: "max_tokens",
    tool_calls: "tool_use",
    content_filter: "end_turn",
  } as const;
  return map[finishReason];
}

// Translate Anthropic request to OpenAI format
export function translateToOpenAI(
  payload: AnthropicMessagesPayload
): ChatCompletionsPayload {
  return {
    model: translateModelName(payload.model),
    messages: translateMessages(payload.messages, payload.system),
    max_tokens: payload.max_tokens,
    stop: payload.stop_sequences,
    stream: payload.stream,
    temperature: payload.temperature,
    top_p: payload.top_p,
    tools: translateTools(payload.tools),
    tool_choice: translateToolChoice(payload.tool_choice),
  };
}

function translateModelName(model: string): string {
  if (model.startsWith("claude-sonnet-4-")) {
    return "claude-sonnet-4";
  } else if (model.startsWith("claude-opus-4-")) {
    return "claude-opus-4";
  }
  return model;
}

function translateMessages(
  messages: AnthropicMessage[],
  system: string | AnthropicTextBlock[] | undefined
): Message[] {
  const systemMessages = handleSystemPrompt(system);
  const otherMessages = messages.flatMap((message) =>
    message.role === "user"
      ? handleUserMessage(message)
      : handleAssistantMessage(message)
  );
  return [...systemMessages, ...otherMessages];
}

function handleSystemPrompt(
  system: string | AnthropicTextBlock[] | undefined
): Message[] {
  if (!system) return [];
  if (typeof system === "string") {
    return [{ role: "system", content: system }];
  }
  const text = system.map((block) => block.text).join("\n\n");
  return [{ role: "system", content: text }];
}

function handleUserMessage(message: AnthropicUserMessage): Message[] {
  const result: Message[] = [];

  if (Array.isArray(message.content)) {
    const toolResultBlocks = message.content.filter(
      (block): block is AnthropicToolResultBlock => block.type === "tool_result"
    );
    const otherBlocks = message.content.filter(
      (block) => block.type !== "tool_result"
    );

    // Tool results must come first
    for (const block of toolResultBlocks) {
      result.push({
        role: "tool",
        tool_call_id: block.tool_use_id,
        content: block.content,
      });
    }

    if (otherBlocks.length > 0) {
      result.push({
        role: "user",
        content: mapContent(otherBlocks),
      });
    }
  } else {
    result.push({
      role: "user",
      content: message.content,
    });
  }

  return result;
}

function handleAssistantMessage(message: AnthropicAssistantMessage): Message[] {
  if (!Array.isArray(message.content)) {
    return [{ role: "assistant", content: message.content }];
  }

  const toolUseBlocks = message.content.filter(
    (block): block is AnthropicToolUseBlock => block.type === "tool_use"
  );
  const textBlocks = message.content.filter(
    (block): block is AnthropicTextBlock => block.type === "text"
  );
  const thinkingBlocks = message.content.filter(
    (block): block is AnthropicThinkingBlock => block.type === "thinking"
  );

  const allTextContent = [
    ...textBlocks.map((b) => b.text),
    ...thinkingBlocks.map((b) => b.thinking),
  ].join("\n\n");

  if (toolUseBlocks.length > 0) {
    return [
      {
        role: "assistant",
        content: allTextContent || null,
        tool_calls: toolUseBlocks.map((toolUse) => ({
          id: toolUse.id,
          type: "function" as const,
          function: {
            name: toolUse.name,
            arguments: JSON.stringify(toolUse.input),
          },
        })),
      },
    ];
  }

  return [{ role: "assistant", content: mapContent(message.content) }];
}

function mapContent(
  content: (AnthropicUserContentBlock | AnthropicAssistantContentBlock)[]
): string | ContentPart[] | null {
  const hasImage = content.some((block) => block.type === "image");

  if (!hasImage) {
    return content
      .filter(
        (block): block is AnthropicTextBlock | AnthropicThinkingBlock =>
          block.type === "text" || block.type === "thinking"
      )
      .map((block) => (block.type === "text" ? block.text : block.thinking))
      .join("\n\n");
  }

  const parts: ContentPart[] = [];
  for (const block of content) {
    if (block.type === "text") {
      parts.push({ type: "text", text: block.text });
    } else if (block.type === "thinking") {
      parts.push({ type: "text", text: block.thinking });
    } else if (block.type === "image") {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${block.source.media_type};base64,${block.source.data}`,
        },
      });
    }
  }
  return parts;
}

function translateTools(
  tools: AnthropicMessagesPayload["tools"]
): Tool[] | undefined {
  if (!tools) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

function translateToolChoice(
  choice: AnthropicMessagesPayload["tool_choice"]
): ChatCompletionsPayload["tool_choice"] {
  if (!choice) return undefined;
  switch (choice.type) {
    case "auto":
      return "auto";
    case "any":
      return "required";
    case "tool":
      if (choice.name) {
        return { type: "function", function: { name: choice.name } };
      }
      return undefined;
    case "none":
      return "none";
    default:
      return undefined;
  }
}

// Translate OpenAI response to Anthropic format
export function translateToAnthropic(
  response: ChatCompletionResponse
): AnthropicResponse {
  const allTextBlocks: AnthropicTextBlock[] = [];
  const allToolUseBlocks: AnthropicToolUseBlock[] = [];
  let stopReason: "stop" | "length" | "tool_calls" | "content_filter" | null =
    response.choices[0]?.finish_reason ?? null;

  for (const choice of response.choices) {
    const textBlocks = getTextBlocks(choice.message.content);
    const toolUseBlocks = getToolUseBlocks(choice.message.tool_calls);

    allTextBlocks.push(...textBlocks);
    allToolUseBlocks.push(...toolUseBlocks);

    if (choice.finish_reason === "tool_calls" || stopReason === "stop") {
      stopReason = choice.finish_reason;
    }
  }

  return {
    id: response.id,
    type: "message",
    role: "assistant",
    model: response.model,
    content: [...allTextBlocks, ...allToolUseBlocks],
    stop_reason: mapStopReason(stopReason),
    stop_sequence: null,
    usage: {
      input_tokens:
        (response.usage?.prompt_tokens ?? 0) -
        (response.usage?.prompt_tokens_details?.cached_tokens ?? 0),
      output_tokens: response.usage?.completion_tokens ?? 0,
      ...(response.usage?.prompt_tokens_details?.cached_tokens !==
        undefined && {
        cache_read_input_tokens:
          response.usage.prompt_tokens_details.cached_tokens,
      }),
    },
  };
}

function getTextBlocks(content: string | null): AnthropicTextBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  return [];
}

function getToolUseBlocks(
  toolCalls: ToolCall[] | undefined
): AnthropicToolUseBlock[] {
  if (!toolCalls) return [];
  return toolCalls.map((tc) => ({
    type: "tool_use",
    id: tc.id,
    name: tc.function.name,
    input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
  }));
}
