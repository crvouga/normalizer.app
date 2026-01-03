import type { EventEmitter } from '../event-emitter/event-emitter';
import { createAgenticLoop } from '../llm/agentic-loop';
import type { LLM } from '../llm/llm';
import type { Logger } from '../logger';
import { createPostgresClient } from '../postgres/postgres-client';
import { Err, isErr, Ok, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { createQueryDatabaseTool } from './create-query-database-tool';
import { createSystemPrompt } from './create-system-prompt';
import type { NormalizerEvent } from './normalizer-event';

/**
 * Create normalization views that transform input tables to match target schemas both structurally and semantically.
 * The views must correctly map input data values to target schema values, not just match column names.
 * Uses an agentic loop with the LLM and a SQL tool for iterative view creation.
 */
export async function createNormalizationViews({
  inputs,
  targets,
  outputs,
  llm,
  sqlDb,
  logger,
}: {
  inputs: Array<{ viewName: string }>;
  targets: Array<{ viewName: string }>;
  outputs: Array<{ viewName: string }>;
  llm: LLM;
  sqlDb: SqlDb;
  logger: Logger;
  eventEmitter: EventEmitter<NormalizerEvent>;
}): Promise<Result<null, string>> {
  logger.info('Starting normalization view creation', {
    inputCount: inputs.length,
    targetCount: targets.length,
    outputCount: outputs.length,
    inputTableNames: inputs.map((input) => input.viewName),
    targetTableNames: targets.map((target) => target.viewName),
    outputViewNames: outputs.map((output) => output.viewName),
  });
  const inputTableNames = inputs.map((input) => input.viewName);
  const targetTableNames = targets.map((target) => target.viewName);
  const outputViewNames = outputs.map((output) => output.viewName);
  const postgresClient = createPostgresClient({ db: sqlDb, logger });
  const queryDatabaseTool = createQueryDatabaseTool({ sqlDb, logger });
  const systemPrompt = createSystemPrompt({
    inputViewNames: inputTableNames,
    targetViewNames: targetTableNames,
    outputViewName: outputViewNames,
  });

  logger.debug('System prompt for normalization view creation', { prompt: systemPrompt });

  const agentLoop = createAgenticLoop({ llm, logger });

  const ran = await agentLoop.run({
    tools: [queryDatabaseTool],
    goal: {
      description:
        'Create normalization views that transform input tables to match target schemas both structurally AND semantically. The views must correctly map input data values to target schema values, not just match column names.',
    },
    shouldContinue: async (_message, stepNumber) => {
      // Check if all required output views exist
      for (const outputViewName of outputViewNames) {
        const checkResult = await postgresClient.tableExists(outputViewName);

        if (isErr(checkResult)) {
          logger.warn('Failed to check if output view exists', {
            viewName: outputViewName,
            error: checkResult.error,
          });
          // If we can't check, assume it doesn't exist and continue
          return {
            shouldContinue: true,
            followUpMessage: `The output view "${outputViewName}" does not exist yet. You must create it using CREATE OR REPLACE VIEW "${outputViewName}" AS ... before finishing. Use the query_database tool to create the view.`,
          };
        }

        const exists = checkResult.value;

        if (!exists) {
          logger.debug('Output view does not exist yet', {
            viewName: outputViewName,
            stepNumber,
          });
          return {
            shouldContinue: true,
            followUpMessage: `The output view "${outputViewName}" does not exist yet. You must create it using CREATE OR REPLACE VIEW "${outputViewName}" AS ... before finishing. Use the query_database tool to create the view.`,
          };
        }
      }

      // All views exist, allow the loop to stop
      logger.debug('All output views exist, allowing loop to complete', {
        outputViewNames,
        stepNumber,
      });
      return { shouldContinue: false };
    },
    initialMessages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content:
          'First, use the query_database tool with SELECT queries to inspect both the schemas AND actual data values in the input and target tables. Understand the semantic meaning of each field and how input data should be transformed to match the target schema. Then create the output views (or materialized views, tables, indexes, etc. as needed) that correctly transform the input data semantically, not just structurally. You MUST create all output views before finishing.',
      },
    ],
  });

  if (isErr(ran)) {
    logger.error('Failed to create normalization views', { error: ran.error });
    return Err(ran.error);
  }

  // Validate that all output views were created
  for (const outputViewName of outputViewNames) {
    const checkResult = await postgresClient.tableExists(outputViewName);

    if (isErr(checkResult)) {
      logger.error('Failed to validate output view exists', {
        viewName: outputViewName,
        error: checkResult.error,
      });
      return Err(`Failed to validate that output view "${outputViewName}" was created`);
    }

    const exists = checkResult.value;
    if (!exists) {
      logger.error('Output view was not created', {
        viewName: outputViewName,
        stepNumber: ran.value.stepNumber,
        phase: ran.value.phase,
      });
      return Err(`Output view "${outputViewName}" was not created by the agentic loop`);
    }
  }

  logger.info('Normalization views created successfully', {
    stepNumber: ran.value.stepNumber,
    phase: ran.value.phase,
    completedNormally: ran.value.completedNormally,
    budgetUsed: ran.value.budgetUsed,
    outputViewNames,
  });

  return Ok(null);
}
