import { z } from 'zod';
import OpenAI from 'openai';
import type { Logger } from '../logger';
import { Err, Ok, type Result } from '../result';
import { zodToJsonSchema } from '../zod-to-json-schema';
import type {
  ChatCompletionOptions,
  ChatCompletionResponse,
  LLM,
  Message,
  StructuredJsonOptions,
  StructuredJsonResponse,
  ToolDefinition,
} from './llm';

/**
 * Supported OpenAI models
 */
export type OpenAIModel =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-4-turbo-preview'
  | 'gpt-4-0125-preview'
  | 'gpt-4-1106-preview'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-16k'
  | 'gpt-3.5-turbo-0125'
  | 'gpt-3.5-turbo-1106';

/**
 * Configuration for OpenAI LLM client
 */
export interface OpenAIConfig {
  /**
   * OpenAI API key
   */
  apiKey: string;
  /**
   * Model to use
   */
  model?: OpenAIModel;
  /**
   * Base URL for OpenAI API (defaults to https://api.openai.com/v1)
   */
  baseUrl?: string;
  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * OpenAI SDK message type
 */
type OpenAIMessage =
  | OpenAI.Chat.Completions.ChatCompletionSystemMessageParam
  | OpenAI.Chat.Completions.ChatCompletionUserMessageParam
  | OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam
  | OpenAI.Chat.Completions.ChatCompletionToolMessageParam;

/**
 * Convert our Message format to OpenAI SDK format
 */
function convertMessageToOpenAI(message: Message): OpenAIMessage {
  if (message.role === 'tool') {
    const toolCallId = 'toolCallId' in message ? message.toolCallId : undefined;
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: toolCallId || '',
    };
  }

  if (message.role === 'assistant' && 'toolCalls' in message && message.toolCalls) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
        },
      })),
    };
  }

  return {
    role: message.role,
    content: message.content,
  } as OpenAIMessage;
}

/**
 * Convert OpenAI SDK message format to our format
 */
function convertMessageFromOpenAI(message: OpenAI.Chat.Completions.ChatCompletionMessage): Message {
  if (message.role === 'assistant') {
    const content = typeof message.content === 'string' ? message.content : '';

    if (message.tool_calls && message.tool_calls.length > 0) {
      return {
        role: 'assistant',
        content,
        toolCalls: message.tool_calls.map((tc) => {
          // Handle both standard and custom tool calls
          if ('function' in tc) {
            return {
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments),
            };
          }
          // For custom tool calls, we need to extract the function info differently
          // This shouldn't happen in normal usage, but handle it gracefully
          return {
            id: tc.id,
            name: 'unknown',
            arguments: {},
          };
        }),
      };
    }

    return {
      role: 'assistant',
      content,
    };
  }

  // For system and user messages
  return {
    role: message.role,
    content: typeof message.content === 'string' ? message.content : '',
  };
}

/**
 * Convert ToolDefinition to OpenAI function format
 */
function convertToolToOpenAI(tool: ToolDefinition): {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
} {
  return {
    name: tool.name,
    ...(tool.description !== undefined && { description: tool.description }),
    parameters: zodToJsonSchema(tool.parameters),
  };
}

/**
 * OpenAI implementation of the LLM interface
 */
export class LLMOpenAI implements LLM {
  private client: OpenAI;
  private model: OpenAIModel;
  private logger?: Logger;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseUrl && { baseURL: config.baseUrl }),
    });
    this.model = config.model || 'gpt-4';
    if (config.logger !== undefined) {
      this.logger = config.logger;
    }
  }

  async chat(
    messages: Message[],
    options?: ChatCompletionOptions,
  ): Promise<Result<ChatCompletionResponse, string>> {
    try {
      const openAIMessages = messages.map(convertMessageToOpenAI);

      this.logger?.debug('OpenAI API request', {
        model: this.model,
        messageCount: openAIMessages.length,
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: openAIMessages,
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.maxTokens !== undefined && { max_tokens: options.maxTokens }),
        ...(options?.topP !== undefined && { top_p: options.topP }),
        ...(options?.frequencyPenalty !== undefined && {
          frequency_penalty: options.frequencyPenalty,
        }),
        ...(options?.presencePenalty !== undefined && {
          presence_penalty: options.presencePenalty,
        }),
        ...(options?.stop && options.stop.length > 0 && { stop: options.stop }),
        ...(options?.tools &&
          options.tools.length > 0 && {
            tools: options.tools.map((tool) => ({
              type: 'function' as const,
              function: convertToolToOpenAI(tool),
            })),
          }),
      });

      const choice = response.choices[0];
      if (!choice) {
        return Err('No response from OpenAI');
      }

      const assistantMessage = choice.message;
      if (assistantMessage.role !== 'assistant') {
        return Err('Unexpected message role from OpenAI');
      }

      const convertedMessage = convertMessageFromOpenAI(assistantMessage);

      const result: ChatCompletionResponse = {
        content: convertedMessage.content,
        ...('toolCalls' in convertedMessage &&
          convertedMessage.toolCalls && { toolCalls: convertedMessage.toolCalls }),
        ...(response.usage && {
          usage: {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          },
        }),
      };

      return Ok(result);
    } catch (error) {
      const errorMessage =
        error instanceof OpenAI.APIError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      this.logger?.error('OpenAI chat error', { error: errorMessage });
      return Err(errorMessage);
    }
  }

  async structuredJson<T extends z.ZodType<unknown>>(
    messages: Message[],
    options: StructuredJsonOptions<T>,
    completionOptions?: ChatCompletionOptions,
  ): Promise<Result<StructuredJsonResponse<z.infer<T>>, string>> {
    try {
      const openAIMessages = messages.map(convertMessageToOpenAI);

      // Convert Zod schema to JSON Schema
      const jsonSchema = zodToJsonSchema(options.schema);

      this.logger?.debug('OpenAI API request (structured JSON)', {
        model: this.model,
        messageCount: openAIMessages.length,
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: openAIMessages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            schema: jsonSchema,
            strict: options.strict ?? false,
          },
        },
        ...(completionOptions?.temperature !== undefined && {
          temperature: completionOptions.temperature,
        }),
        ...(completionOptions?.maxTokens !== undefined && {
          max_tokens: completionOptions.maxTokens,
        }),
        ...(completionOptions?.topP !== undefined && { top_p: completionOptions.topP }),
        ...(completionOptions?.frequencyPenalty !== undefined && {
          frequency_penalty: completionOptions.frequencyPenalty,
        }),
        ...(completionOptions?.presencePenalty !== undefined && {
          presence_penalty: completionOptions.presencePenalty,
        }),
        ...(completionOptions?.stop &&
          completionOptions.stop.length > 0 && { stop: completionOptions.stop }),
        ...(options.tools &&
          options.tools.length > 0 && {
            tools: options.tools.map((tool) => ({
              type: 'function' as const,
              function: convertToolToOpenAI(tool),
            })),
          }),
      });

      const choice = response.choices[0];
      if (!choice) {
        return Err('No response from OpenAI');
      }

      const content = choice.message.content;
      if (!content || typeof content !== 'string') {
        return Err('Empty response from OpenAI');
      }

      // Parse and validate JSON
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch (parseError) {
        return Err(
          `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }

      // Validate against Zod schema
      const validationResult = options.schema.safeParse(parsedJson);
      if (!validationResult.success) {
        return Err(`Response does not match schema: ${validationResult.error.message}`);
      }

      const result: StructuredJsonResponse<z.infer<T>> = {
        data: validationResult.data,
        rawJson: content,
        ...(response.usage && {
          usage: {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          },
        }),
      };

      return Ok(result);
    } catch (error) {
      const errorMessage =
        error instanceof OpenAI.APIError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      this.logger?.error('OpenAI structuredJson error', { error: errorMessage });
      return Err(errorMessage);
    }
  }
}
