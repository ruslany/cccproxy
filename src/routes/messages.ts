import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import {
  createChatCompletions,
  type ChatCompletionChunk,
  type ChatCompletionResponse,
} from "../api/chat";

import type { AnthropicMessagesPayload, AnthropicStreamState } from "./types";
import { translateToOpenAI, translateToAnthropic } from "./translate";
import { translateChunkToEvents } from "./stream";

export async function handleMessages(c: Context) {
  const anthropicPayload = await c.req.json<AnthropicMessagesPayload>();
  const openAIPayload = translateToOpenAI(anthropicPayload);

  const response = await createChatCompletions(openAIPayload);

  // Non-streaming response
  if ("choices" in response) {
    const anthropicResponse = translateToAnthropic(
      response as ChatCompletionResponse
    );
    return c.json(anthropicResponse);
  }

  // Streaming response
  return streamSSE(c, async (stream) => {
    const state: AnthropicStreamState = {
      messageStartSent: false,
      contentBlockIndex: 0,
      contentBlockOpen: false,
      toolCalls: {},
    };

    for await (const rawEvent of response) {
      if (rawEvent.data === "[DONE]") break;
      if (!rawEvent.data) continue;

      const chunk = JSON.parse(rawEvent.data) as ChatCompletionChunk;
      const events = translateChunkToEvents(chunk, state);

      for (const event of events) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    }
  });
}
