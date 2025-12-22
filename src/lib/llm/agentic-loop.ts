import type { LLM, Message, ToolDefinition } from './llm';
import type { Logger } from '../logger';

/**
 * Extended tool definition that includes execution logic
 */
export interface ExecutableTool extends ToolDefinition {
  /**
   * Execute the tool with the provided arguments
   * @param args - The tool arguments (should match the parameters schema)
   * @returns JSON string result to send back to the LLM
   */
  execute: (args: unknown) => Promise<string>;
}

/**
 * Handler called when LLM responds without tool calls
 */
export interface NoToolCallHandler {
  /**
   * @param message - The assistant's message without tool calls
   * @param iteration - Current iteration number (0-indexed)
   * @returns Control flow decision
   */
  (
    message: Message,
    iteration: number,
  ): {
    /** Whether to continue the loop or break */
    shouldContinue: boolean;
    /** Optional follow-up message to send to LLM */
    followUpMessage?: string;
  };
}

export interface AgenticLoopOptions {
  /** LLM instance to use */
  llm: LLM;

  /** Initial messages (typically system + user prompt) */
  initialMessages: Message[];

  /** Tools available to the LLM with execution logic */
  tools: ExecutableTool[];

  /** Maximum number of iterations before stopping */
  maxIterations?: number;

  /** Logger instance */
  logger: Logger;

  /**
   * Handler for when LLM doesn't use tools
   * If not provided, loop breaks on first non-tool response
   */
  onNoToolCalls?: NoToolCallHandler;
}

export interface AgenticLoopResult {
  /** Full conversation history */
  messages: Message[];

  /** Whether loop completed normally or hit max iterations */
  completedNormally: boolean;

  /** Number of iterations executed */
  iterations: number;
}

/**
 * Runs an agentic loop where LLM can iteratively call tools
 * until it's ready to provide a final response
 */
export async function runAgenticLoop(options: AgenticLoopOptions): Promise<AgenticLoopResult> {
  const { llm, initialMessages, tools, maxIterations = 10, logger, onNoToolCalls } = options;

  const messages: Message[] = [...initialMessages];
  let iteration = 0;

  logger.debug('Starting agentic loop', {
    maxIterations,
    toolCount: tools.length,
    toolNames: tools.map((t) => t.name),
  });

  while (iteration < maxIterations) {
    logger.debug('Agentic loop iteration', {
      iteration: iteration + 1,
      maxIterations,
      messageCount: messages.length,
    });

    // Call LLM with tools
    const response = await llm.completions(messages, { tools });

    const lastMessage = response[response.length - 1];

    if (!lastMessage || lastMessage.role !== 'assistant') {
      logger.warn('Unexpected message role or missing message', {
        iteration: iteration + 1,
        lastMessageRole: lastMessage?.role,
      });
      break;
    }

    messages.push(lastMessage);

    // Check if there are tool calls
    const hasToolCalls =
      'toolCalls' in lastMessage &&
      lastMessage.toolCalls !== undefined &&
      lastMessage.toolCalls.length > 0;

    if (hasToolCalls && lastMessage.toolCalls) {
      logger.debug('Executing tool calls', {
        iteration: iteration + 1,
        toolCallCount: lastMessage.toolCalls.length,
        toolCallNames: lastMessage.toolCalls.map((tc) => tc.name),
      });

      // Execute all tool calls
      for (const toolCall of lastMessage.toolCalls) {
        logger.debug('Executing tool call', {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });

        // Find the matching tool
        const tool = tools.find((t) => t.name === toolCall.name);

        if (!tool) {
          logger.warn('Unknown tool requested', { toolName: toolCall.name });
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
            toolCallId: toolCall.id,
          });
          continue;
        }

        // Execute the tool
        try {
          const result = await tool.execute(toolCall.arguments);
          messages.push({
            role: 'tool',
            content: result,
            toolCallId: toolCall.id,
          });
        } catch (error) {
          logger.error('Tool execution error', {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            error: error instanceof Error ? error.message : String(error),
          });
          messages.push({
            role: 'tool',
            content: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
            toolCallId: toolCall.id,
          });
        }
      }
    } else {
      // No tool calls - check if we should continue
      if (onNoToolCalls) {
        const decision = onNoToolCalls(lastMessage, iteration);

        if (!decision.shouldContinue) {
          logger.debug('No tool calls handler decided to stop', {
            iteration: iteration + 1,
          });
          break;
        }

        if (decision.followUpMessage) {
          logger.debug('No tool calls handler provided follow-up message', {
            iteration: iteration + 1,
          });
          messages.push({
            role: 'user',
            content: decision.followUpMessage,
          });
        }
      } else {
        // Default behavior: stop on first non-tool response
        logger.debug('No tool calls detected, stopping loop', {
          iteration: iteration + 1,
        });
        break;
      }
    }

    iteration++;
  }

  const completedNormally = iteration < maxIterations;

  if (!completedNormally) {
    logger.warn('Agentic loop reached maximum iterations', {
      maxIterations,
    });
  }

  logger.debug('Agentic loop completed', {
    iterations: iteration,
    completedNormally,
    finalMessageCount: messages.length,
  });

  return {
    messages,
    completedNormally,
    iterations: iteration,
  };
}
