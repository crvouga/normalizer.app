import { z } from 'zod';
import type { Logger } from '../logger';
import { Err, isErr, Ok, type Result } from '../result';
import type { LLM, Message, ToolCall, ToolDefinition, Usage } from './llm';

/**
 * Agent execution phase
 */
export type AgentPhase =
  | 'initializing'
  | 'planning' // Optional: agent can plan before acting
  | 'acting' // Executing tool calls
  | 'reasoning' // LLM thinking without tools
  | 'final' // Produced final answer
  | 'failed' // Unrecoverable error
  | 'budget_exceeded'; // Hit token/time/cost limit

/**
 * Budget tracking for agent execution
 */
export interface BudgetTracking {
  tokens: { used: number; limit: number };
  wallClockMs: { used: number; limit: number };
  toolCalls: { used: number; limit: number };
}

/**
 * Budget limits configuration
 */
export interface BudgetLimits {
  /** Maximum tokens (0 = unlimited) */
  maxTokens?: number;
  /** Maximum wall-clock time in milliseconds (0 = unlimited) */
  maxWallClockMs?: number;
  /** Maximum number of tool calls (0 = unlimited) */
  maxToolCalls?: number;
}

/**
 * Execution event types
 */
export type ExecutionEvent =
  | {
      type: 'phase_transition';
      from: AgentPhase;
      to: AgentPhase;
      stepNumber: number;
      timestamp: number;
    }
  | {
      type: 'tool_call_started';
      toolCallId: string;
      toolName: string;
      stepNumber: number;
      timestamp: number;
    }
  | {
      type: 'tool_call_completed';
      toolCallId: string;
      toolName: string;
      success: boolean;
      stepNumber: number;
      timestamp: number;
      error?: string;
    }
  | {
      type: 'tool_validation_error';
      toolCallId: string;
      toolName: string;
      error: string;
      stepNumber: number;
      timestamp: number;
    }
  | {
      type: 'budget_check';
      budget: BudgetTracking;
      stepNumber: number;
      timestamp: number;
    }
  | {
      type: 'llm_call';
      stepNumber: number;
      timestamp: number;
      usage?: Usage;
    };

/**
 * Agent state during execution
 */
export interface AgentState {
  phase: AgentPhase;
  stepNumber: number;
  conversationMessages: Message[];
  executionEvents: ExecutionEvent[];
  budgetUsed: BudgetTracking;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  content: string;
  error?: string;
  validationError?: string;
}

/**
 * Extended tool definition that includes execution logic
 */
export interface ExecutableTool extends ToolDefinition {
  /**
   * Execute the tool with the provided arguments
   * @param args - The tool arguments (validated against parameters schema)
   * @returns JSON string result to send back to the LLM
   */
  execute: (args: unknown) => Promise<string>;
}

/**
 * Handler called when LLM responds without tool calls
 * Returns whether to continue the loop and optional follow-up message
 */
export interface ShouldContinueHandler {
  /**
   * @param message - The assistant's message without tool calls
   * @param stepNumber - Current step number (1-indexed)
   * @param state - Current agent state
   * @returns Control flow decision
   */
  (
    message: Message,
    stepNumber: number,
    state: AgentState,
  ): {
    /** Whether to continue the loop or break */
    shouldContinue: boolean;
    /** Optional follow-up message to send to LLM */
    followUpMessage?: string;
  };
}

/**
 * Agent hooks for extensibility
 */
export interface AgentHooks {
  /**
   * Called when agent transitions between phases
   */
  onPhaseTransition?: (from: AgentPhase, to: AgentPhase, state: AgentState) => void | Promise<void>;

  /**
   * Called before executing a tool call
   */
  beforeToolCall?: (toolCall: ToolCall, state: AgentState) => void | Promise<void>;

  /**
   * Called after executing a batch of tool calls
   */
  afterToolBatch?: (results: ToolResult[], state: AgentState) => void | Promise<void>;
}

/**
 * Agent goal and success criteria (placeholder for future implementation)
 */
export interface AgentGoal {
  description: string;
  successCriteria?: (state: AgentState) => boolean;
}

/**
 * Agent memory interface (placeholder for future implementation)
 */
export interface AgentMemory {
  store(key: string, value: unknown): Promise<void>;
  retrieve(key: string): Promise<unknown | null>;
  // Future: vector memory, conversation summarization, etc.
}

export interface AgentOptions {
  /** LLM instance to use */
  llm: LLM;

  /** Logger instance */
  logger: Logger;
}

export interface AgentRunOptions {
  /** Initial messages (typically system + user prompt) */
  initialMessages: Message[];

  /** Tools available to the LLM with execution logic */
  tools: ExecutableTool[];

  /** Maximum number of iterations before stopping */
  maxIterations?: number;

  /**
   * Handler for when LLM doesn't use tools
   * If not provided, loop breaks on first non-tool response
   */
  shouldContinue?: ShouldContinueHandler;

  /**
   * Budget limits for execution
   */
  budgetLimits?: BudgetLimits;

  /**
   * Hooks for extensibility
   */
  hooks?: AgentHooks;

  /**
   * Agent goal (optional, for future use)
   */
  goal?: AgentGoal;

  /**
   * Agent memory (optional, for future use)
   */
  memory?: AgentMemory;
}

/**
 * @deprecated Use AgentOptions and AgentRunOptions instead
 */
export interface AgenticLoopOptions extends AgentOptions, AgentRunOptions {}

export interface AgenticLoopResult {
  /** Conversation messages (for LLM continuation) */
  conversationMessages: Message[];

  /** Execution events (for debugging and analysis) */
  executionEvents: ExecutionEvent[];

  /** Final agent phase */
  phase: AgentPhase;

  /** Final answer message, if agent reached final phase */
  finalAnswer: Message | null;

  /** Whether loop completed normally (reached final phase) */
  completedNormally: boolean;

  /** Number of steps executed */
  stepNumber: number;

  /** Budget usage at completion */
  budgetUsed: BudgetTracking;
}

/**
 * Agent class that manages an agentic loop execution
 */
export class AgenticLoop {
  private readonly llm: LLM;
  private readonly logger: Logger;

  // Execution state (reset on each run)
  private tools: ExecutableTool[] = [];
  private maxIterations = 10;
  private shouldContinue: ShouldContinueHandler | undefined;
  private budgetLimits: BudgetLimits = {};
  private hooks: AgentHooks | undefined;
  // Placeholder for future implementation
  private _goal: AgentGoal | undefined;
  // Placeholder for future implementation
  private _memory: AgentMemory | undefined;

  private conversationMessages: Message[] = [];
  private executionEvents: ExecutionEvent[] = [];
  private budgetUsed: BudgetTracking;
  private phase: AgentPhase = 'reasoning';
  private stepNumber = 0;
  private finalAnswer: Message | null = null;
  private startTime = 0;

  constructor(options: AgentOptions) {
    this.llm = options.llm;
    this.logger = options.logger.child(AgenticLoop.name);

    // Initialize budget tracking (will be reset on each run)
    this.budgetUsed = {
      tokens: { used: 0, limit: 0 },
      wallClockMs: { used: 0, limit: 0 },
      toolCalls: { used: 0, limit: 0 },
    };
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return {
      phase: this.phase,
      stepNumber: this.stepNumber,
      conversationMessages: [...this.conversationMessages],
      executionEvents: [...this.executionEvents],
      budgetUsed: { ...this.budgetUsed },
    };
  }

  /**
   * Run the agentic loop
   */
  async run(options: AgentRunOptions): Promise<Result<AgenticLoopResult, string>> {
    try {
      // Set run-specific options
      this.tools = options.tools;
      this.maxIterations = options.maxIterations ?? 10;
      this.shouldContinue = options.shouldContinue;
      this.budgetLimits = options.budgetLimits ?? {};
      this.hooks = options.hooks;
      this._goal = options.goal;
      this._memory = options.memory;
      // Suppress unused warnings - these are placeholders for future features
      void this._goal;
      void this._memory;

      // Initialize state
      this.conversationMessages = [...options.initialMessages];
      this.executionEvents = [];
      this.phase = 'reasoning';
      this.stepNumber = 0;
      this.finalAnswer = null;
      this.startTime = Date.now();

      // Reset budget tracking
      this.budgetUsed = {
        tokens: { used: 0, limit: this.budgetLimits.maxTokens ?? 0 },
        wallClockMs: { used: 0, limit: this.budgetLimits.maxWallClockMs ?? 0 },
        toolCalls: { used: 0, limit: this.budgetLimits.maxToolCalls ?? 0 },
      };

      this.logger.debug('Starting agentic loop', {
        maxIterations: this.maxIterations,
        toolCount: this.tools.length,
        toolNames: this.tools.map((t) => t.name),
        budgetLimits: this.budgetLimits,
      });

      while (this.stepNumber < this.maxIterations) {
        this.stepNumber++;

        // Update wall-clock time
        this.budgetUsed.wallClockMs.used = Date.now() - this.startTime;

        // Check budget limits
        if (this.checkBudgetLimits()) {
          this.transitionPhase('budget_exceeded');
          this.logger.warn('Agentic loop exceeded budget limits', {
            budgetUsed: this.budgetUsed,
            budgetLimits: this.budgetLimits,
          });
          break;
        }

        this.executionEvents.push({
          type: 'budget_check',
          budget: { ...this.budgetUsed },
          stepNumber: this.stepNumber,
          timestamp: Date.now(),
        });

        this.logger.debug('Agentic loop step', {
          stepNumber: this.stepNumber,
          maxIterations: this.maxIterations,
          phase: this.phase,
          messageCount: this.conversationMessages.length,
          budgetUsed: this.budgetUsed,
        });

        // Call LLM with tools
        const response = await this.llm.completions(this.conversationMessages, {
          tools: this.tools,
        });

        const lastMessage = response[response.length - 1];

        if (!lastMessage || lastMessage.role !== 'assistant') {
          this.logger.warn('Unexpected message role or missing message', {
            stepNumber: this.stepNumber,
            lastMessageRole: lastMessage?.role,
          });
          this.transitionPhase('failed');
          break;
        }

        this.conversationMessages.push(lastMessage);

        // Check if there are tool calls
        const hasToolCalls =
          'toolCalls' in lastMessage &&
          lastMessage.toolCalls !== undefined &&
          lastMessage.toolCalls.length > 0;

        if (hasToolCalls && lastMessage.toolCalls) {
          await this.handleToolCalls(lastMessage.toolCalls);
        } else {
          const shouldBreak = await this.handleNoToolCalls(lastMessage);
          if (shouldBreak) {
            break;
          }
        }
      }

      // Final budget update
      this.budgetUsed.wallClockMs.used = Date.now() - this.startTime;

      // Check if we hit max iterations
      if (this.stepNumber >= this.maxIterations) {
        const currentPhase = this.phase as AgentPhase;
        if (currentPhase !== 'final' && currentPhase !== 'budget_exceeded') {
          this.logger.warn('Agentic loop reached maximum iterations', {
            maxIterations: this.maxIterations,
            finalPhase: currentPhase,
          });
          this.transitionPhase('failed');
        }
      }

      // Read final phase after potential transition
      const finalPhase = this.phase as AgentPhase;
      const completedNormally = finalPhase === 'final';

      this.logger.debug('Agentic loop completed', {
        stepNumber: this.stepNumber,
        phase: finalPhase,
        completedNormally,
        finalMessageCount: this.conversationMessages.length,
        budgetUsed: this.budgetUsed,
      });

      return Ok({
        conversationMessages: this.conversationMessages,
        executionEvents: this.executionEvents,
        phase: finalPhase,
        finalAnswer: this.finalAnswer,
        completedNormally,
        stepNumber: this.stepNumber,
        budgetUsed: this.budgetUsed,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during agentic loop execution';
      this.logger.error('Agentic loop failed', { error: errorMessage });
      return Err(errorMessage);
    }
  }

  /**
   * Transition between phases
   */
  private transitionPhase(newPhase: AgentPhase): void {
    if (this.phase !== newPhase) {
      const event: ExecutionEvent = {
        type: 'phase_transition',
        from: this.phase,
        to: newPhase,
        stepNumber: this.stepNumber,
        timestamp: Date.now(),
      };
      this.executionEvents.push(event);
      this.hooks?.onPhaseTransition?.(this.phase, newPhase, this.getState());
      this.phase = newPhase;
    }
  }

  /**
   * Handle tool calls from LLM
   */
  private async handleToolCalls(toolCalls: ToolCall[]): Promise<void> {
    this.transitionPhase('acting');

    this.logger.debug('Executing tool calls', {
      stepNumber: this.stepNumber,
      toolCallCount: toolCalls.length,
      toolCallNames: toolCalls.map((tc) => tc.name),
    });

    // Record tool call start events
    for (const toolCall of toolCalls) {
      this.executionEvents.push({
        type: 'tool_call_started',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        stepNumber: this.stepNumber,
        timestamp: Date.now(),
      });

      this.hooks?.beforeToolCall?.(toolCall, this.getState());
    }

    // Execute all tool calls as a batch
    const toolResults = await this.executeToolBatch(toolCalls);

    // Update tool call budget
    this.budgetUsed.toolCalls.used += toolResults.length;

    // Record tool call completion events and add results to conversation
    for (const result of toolResults) {
      if (result.validationError) {
        this.executionEvents.push({
          type: 'tool_validation_error',
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          error: result.validationError,
          stepNumber: this.stepNumber,
          timestamp: Date.now(),
        });
      } else {
        const event: ExecutionEvent = {
          type: 'tool_call_completed',
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          success: result.success,
          stepNumber: this.stepNumber,
          timestamp: Date.now(),
        };
        if (result.error) {
          event.error = result.error;
        }
        this.executionEvents.push(event);
      }

      this.conversationMessages.push({
        role: 'tool',
        content: result.content,
        toolCallId: result.toolCallId,
      });
    }

    this.hooks?.afterToolBatch?.(toolResults, this.getState());

    // Transition back to reasoning phase
    this.transitionPhase('reasoning');
  }

  /**
   * Handle case when LLM responds without tool calls
   */
  private async handleNoToolCalls(message: Message): Promise<boolean> {
    this.transitionPhase('reasoning');

    if (this.shouldContinue) {
      const decision = this.shouldContinue(message, this.stepNumber, this.getState());

      if (!decision.shouldContinue) {
        this.logger.debug('No tool calls handler decided to stop', {
          stepNumber: this.stepNumber,
        });
        this.transitionPhase('final');
        this.finalAnswer = message;
        return true;
      }

      if (decision.followUpMessage) {
        this.logger.debug('No tool calls handler provided follow-up message', {
          stepNumber: this.stepNumber,
        });
        this.conversationMessages.push({
          role: 'user',
          content: decision.followUpMessage,
        });
      }
      return false;
    } else {
      // Default behavior: stop on first non-tool response
      this.logger.debug('No tool calls detected, stopping loop', {
        stepNumber: this.stepNumber,
      });
      this.transitionPhase('final');
      this.finalAnswer = message;
      return true;
    }
  }

  /**
   * Validates tool call arguments against the tool's schema
   */
  private validateToolArguments(tool: ExecutableTool, args: unknown): Result<unknown, string> {
    try {
      const validated = tool.parameters.parse(args);
      return Ok(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return Err(
          `Validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        );
      }
      return Err(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Executes a batch of tool calls with validation and error handling
   */
  private async executeToolBatch(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const tool = this.tools.find((t) => t.name === toolCall.name);

      if (!tool) {
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
          error: `Unknown tool: ${toolCall.name}`,
        });
        continue;
      }

      // Validate arguments
      const validationResult = this.validateToolArguments(tool, toolCall.arguments);
      if (isErr(validationResult)) {
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          content: JSON.stringify({ error: validationResult.error }),
          validationError: validationResult.error,
        });
        continue;
      }

      // Execute tool
      try {
        const result = await tool.execute(validationResult.value);
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: true,
          content: result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Tool execution error', {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          error: errorMessage,
        });
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          content: JSON.stringify({ error: errorMessage }),
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Checks if budget limits have been exceeded
   */
  private checkBudgetLimits(): boolean {
    if (this.budgetLimits.maxTokens && this.budgetUsed.tokens.used >= this.budgetLimits.maxTokens) {
      return true;
    }
    if (
      this.budgetLimits.maxWallClockMs &&
      this.budgetUsed.wallClockMs.used >= this.budgetLimits.maxWallClockMs
    ) {
      return true;
    }
    if (
      this.budgetLimits.maxToolCalls &&
      this.budgetUsed.toolCalls.used >= this.budgetLimits.maxToolCalls
    ) {
      return true;
    }
    return false;
  }
}

/**
 * Runs an agentic loop where LLM can iteratively call tools
 * until it's ready to provide a final response
 *
 * @deprecated Use `new Agent({ llm, logger }).run({ tools, initialMessages, ... })` instead
 */
export async function runAgenticLoop(
  options: AgenticLoopOptions,
): Promise<Result<AgenticLoopResult, string>> {
  const agent = new AgenticLoop({ llm: options.llm, logger: options.logger });
  const runOptions: AgentRunOptions = {
    tools: options.tools,
    initialMessages: options.initialMessages,
  };
  if (options.maxIterations !== undefined) {
    runOptions.maxIterations = options.maxIterations;
  }
  if (options.shouldContinue !== undefined) {
    runOptions.shouldContinue = options.shouldContinue;
  }
  if (options.budgetLimits !== undefined) {
    runOptions.budgetLimits = options.budgetLimits;
  }
  if (options.hooks !== undefined) {
    runOptions.hooks = options.hooks;
  }
  if (options.goal !== undefined) {
    runOptions.goal = options.goal;
  }
  if (options.memory !== undefined) {
    runOptions.memory = options.memory;
  }
  return agent.run(runOptions);
}
