/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelebrationEvent, AIPlanningResult } from '../types';
import { generateDeterministicPlan } from '../utils/deterministicPlanner';

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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

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
      const errorData = await response.json().catch(() => ({}));
      console.warn('Backend Gemini API returned non-OK status:', response.status, errorData);
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
  } catch (err: unknown) {
    console.warn('Network or server error during AI plan generation. Using deterministic fallback.', err);
    const fallback = generateDeterministicPlan(event);
    return {
      ...fallback,
      isFallback: true,
      modelUsed: 'Celebria Heuristic Engine (Offline / Network Fallback)',
    };
  }
}

/**
 * Generate focused custom ideas (e.g., specific theme tweaks, food alternatives)
 */
export async function generateFocusedIdeas(
  event: CelebrationEvent,
  prompt: string
): Promise<{ title: string; ideas: string[]; source: string }> {
  try {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, prompt }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.ideas) {
        return {
          title: data.title || 'Personalized Ideas',
          ideas: data.ideas,
          source: data.model || 'Gemini 3.8 Flash',
        };
      }
    }
  } catch {
    // Ignore and proceed to fallback
  }

  // Heuristic ideas fallback
  return {
    title: `Tailored Ideas for ${event.name}`,
    ideas: [
      `Align food and beverage around interactive stations rather than standard lines for ${event.guestCount} guests.`,
      `Incorporate warm ambient string lighting and acoustic live interludes to elevate the atmosphere.`,
      `Design a zero-waste favors station where guests assemble custom botanical tea blends or take home potted succulents.`,
      `Establish dedicated photo-ready welcome signs with the signature ${event.theme || 'celebration'} motif.`,
      `Ensure dedicated wheelchair ramps and a designated sensory recharge area are clearly marked on printed programs.`,
    ],
    source: 'Celebria Heuristic Engine (Local Fallback)',
  };
}
