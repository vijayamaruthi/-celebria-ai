/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CelebrationEvent } from '../types/index';
import { BUDGET_CATEGORIES } from '../types/index';
import {
  createRetryAwareGeminiFetch,
  createIdeasAIClient,
  processPlanRequest,
  retryGeminiRequest,
} from '../server/geminiBackend';
import { generateCelebrationPlan } from '../services/geminiService';
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
    name: 'Does not log raw provider errors when the Planning Assistant falls back',
    run: async () => {
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };

      try {
        const result = await processPlanRequest(makeEvent(25001), undefined, {
          generateContent: async () => {
            throw Object.assign(new Error('private provider detail and request content'), { status: 503 });
          },
          retryOptions: { maxAttempts: 1 },
        });

        assert(result.plan.isFallback, 'Expected the deterministic fallback after a provider error');
        const warningText = warnings.join('\n');
        assert(warningText.includes('HTTP 503'), 'Expected the sanitized log to retain the HTTP status');
        assert(!warningText.includes('private provider detail'), 'Raw provider details must not be logged');
        assert(!warningText.includes('request content'), 'Request content must not be logged');
      } finally {
        console.warn = originalWarn;
      }
    },
  });

  tests.push({
    name: 'Does not log raw API error bodies in the Planning Assistant client fallback',
    run: async () => {
      const originalFetch = globalThis.fetch;
      const originalWarn = console.warn;
      const warnings: string[] = [];
      globalThis.fetch = async () => new Response(JSON.stringify({
        error: 'Request failed',
        details: 'private provider detail and request content',
      }), { status: 500, headers: { 'content-type': 'application/json' } });
      console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };

      try {
        const result = await generateCelebrationPlan(makeEvent(25001));
        const warningText = warnings.join('\n');

        assert(result.isFallback === true, 'Expected the client to use its deterministic fallback');
        assert(warningText.includes('HTTP 500'), 'Expected the client log to retain the HTTP status');
        assert(!warningText.includes('private provider detail'), 'Raw API error details must not be logged');
        assert(!warningText.includes('request content'), 'Request content must not be logged');
      } finally {
        globalThis.fetch = originalFetch;
        console.warn = originalWarn;
      }
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
    name: 'Runs one installed-SDK fetch per outer retry and sends the Ideas deadline',
    run: async () => {
      let fetchAttempts = 0;
      let serverTimeoutHeader = '';
      const client = createIdeasAIClient('test-only-key', async (_input, init) => {
        fetchAttempts++;
        serverTimeoutHeader = new Headers(init?.headers).get('x-server-timeout') || '';
        return new Response(JSON.stringify({ error: { code: 503, message: 'temporary test failure' } }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        });
      });

      try {
        await retryGeminiRequest(
          () => client.models.generateContent({ model: 'gemini-3.8-flash', contents: 'test request' }),
          { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, wait: async () => undefined }
        );
        throw new Error('Expected repeated HTTP 503 responses to exhaust retries');
      } catch (error) {
        assert(!(error instanceof Error && error.message === 'Expected repeated HTTP 503 responses to exhaust retries'), 'Expected SDK failure after HTTP 503');
      }

      assert(fetchAttempts === 3, `Expected one SDK fetch for each of three outer attempts, got ${fetchAttempts}`);
      assert(serverTimeoutHeader === '20', `Expected the 20-second server deadline, got ${serverTimeoutHeader}`);
    },
  });

  tests.push({
    name: 'Aborts the installed-SDK fetch when its per-attempt timeout expires',
    run: async () => {
      let fetchAttempts = 0;
      let requestSignal: AbortSignal | undefined;
      const client = createIdeasAIClient('test-only-key', async (_input, init) => {
        fetchAttempts++;
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          if (!requestSignal) {
            reject(new Error('Expected the SDK to pass an abort signal to fetch'));
            return;
          }
          const rejectOnAbort = () => reject(Object.assign(new Error('mock fetch aborted'), { name: 'AbortError' }));
          if (requestSignal.aborted) rejectOnAbort();
          else requestSignal.addEventListener('abort', rejectOnAbort, { once: true });
        });
      }, 10);

      let rejected = false;
      let guardTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          client.models.generateContent({ model: 'gemini-3.8-flash', contents: 'timeout test' }),
          new Promise<never>((_resolve, reject) => {
            guardTimer = setTimeout(() => reject(new Error('SDK timeout did not abort the mocked fetch')), 250);
          }),
        ]);
      } catch {
        rejected = true;
      } finally {
        if (guardTimer) clearTimeout(guardTimer);
      }

      assert(rejected, 'Expected the timed-out SDK request to reject');
      assert(fetchAttempts === 1, `Expected one SDK attempt, got ${fetchAttempts}`);
      assert(requestSignal?.aborted === true, 'Expected the SDK timeout to abort its fetch signal');
    },
  });

  tests.push({
    name: 'Aborts the installed-SDK fetch when the API caller disconnects',
    run: async () => {
      const callerController = new AbortController();
      let fetchAttempts = 0;
      let fetchSignal: AbortSignal | undefined;
      let markFetchStarted!: () => void;
      const fetchStarted = new Promise<void>((resolve) => { markFetchStarted = resolve; });
      const client = createIdeasAIClient('test-only-key', async (_input, init) => {
        fetchAttempts++;
        fetchSignal = init?.signal ?? undefined;
        markFetchStarted();
        return new Promise<Response>((_resolve, reject) => {
          if (!fetchSignal) {
            reject(new Error('Expected the SDK to pass a combined abort signal to fetch'));
            return;
          }
          const rejectOnAbort = () => reject(Object.assign(new Error('mock fetch aborted'), { name: 'AbortError' }));
          if (fetchSignal.aborted) rejectOnAbort();
          else fetchSignal.addEventListener('abort', rejectOnAbort, { once: true });
        });
      }, 20_000, callerController.signal);
      const generation = client.models.generateContent({ model: 'gemini-3.8-flash', contents: 'disconnect test' })
        .then(() => false, () => true);

      let startGuard: ReturnType<typeof setTimeout> | undefined;
      const didStart = await Promise.race([
        fetchStarted.then(() => true),
        new Promise<boolean>((resolve) => { startGuard = setTimeout(() => resolve(false), 250); }),
      ]);
      if (startGuard) clearTimeout(startGuard);
      assert(didStart, 'Expected the SDK to invoke the mocked fetch');

      callerController.abort();
      let abortGuard: ReturnType<typeof setTimeout> | undefined;
      const didAbort = await Promise.race([
        generation,
        new Promise<boolean>((resolve) => { abortGuard = setTimeout(() => resolve(false), 250); }),
      ]);
      if (abortGuard) clearTimeout(abortGuard);

      assert(didAbort, 'Expected the SDK generation to reject when the caller disconnects');
      assert(fetchAttempts === 1, `Expected cancellation to avoid duplicate SDK calls, got ${fetchAttempts}`);
      assert(fetchSignal?.aborted === true, 'Expected the caller disconnect to abort the SDK fetch signal');
    },
  });

  tests.push({
    name: 'Cancels retry backoff promptly when the API caller disconnects',
    run: async () => {
      const callerController = new AbortController();
      let attempts = 0;
      const startedAt = Date.now();

      try {
        await retryGeminiRequest(async () => {
          attempts++;
          setTimeout(() => callerController.abort(), 10);
          throw Object.assign(new Error('temporary upstream failure'), { status: 503 });
        }, {
          signal: callerController.signal,
          initialDelayMs: 500,
          maxDelayMs: 500,
        });
      } catch {
        // Cancellation should interrupt the pending delay and reject before another attempt.
      }

      assert(attempts === 1, `Expected no retry after cancellation during backoff, got ${attempts}`);
      assert(Date.now() - startedAt < 300, 'Expected cancellation to interrupt the 500ms retry delay');
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
