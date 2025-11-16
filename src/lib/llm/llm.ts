import type { z } from 'zod';

/**
 * Message role in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Base message structure
 */
export interface BaseMessage {
  role: MessageRole;
  content: string;
}

/**
 * Tool/function call message from assistant
 */
export interface ToolCallMessage extends BaseMessage {
  role: 'assistant';
  toolCalls?: ToolCall[];
}

/**
 * Tool result message (response to tool call)
 */
export interface ToolResultMessage extends BaseMessage {
  role: 'tool';
  toolCallId: string;
}

/**
 * Union type for all message types
 */
export type Message = BaseMessage | ToolCallMessage | ToolResultMessage;

/**
 * Tool/function definition for function calling
 */
export interface ToolDefinition {
  /**
   * Unique identifier for the tool
   */
  name: string;
  /**
   * Description of what the tool does
   */
  description?: string;
  /**
   * Zod schema defining the parameters the tool accepts
   */
  parameters: z.ZodType<unknown>;
}

/**
 * Tool call made by the LLM
 */
export interface ToolCall {
  /**
   * Unique identifier for this tool call
   */
  id: string;
  /**
   * Name of the tool being called
   */
  name: string;
  /**
   * Arguments passed to the tool (parsed according to tool's parameter schema)
   */
  arguments: unknown;
}

/**
 * Token usage information
 */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Base stream chunk types for incremental responses (without schema)
 */
export type StreamChunk =
  | {
      /**
       * Content delta - incremental text chunk
       */
      type: 'content';
      delta: string;
    }
  | {
      /**
       * Tool call - emitted when a tool call is complete
       */
      type: 'tool_call';
      toolCall: ToolCall;
    }
  | {
      /**
       * Done - final chunk with complete response data
       */
      type: 'done';
      /**
       * Complete content string
       */
      content: string;
      /**
       * All tool calls made during the response (if any)
       */
      toolCalls?: ToolCall[];
      /**
       * Token usage information (if available)
       */
      usage?: Usage;
      /**
       * Parsed and validated data (only present when schema is provided)
       */
      data?: unknown;
    };

/**
 * Stream chunk types for structured JSON responses (with schema type)
 */
export type StreamChunkWithSchema<T> =
  | {
      /**
       * Content delta - incremental text chunk
       */
      type: 'content';
      delta: string;
    }
  | {
      /**
       * Tool call - emitted when a tool call is complete
       */
      type: 'tool_call';
      toolCall: ToolCall;
    }
  | {
      /**
       * Done - final chunk with complete response data
       */
      type: 'done';
      /**
       * Complete content string
       */
      content: string;
      /**
       * All tool calls made during the response (if any)
       */
      toolCalls?: ToolCall[];
      /**
       * Token usage information (if available)
       */
      usage?: Usage;
      /**
       * Parsed and validated data matching the provided schema (always present when schema is provided)
       */
      data: T;
    };

/**
 * Options for streaming completion
 */
export interface StreamOptions {
  /**
   * Temperature for response randomness (0-2, higher = more random)
   */
  temperature?: number;
  /**
   * Maximum number of tokens to generate
   */
  maxTokens?: number;
  /**
   * Top-p (nucleus) sampling parameter
   */
  topP?: number;
  /**
   * Frequency penalty to reduce repetition
   */
  frequencyPenalty?: number;
  /**
   * Presence penalty to encourage new topics
   */
  presencePenalty?: number;
  /**
   * Stop sequences that will end generation
   */
  stop?: string[];
  /**
   * Tools/function definitions available to the LLM for function calling
   */
  tools?: ToolDefinition[];
  /**
   * Zod schema for structured JSON output (if provided, enables structured JSON mode)
   */
  schema?: z.ZodType<unknown>;
  /**
   * Whether to strictly enforce the schema (only applies when schema is provided)
   */
  strict?: boolean;
}

/**
 * Abstraction over Large Language Model services.
 * This abstract class allows swapping between different LLM providers (OpenAI, Anthropic, etc.)
 * at runtime without changing the calling code.
 */
export abstract class LLM {
  /**
   * Get a chat completion (non-streaming).
   * @param messages Array of messages in the conversation
   * @param options Optional configuration for the completion, including optional tools
   * @returns Promise that resolves to an array of messages including the assistant's response
   */
  async completions(messages: Message[], options?: StreamOptions): Promise<Message[]> {
    const result: Message[] = [...messages];
    let assistantMessage: ToolCallMessage | null = null;

    for await (const chunk of this.stream(messages, options)) {
      if (chunk.type === 'tool_call') {
        if (!assistantMessage) {
          assistantMessage = {
            role: 'assistant',
            content: '',
            toolCalls: [],
          };
        }
        if (!assistantMessage.toolCalls) {
          assistantMessage.toolCalls = [];
        }
        assistantMessage.toolCalls.push(chunk.toolCall);
      } else if (chunk.type === 'done') {
        if (!assistantMessage) {
          assistantMessage = {
            role: 'assistant',
            content: chunk.content,
            ...(chunk.toolCalls && chunk.toolCalls.length > 0 && { toolCalls: chunk.toolCalls }),
          };
        } else {
          assistantMessage.content = chunk.content;
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            assistantMessage.toolCalls = chunk.toolCalls;
          }
        }
      }
    }

    if (assistantMessage) {
      result.push(assistantMessage);
    }

    return result;
  }

  /**
   * Stream a chat conversation completion with structured JSON output.
   * @param messages Array of messages in the conversation
   * @param options Configuration including a schema for structured JSON output
   * @returns AsyncIterable of stream chunks with type-safe data field matching the schema
   */
  abstract stream<T extends z.ZodType<unknown>>(
    messages: Message[],
    options: StreamOptions & { schema: T },
  ): AsyncIterable<StreamChunkWithSchema<z.infer<T>>>;

  /**
   * Stream a chat conversation completion.
   * @param messages Array of messages in the conversation
   * @param options Optional configuration for the completion, including optional tools
   * @returns AsyncIterable of stream chunks containing content deltas, tool calls, and final response data
   */
  abstract stream(messages: Message[], options?: StreamOptions): AsyncIterable<StreamChunk>;
}
