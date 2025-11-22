import type { Logger } from '../logger';
import type { ObjectStore } from '../object-store/object-store';
import { isOk } from '../result';

export class Normalizer {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly logger: Logger,
  ) {}

  /**
   * Clones an object from input key/bucket to output key/bucket
   */
  async normalize(input: {
    inputKey: string;
    inputBucket: string;
    outputKey: string;
    outputBucket: string;
  }): Promise<void> {
    this.logger.info('Cloning object', {
      inputKey: input.inputKey,
      inputBucket: input.inputBucket,
      outputKey: input.outputKey,
      outputBucket: input.outputBucket,
    });

    // Read from input
    const readResult = await this.objectStore.read({
      bucket: input.inputBucket,
      key: input.inputKey,
    });

    if (!isOk(readResult)) {
      throw new Error(`Failed to read input object: ${readResult.error}`);
    }

    // Write to output
    const writeResult = await this.objectStore.write({
      bucket: input.outputBucket,
      key: input.outputKey,
      data: readResult.value,
    });

    if (!isOk(writeResult)) {
      throw new Error(`Failed to write output object: ${writeResult.error}`);
    }

    this.logger.info('Successfully cloned object', {
      inputKey: input.inputKey,
      outputKey: input.outputKey,
    });
  }
}
