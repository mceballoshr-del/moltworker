/**
 * Workers AI Provider Module for NewClaw
 *
 * Provides direct AI inference via Cloudflare Workers AI binding.
 * No external API keys needed - uses Cloudflare's serverless GPU infrastructure.
 */

export interface WorkersAIModel {
  id: string;
  displayName: string;
  provider: string;
  contextWindow?: number;
}

/** Available models on Cloudflare Workers AI */
export const AVAILABLE_MODELS: WorkersAIModel[] = [
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    displayName: 'Llama 3.3 70B',
    provider: 'Meta',
    contextWindow: 8192,
  },
  {
    id: '@cf/mistralai/mistral-small-3.1-24b-instruct',
    displayName: 'Mistral Small 3.1 24B',
    provider: 'Mistral AI',
    contextWindow: 32768,
  },
  {
    id: '@cf/google/gemma-3-12b-it',
    displayName: 'Gemma 3 12B',
    provider: 'Google',
    contextWindow: 8192,
  },
  {
    id: '@cf/meta/llama-4-scout-17b-16e-instruct',
    displayName: 'Llama 4 Scout 17B',
    provider: 'Meta',
    contextWindow: 8192,
  },
];

export interface QueryResult {
  model: string;
  displayName: string;
  provider: string;
  text: string;
  durationMs: number;
  error?: string;
}

export interface QueryOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Query a single Workers AI model.
 */
export async function queryModel(
  ai: Ai,
  modelId: string,
  prompt: string,
  options: QueryOptions = {},
): Promise<QueryResult> {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  const displayName = model?.displayName ?? modelId;
  const provider = model?.provider ?? 'Unknown';

  const startTime = Date.now();

  try {
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const result = await ai.run(modelId as Parameters<Ai['run']>[0], {
      messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    });

    const durationMs = Date.now() - startTime;

    // Workers AI returns { response: string } for text generation
    const text =
      typeof result === 'object' && result !== null && 'response' in result
        ? (result as { response: string }).response
        : JSON.stringify(result);

    return { model: modelId, displayName, provider, text, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return {
      model: modelId,
      displayName,
      provider,
      text: '',
      durationMs,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Query multiple models in parallel (Polystation core).
 */
export async function queryMultipleModels(
  ai: Ai,
  prompt: string,
  modelIds?: string[],
  options: QueryOptions = {},
): Promise<QueryResult[]> {
  const models = modelIds?.length
    ? AVAILABLE_MODELS.filter((m) => modelIds.includes(m.id))
    : AVAILABLE_MODELS;

  const results = await Promise.all(models.map((m) => queryModel(ai, m.id, prompt, options)));

  return results;
}
