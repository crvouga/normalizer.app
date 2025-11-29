import { createPgliteSqlDb } from '~/src/shared/sql-db';
import type { LLM } from '../llm/llm';
import type { Logger } from '../logger';
import type { ObjectLocation } from '../object-store/object-location';
import type { ObjectStore } from '../object-store/object-store';
import { Err, isErr, isOk, Ok, type Result } from '../result';
import {
  createTabularDataPostgresImporter,
  type BatchImportRequest,
  type BatchImportResult,
} from '../tabular-data-postgres-loader/tabular-data-postgres-importer';
import type { SqlDb } from '../sql-db/sql-db';

export class Normalizer {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly logger: Logger,
    private readonly llm: LLM,
  ) {}

  /**
   * Normalizes objects by processing inputs against targets and producing outputs.
   * Reads all inputs and targets, processes them according to normalization logic,
   * and writes outputs to the specified bucket with keys generated from the prefix.
   */
  async normalize(params: {
    targets: ObjectLocation[];
    inputs: ObjectLocation[];
    outputObjectKeyPrefix: string;
    outputObjectBucket: string;
  }): Promise<Result<{ outputs: ObjectLocation[] }, string>> {
    const sqlDb = await createPgliteSqlDb({ logger: this.logger });
    const importedBatch = await this.importTabularData(sqlDb, params.inputs, params.targets);

    if (isErr(importedBatch.result)) {
      return importedBatch.result;
    }

    this.logger.info('Normalizing objects', {
      inputCount: params.inputs.length,
      targetCount: params.targets.length,
      outputObjectKeyPrefix: params.outputObjectKeyPrefix,
      outputObjectBucket: params.outputObjectBucket,
    });

    if (params.inputs.length === 0) {
      this.logger.error('Normalization failed: No inputs provided');
      return Err('No inputs provided');
    }

    let messages;
    try {
      messages = await this.llm.completions([
        {
          role: 'system',
          content: 'You are a helpful assistant that normalizes objects.',
        },
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get LLM completions', { error: errorMessage });
      return Err(`Failed to get LLM completions: ${errorMessage}`);
    }

    this.logger.info('LLM messages', { messages });

    // Read all inputs using batch operation
    const inputsReadResult = await this.objectStore.readMany(params.inputs);
    if (!isOk(inputsReadResult)) {
      this.logger.error('Failed to read input objects', { error: inputsReadResult.error });
      return Err(`Failed to read input objects: ${inputsReadResult.error}`);
    }

    const inputData: Array<{ location: ObjectLocation; data: Buffer }> = [];
    for (const item of inputsReadResult.value) {
      if (item.data === null) {
        this.logger.error('Failed to read input object', { objectKey: item.key });
        return Err(`Failed to read input object ${item.key}: object not found`);
      }

      inputData.push({ location: { bucket: item.bucket, key: item.key }, data: item.data });
    }

    // Read all targets using batch operation
    const targetsReadResult = await this.objectStore.readMany(params.targets);
    if (!isOk(targetsReadResult)) {
      this.logger.error('Failed to read target objects', { error: targetsReadResult.error });
      return Err(`Failed to read target objects: ${targetsReadResult.error}`);
    }

    const targetData: Array<{ location: ObjectLocation; data: Buffer }> = [];
    for (const item of targetsReadResult.value) {
      if (item.data === null) {
        this.logger.error('Failed to read target object', { objectKey: item.key });
        return Err(`Failed to read target object ${item.key}: object not found`);
      }

      targetData.push({ location: { bucket: item.bucket, key: item.key }, data: item.data });
    }

    // Determine number of outputs and process them
    const numberOfOutputs = this.determineNumberOfOutputs(inputData, targetData);

    // Extract extension from first target or input for naming
    const extension = this.getExtension(params.targets[0]?.key || params.inputs[0]?.key || '');

    // Process all outputs and prepare write entries
    const writeEntries: Array<ObjectLocation & { data: Buffer }> = [];
    for (let i = 0; i < numberOfOutputs; i++) {
      const outputKey = `${params.outputObjectKeyPrefix}${i}${extension}`;

      // Process inputs and targets to produce output data
      const outputDataResult = this.processOutput(inputData, targetData, i);
      if (!isOk(outputDataResult)) {
        this.logger.error('Failed to process output', {
          outputIndex: i,
          error: outputDataResult.error,
        });
        return Err(`Failed to process output ${i}: ${outputDataResult.error}`);
      }

      writeEntries.push({
        bucket: params.outputObjectBucket,
        key: outputKey,
        data: outputDataResult.value,
      });
    }

    // Write all outputs using batch operation
    const writeResult = await this.objectStore.writeMany(writeEntries);
    if (!isOk(writeResult)) {
      this.logger.error('Failed to write output objects', { error: writeResult.error });
      return Err(`Failed to write output objects: ${writeResult.error}`);
    }

    const outputs = writeResult.value;

    this.logger.info('Successfully created all outputs', {
      outputCount: outputs.length,
    });

    this.logger.info('Normalization completed', {
      inputCount: params.inputs.length,
      targetCount: params.targets.length,
      outputCount: outputs.length,
    });

    return Ok({ outputs });
  }

  /**
   * Imports tabular data from inputs and targets into PostgreSQL tables.
   */
  private async importTabularData(
    sqlDb: SqlDb,
    inputs: ObjectLocation[],
    targets: ObjectLocation[],
  ): Promise<BatchImportResult> {
    const tabularDataPostgresImporter = createTabularDataPostgresImporter({
      sql: sqlDb,
      logger: this.logger,
      objectStore: this.objectStore,
    });

    const batchRequests: BatchImportRequest[] = [
      ...inputs.map((objLoc, idx) => ({
        bucket: objLoc.bucket,
        key: objLoc.key,
        options: {
          tableName: `input_${idx}`,
          dropIfExists: true,
        },
      })),
      ...targets.map((objLoc, idx) => ({
        bucket: objLoc.bucket,
        key: objLoc.key,
        options: {
          tableName: `target_${idx}`,
          dropIfExists: true,
        },
      })),
    ];

    return await tabularDataPostgresImporter.importBatch(batchRequests);
  }

  /**
   * Determines how many outputs should be produced from the given inputs and targets.
   * Default implementation: produces one output per input.
   * Override this method to implement custom normalization logic.
   */
  protected determineNumberOfOutputs(
    inputData: Array<{ location: ObjectLocation; data: Buffer }>,
    targetData: Array<{ location: ObjectLocation; data: Buffer }>,
  ): number {
    // Default: one output per input
    // This can be overridden to implement custom normalization logic
    // Note: targetData is available for custom implementations
    void targetData;
    return inputData.length > 0 ? inputData.length : 1;
  }

  /**
   * Processes input and target data to produce output data for a given output index.
   * Default implementation: clones the input data at the given index.
   * Override this method to implement custom normalization logic.
   */
  protected processOutput(
    inputData: Array<{ location: ObjectLocation; data: Buffer }>,
    targetData: Array<{ location: ObjectLocation; data: Buffer }>,
    outputIndex: number,
  ): Result<Buffer, string> {
    // Default: clone the input data at the output index
    // This can be overridden to implement custom normalization logic
    // Note: targetData is available for custom implementations
    void targetData;

    if (inputData.length === 0) {
      return Err('No input data available to process');
    }

    const inputIndex = outputIndex % inputData.length;
    const input = inputData[inputIndex];
    if (!input) {
      return Err(`Input data at index ${inputIndex} is undefined`);
    }

    return Ok(input.data);
  }

  /**
   * Extracts file extension from an object key.
   */
  private getExtension(key: string): string {
    const lastDot = key.lastIndexOf('.');
    if (lastDot === -1 || lastDot === key.length - 1) {
      return '';
    }
    return key.substring(lastDot);
  }
}

export function createNormalizer(params: {
  objectStore: ObjectStore;
  logger: Logger;
  llm: LLM;
}): Normalizer {
  return new Normalizer(params.objectStore, params.logger, params.llm);
}
