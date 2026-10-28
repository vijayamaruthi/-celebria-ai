/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelebrationEvent, AIPlanningResult } from '../types';
import { generateDeterministicPlan } from '../utils/deterministicPlanner';
import { generateFocusedIdeasFallback } from '../utils/focusedIdeasFallback';

const FOCUSED_IDEAS_REQUEST_TIMEOUT_MS = 75_000;

export interface PlanGenerationOptions {
  customFocus?: string;
  forceDeterministic?: boolean;
}

/**
 * Generate a comprehensive AI plan by calling server-side API endpoint (/api/plan)
 * If the server or Gemini API is unavailable, transparently falls back to the deterministic engine.
 */
export async function generateCelebrationPlan(
  event: CelebrationEvent,
  options?: PlanGenerationOptions
): Promise<AIPlanningResult> {
  if (options?.forceDeterministic) {
    return generateDeterministicPlan(event);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        customFocus: options?.customFocus,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Backend AI plan request failed; using deterministic fallback.', `HTTP ${response.status}`);
      const fallback = generateDeterministicPlan(event);
      return {
        ...fallback,
        isFallback: true,
        modelUsed: 'Celebria Heuristic Engine (Server returned ' + response.status + ')',
      };
    }

    const data = await response.json();
    if (data && data.plan) {
      return {
        ...data.plan,
        eventId: event.id,
        isFallback: false,
        modelUsed: data.model || 'Gemini 3.8 Flash',
        generatedAt: new Date().toISOString(),
      };
    }

    // Fallback if data structure is unexpected
    return generateDeterministicPlan(event);
  } catch {
    console.warn('Network or server error during AI plan generation. Using deterministic fallback.');
    const fallback = generateDeterministicPlan(event);
    return {
      ...fallback,
      isFallback: true,
      modelUsed: 'Celebria Heuristic Engine (Offline / Network Fallback)',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate focused custom ideas (e.g., specific theme tweaks, food alternatives)
 */
export async function generateFocusedIdeas(
  event: CelebrationEvent,
  prompt: string
): Promise<{ title: string; ideas: string[]; source: string }> {
  const fallback = () => generateFocusedIdeasFallback(event, prompt);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FOCUSED_IDEAS_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, prompt }),
      signal: controller.signal,
    });

    if (!response.ok) return fallback();

    const data: unknown = await response.json();
    if (
      data &&
      typeof data === 'object' &&
      'title' in data &&
      typeof data.title === 'string' &&
      data.title.trim().length > 0 &&
      'ideas' in data &&
      Array.isArray(data.ideas) &&
      data.ideas.length >= 3 &&
      data.ideas.length <= 6 &&
      data.ideas.every((idea: unknown) => typeof idea === 'string' && idea.trim().length > 0) &&
      'model' in data &&
      typeof data.model === 'string' &&
      data.model.trim().length > 0
    ) {
      return { title: data.title, ideas: data.ideas, source: data.model };
    }
  } catch {
    // Use the same contextual fallback if the API is unreachable or returns invalid JSON.
  } finally {
    clearTimeout(timeoutId);
  }

  return fallback();
}
