import type { LLM } from '../llm/llm';
import type { Logger } from '../logger';
import type { ObjectStore } from '../object-store/object-store';
import { isOk } from '../result';

type ObjectLocation = {
  objectKey: string;
  objectBucket: string;
};

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
  }): Promise<{ outputs: ObjectLocation[] }> {
    this.logger.info('Normalizing objects', {
      inputCount: params.inputs.length,
      targetCount: params.targets.length,
      outputObjectKeyPrefix: params.outputObjectKeyPrefix,
      outputObjectBucket: params.outputObjectBucket,
    });

    if (params.inputs.length === 0) {
      throw new Error('No inputs provided');
    }

    const messages = await this.llm.completions([
      {
        role: 'system',
        content: 'You are a helpful assistant that normalizes objects.',
      },
    ]);

    this.logger.info('LLM messages', { messages });

    // Read all inputs
    const inputData: Array<{ location: ObjectLocation; data: Buffer }> = [];
    for (const input of params.inputs) {
      const readResult = await this.objectStore.read({
        bucket: input.objectBucket,
        key: input.objectKey,
      });

      if (!isOk(readResult)) {
        throw new Error(`Failed to read input object ${input.objectKey}: ${readResult.error}`);
      }

      inputData.push({ location: input, data: readResult.value });
    }

    // Read all targets
    const targetData: Array<{ location: ObjectLocation; data: Buffer }> = [];
    for (const target of params.targets) {
      const readResult = await this.objectStore.read({
        bucket: target.objectBucket,
        key: target.objectKey,
      });

      if (!isOk(readResult)) {
        throw new Error(`Failed to read target object ${target.objectKey}: ${readResult.error}`);
      }

      targetData.push({ location: target, data: readResult.value });
    }

    // Determine number of outputs and process them
    const numberOfOutputs = this.determineNumberOfOutputs(inputData, targetData);
    const outputs: ObjectLocation[] = [];

    // Extract extension from first target or input for naming
    const extension = this.getExtension(
      params.targets[0]?.objectKey || params.inputs[0]?.objectKey || '',
    );

    for (let i = 0; i < numberOfOutputs; i++) {
      const outputKey = `${params.outputObjectKeyPrefix}${i}${extension}`;

      // Process inputs and targets to produce output data
      const outputData = this.processOutput(inputData, targetData, i);

      const writeResult = await this.objectStore.write({
        bucket: params.outputObjectBucket,
        key: outputKey,
        data: outputData,
      });

      if (!isOk(writeResult)) {
        throw new Error(`Failed to write output object ${i}: ${writeResult.error}`);
      }

      outputs.push({
        objectKey: outputKey,
        objectBucket: params.outputObjectBucket,
      });

      this.logger.info('Successfully created output', {
        outputKey,
        outputIndex: i,
      });
    }

    this.logger.info('Normalization completed', {
      inputCount: params.inputs.length,
      targetCount: params.targets.length,
      outputCount: outputs.length,
    });

    return { outputs };
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
  ): Buffer {
    // Default: clone the input data at the output index
    // This can be overridden to implement custom normalization logic
    // Note: targetData is available for custom implementations
    void targetData;

    if (inputData.length === 0) {
      throw new Error('No input data available to process');
    }

    const inputIndex = outputIndex % inputData.length;
    const input = inputData[inputIndex];
    if (!input) {
      throw new Error(`Input data at index ${inputIndex} is undefined`);
    }

    return input.data;
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
