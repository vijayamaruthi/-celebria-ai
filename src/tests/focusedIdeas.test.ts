/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CelebrationEvent } from '../types/index';
import { generateFocusedIdeas } from '../services/geminiService';
import { processIdeasRequest, retryGeminiRequest } from '../server/geminiBackend';
import { resolveFocusedIdeasEventContext } from '../utils/focusedIdeasFallback';
import { acquireInFlightGuard, releaseInFlightGuard } from '../utils/inFlightGuard';

const BANGALORE_WEDDING_QUESTION =
  'Suggest creative, budget-friendly entertainment ideas for a wedding in Bangalore with 200 guests and a total budget of ₹30,00,000. Include interactive games, guest activities, and practical recommendations.';

function makeEvent(): CelebrationEvent {
  return {
    id: 'focused-ideas-test',
    name: 'Mira’s Birthday',
    type: 'birthday',
    date: '2027-08-14',
    time: '17:30',
    guestCount: 42,
    totalBudget: 6000,
    currency: 'NZD',
    location: 'Auckland',
    venueType: 'outdoor',
    theme: 'Starlit garden',
    priorities: ['karaoke', 'guest comfort'],
    dietaryRequirements: ['vegan', 'gluten-free'],
    accessibilityNeeds: ['step-free access'],
    notes: 'Keep the activity area close to seating.',
    createdAt: '',
    updatedAt: '',
  };
}

function makeStaleWorkspaceEvent(): CelebrationEvent {
  return {
    ...makeEvent(),
    name: 'weeding',
    type: 'birthday',
    guestCount: 80,
    totalBudget: 15000,
    currency: 'USD',
    location: 'Seattle',
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function responseText(title: string, ideas = ['First idea', 'Second idea', 'Third idea']) {
  return { text: JSON.stringify({ title, ideas }) };
}

export function testFocusedIdeas() {
  const tests: { name: string; run: () => Promise<void> }[] = [];

  tests.push({
    name: 'Synchronously rejects duplicate submissions and allows a later request',
    run: async () => {
      const planSubmission = { inFlight: false };
      const ideasSubmission = { inFlight: false };

      for (const submission of [planSubmission, ideasSubmission]) {
        assert(acquireInFlightGuard(submission), 'Expected the first submission to acquire the guard');
        assert(!acquireInFlightGuard(submission), 'Expected a same-tick duplicate submission to be rejected');
        releaseInFlightGuard(submission);
        assert(acquireInFlightGuard(submission), 'Expected a new submission to be allowed after completion');
        releaseInFlightGuard(submission);
      }
    },
  });

  tests.push({
    name: 'Generates three Gemini ideas and sends the complete event context and question',
    run: async () => {
      const event = makeEvent();
      const question = 'Ideas for gluten-free outdoor games with step-free access?';
      let submittedPrompt = '';
      const result = await processIdeasRequest(event, question, {
        generateContent: async (prompt) => {
          submittedPrompt = prompt;
          return responseText('Birthday activity ideas');
        },
        retryOptions: { wait: async () => undefined },
      });

      assert(result.title === 'Birthday activity ideas', 'Expected the Gemini title');
      assert(result.ideas.length === 3, 'Expected exactly three generated ideas');
      assert(result.model === 'Gemini 3.8 Flash', 'Expected Gemini source transparency');
      for (const detail of [
        question,
        'Mira’s Birthday',
        'TYPE: birthday',
        'GUESTS: 42',
        '6000 NZD',
        'Auckland',
        'outdoor',
        'vegan, gluten-free',
        'step-free access',
        'Keep the activity area close to seating.',
      ]) {
        assert(submittedPrompt.includes(detail), `Expected request prompt to preserve ${detail}`);
      }
    },
  });

  tests.push({
    name: 'Uses explicit question details instead of stale workspace facts in the Gemini request',
    run: async () => {
      let submittedPrompt = '';
      const result = await processIdeasRequest(makeStaleWorkspaceEvent(), BANGALORE_WEDDING_QUESTION, {
        generateContent: async (prompt) => {
          submittedPrompt = prompt;
          return responseText('Wedding entertainment ideas');
        },
        retryOptions: { wait: async () => undefined },
      });

      assert(result.model === 'Gemini 3.8 Flash', 'Expected Gemini source labeling to remain intact');
      for (const detail of ['TYPE: wedding', 'GUESTS: 200', 'BUDGET: 3000000 INR', 'LOCATION: Bangalore']) {
        assert(submittedPrompt.includes(detail), `Expected Gemini prompt to use ${detail}`);
      }
      assert(!submittedPrompt.includes('GUESTS: 80'), 'Stale guest count must not reach Gemini');
      assert(!submittedPrompt.includes('15000 USD'), 'Stale USD budget must not reach Gemini');
      assert(!submittedPrompt.includes('Seattle'), 'Stale location must not reach Gemini');
      assert(!submittedPrompt.includes('weeding'), 'Misspelled stale workspace name must not reach Gemini');
      assert(!submittedPrompt.includes('2027-08-14'), 'Unrelated workspace date must not reach Gemini');
      assert(!submittedPrompt.includes('Starlit garden'), 'Unrelated workspace theme must not reach Gemini');
      assert(!submittedPrompt.includes('vegan, gluten-free'), 'Unrelated workspace dietary notes must not reach Gemini');
      assert(submittedPrompt.includes(BANGALORE_WEDDING_QUESTION), 'Expected the original question to be preserved');
    },
  });

  tests.push({
    name: 'Retains relevant workspace details but omits an unstated saved date and time',
    run: async () => {
      const event = makeEvent();
      const resolved = resolveFocusedIdeasEventContext(
        event,
        'Suggest budget-friendly entertainment and games for a birthday.'
      );
      assert(resolved.type === event.type, 'Expected the workspace event type to remain supplemental context');
      assert(resolved.location === event.location, 'Expected the workspace location to remain when unstated');
      assert(resolved.guestCount === event.guestCount, 'Expected the workspace guest count to remain when unstated');
      assert(resolved.totalBudget === event.totalBudget, 'Expected the workspace budget to remain when unstated');
      assert(resolved.currency === event.currency, 'Expected the workspace currency to remain when unstated');
      assert(resolved.date === '', 'A saved date must not be treated as stated in the current question');
      assert(resolved.time === undefined, 'A saved time must not be treated as stated in the current question');

      let submittedPrompt = '';
      await processIdeasRequest(event, 'Suggest budget-friendly entertainment and games for a birthday.', {
        generateContent: async (prompt) => {
          submittedPrompt = prompt;
          return responseText('Birthday entertainment');
        },
      });
      assert(submittedPrompt.includes('DATE: Not stated in the current question'), 'Expected the Gemini prompt to mark the date as unstated');
      assert(!submittedPrompt.includes(event.date), 'Stale workspace date must not reach Gemini');
      assert(!event.time || !submittedPrompt.includes(event.time), 'Stale workspace time must not reach Gemini');
    },
  });

  tests.push({
    name: 'Preserves a date and time explicitly stated in the current question',
    run: async () => {
      const event = makeEvent();
      const question = 'Suggest birthday entertainment for 2028-09-12 at 6:30 PM.';
      const resolved = resolveFocusedIdeasEventContext(event, question);
      let submittedPrompt = '';
      await processIdeasRequest(event, question, {
        generateContent: async (prompt) => {
          submittedPrompt = prompt;
          return responseText('Birthday entertainment');
        },
      });

      assert(resolved.date === '2028-09-12', `Expected the explicit date, got ${resolved.date}`);
      assert(resolved.time === '6:30 PM', `Expected the explicit time, got ${resolved.time}`);
      assert(submittedPrompt.includes('DATE: 2028-09-12 at 6:30 PM'), 'Expected the Gemini request to include the explicit date and time');
    },
  });

  tests.push({
    name: 'Retries a transient 503 with bounded jitter and then returns Gemini ideas',
    run: async () => {
      let attempts = 0;
      const delays: number[] = [];
      const result = await processIdeasRequest(makeEvent(), 'Suggest a short birthday toast', {
        generateContent: async () => {
          attempts++;
          if (attempts === 1) throw Object.assign(new Error('temporarily unavailable'), { status: 503 });
          return responseText('Toast ideas');
        },
        retryOptions: {
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 300,
          jitter: 0.2,
          random: () => 0,
          wait: async (delayMs) => { delays.push(delayMs); },
        },
      });

      assert(attempts === 2, `Expected one retry, got ${attempts} attempts`);
      assert(delays.join(',') === '80', `Expected 20% jittered 100ms backoff, got ${delays}`);
      assert(result.model === 'Gemini 3.8 Flash', 'Expected a recovered request to be labeled as Gemini');
    },
  });

  tests.push({
    name: 'Retries a transient HTTP 504 and accepts the successful Gemini response',
    run: async () => {
      let attempts = 0;
      const delays: number[] = [];
      const result = await processIdeasRequest(makeEvent(), 'Suggest birthday entertainment', {
        generateContent: async () => {
          attempts++;
          if (attempts === 1) throw Object.assign(new Error('deadline exceeded'), { status: 504 });
          return responseText('Recovered birthday entertainment');
        },
        retryOptions: {
          initialDelayMs: 25,
          maxDelayMs: 100,
          jitter: 0,
          wait: async (delayMs) => { delays.push(delayMs); },
        },
      });

      assert(attempts === 2, `Expected one retry after HTTP 504, got ${attempts} attempts`);
      assert(delays.join(',') === '25', `Expected one bounded backoff, got ${delays}`);
      assert(result.title === 'Recovered birthday entertainment', 'Expected the successful Gemini result');
      assert(result.model === 'Gemini 3.8 Flash', 'Expected Gemini source after the retry succeeds');
    },
  });

  tests.push({
    name: 'Falls back after repeated HTTP 504 without adding the workspace date or time',
    run: async () => {
      let attempts = 0;
      const question = 'Suggest budget-friendly entertainment and games for a birthday.';
      const result = await processIdeasRequest(makeEvent(), question, {
        generateContent: async () => {
          attempts++;
          throw Object.assign(new Error('deadline exceeded'), { status: 504 });
        },
        retryOptions: {
          initialDelayMs: 10,
          maxDelayMs: 100,
          jitter: 0,
          wait: async () => undefined,
        },
      });

      const joinedIdeas = result.ideas.join(' ');
      assert(attempts === 3, `Expected the three-attempt cap before fallback, got ${attempts}`);
      assert(result.model === 'Celebria Heuristic Engine (Contextual Fallback)', 'Expected contextual fallback source');
      assert(joinedIdeas.includes(question), 'Expected the fallback to preserve the current question');
      assert(joinedIdeas.includes('Auckland'), 'Expected relevant workspace location to remain supplemental context');
      assert(!joinedIdeas.includes('2027-08-14'), 'An unstated workspace date must not appear in the fallback');
      assert(!joinedIdeas.includes('17:30'), 'An unstated workspace time must not appear in the fallback');
    },
  });

  tests.push({
    name: 'Returns entertainment-focused ideas with current question context after repeated 503 errors',
    run: async () => {
      const event = makeStaleWorkspaceEvent();
      let attempts = 0;
      let warning = '';
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => { warning = args.map(String).join(' '); };
      try {
        const result = await processIdeasRequest(event, BANGALORE_WEDDING_QUESTION, {
          generateContent: async () => {
            attempts++;
            throw Object.assign(new Error(`503 response included private prompt ${BANGALORE_WEDDING_QUESTION}`), { status: 503 });
          },
          retryOptions: { initialDelayMs: 10, maxDelayMs: 100, wait: async () => undefined },
        });

        assert(attempts === 3, `Expected the three-attempt ceiling, got ${attempts}`);
        assert(result.model === 'Celebria Heuristic Engine (Contextual Fallback)', 'Expected fallback source labeling');
        assert(result.ideas.length === 6, 'Expected the complete entertainment fallback plan');
        const joinedIdeas = result.ideas.join(' ');
        for (const context of [
          BANGALORE_WEDDING_QUESTION,
          'wedding',
          'Bangalore',
          '200 guests',
          '₹30,00,000',
          'trivia',
          'wedding bingo',
          'photo spot',
          'message station',
          'Kannada',
          'run of show',
          'low-cost',
        ]) {
          assert(joinedIdeas.includes(context), `Expected fallback ideas to preserve ${context}`);
        }
        assert(!joinedIdeas.includes('80 guests'), 'Stale guest count must not appear in fallback');
        assert(!joinedIdeas.includes('$15,000'), 'Stale budget and currency must not appear in fallback');
        assert(!joinedIdeas.includes('Seattle'), 'Stale workspace location must not appear in fallback');
        assert(!joinedIdeas.includes('weeding'), 'Misspelled stale event name must not appear in fallback');
        assert(!joinedIdeas.includes('2027-08-14'), 'Unrelated workspace date must not appear in fallback');
        assert(!joinedIdeas.includes('Starlit garden'), 'Unrelated workspace theme must not appear in fallback');
        assert(!joinedIdeas.includes('vegan'), 'Unrelated workspace dietary notes must not appear in fallback');
        assert(warning.includes('HTTP 503'), 'Expected only the safe provider status in the warning');
        assert(warning.includes('attempts=3'), 'Expected safe attempt-count diagnostics');
        assert(warning.includes('attemptDurationsMs='), 'Expected safe per-attempt duration diagnostics');
        assert(warning.includes('totalMs='), 'Expected safe total-duration diagnostics');
        assert(!warning.includes(BANGALORE_WEDDING_QUESTION), 'Expected private request text to stay out of logs');
      } finally {
        console.warn = originalWarn;
      }
    },
  });

  tests.push({
    name: 'Honors a usable HTTP 429 Retry-After value before retrying',
    run: async () => {
      let attempts = 0;
      const delays: number[] = [];
      const result = await processIdeasRequest(makeEvent(), 'Suggest a low-key activity', {
        generateContent: async () => {
          attempts++;
          if (attempts === 1) {
            throw Object.assign(new Error('rate limited'), {
              status: 429,
              headers: { 'retry-after': '0.25' },
            });
          }
          return responseText('Low-key activity');
        },
        retryOptions: {
          initialDelayMs: 50,
          maxDelayMs: 1000,
          jitter: 0,
          wait: async (delayMs) => { delays.push(delayMs); },
        },
      });

      assert(attempts === 2, `Expected one 429 retry, got ${attempts}`);
      assert(delays.join(',') === '250', `Expected exact 250ms Retry-After, got ${delays}`);
      assert(result.model === 'Gemini 3.8 Flash', 'Expected Gemini source after the retry succeeds');
    },
  });

  tests.push({
    name: 'Does not retry permanent invalid-request or authentication errors',
    run: async () => {
      for (const status of [400, 401, 403]) {
        let attempts = 0;
        const result = await processIdeasRequest(makeEvent(), 'Suggest a birthday activity', {
          generateContent: async () => {
            attempts++;
            throw Object.assign(new Error(`permanent ${status}`), { status });
          },
          retryOptions: { wait: async () => undefined },
        });

        assert(attempts === 1, `Expected one attempt for HTTP ${status}, got ${attempts}`);
        assert(result.model === 'Celebria Heuristic Engine (Contextual Fallback)', `Expected fallback for HTTP ${status}`);
      }
    },
  });

  tests.push({
    name: 'Keeps the Planning Assistant retry classification unchanged by default',
    run: async () => {
      for (const error of [
        new TypeError('Failed to fetch'),
        Object.assign(new Error('request aborted'), { name: 'AbortError' }),
      ]) {
        let attempts = 0;
        try {
          await retryGeminiRequest(async () => {
            attempts++;
            throw error;
          }, { wait: async () => undefined });
        } catch {
          // Default callers keep their previous classification; only Ideas opts into these cases.
        }
        assert(attempts === 1, `Expected one default attempt for ${error.name}, got ${attempts}`);
      }
    },
  });

  tests.push({
    name: 'Retries transient network failures and request timeouts',
    run: async () => {
      let attempts = 0;
      const delays: number[] = [];
      const result = await processIdeasRequest(makeEvent(), 'Suggest birthday entertainment', {
        generateContent: async () => {
          attempts++;
          if (attempts === 1) throw new TypeError('Failed to fetch');
          if (attempts === 2) throw Object.assign(new Error('request timed out'), { name: 'AbortError' });
          return responseText('Birthday entertainment');
        },
        retryOptions: {
          initialDelayMs: 20,
          maxDelayMs: 100,
          jitter: 0,
          wait: async (delayMs) => { delays.push(delayMs); },
        },
      });

      assert(attempts === 3, `Expected retries for network and timeout errors, got ${attempts}`);
      assert(delays.join(',') === '20,40', `Expected exponential network backoff, got ${delays}`);
      assert(result.model === 'Gemini 3.8 Flash', 'Expected recovered Gemini response');
    },
  });

  tests.push({
    name: 'Stops retrying when the API caller cancels the request',
    run: async () => {
      const requestController = new AbortController();
      let attempts = 0;
      const result = await processIdeasRequest(makeEvent(), 'Suggest birthday entertainment', {
        signal: requestController.signal,
        generateContent: async () => {
          attempts++;
          requestController.abort();
          throw Object.assign(new Error('caller cancelled'), { name: 'AbortError' });
        },
        retryOptions: { wait: async () => undefined },
      });

      assert(attempts === 1, `Expected cancellation to stop retries after one attempt, got ${attempts}`);
      assert(result.model === 'Celebria Heuristic Engine (Contextual Fallback)', 'Expected the safe local fallback result');
    },
  });

  tests.push({
    name: 'Uses the contextual fallback when Gemini returns malformed data',
    run: async () => {
      const result = await processIdeasRequest(makeEvent(), 'Suggest vegan snacks', {
        generateContent: async () => ({ text: '{not valid json' }),
        retryOptions: { wait: async () => undefined },
      });
      assert(result.model === 'Celebria Heuristic Engine (Contextual Fallback)', 'Expected malformed output fallback');
      assert(result.ideas.length === 3, 'Expected three fallback ideas');
      assert(result.ideas.join(' ').includes('vegan snacks'), 'Expected the fallback to answer the actual question');
    },
  });

  tests.push({
    name: 'Preserves the server fallback source in the existing Ideas UI service contract',
    run: async () => {
      const originalFetch = globalThis.fetch;
      const source = 'Celebria Heuristic Engine (Contextual Fallback)';
      globalThis.fetch = async () => new Response(JSON.stringify({
        title: 'Practical ideas for Mira’s Birthday',
        ideas: ['Idea one', 'Idea two', 'Idea three', 'Idea four', 'Idea five', 'Idea six'],
        model: source,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });

      try {
        const result = await generateFocusedIdeas(makeEvent(), 'Suggest birthday decor');
        assert(result.source === source, 'Expected fallback origin to be visible to the existing Source label');
        assert(result.ideas.length === 6, 'Expected the complete server fallback to reach the UI');
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  });

  tests.push({
    name: 'Falls back safely for malformed frontend responses instead of assuming they are Gemini answers',
    run: async () => {
      const originalFetch = globalThis.fetch;
      const malformedBodies = [
        JSON.stringify({ title: 'Unlabeled ideas', ideas: ['One', 'Two', 'Three'] }),
        '{not valid json',
      ];

      try {
        for (const body of malformedBodies) {
          globalThis.fetch = async () => new Response(body, { status: 200 });
          const question = 'Suggest accessible birthday activities';
          const result = await generateFocusedIdeas(makeEvent(), question);
          assert(
            result.source === 'Celebria Heuristic Engine (Contextual Fallback)',
            'Expected malformed or unlabeled data to use the explicitly labeled fallback'
          );
          assert(result.ideas.join(' ').includes(question), 'Expected the local fallback to retain the question');
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  });

  tests.push({
    name: 'Returns question-specific local ideas if the frontend API call fails',
    run: async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };

      try {
        const question = 'Suggest gluten-free cocktail ideas for the garden';
        const result = await generateFocusedIdeas(makeEvent(), question);
        assert(result.source === 'Celebria Heuristic Engine (Contextual Fallback)', 'Expected local fallback source');
        assert(result.ideas.length === 3, 'Expected three local ideas');
        const joinedIdeas = result.ideas.join(' ');
        for (const context of [question, 'birthday', 'Auckland', 'NZ$6,000']) {
          assert(joinedIdeas.includes(context), `Expected local fallback to preserve ${context}`);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  });

  return tests;
}
