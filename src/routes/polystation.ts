/**
 * Polystation Routes - Multi-Model AI Query Station
 *
 * Enables querying multiple Workers AI models in parallel
 * and comparing their responses side-by-side.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AVAILABLE_MODELS, queryMultipleModels } from '../ai';

const polystation = new Hono<AppEnv>();

/**
 * GET /api/polystation/models
 * Returns available Workers AI models.
 */
polystation.get('/models', (c) => {
  return c.json({
    models: AVAILABLE_MODELS.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      provider: m.provider,
      contextWindow: m.contextWindow,
    })),
    workersAiAvailable: !!c.env.AI,
  });
});

/**
 * POST /api/polystation/query
 * Query multiple AI models in parallel.
 *
 * Body: { prompt: string, models?: string[], maxTokens?: number, temperature?: number, systemPrompt?: string }
 */
polystation.post('/query', async (c) => {
  if (!c.env.AI) {
    return c.json(
      {
        error: 'Workers AI not configured',
        hint: 'Add [ai] binding to wrangler.jsonc and redeploy',
      },
      503,
    );
  }

  let body: {
    prompt?: string;
    models?: string[];
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { prompt, models, maxTokens, temperature, systemPrompt } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return c.json({ error: 'prompt is required and must be a non-empty string' }, 400);
  }

  if (prompt.length > 10000) {
    return c.json({ error: 'prompt must be 10000 characters or less' }, 400);
  }

  console.log(
    `[POLYSTATION] Querying ${models?.length ?? AVAILABLE_MODELS.length} models with prompt: "${prompt.slice(0, 100)}..."`,
  );

  const startTime = Date.now();

  const results = await queryMultipleModels(c.env.AI, prompt, models, {
    maxTokens,
    temperature,
    systemPrompt,
  });

  const totalDurationMs = Date.now() - startTime;

  return c.json({
    prompt: prompt.slice(0, 200),
    totalDurationMs,
    results,
  });
});

export { polystation };
