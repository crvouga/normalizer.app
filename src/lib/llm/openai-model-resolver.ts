import type OpenAI from 'openai';
import type { Logger } from '../logger';

export type ModelTier = 'strong' | 'fast';

const CACHE_TTL_MS = 60 * 60 * 1000;
const CHAIN_LENGTH = 5;

const CHAT_MODEL_PREFIXES = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-'];

const EXCLUDED_SUBSTRINGS = [
  'embedding',
  'whisper',
  'tts',
  'dall-e',
  'moderation',
  'realtime',
  'instruct',
  'transcribe',
  'search',
  'computer-use',
  'audio',
  'image',
  'sora',
];

/** Models that respond with plain-text JSON instead of the tools/function-calling API. */
const TOOL_CALLING_EXCLUDED_SUBSTRINGS = ['-chat-latest', '-chat-', 'chatgpt-'];

type ModelCache = {
  models: string[];
  expiresAt: number;
};

let modelCache: ModelCache | null = null;

/**
 * Returns true when a model ID looks like a chat/completions model.
 */
export function isChatCapableModelId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  if (EXCLUDED_SUBSTRINGS.some((s) => lower.includes(s))) {
    return false;
  }
  return CHAT_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Filter a list of model IDs to chat-capable models only.
 */
export function filterChatCapableModels(modelIds: string[]): string[] {
  return modelIds.filter(isChatCapableModelId);
}

/**
 * Models suitable for agentic tool-calling (excludes ChatGPT-branded variants).
 */
export function isToolCallingCapableModelId(modelId: string): boolean {
  if (!isChatCapableModelId(modelId)) {
    return false;
  }
  const lower = modelId.toLowerCase();
  return !TOOL_CALLING_EXCLUDED_SUBSTRINGS.some((s) => lower.includes(s));
}

export function filterToolCallingCapableModels(modelIds: string[]): string[] {
  return modelIds.filter(isToolCallingCapableModelId);
}

/**
 * Score a model ID for ranking. Higher is better for strong tier; inverted for fast tier.
 */
export function scoreModelForTier(modelId: string, tier: ModelTier): number {
  const lower = modelId.toLowerCase();
  let score = 0;

  const generationMatch = lower.match(/gpt-(\d+)/);
  if (generationMatch) {
    score += Number(generationMatch[1]) * 100;
  }

  const oSeriesMatch = lower.match(/^o(\d+)/);
  if (oSeriesMatch) {
    score += Number(oSeriesMatch[1]) * 120;
  }

  if (lower.includes('-nano')) {
    score += tier === 'fast' ? 80 : -200;
  } else if (lower.includes('-mini')) {
    score += tier === 'fast' ? 40 : -80;
  } else if (tier === 'strong') {
    score += 50;
  }

  if (/\d{4}-\d{2}-\d{2}/.test(lower)) {
    score -= 30;
  }
  if (lower.includes('-preview')) {
    score -= 20;
  }
  if (lower.includes('-latest')) {
    score += tier === 'fast' ? 10 : -40;
  }

  return score;
}

/**
 * Rank models for the given tier. Returns sorted IDs (best first).
 */
export function rankModelsForTier(modelIds: string[], tier: ModelTier): string[] {
  const unique = [...new Set(modelIds)];
  return unique
    .map((id) => ({ id, score: scoreModelForTier(id, tier) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((entry) => entry.id);
}

/**
 * Build an ordered model chain: explicit primary first, then ranked fallbacks.
 */
export function buildModelChain(params: {
  rankedModels: string[];
  explicitModel?: string;
  chainLength?: number;
}): string[] {
  const { rankedModels, explicitModel, chainLength = CHAIN_LENGTH } = params;
  const chain: string[] = [];

  if (explicitModel) {
    chain.push(explicitModel);
  }

  for (const model of rankedModels) {
    if (chain.length >= chainLength) break;
    if (!chain.includes(model)) {
      chain.push(model);
    }
  }

  return chain;
}

/**
 * Fetch chat-capable model IDs from the OpenAI API (cached).
 */
export async function fetchAvailableChatModels(client: OpenAI, logger: Logger): Promise<string[]> {
  const now = Date.now();
  if (modelCache && modelCache.expiresAt > now) {
    return modelCache.models;
  }

  const response = await client.models.list();
  const allIds = response.data.map((m) => m.id);
  const chatModels = filterChatCapableModels(allIds);

  logger.debug('Fetched OpenAI models', {
    total: allIds.length,
    chatCapable: chatModels.length,
  });

  modelCache = {
    models: chatModels,
    expiresAt: now + CACHE_TTL_MS,
  };

  return chatModels;
}

/**
 * Resolve an ordered model chain for OpenAI requests.
 */
export async function resolveOpenAIModelChain(params: {
  client: OpenAI;
  logger: Logger;
  tier?: ModelTier;
  explicitModel?: string;
  chainLength?: number;
}): Promise<string[]> {
  const tier = params.tier ?? 'strong';
  const envModel = process.env.OPENAI_MODEL;
  const explicitModel = params.explicitModel ?? envModel;

  try {
    const available = await fetchAvailableChatModels(params.client, params.logger);
    const eligible = filterToolCallingCapableModels(available);
    const ranked = rankModelsForTier(eligible.length > 0 ? eligible : available, tier);
    const chain = buildModelChain({
      rankedModels: ranked,
      ...(explicitModel !== undefined && { explicitModel }),
      ...(params.chainLength !== undefined && { chainLength: params.chainLength }),
    });

    if (chain.length === 0) {
      throw new Error('No chat-capable models returned from OpenAI API');
    }

    params.logger.info('Resolved OpenAI model chain', {
      tier,
      primary: chain[0],
      chain,
      ...(explicitModel !== undefined && { explicitOverride: explicitModel }),
    });

    return chain;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    params.logger.warn('Failed to resolve models from OpenAI API, using explicit model only', {
      error: message,
      explicitModel,
    });

    if (explicitModel) {
      return [explicitModel];
    }

    throw new Error(`Failed to resolve OpenAI model chain: ${message}`);
  }
}

/** Reset the in-memory model cache (for tests). */
export function clearOpenAIModelCache(): void {
  modelCache = null;
}
