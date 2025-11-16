import type { z } from 'zod';
import type { Result } from '../result';

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
 * Options for chat completion
 */
export interface ChatCompletionOptions {
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
   * Whether to stream the response
   */
  stream?: boolean;
  /**
   * Tools/function definitions available to the LLM for function calling
   */
  tools?: ToolDefinition[];
}

/**
 * Response from a chat completion
 */
export interface ChatCompletionResponse {
  /**
   * The generated message content
   */
  content: string;
  /**
   * Tool calls made by the assistant (if any)
   */
  toolCalls?: ToolCall[];
  /**
   * Token usage information
   */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Options for structured JSON output
 */
export interface StructuredJsonOptions<T extends z.ZodType<unknown>> {
  /**
   * Zod schema that defines the expected JSON structure
   */
  schema: T;
  /**
   * Whether to strictly enforce the schema (fail if output doesn't match)
   */
  strict?: boolean;
  /**
   * Tools/function definitions available to the LLM for function calling
   */
  tools?: ToolDefinition[];
}

/**
 * Response from structured JSON completion
 */
export interface StructuredJsonResponse<T> {
  /**
   * Parsed and validated JSON data matching the provided schema
   */
  data: T;
  /**
   * Raw JSON string before parsing
   */
  rawJson?: string;
  /**
   * Token usage information
   */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Abstraction over Large Language Model services.
 * This interface allows swapping between different LLM providers (OpenAI, Anthropic, etc.)
 * at runtime without changing the calling code.
 */
export interface LLM {
  /**
   * Complete a chat conversation.
   * @param messages Array of messages in the conversation
   * @param options Optional configuration for the completion, including optional tools for function calling
   * @returns Result containing the completion response (with potential tool calls if tools were provided) or an error
   */
  chat(
    messages: Message[],
    options?: ChatCompletionOptions,
  ): Promise<Result<ChatCompletionResponse, string>>;

  /**
   * Generate a structured JSON response that matches a Zod schema.
   * @param messages Array of messages in the conversation
   * @param options Configuration including the schema to validate against and optional tools for function calling
   * @param completionOptions Optional additional configuration for the completion
   * @returns Result containing the parsed and validated JSON data (with potential tool calls if tools were provided) or an error
   */
  structuredJson<T extends z.ZodType<unknown>>(
    messages: Message[],
    options: StructuredJsonOptions<T>,
    completionOptions?: ChatCompletionOptions,
  ): Promise<Result<StructuredJsonResponse<z.infer<T>>, string>>;
}
