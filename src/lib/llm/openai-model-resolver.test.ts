import { afterEach, describe, expect, test } from 'bun:test';
import {
  buildModelChain,
  clearOpenAIModelCache,
  filterChatCapableModels,
  filterToolCallingCapableModels,
  isChatCapableModelId,
  isToolCallingCapableModelId,
  rankModelsForTier,
  resolveOpenAIModelChain,
} from './openai-model-resolver';

const FIXTURE_MODELS = [
  'gpt-5',
  'gpt-5-chat-latest',
  'gpt-5.1-chat-latest',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
  'o3',
  'o3-mini',
  'text-embedding-3-small',
  'whisper-1',
  'dall-e-3',
  'gpt-4-0613',
  'gpt-4-turbo-preview',
];

describe('isChatCapableModelId', () => {
  test('includes gpt and o-series chat models', () => {
    expect(isChatCapableModelId('gpt-5')).toBe(true);
    expect(isChatCapableModelId('gpt-4o-mini')).toBe(true);
    expect(isChatCapableModelId('o3')).toBe(true);
    expect(isChatCapableModelId('o3-mini')).toBe(true);
  });

  test('excludes non-chat model families', () => {
    expect(isChatCapableModelId('text-embedding-3-small')).toBe(false);
    expect(isChatCapableModelId('whisper-1')).toBe(false);
    expect(isChatCapableModelId('dall-e-3')).toBe(false);
    expect(isChatCapableModelId('gpt-4o-realtime-preview')).toBe(false);
  });
});

describe('isToolCallingCapableModelId', () => {
  test('excludes chat-latest variants', () => {
    expect(isToolCallingCapableModelId('gpt-5')).toBe(true);
    expect(isToolCallingCapableModelId('gpt-5-chat-latest')).toBe(false);
    expect(isToolCallingCapableModelId('gpt-5.1-chat-latest')).toBe(false);
  });
});

describe('filterToolCallingCapableModels', () => {
  test('removes chat-latest models from fixture list', () => {
    const filtered = filterToolCallingCapableModels(FIXTURE_MODELS);
    expect(filtered).toContain('gpt-5');
    expect(filtered).not.toContain('gpt-5-chat-latest');
    expect(filtered).not.toContain('gpt-5.1-chat-latest');
  });
});

describe('filterChatCapableModels', () => {
  test('filters fixture list to chat models only', () => {
    const filtered = filterChatCapableModels(FIXTURE_MODELS);
    expect(filtered).toContain('gpt-5');
    expect(filtered).toContain('o3');
    expect(filtered).not.toContain('text-embedding-3-small');
    expect(filtered).not.toContain('whisper-1');
    expect(filtered).not.toContain('dall-e-3');
  });
});

describe('rankModelsForTier', () => {
  test('strong tier prefers full models over nano/mini', () => {
    const ranked = rankModelsForTier(
      ['gpt-5-nano', 'gpt-5-mini', 'gpt-5', 'gpt-4.1', 'gpt-4o-mini'],
      'strong',
    );
    expect(ranked[0]).toBe('gpt-5');
    expect(ranked.indexOf('gpt-5-nano')).toBeGreaterThan(ranked.indexOf('gpt-5'));
    expect(ranked.indexOf('gpt-4o-mini')).toBeGreaterThan(ranked.indexOf('gpt-4.1'));
  });

  test('fast tier prefers smaller models', () => {
    const ranked = rankModelsForTier(['gpt-5-nano', 'gpt-5-mini', 'gpt-5'], 'fast');
    expect(ranked[0]).toBe('gpt-5-nano');
  });

  test('o-series ranks above older gpt generations for strong tier', () => {
    const ranked = rankModelsForTier(['gpt-4o', 'o3', 'gpt-5'], 'strong');
    expect(ranked[0]).toBe('gpt-5');
    expect(ranked.indexOf('o3')).toBeLessThan(ranked.indexOf('gpt-4o'));
  });
});

describe('buildModelChain', () => {
  test('puts explicit model first and appends ranked fallbacks', () => {
    const chain = buildModelChain({
      rankedModels: ['gpt-5', 'gpt-4.1', 'gpt-4o'],
      explicitModel: 'gpt-4o-mini',
      chainLength: 4,
    });
    expect(chain).toEqual(['gpt-4o-mini', 'gpt-5', 'gpt-4.1', 'gpt-4o']);
  });

  test('deduplicates explicit model if already in ranked list', () => {
    const chain = buildModelChain({
      rankedModels: ['gpt-5', 'gpt-4.1'],
      explicitModel: 'gpt-5',
      chainLength: 3,
    });
    expect(chain).toEqual(['gpt-5', 'gpt-4.1']);
  });
});

describe('resolveOpenAIModelChain', () => {
  const originalOpenAIModel = process.env.OPENAI_MODEL;

  afterEach(() => {
    clearOpenAIModelCache();
    if (originalOpenAIModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalOpenAIModel;
    }
  });

  test('uses OPENAI_MODEL env as primary with dynamic fallbacks', async () => {
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    const mockClient = {
      models: {
        list: async () => ({
          data: FIXTURE_MODELS.map((id) => ({ id, object: 'model' as const })),
        }),
      },
    };

    const chain = await resolveOpenAIModelChain({
      client: mockClient as never,
      logger: { debug: () => {}, info: () => {}, warn: () => {} } as never,
      tier: 'strong',
    });

    expect(chain[0]).toBe('gpt-4o-mini');
    expect(chain.length).toBeGreaterThan(1);
    expect(chain).toContain('gpt-5');
  });

  test('returns top strong models when no explicit override', async () => {
    delete process.env.OPENAI_MODEL;
    const mockClient = {
      models: {
        list: async () => ({
          data: FIXTURE_MODELS.map((id) => ({ id, object: 'model' as const })),
        }),
      },
    };

    const chain = await resolveOpenAIModelChain({
      client: mockClient as never,
      logger: { debug: () => {}, info: () => {}, warn: () => {} } as never,
      tier: 'strong',
    });

    expect(chain[0]).toBe('gpt-5');
    expect(chain).not.toContain('text-embedding-3-small');
    expect(chain).not.toContain('gpt-5-nano');
    expect(chain).not.toContain('gpt-5-chat-latest');
  });

  test('caches model list across calls', async () => {
    delete process.env.OPENAI_MODEL;
    let callCount = 0;
    const mockClient = {
      models: {
        list: async () => {
          callCount++;
          return {
            data: [{ id: 'gpt-5', object: 'model' as const }],
          };
        },
      },
    };

    const logger = { debug: () => {}, info: () => {}, warn: () => {} } as never;

    await resolveOpenAIModelChain({ client: mockClient as never, logger, tier: 'strong' });
    await resolveOpenAIModelChain({ client: mockClient as never, logger, tier: 'strong' });

    expect(callCount).toBe(1);
  });

  test('falls back to explicit model only when API fails', async () => {
    process.env.OPENAI_MODEL = 'gpt-4o';
    const mockClient = {
      models: {
        list: async () => {
          throw new Error('API unavailable');
        },
      },
    };

    const chain = await resolveOpenAIModelChain({
      client: mockClient as never,
      logger: { debug: () => {}, info: () => {}, warn: () => {} } as never,
      tier: 'strong',
    });

    expect(chain).toEqual(['gpt-4o']);
  });
});
