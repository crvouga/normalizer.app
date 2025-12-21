import OpenAI from 'openai';
import type { z } from 'zod';
import type { Logger } from '../logger';
import { SecretString } from '../secrets/secret-string';
import { zodToJsonSchema } from '../zod-to-json-schema';
import {
  LLM,
  type Message,
  type StreamChunk,
  type StreamChunkWithSchema,
  type StreamOptions,
  type ToolCall,
  type ToolDefinition,
  type Usage,
} from './llm';

/**
 * Supported OpenAI models - extracted from OpenAI client library types
 */
export type OpenAIModel = OpenAI.ChatModel;

export const CHEAPEST_MODEL: OpenAIModel = 'gpt-3.5-turbo';

/**
 * Configuration for OpenAI LLM client
 */
export interface OpenAIConfig {
  /**
   * OpenAI API key
   */
  apiKey: SecretString;
  /**
   * Model to use
   */
  model: OpenAIModel;
  /**
   * Base URL for OpenAI API (defaults to https://api.openai.com/v1)
   */
  baseUrl?: string;
  /**
   * Logger instance
   */
  logger: Logger;
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
 * Internal state for processing stream chunks
 */
interface StreamState {
  accumulatedContent: string;
  toolCalls: ToolCall[];
  toolCallBuffers: Map<number, { id: string; name: string; arguments: string }>;
  usage: Usage | undefined;
}

/**
 * OpenAI implementation of the LLM interface
 */
export class LLMOpenAI extends LLM {
  private client: OpenAI;
  private model: OpenAIModel;
  private logger: Logger;

  constructor(config: OpenAIConfig) {
    super();
    this.client = new OpenAI({
      apiKey: config.apiKey.DANGEROUSLY_readValue(),
      ...(config.baseUrl && { baseURL: config.baseUrl }),
    });
    this.model = config.model;
    this.logger = config.logger;
  }

  // Implementation satisfies both overloads - TypeScript can't verify this for async generators
  // The return type is a union that satisfies both overload signatures
  // @ts-expect-error - TypeScript can't verify overload compatibility for async generators.
  // The implementation correctly satisfies both overloads at runtime - when schema is provided,
  // the done chunk always includes typed data; when not provided, it uses the base StreamChunk type.
  async *stream<T extends z.ZodType<unknown>>(
    messages: Message[],
    options?: StreamOptions | (StreamOptions & { schema: T }),
  ): AsyncIterable<StreamChunk | StreamChunkWithSchema<z.infer<T>>> {
    const openAIMessages = messages.map(this.convertMessageToOpenAI);

    this.logger.debug('OpenAI API request (streaming)', {
      model: this.model,
      messageCount: openAIMessages.length,
      hasSchema: options?.schema !== undefined,
    });

    try {
      const requestParams = this.buildRequestParams(openAIMessages, options);
      const stream = await this.client.chat.completions.create(requestParams);

      const state: StreamState = {
        accumulatedContent: '',
        toolCalls: [],
        toolCallBuffers: new Map<number, { id: string; name: string; arguments: string }>(),
        usage: undefined,
      };

      yield* this.processStreamChunks(stream, state);

      yield* this.processRemainingToolCalls(state);

      const parsedData = this.parseAndValidateResponse(state.accumulatedContent, options);

      yield this.createDoneChunk(state, parsedData, options);
    } catch (error) {
      // Check if error is about structured outputs not being supported
      const isStructuredOutputsError =
        error instanceof OpenAI.APIError &&
        error.message.includes("'response_format' of type 'json_schema' is not supported");

      if (isStructuredOutputsError && options?.schema) {
        // Fallback: retry without structured outputs, but request JSON format
        this.logger.warn(
          'Model does not support structured outputs, falling back to JSON format with manual validation',
          { model: this.model },
        );

        // Add instruction to return JSON in the last user message
        const fallbackMessages: OpenAIMessage[] = [...openAIMessages];
        const lastMessage = fallbackMessages[fallbackMessages.length - 1];
        if (
          lastMessage &&
          'role' in lastMessage &&
          lastMessage.role === 'user' &&
          typeof lastMessage.content === 'string'
        ) {
          fallbackMessages[fallbackMessages.length - 1] = {
            ...lastMessage,
            content:
              lastMessage.content +
              '\n\nIMPORTANT: Respond with valid JSON only, no markdown code blocks, no explanatory text.',
          };
        } else {
          fallbackMessages.push({
            role: 'user',
            content:
              'IMPORTANT: Respond with valid JSON only, no markdown code blocks, no explanatory text.',
          });
        }

        // Create options without schema to avoid structured outputs
        const { schema: _, ...fallbackOptions } = options;
        const fallbackParams = this.buildRequestParams(fallbackMessages, fallbackOptions);
        // Use JSON format instead of structured outputs
        fallbackParams.response_format = { type: 'json_object' };

        try {
          const stream = await this.client.chat.completions.create(fallbackParams);

          const state: StreamState = {
            accumulatedContent: '',
            toolCalls: [],
            toolCallBuffers: new Map<number, { id: string; name: string; arguments: string }>(),
            usage: undefined,
          };

          yield* this.processStreamChunks(stream, state);

          yield* this.processRemainingToolCalls(state);

          // Parse and validate manually
          const parsedData = this.parseAndValidateResponse(state.accumulatedContent, options);

          yield this.createDoneChunk(state, parsedData, options);
        } catch (fallbackError) {
          // Check if json_object format is also not supported
          const isJsonObjectError =
            fallbackError instanceof OpenAI.APIError &&
            fallbackError.message.includes(
              "'response_format' of type 'json_object' is not supported",
            );

          if (isJsonObjectError) {
            // Final fallback: plain text with JSON instructions, no response_format
            this.logger.warn(
              'Model does not support json_object format, falling back to plain text with JSON prompt instructions',
              { model: this.model },
            );

            // Remove response_format and rely on prompt instructions
            const plainTextParams = this.buildRequestParams(fallbackMessages, fallbackOptions);
            // Don't set response_format at all

            const stream = await this.client.chat.completions.create(plainTextParams);

            const state: StreamState = {
              accumulatedContent: '',
              toolCalls: [],
              toolCallBuffers: new Map<number, { id: string; name: string; arguments: string }>(),
              usage: undefined,
            };

            yield* this.processStreamChunks(stream, state);

            yield* this.processRemainingToolCalls(state);

            // Parse and validate manually (will handle markdown code blocks if present)
            const parsedData = this.parseAndValidateResponse(state.accumulatedContent, options);

            yield this.createDoneChunk(state, parsedData, options);
          } else {
            // Re-throw other errors from fallback
            throw fallbackError;
          }
        }
      } else {
        // Re-throw other errors
        const errorMessage =
          error instanceof OpenAI.APIError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);
        this.logger.error('OpenAI stream error', { error: errorMessage });
        throw new Error(errorMessage);
      }
    }
  }

  private buildRequestParams(
    messages: OpenAIMessage[],
    options?: StreamOptions | (StreamOptions & { schema: z.ZodType<unknown> }),
  ): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
    const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
      model: this.model,
      messages,
      stream: true,
    };
    if (options?.temperature !== undefined) {
      requestParams.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      // max_tokens is still valid in OpenAI API despite TypeScript deprecation warning
      (requestParams as { max_tokens?: number }).max_tokens = options.maxTokens;
    }
    if (options?.topP !== undefined) {
      requestParams.top_p = options.topP;
    }
    if (options?.frequencyPenalty !== undefined) {
      requestParams.frequency_penalty = options.frequencyPenalty;
    }
    if (options?.presencePenalty !== undefined) {
      requestParams.presence_penalty = options.presencePenalty;
    }
    if (options?.stop && options.stop.length > 0) {
      requestParams.stop = options.stop;
    }
    if (options?.tools && options.tools.length > 0) {
      requestParams.tools = options.tools.map((tool) => ({
        type: 'function' as const,
        function: this.convertToolToOpenAI(tool),
      }));
    }
    if (options?.schema) {
      const jsonSchema = zodToJsonSchema(options.schema);
      requestParams.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: jsonSchema,
          strict: options.strict ?? false,
        },
      };
    }

    return requestParams;
  }

  private async *processStreamChunks(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    state: StreamState,
  ): AsyncIterable<StreamChunk> {
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) {
        continue;
      }

      const delta = choice.delta;

      if (delta.content) {
        yield* this.handleContentDelta(delta.content, state);
      }

      if (delta.tool_calls) {
        this.handleToolCallDelta(delta.tool_calls, state);
      }

      if (chunk.usage) {
        state.usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        };
      }

      if (choice.finish_reason === 'tool_calls') {
        yield* this.processToolCalls(state);
      }
    }
  }

  private *handleContentDelta(
    content: string,
    state: { accumulatedContent: string },
  ): Generator<StreamChunk> {
    state.accumulatedContent += content;
    yield { type: 'content', delta: content };
  }

  private handleToolCallDelta(
    toolCallDeltas: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[],
    state: {
      toolCallBuffers: Map<number, { id: string; name: string; arguments: string }>;
    },
  ): void {
    for (const toolCallDelta of toolCallDeltas) {
      if (toolCallDelta.index === undefined) {
        continue;
      }

      const index = toolCallDelta.index;
      const callId = toolCallDelta.id;

      if (!state.toolCallBuffers.has(index)) {
        state.toolCallBuffers.set(index, { id: callId || '', name: '', arguments: '' });
      }

      const buffer = state.toolCallBuffers.get(index)!;

      if (callId) {
        buffer.id = callId;
      }

      if (toolCallDelta.function?.name) {
        buffer.name = toolCallDelta.function.name;
      }

      if (toolCallDelta.function?.arguments) {
        buffer.arguments += toolCallDelta.function.arguments;
      }
    }
  }

  private *processToolCalls(state: StreamState): Generator<StreamChunk> {
    for (const [index, buffer] of state.toolCallBuffers.entries()) {
      if (!buffer.id || !buffer.name || !buffer.arguments) {
        continue;
      }

      try {
        const parsedArgs = JSON.parse(buffer.arguments);
        const newToolCall: ToolCall = {
          id: buffer.id,
          name: buffer.name,
          arguments: parsedArgs,
        };
        state.toolCalls.push(newToolCall);
        yield { type: 'tool_call', toolCall: newToolCall };
      } catch (error) {
        this.logger.warn('Failed to parse tool call arguments', {
          index,
          callId: buffer.id,
          arguments: buffer.arguments,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private *processRemainingToolCalls(state: StreamState): Generator<StreamChunk> {
    for (const [index, buffer] of state.toolCallBuffers.entries()) {
      if (!buffer.id || !buffer.name || !buffer.arguments) {
        continue;
      }

      const alreadyEmitted = state.toolCalls.some((tc) => tc.id === buffer.id);
      if (alreadyEmitted) {
        continue;
      }

      try {
        const parsedArgs = JSON.parse(buffer.arguments);
        const newToolCall: ToolCall = {
          id: buffer.id,
          name: buffer.name,
          arguments: parsedArgs,
        };
        state.toolCalls.push(newToolCall);
        yield { type: 'tool_call', toolCall: newToolCall };
      } catch (error) {
        this.logger.warn('Failed to parse tool call arguments', {
          index,
          callId: buffer.id,
          arguments: buffer.arguments,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private parseAndValidateResponse(
    accumulatedContent: string,
    options?: StreamOptions | (StreamOptions & { schema: z.ZodType<unknown> }),
  ): unknown | undefined {
    if (!options?.schema) {
      return undefined;
    }

    // Extract JSON from markdown code blocks if present
    let jsonContent = accumulatedContent.trim();
    const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonContent = codeBlockMatch[1].trim();
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(jsonContent);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
    }

    const validationResult = options.schema.safeParse(parsedData);
    if (!validationResult.success) {
      throw new Error(`Response does not match schema: ${validationResult.error.message}`);
    }

    return validationResult.data;
  }

  private createDoneChunk<T extends z.ZodType<unknown>>(
    state: StreamState,
    parsedData: unknown | undefined,
    options?: StreamOptions | (StreamOptions & { schema: T }),
  ): StreamChunk | StreamChunkWithSchema<z.infer<T>> {
    const baseChunk = {
      type: 'done' as const,
      content: state.accumulatedContent,
      ...(state.toolCalls.length > 0 && { toolCalls: state.toolCalls }),
      ...(state.usage && { usage: state.usage }),
    };

    if (options?.schema && parsedData !== undefined) {
      return {
        ...baseChunk,
        data: parsedData,
      } satisfies StreamChunkWithSchema<z.infer<typeof options.schema>>;
    }

    return {
      ...baseChunk,
      ...(parsedData !== undefined && { data: parsedData }),
    } satisfies StreamChunk;
  }

  private convertMessageToOpenAI(message: Message): OpenAIMessage {
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
            arguments:
              typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
          },
        })),
      };
    }

    return {
      role: message.role,
      content: message.content,
    } satisfies OpenAIMessage;
  }

  private convertToolToOpenAI(tool: ToolDefinition): {
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
}

export function createLLMOpenAI(params: { logger: Logger; model: OpenAIModel }): LLM {
  const apiKey = SecretString.fromEnvVar('OPENAI_API_KEY');

  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  return new LLMOpenAI({
    apiKey,
    logger: params.logger,
    model: params.model,
  }) as LLM;
}

export function isOpenAIEnabled(): boolean {
  return process.env.OPENAI_API_KEY !== undefined;
}
