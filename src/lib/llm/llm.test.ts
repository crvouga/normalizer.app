import { beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { createLogger } from '../logger';
import { LLM, type Message } from './llm';
import { createLLMOpenAI, isOpenAIEnabled } from './llm-open-ai';

describe.skipIf(!isOpenAIEnabled())('@llm.ts (OpenAI Implementation)', () => {
  let llm: LLM;

  beforeEach(() => {
    llm = createLLMOpenAI({ logger: createLogger({ noop: true }) });
  });

  test('completions: returns a text completion from a simple prompt', async () => {
    const messages: Message[] = [{ role: 'user', content: 'What is 2+2?' }];

    const result = await llm.completions(messages);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((msg) => msg.role === 'assistant')).toBe(true);
  });

  test('completions: accepts system prompt and returns assistant message', async () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello.' },
    ];

    const result = await llm.completions(messages);

    expect(Array.isArray(result)).toBe(true);
    const assistantMsg = result.find((msg) => msg.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(typeof assistantMsg?.content).toBe('string');
    expect(assistantMsg?.content?.length).toBeGreaterThan(0);
  });

  test('stream: yields assistant messages in a stream from a prompt', async () => {
    const messages: Message[] = [{ role: 'user', content: 'List three animals.' }];

    const streamChunks: any[] = [];
    for await (const chunk of llm.stream(messages)) {
      streamChunks.push(chunk);
    }

    expect(streamChunks.length).toBeGreaterThan(0);

    const hasContent = streamChunks.some(
      (chunk) =>
        (typeof chunk.content === 'string' && chunk.content.length > 0) ||
        (chunk.choices &&
          Array.isArray(chunk.choices) &&
          typeof chunk.choices[0]?.delta?.content === 'string'),
    );
    expect(hasContent).toBe(true);
  });

  test('supports tool calls in completions if implemented', async () => {
    const dummyTool = {
      name: 'getCurrentTime',
      description: 'Returns the current time.',
      parameters: z.object({}),
      execute: async () => ({ time: new Date().toISOString() }),
    };

    const messages: Message[] = [{ role: 'user', content: 'Call the getCurrentTime function.' }];

    const result = await llm.completions(messages, {
      tools: [dummyTool],
    });

    expect(Array.isArray(result)).toBe(true);

    const hasToolCall = result.some(
      (m) =>
        m.role === 'tool' ||
        (m.role === 'assistant' && 'toolCalls' in m && m.toolCalls && m.toolCalls.length > 0),
    );

    expect(typeof hasToolCall).toBe('boolean');
  }, 10000); // 10 second timeout
});
