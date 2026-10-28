/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type { CelebrationEvent, AIPlanningResult } from '../types/index.ts';
import { generateDeterministicPlan } from '../utils/deterministicPlanner.ts';
import { generateFocusedIdeasFallback } from '../utils/focusedIdeasFallback.ts';

let aiInstance: GoogleGenAI | null = null;
let ideasAiInstance: GoogleGenAI | null = null;

type GeminiContentResponse = { text?: string | null };

export interface GeminiRetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Symmetric random jitter fraction applied to exponential delays (0 disables jitter). */
  jitter?: number;
  random?: () => number;
  /** Opt into broader fetch/abort error matching for the Ideas endpoint only. */
  retryAbortErrors?: boolean;
  retryFailedFetchErrors?: boolean;
  wait?: (delayMs: number) => Promise<void>;
}

export interface PlanRequestDependencies {
  generateContent?: () => Promise<GeminiContentResponse>;
  retryOptions?: GeminiRetryOptions;
}

export interface IdeasRequestDependencies {
  generateContent?: (prompt: string) => Promise<GeminiContentResponse>;
  retryOptions?: GeminiRetryOptions;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<
  GeminiRetryOptions,
  'wait' | 'jitter' | 'random' | 'retryAbortErrors' | 'retryFailedFetchErrors'
>> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
};
const MAX_RETRY_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 5000;
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const value = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
    response?: { status?: unknown };
  };
  const status = value.status ?? value.statusCode ?? value.response?.status;
  if (typeof status === 'number') return status;
  if (typeof status === 'string') {
    const parsedStatus = Number(status);
    if (Number.isFinite(parsedStatus)) return parsedStatus;
  }
  if (value.code === 'UNAVAILABLE') return 503;
  if (value.code === 'RESOURCE_EXHAUSTED') return 429;

  if (typeof value.message === 'string') {
    const match = value.message.match(/\b(408|429|500|502|503|504)\b/);
    if (match) return Number(match[1]);
  }

  return undefined;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const value = error as {
    headers?: { get?: (name: string) => string | null } | Record<string, unknown>;
    response?: { headers?: { get?: (name: string) => string | null } | Record<string, unknown> };
  };
  const headers = value.response?.headers ?? value.headers;
  let retryAfter: unknown;
  let retryAfterMs: unknown;

  if (headers && typeof (headers as { get?: unknown }).get === 'function') {
    const responseHeaders = headers as { get: (name: string) => string | null };
    retryAfterMs = responseHeaders.get('retry-after-ms');
    retryAfter = responseHeaders.get('retry-after');
  } else if (headers && typeof headers === 'object') {
    const record = headers as Record<string, unknown>;
    retryAfterMs = record['retry-after-ms'] ?? record['Retry-After-Ms'];
    retryAfter = record['retry-after'] ?? record['Retry-After'];
  }

  const parsedMs = retryAfterMs === undefined || retryAfterMs === null || retryAfterMs === ''
    ? Number.NaN
    : Number(retryAfterMs);
  if (Number.isFinite(parsedMs) && parsedMs >= 0) return parsedMs;
  if (typeof retryAfter !== 'string' && typeof retryAfter !== 'number') return undefined;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = new Date(String(retryAfter)).getTime();
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function isTransientNetworkError(
  error: unknown,
  retryAbortErrors = false,
  retryFailedFetchErrors = false
): boolean {
  let current = error;

  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const value = current as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };
    if (typeof value.code === 'string' && TRANSIENT_NETWORK_CODES.has(value.code)) return true;
    if (value.name === 'TimeoutError' || (retryAbortErrors && value.name === 'AbortError')) return true;
    if (
      value.name === 'TypeError' &&
      typeof value.message === 'string' &&
      (
        /^(fetch failed|network error|network request failed)$/i.test(value.message.trim()) ||
        (retryFailedFetchErrors && /^failed to fetch$/i.test(value.message.trim()))
      )
    ) {
      return true;
    }
    current = value.cause;
  }

  return false;
}

/**
 * The GenAI SDK's ApiError retains the status but drops response headers. Preserve
 * headers for 429 errors so the bounded retry policy can honor Retry-After.
 */
export function createRetryAwareGeminiFetch(fetcher: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const response = await fetcher(input, init);
    if (response.status !== 429) return response;

    const error = Object.assign(new Error('Gemini API rate limited (HTTP 429)'), {
      status: response.status,
      headers: response.headers,
    });
    void response.body?.cancel().catch(() => undefined);
    throw error;
  };
}

export async function retryGeminiRequest<T>(
  request: () => Promise<T>,
  options: GeminiRetryOptions = {}
): Promise<T> {
  const requestedAttempts = options.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts;
  const maxAttempts = Number.isFinite(requestedAttempts)
    ? Math.min(MAX_RETRY_ATTEMPTS, Math.max(1, Math.floor(requestedAttempts)))
    : DEFAULT_RETRY_OPTIONS.maxAttempts;
  const requestedMaxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const maxDelayMs = Number.isFinite(requestedMaxDelayMs)
    ? Math.min(MAX_RETRY_DELAY_MS, Math.max(0, requestedMaxDelayMs))
    : DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const requestedInitialDelayMs = options.initialDelayMs ?? DEFAULT_RETRY_OPTIONS.initialDelayMs;
  const initialDelayMs = Number.isFinite(requestedInitialDelayMs)
    ? Math.min(maxDelayMs, Math.max(0, requestedInitialDelayMs))
    : Math.min(maxDelayMs, DEFAULT_RETRY_OPTIONS.initialDelayMs);
  const requestedJitter = options.jitter ?? 0;
  const jitter = Number.isFinite(requestedJitter)
    ? Math.min(1, Math.max(0, requestedJitter))
    : 0;
  const random = options.random ?? Math.random;
  const wait = options.wait ?? waitForRetry;

  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const status = getErrorStatus(error);
      // A known HTTP status takes precedence so authentication and request errors
      // never get retried just because an attached cause happens to look transient.
      const isTemporary = status !== undefined
        ? [408, 429, 500, 502, 503, 504].includes(status)
        : isTransientNetworkError(
            error,
            options.retryAbortErrors === true,
            options.retryFailedFetchErrors === true
          );
      if (!isTemporary || attempt >= maxAttempts) throw error;

      const retryAfterMs = status === 429 ? getRetryAfterMs(error) : undefined;
      // Respect a longer server rate-limit window by falling back instead of retrying too early.
      if (retryAfterMs !== undefined && retryAfterMs > maxDelayMs) throw error;

      const exponentialDelayMs = Math.min(maxDelayMs, initialDelayMs * 2 ** (attempt - 1));
      const randomValue = random();
      const safeRandomValue = Number.isFinite(randomValue)
        ? Math.min(1, Math.max(0, randomValue))
        : 0.5;
      const jitteredDelayMs = Math.min(
        maxDelayMs,
        Math.max(0, exponentialDelayMs * (1 + ((safeRandomValue * 2) - 1) * jitter))
      );
      await wait(Math.max(jitteredDelayMs, retryAfterMs ?? 0));
    }
  }
}

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
        fetch: createRetryAwareGeminiFetch(),
        // The server retry wrapper below owns the bounded policy for plan generation.
        retryOptions: { attempts: 1 },
      },
    });
  }
  return aiInstance;
}

function getIdeasAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') return null;
  if (!ideasAiInstance) {
    ideasAiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
        fetch: createRetryAwareGeminiFetch(),
        // Give each outer retry a finite lifetime; retryGeminiRequest owns the total attempt budget.
        timeout: 15000,
        retryOptions: { attempts: 1 },
      },
    });
  }
  return ideasAiInstance;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStringFields(value: unknown, ...keys: string[]): value is Record<string, unknown> {
  return isRecord(value) && keys.every((key) => typeof value[key] === 'string');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecordArray(
  value: unknown,
  validate: (item: Record<string, unknown>) => boolean
): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && validate(item));
}

function isValidGeminiPlan(value: unknown): value is Record<string, unknown> {
  if (!hasStringFields(value, 'eventOverview', 'planningStrategy')) return false;

  return (
    isRecordArray(value.recommendedCategoryAllocations, (allocation) =>
      hasStringFields(allocation, 'category', 'rationale') &&
      typeof allocation.percentage === 'number' &&
      Number.isFinite(allocation.percentage) &&
      allocation.percentage >= 0 &&
      allocation.percentage <= 100 &&
      Number.isFinite(allocation.recommendedAmount) &&
      typeof allocation.recommendedAmount === 'number' &&
      allocation.recommendedAmount >= 0
    ) &&
    isRecordArray(value.timelinePhases, (phase) =>
      hasStringFields(phase, 'phase', 'phaseTitle') &&
      isRecordArray(phase.recommendedMilestones, (milestone) =>
        hasStringFields(milestone, 'title', 'description', 'priority', 'category') &&
        typeof milestone.daysBeforeEvent === 'number' &&
        Number.isFinite(milestone.daysBeforeEvent)
      )
    ) &&
    isRecordArray(value.vendorRecommendations, (vendor) =>
      hasStringFields(vendor, 'category', 'suggestedSearchCriteria', 'typicalCostPercentage', 'negotiationScript') &&
      isStringArray(vendor.keyQuestionsToAsk)
    ) &&
    isRecordArray(value.prioritizedActionItems, (action) =>
      hasStringFields(action, 'action', 'urgency', 'impact')
    ) &&
    isRecord(value.themeAndDecorConcepts) &&
    hasStringFields(value.themeAndDecorConcepts, 'themeTitle', 'lowerCostAlternative') &&
    isRecordArray(value.themeAndDecorConcepts.colorPalette, (color) => hasStringFields(color, 'name', 'hex')) &&
    isStringArray(value.themeAndDecorConcepts.lightingIdeas) &&
    isStringArray(value.themeAndDecorConcepts.decorElements) &&
    isRecord(value.foodAndCateringConsiderations) &&
    hasStringFields(value.foodAndCateringConsiderations, 'style') &&
    isStringArray(value.foodAndCateringConsiderations.dietaryAccommodations) &&
    isStringArray(value.foodAndCateringConsiderations.costSavingTips) &&
    isStringArray(value.foodAndCateringConsiderations.presentationIdeas) &&
    isRecord(value.guestManagement) &&
    isStringArray(value.guestManagement.rsvpMilestones) &&
    isStringArray(value.guestManagement.seatingAdvice) &&
    isStringArray(value.guestManagement.accessibilityAccommodations) &&
    isRecordArray(value.riskAndContingency, (risk) =>
      hasStringFields(risk, 'risk', 'severity', 'mitigation', 'fallbackOption')
    )
  );
}

export async function processPlanRequest(
  event: CelebrationEvent,
  customFocus?: string,
  dependencies: PlanRequestDependencies = {}
): Promise<{ plan: AIPlanningResult; model: string }> {
  const ai = getAIClient();
  const deterministicPlan = generateDeterministicPlan(event);

  if (!ai && !dependencies.generateContent) {
    return {
      plan: {
        ...deterministicPlan,
        isFallback: true,
        modelUsed: 'Celebria Heuristic Engine (GEMINI_API_KEY not configured)',
      },
      model: 'Celebria Heuristic Engine',
    };
  }

  const prompt = `
You are Celebria AI, an expert celebration and event planning architect.
Create a comprehensive, production-quality, context-sensitive planning blueprint for this celebration:

EVENT SPECIFICATIONS:
- Event Name: "${event.name}"
- Event Type: "${event.type}" (e.g. wedding, birthday, community, gala)
- Target Date: "${event.date}"
- Guest Count: ${event.guestCount}
- Total Budget: ${event.totalBudget} ${event.currency}
- Canonical Category Allocations: ${JSON.stringify(
    deterministicPlan.recommendedCategoryAllocations.map(({ category, percentage, recommendedAmount }) => ({
      category,
      percentage,
      recommendedAmount,
    }))
  )}
- Location & Venue Type: ${event.location} (${event.venueType})
- Aesthetic Theme: "${event.theme || 'Modern refined celebration'}"
- Priorities: ${event.priorities?.join(', ') || 'Overall guest experience, hospitality'}
- Dietary Requirements: ${event.dietaryRequirements?.join(', ') || 'Standard allergies and preferences'}
- Accessibility Accommodations: ${event.accessibilityNeeds?.join(', ') || 'Standard accessibility'}
- Special Notes: "${event.notes || 'None'}"
${customFocus ? `- Specific User Focus Area: "${customFocus}"` : ''}

Generate an exact JSON object conforming to this schema (do not wrap in markdown or backticks):
{
  "eventOverview": "string: 2-3 sentences overview tailored to this guest count and scale",
  "planningStrategy": "string: strategic guidance on locking vendors and risk management",
  "recommendedCategoryAllocations": [
    {
      "category": "venue" | "catering" | "decoration" | "photography" | "entertainment" | "transportation" | "invitations" | "accommodation" | "miscellaneous" | "contingency",
      "percentage": number (integer percent 0-100),
      "recommendedAmount": number (in currency),
      "rationale": "string: why this amount is needed for this guest count"
    }
  ],
  "timelinePhases": [
    {
      "phase": "phase_6m_plus" | "phase_2_3m" | "phase_1m" | "phase_2w" | "phase_week_of" | "phase_day_of",
      "phaseTitle": "string",
      "recommendedMilestones": [
        {
          "title": "string: clear milestone name",
          "description": "string: actionable details",
          "priority": "low" | "medium" | "high" | "urgent",
          "daysBeforeEvent": number,
          "category": "string"
        }
      ]
    }
  ],
  "vendorRecommendations": [
    {
      "category": "string",
      "suggestedSearchCriteria": "string",
      "keyQuestionsToAsk": ["string", "string", "string"],
      "typicalCostPercentage": "string",
      "negotiationScript": "string"
    }
  ],
  "prioritizedActionItems": [
    {
      "action": "string",
      "urgency": "high" | "medium" | "low",
      "impact": "string"
    }
  ],
  "themeAndDecorConcepts": {
    "themeTitle": "string",
    "colorPalette": [
      { "name": "string", "hex": "#HEX" }
    ],
    "lightingIdeas": ["string"],
    "decorElements": ["string"],
    "lowerCostAlternative": "string"
  },
  "foodAndCateringConsiderations": {
    "style": "string",
    "dietaryAccommodations": ["string"],
    "costSavingTips": ["string"],
    "presentationIdeas": ["string"]
  },
  "guestManagement": {
    "rsvpMilestones": ["string"],
    "seatingAdvice": ["string"],
    "accessibilityAccommodations": ["string"]
  },
  "riskAndContingency": [
    {
      "risk": "string",
      "severity": "low" | "medium" | "high",
      "mitigation": "string",
      "fallbackOption": "string"
    }
  ]
}

Use the supplied category allocations and amounts exactly; do not change their percentages or recommendedAmount values. Ensure realistic deadlines.
`;

  try {
    const response = await retryGeminiRequest(
      dependencies.generateContent ?? (() => ai!.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      })),
      dependencies.retryOptions
    );

    const rawText = response.text || '';
    const cleanJson = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (!isValidGeminiPlan(parsed)) {
      throw new Error('Gemini returned an invalid planning response.');
    }

    return {
      plan: {
        ...(parsed as unknown as AIPlanningResult),
        // The deterministic planner is the source of truth for amounts, so even a
        // successful Gemini response always allocates exactly the requested budget.
        recommendedCategoryAllocations: deterministicPlan.recommendedCategoryAllocations,
        eventId: event.id,
        isFallback: false,
        modelUsed: 'Gemini 3.8 Flash',
        generatedAt: new Date().toISOString(),
      },
      model: 'Gemini 3.8 Flash',
    };
  } catch (err) {
    console.warn('Gemini 3.8 Flash API call failed. Using deterministic engine fallback.', err);
    return {
      plan: {
        ...deterministicPlan,
        isFallback: true,
        modelUsed: 'Celebria Heuristic Engine (Gemini Service Fallback)',
      },
      model: 'Celebria Heuristic Engine',
    };
  }
}
export async function processIdeasRequest(
  event: CelebrationEvent,
  userPrompt: string,
  dependencies: IdeasRequestDependencies = {}
): Promise<{ title: string; ideas: string[]; model: string }> {
  const ai = dependencies.generateContent ? null : getIdeasAIClient();
  const useFallback = () => {
    const fallback = generateFocusedIdeasFallback(event, userPrompt);
    return { title: fallback.title, ideas: fallback.ideas, model: fallback.source };
  };

  if (!ai && !dependencies.generateContent) return useFallback();

  try {
    const prompt = `
You are Celebria AI, a creative celebration planner.
Answer the user's actual request and never substitute a different event.

EVENT: ${event.name}
TYPE: ${event.type}
DATE: ${event.date}${event.time ? ` at ${event.time}` : ''}
GUESTS: ${event.guestCount}
BUDGET: ${event.totalBudget} ${event.currency}
LOCATION: ${event.location}
VENUE TYPE: ${event.venueType}
THEME: ${event.theme || 'Not specified'}
PRIORITIES: ${event.priorities?.join(', ') || 'Not specified'}
DIETARY REQUIREMENTS: ${event.dietaryRequirements?.join(', ') || 'Not specified'}
ACCESSIBILITY NEEDS: ${event.accessibilityNeeds?.join(', ') || 'Not specified'}
SPECIAL NOTES: ${event.notes || 'None'}

USER REQUEST:
${userPrompt}

Return only valid JSON:
{
  "title": "A specific title for the request",
  "ideas": ["Idea 1", "Idea 2", "Idea 3"]
}

Give exactly 3 practical, specific ideas. Respect the event type and budget.
Do not provide wedding suggestions unless the user asks about a wedding.
`;

    const response = await retryGeminiRequest(
      dependencies.generateContent
        ? () => dependencies.generateContent!(prompt)
        : () => ai!.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          }),
      {
        jitter: 0.2,
        retryAbortErrors: true,
        retryFailedFetchErrors: true,
        ...dependencies.retryOptions,
      }
    );

    const rawText = (response.text || '')
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(rawText);

    if (typeof parsed.title !== 'string' || !Array.isArray(parsed.ideas)) {
      throw new Error('Gemini returned an invalid ideas response.');
    }

    const ideas = parsed.ideas
      .filter((idea: unknown): idea is string => typeof idea === 'string' && idea.trim().length > 0)
      .slice(0, 3);

    if (parsed.title.trim().length === 0 || ideas.length !== 3) {
      throw new Error('Gemini returned an incomplete ideas response.');
    }

    return {
      title: parsed.title,
      ideas,
      model: 'Gemini 3.8 Flash',
    };
  } catch (err) {
    // Keep prompts, event notes, API key material, and raw provider errors out of logs.
    const status = getErrorStatus(err);
    console.warn(
      'Gemini idea generation failed; using contextual fallback.',
      status ? `HTTP ${status}` : 'request/network error'
    );
    return useFallback();
  }
}
