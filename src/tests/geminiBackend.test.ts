/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CelebrationEvent } from '../types/index';
import { BUDGET_CATEGORIES } from '../types/index';
import {
  createRetryAwareGeminiFetch,
  processPlanRequest,
  retryGeminiRequest,
} from '../server/geminiBackend';
import { generateDeterministicPlan } from '../utils/deterministicPlanner';

function makeEvent(totalBudget: number): CelebrationEvent {
  return {
    id: 'gemini-retry-test',
    name: 'Retry Test Celebration',
    type: 'wedding',
    date: '2027-06-15',
    guestCount: 80,
    totalBudget,
    currency: 'USD',
    location: 'Test Garden',
    venueType: 'outdoor',
    theme: 'Garden party',
    priorities: [],
    dietaryRequirements: [],
    accessibilityNeeds: [],
    notes: '',
    createdAt: '',
    updatedAt: '',
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validGeminiPlan(allocations: unknown[]) {
  return {
    eventOverview: 'A tailored celebration overview.',
    planningStrategy: 'A practical planning strategy.',
    recommendedCategoryAllocations: allocations,
    timelinePhases: [],
    vendorRecommendations: [],
    prioritizedActionItems: [],
    themeAndDecorConcepts: {
      themeTitle: 'Garden party',
      colorPalette: [],
      lightingIdeas: [],
      decorElements: [],
      lowerCostAlternative: 'Use seasonal greenery.',
    },
    foodAndCateringConsiderations: {
      style: 'Family-style dinner',
      dietaryAccommodations: [],
      costSavingTips: [],
      presentationIdeas: [],
    },
    guestManagement: {
      rsvpMilestones: [],
      seatingAdvice: [],
      accessibilityAccommodations: [],
    },
    riskAndContingency: [],
  };
}

function assertValidAllocations(event: CelebrationEvent, allocations: Array<{ category: string; recommendedAmount: number }>) {
  assert(allocations.length === BUDGET_CATEGORIES.length, 'Expected one allocation for every budget category');
  assert(new Set(allocations.map((item) => item.category)).size === allocations.length, 'Expected allocation categories to be unique');
  assert(allocations.every((item) => BUDGET_CATEGORIES.some((category) => category.id === item.category)), 'Expected only supported budget categories');
  assert(allocations.every((item) => Number.isFinite(item.recommendedAmount) && item.recommendedAmount >= 0), 'Expected finite, non-negative category amounts');
  const total = allocations.reduce((sum, item) => sum + item.recommendedAmount, 0);
  assert(total === event.totalBudget, `Expected allocations to total ${event.totalBudget}, got ${total}`);
}

export function testGeminiBackend() {
  const tests: { name: string; run: () => Promise<void> }[] = [];

  tests.push({
    name: 'Retries temporary 503 errors with bounded exponential backoff',
    run: async () => {
      let attempts = 0;
      const delays: number[] = [];
      const result = await retryGeminiRequest(
        async () => {
          attempts++;
          if (attempts < 3) throw Object.assign(new Error('Gemini temporarily unavailable'), { status: 503 });
          return 'plan';
        },
        {
          maxAttempts: 3,
          initialDelayMs: 25,
          maxDelayMs: 100,
          wait: async (delayMs) => { delays.push(delayMs); },
        }
      );

      assert(result === 'plan', 'Expected the successful retry result');
      assert(attempts === 3, `Expected 3 attempts, got ${attempts}`);
      assert(delays.join(',') === '25,50', `Expected exponential delays 25,50; got ${delays}`);
    },
  });

  tests.push({
    name: 'Retries 429 rate limits using Retry-After when it fits the retry cap',
    run: async () => {
      let attempts = 0;
      const delays: number[] = [];
      const result = await retryGeminiRequest(
        async () => {
          attempts++;
          if (attempts === 1) {
            throw Object.assign(new Error('Rate limited'), {
              status: 429,
              response: { headers: { get: (name: string) => name === 'retry-after' ? '0.2' : null } },
            });
          }
          return 'recovered';
        },
        {
          maxAttempts: 2,
          initialDelayMs: 50,
          maxDelayMs: 500,
          wait: async (delayMs) => { delays.push(delayMs); },
        }
      );

      assert(result === 'recovered', 'Expected the request to recover after rate limiting');
      assert(delays[0] === 200, `Expected Retry-After delay of 200ms, got ${delays[0]}`);
    },
  });

  tests.push({
    name: 'Returns deterministic fallback after Gemini stays unavailable',
    run: async () => {
      const event = makeEvent(25001);
      let attempts = 0;
      const delays: number[] = [];
      const result = await processPlanRequest(event, undefined, {
        generateContent: async () => {
          attempts++;
          throw Object.assign(new Error('503 UNAVAILABLE: high demand'), { status: 503 });
        },
        retryOptions: {
          maxAttempts: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          wait: async (delayMs) => { delays.push(delayMs); },
        },
      });

      const allocatedTotal = result.plan.recommendedCategoryAllocations.reduce(
        (sum, allocation) => sum + allocation.recommendedAmount,
        0
      );

      assert(attempts === 3, `Expected 3 Gemini attempts before fallback, got ${attempts}`);
      assert(delays.join(',') === '10,20', `Expected bounded delays 10,20; got ${delays}`);
      assert(result.plan.isFallback, 'Expected the deterministic fallback to be marked as fallback');
      assert(allocatedTotal === event.totalBudget, `Expected fallback allocations to total ${event.totalBudget}, got ${allocatedTotal}`);
      assertValidAllocations(event, result.plan.recommendedCategoryAllocations);
    },
  });

  tests.push({
    name: 'Keeps deterministic category amounts exact when Gemini succeeds',
    run: async () => {
      const event = makeEvent(10003);
      const result = await processPlanRequest(event, undefined, {
        generateContent: async () => ({
          text: JSON.stringify({
            ...validGeminiPlan([
              { category: 'venue', percentage: 100, recommendedAmount: 1, rationale: 'Model suggestion' },
            ]),
          }),
        }),
      });
      const deterministic = generateDeterministicPlan(event);
      const expectedAmounts = deterministic.recommendedCategoryAllocations.map((item) => item.recommendedAmount);
      const actualAmounts = result.plan.recommendedCategoryAllocations.map((item) => item.recommendedAmount);
      const allocatedTotal = actualAmounts.reduce((sum, amount) => sum + amount, 0);

      assert(!result.plan.isFallback, 'Expected the Gemini response to remain marked as successful');
      assert(actualAmounts.join(',') === expectedAmounts.join(','), 'Expected deterministic allocations to replace model-generated amounts');
      assert(allocatedTotal === event.totalBudget, `Expected successful plan allocations to total ${event.totalBudget}, got ${allocatedTotal}`);
      assertValidAllocations(event, result.plan.recommendedCategoryAllocations);
    },
  });

  tests.push({
    name: 'Does not retry a 429 beyond a server Retry-After window longer than the cap',
    run: async () => {
      let attempts = 0;
      try {
        await retryGeminiRequest(
          async () => {
            attempts++;
            throw Object.assign(new Error('Rate limited'), {
              status: 429,
              headers: { 'retry-after': '30' },
            });
          },
          { maxAttempts: 3, maxDelayMs: 1000, wait: async () => undefined }
        );
        throw new Error('Expected the rate-limited request to stop retrying');
      } catch (error) {
        assert(attempts === 1, `Expected one attempt when Retry-After exceeds cap, got ${attempts}`);
        assert(error instanceof Error && error.message === 'Rate limited', 'Expected original rate limit error');
      }
    },
  });

  tests.push({
    name: 'Retries transient fetch network errors',
    run: async () => {
      let attempts = 0;
      const delays: number[] = [];
      const result = await retryGeminiRequest(
        async () => {
          attempts++;
          if (attempts === 1) {
            throw new TypeError('fetch failed', {
              cause: Object.assign(new Error('connect ECONNRESET'), { code: 'ECONNRESET' }),
            });
          }
          return 'connected';
        },
        {
          maxAttempts: 2,
          initialDelayMs: 10,
          wait: async (delayMs) => { delays.push(delayMs); },
        }
      );

      assert(result === 'connected', 'Expected the request to recover after a network failure');
      assert(attempts === 2, `Expected 2 attempts, got ${attempts}`);
      assert(delays.join(',') === '10', `Expected one backoff delay of 10ms, got ${delays}`);
    },
  });

  tests.push({
    name: 'Does not retry permanent authentication or invalid-request errors',
    run: async () => {
      for (const status of [400, 401, 403]) {
        let attempts = 0;
        try {
          await retryGeminiRequest(async () => {
            attempts++;
            throw Object.assign(new Error(`Permanent error ${status}`), { status });
          }, { wait: async () => undefined });
          throw new Error('Expected the permanent error to be thrown');
        } catch (error) {
          assert(attempts === 1, `Expected one attempt for HTTP ${status}, got ${attempts}`);
          assert(error instanceof Error && error.message === `Permanent error ${status}`, 'Expected the original permanent error');
        }
      }
    },
  });

  tests.push({
    name: 'Keeps invalid retry settings within hard attempt and delay bounds',
    run: async () => {
      for (const invalidMaxAttempts of [Number.NaN, Number.POSITIVE_INFINITY]) {
        let attempts = 0;
        const delays: number[] = [];
        try {
          await retryGeminiRequest(async () => {
            attempts++;
            if (attempts > 3) throw new Error('Retry guard exceeded');
            throw Object.assign(new Error('Service unavailable'), { status: 503 });
          }, {
            maxAttempts: invalidMaxAttempts,
            initialDelayMs: Number.POSITIVE_INFINITY,
            maxDelayMs: Number.POSITIVE_INFINITY,
            wait: async (delayMs) => { delays.push(delayMs); },
          });
        } catch (error) {
          assert(error instanceof Error && error.message === 'Service unavailable', 'Expected the last retryable error');
        }

        assert(attempts === 3, `Expected the hard cap of 3 attempts, got ${attempts}`);
        assert(delays.join(',') === '500,1000', `Expected finite default delays, got ${delays}`);
      }
    },
  });

  tests.push({
    name: 'Preserves a real 429 response Retry-After header for retry handling',
    run: async () => {
      let fetchAttempts = 0;
      const delays: number[] = [];
      const retryAwareFetch = createRetryAwareGeminiFetch(async () => {
        fetchAttempts++;
        if (fetchAttempts === 1) {
          return new Response(null, { status: 429, headers: { 'retry-after': '0.25' } });
        }
        return new Response('ok', { status: 200 });
      });
      const response = await retryGeminiRequest(
        () => retryAwareFetch('https://generativelanguage.googleapis.com/test'),
        {
          maxAttempts: 2,
          initialDelayMs: 50,
          maxDelayMs: 500,
          wait: async (delayMs) => { delays.push(delayMs); },
        }
      );

      assert(response.status === 200, `Expected the second response to succeed, got ${response.status}`);
      assert(delays.join(',') === '250', `Expected the HTTP Retry-After delay of 250ms, got ${delays}`);
    },
  });

  tests.push({
    name: 'Falls back when Gemini returns invalid JSON or an invalid plan shape',
    run: async () => {
      const event = makeEvent(10003);
      const malformedResponses = ['not json', JSON.stringify({ eventOverview: 'Incomplete response' })];

      for (const text of malformedResponses) {
        const result = await processPlanRequest(event, undefined, {
          generateContent: async () => ({ text }),
        });
        assert(result.plan.isFallback, 'Expected malformed Gemini content to trigger fallback');
        assertValidAllocations(event, result.plan.recommendedCategoryAllocations);
      }
    },
  });

  return tests;
}
