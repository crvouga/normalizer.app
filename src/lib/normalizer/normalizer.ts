import type { LLM } from '../llm/llm';

export class Normalizer {
  constructor(
    private readonly llm: LLM,
    // private readonly s3Client: S3Client,
    // private readonly logger: Logger,
  ) {}

  async normalize(_input: {
    inputKey: string;
    inputBucket: string;
    outputKey: string;
    outputBucket: string;
  }): Promise<{}> {
    this.llm.completions([
      {
        role: 'system',
        content: 'You are a helpful assistant that normalizes files.',
      },
      {
        role: 'user',
        content: `Normalize the following file:
        Input Key: ${_input.inputKey}
        Input Bucket: ${_input.inputBucket}
        Output Key: ${_input.outputKey}
        Output Bucket: ${_input.outputBucket}`,
      },
    ]);

    return {};
  }
}
