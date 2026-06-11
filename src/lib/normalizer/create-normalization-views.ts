import type { EventEmitter } from '../event-emitter/event-emitter';
import { createAgenticLoop } from '../llm/agentic-loop';
import type { LLM } from '../llm/llm';
import type { Logger } from '../logger';
import { createPostgresClient, type ColumnMetadata } from '../postgres/postgres-client';
import { Err, isErr, isOk, Ok, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { createFollowUpPrompt } from './create-follow-up-prompt';
import { createGoalPrompt } from './create-goal-prompt';
import { createQueryDatabaseTool } from './create-query-database-tool';
import { createSystemPrompt } from './create-system-prompt';
import { createUserPrompt } from './create-user-prompt';
import { extractQueryFromToolArguments } from '~/src/workspace/normalization-log/extract-query-from-tool-arguments';
import { formatQueryResultLog } from '~/src/workspace/normalization-log/format-query-result-log';
import type { NormalizationProgressReporter } from '~/src/workspace/normalization-log/normalization-progress-reporter';
import { NormalizationProgressMessages } from '~/src/workspace/normalization-log/normalization-progress-messages';
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
  progressReporter,
}: {
  inputs: Array<{ viewName: string }>;
  targets: Array<{ viewName: string }>;
  outputs: Array<{ viewName: string }>;
  llm: LLM;
  sqlDb: SqlDb;
  logger: Logger;
  eventEmitter: EventEmitter<NormalizerEvent>;
  progressReporter?: NormalizationProgressReporter;
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

  const tableSchemas: Record<string, ColumnMetadata[]> = {};
  for (const tableName of [...inputTableNames, ...targetTableNames]) {
    const schemaResult = await postgresClient.getTableSchema(tableName);
    if (isOk(schemaResult)) {
      tableSchemas[tableName] = schemaResult.value;
    }
  }

  const systemPrompt = createSystemPrompt({
    inputViewNames: inputTableNames,
    targetViewNames: targetTableNames,
    outputViewName: outputViewNames,
    tableSchemas,
  });
  const goalPrompt = createGoalPrompt();
  const userPrompt = createUserPrompt();

  logger.debug('System prompt for normalization view creation', {
    promptLength: systemPrompt.length,
  });

  for (const outputViewName of outputViewNames) {
    const quotedName = `"${outputViewName.replace(/"/g, '""')}"`;
    const dropResult = await sqlDb.unsafe(`DROP VIEW IF EXISTS ${quotedName} CASCADE`);
    if (isErr(dropResult)) {
      logger.warn('Failed to pre-drop output view', { outputViewName, error: dropResult.error });
    }
  }

  progressReporter?.progress(NormalizationProgressMessages.analyzing);

  const agentLoop = createAgenticLoop({ llm, logger });
  let lastSqlError: string | undefined;

  const ran = await agentLoop.run({
    tools: [queryDatabaseTool],
    maxIterations: 20,
    goal: {
      description: goalPrompt,
    },
    hooks: {
      onReasoningDelta(delta) {
        progressReporter?.reasoning(delta);
      },
      onToolBatchStarted() {
        progressReporter?.progress(NormalizationProgressMessages.applying);
      },
      afterToolBatch(results, toolCalls) {
        for (let index = 0; index < results.length; index++) {
          const result = results[index]!;
          if (result.toolName !== 'query_database') continue;

          const query = extractQueryFromToolArguments(toolCalls[index]?.arguments);

          if (result.error) {
            lastSqlError = result.error;
            progressReporter?.queryResult({
              message: result.error,
              meta: {
                resultType: 'error',
                error: result.error,
                ...(query !== undefined ? { query } : {}),
              },
            });
            continue;
          }

          const formatted = formatQueryResultLog(result.content, query);
          if (formatted) {
            if (formatted.meta.resultType === 'error' && formatted.meta.error) {
              lastSqlError = formatted.meta.error;
            }
            progressReporter?.queryResult(formatted);
            continue;
          }

          try {
            const parsed = JSON.parse(result.content) as { error?: string };
            if (parsed.error) {
              lastSqlError = parsed.error;
            }
          } catch {
            // ignore non-JSON tool output
          }
        }
      },
    },
    initialMessages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    async shouldContinue(_message, stepNumber) {
      const checked = await postgresClient.viewsExist(outputViewNames);

      if (isErr(checked)) {
        const error = checked.error;
        const outputViewName =
          error.type === 'not-created' || error.type === 'errored'
            ? error.viewName
            : outputViewNames[0]!;
        logger.debug('Some output views do not exist yet or errored, continuing agentic loop', {
          error,
          stepNumber,
          lastSqlError,
        });
        return {
          shouldContinue: true,
          followUpMessage: createFollowUpPrompt({
            outputViewName,
            inputViewNames: inputTableNames,
            ...(lastSqlError !== undefined ? { lastSqlError } : {}),
          }),
        };
      }

      logger.debug('All output views exist, allowing loop to complete', {
        outputViewNames,
        stepNumber,
      });

      return { shouldContinue: false };
    },
  });

  if (isErr(ran)) {
    logger.error('Failed to create normalization views', { error: ran.error });
    return Err(ran.error);
  }

  const checked = await postgresClient.viewsExist(outputViewNames);

  if (isErr(checked)) {
    logger.error('Failed to validate output views exist', {
      error: checked.error,
    });
    switch (checked.error.type) {
      case 'errored':
        return Err(checked.error.error);
      case 'not-created':
        return Err(`The output view "${checked.error.viewName}" was not created.`);
      default:
        return Err('Unknown error');
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
