/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type { CelebrationEvent, AIPlanningResult } from '../types/index.ts';
import { generateDeterministicPlan } from '../utils/deterministicPlanner.ts';
import {
  generateFocusedIdeasFallback,
  resolveFocusedIdeasEventContext,
} from '../utils/focusedIdeasFallback.ts';

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
  signal?: AbortSignal;
  wait?: (delayMs: number) => Promise<void>;
}

export interface PlanRequestDependencies {
  generateContent?: () => Promise<GeminiContentResponse>;
  retryOptions?: GeminiRetryOptions;
}

export interface IdeasRequestDependencies {
  generateContent?: (prompt: string) => Promise<GeminiContentResponse>;
  retryOptions?: GeminiRetryOptions;
  signal?: AbortSignal;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<
  GeminiRetryOptions,
  'wait' | 'jitter' | 'random' | 'retryAbortErrors' | 'retryFailedFetchErrors' | 'signal'
>> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
};
const MAX_RETRY_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 5000;
const IDEAS_GEMINI_ATTEMPT_TIMEOUT_MS = 20_000;
type GeminiFailureClass =
  | 'request_rate_limit'
  | 'token_rate_limit'
  | 'rate_limit'
  | 'daily_quota'
  | 'project_quota'
  | 'quota_exhausted'
  | 'billing_or_spend_limit'
  | 'unknown_429'
  | 'service_overload'
  | 'deadline_exceeded'
  | 'timeout'
  | 'authentication'
  | 'permission_or_project_config'
  | 'invalid_request'
  | 'other';
const NON_RECOVERABLE_429_CLASSES = new Set<GeminiFailureClass>([
  'daily_quota',
  'project_quota',
  'billing_or_spend_limit',
]);
const SAFE_GEMINI_FAILURE_CLASSES = new Set<GeminiFailureClass>([
  'request_rate_limit',
  'token_rate_limit',
  'rate_limit',
  'daily_quota',
  'project_quota',
  'quota_exhausted',
  'billing_or_spend_limit',
  'unknown_429',
  'service_overload',
  'deadline_exceeded',
  'timeout',
  'authentication',
  'permission_or_project_config',
  'invalid_request',
  'other',
]);
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

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    timer = setTimeout(finish, delayMs);
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) finish();
  });
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function parseRetryDelay(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  const duration = text.match(/^(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?)$/i);
  if (duration) {
    const amount = Number(duration[1]);
    const milliseconds = /^m/i.test(duration[2]) ? amount : amount * 1000;
    return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds : undefined;
  }
  const seconds = Number(text);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

function classify429Payload(payload: unknown): GeminiFailureClass {
  const root = asRecord(payload);
  const providerError = asRecord(root?.error);
  if (!providerError) return 'unknown_429';

  const messages: string[] = [];
  if (typeof providerError.message === 'string') messages.push(providerError.message);
  if (typeof providerError.status === 'string') messages.push(providerError.status);
  const details = Array.isArray(providerError.details) ? providerError.details : [];
  for (const detail of details) {
    const record = asRecord(detail);
    if (!record) continue;
    const type = typeof record['@type'] === 'string' ? record['@type'] : '';
    if (type.endsWith('google.rpc.ErrorInfo')) {
      if (typeof record.reason === 'string') messages.push(record.reason);
      const metadata = asRecord(record.metadata);
      for (const key of ['quota_metric', 'quota_limit', 'quota_unit', 'limit']) {
        if (typeof metadata?.[key] === 'string') messages.push(metadata[key] as string);
      }
    }
  }

  const diagnosticText = messages.join(' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  if (/\b(billing|spend(?: based)? limit|prepay|payment required|credit balance depleted)\b/.test(diagnosticText)) {
    return 'billing_or_spend_limit';
  }
  if (/\b(daily|per day|requests per day|tokens per day|rpd)\b/.test(diagnosticText)) {
    return 'daily_quota';
  }
  if (/\b(tokens? (?:per|\/)\s*(?:minute|second)|tpm|tokens per minute|tokens per second)\b/.test(diagnosticText)) {
    return 'token_rate_limit';
  }
  if (/\b(requests? (?:per|\/)\s*(?:minute|second)|rpm|requests per minute|requests per second)\b/.test(diagnosticText)) {
    return 'request_rate_limit';
  }
  if (/\b(rate limit exceeded|rate limit)\b/.test(diagnosticText)) return 'rate_limit';
  if (/\b(project.{0,12}quota|quota.{0,12}project)\b/.test(diagnosticText)) return 'project_quota';
  if (/\b(quota exceeded|quota exhausted|quota_exceeded)\b/.test(diagnosticText)) return 'quota_exhausted';
  return 'unknown_429';
}

/** Return only a small allow-listed category; never return provider text or metadata. */
export function classifyGeminiFailure(error: unknown): GeminiFailureClass {
  const status = getErrorStatus(error);
  if (status === 429) {
    const value = asRecord(error);
    const suppliedClass = value?.failureClass;
    return typeof suppliedClass === 'string' && SAFE_GEMINI_FAILURE_CLASSES.has(suppliedClass as GeminiFailureClass)
      ? suppliedClass as GeminiFailureClass
      : 'unknown_429';
  }
  if (status === 503) return 'service_overload';
  if (status === 504) return 'deadline_exceeded';
  if (status === 408) return 'timeout';
  if (status === 401) return 'authentication';
  if (status === 403) return 'permission_or_project_config';
  if (status === 400) return 'invalid_request';
  if (status === 402) return 'billing_or_spend_limit';
  return 'other';
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
  if (typeof retryAfter === 'string' || typeof retryAfter === 'number') {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const date = new Date(String(retryAfter)).getTime();
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }

  const embeddedRetryAfterMs = asRecord(error)?.retryAfterMs;
  return typeof embeddedRetryAfterMs === 'number' && Number.isFinite(embeddedRetryAfterMs) && embeddedRetryAfterMs >= 0
    ? embeddedRetryAfterMs
    : undefined;
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

function combineAbortSignals(signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const activeSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (activeSignals.length === 0) return undefined;
  if (activeSignals.length === 1) return activeSignals[0];
  return AbortSignal.any(activeSignals);
}

/**
 * The GenAI SDK's ApiError retains the status but drops response headers. Preserve
 * headers for 429 errors so the bounded retry policy can honor Retry-After.
 */
export function createRetryAwareGeminiFetch(
  fetcher: typeof fetch = fetch,
  requestSignal?: AbortSignal
): typeof fetch {
  return async (input, init) => {
    const signal = combineAbortSignals([init?.signal ?? undefined, requestSignal]);
    const response = await fetcher(input, { ...init, signal });
    if (response.status !== 429) return response;

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      // Some gateways return a non-JSON 429. Keep the failure generic and sanitized.
    }
    const failureClass = classify429Payload(payload);
    const root = asRecord(payload);
    const providerError = asRecord(root?.error);
    const details = Array.isArray(providerError?.details) ? providerError.details : [];
    let bodyRetryAfterMs: number | undefined;
    for (const detail of details) {
      const record = asRecord(detail);
      if (!record || typeof record['@type'] !== 'string' || !record['@type'].endsWith('google.rpc.RetryInfo')) continue;
      bodyRetryAfterMs = parseRetryDelay(record.retryDelay);
      if (bodyRetryAfterMs !== undefined) break;
    }
    if (bodyRetryAfterMs === undefined && typeof providerError?.message === 'string') {
      const retryMatch = providerError.message.match(/\bretry in\s+(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?)\b/i);
      if (retryMatch) bodyRetryAfterMs = parseRetryDelay(`${retryMatch[1]} ${retryMatch[2]}`);
    }

    const error = Object.assign(new Error('Gemini API request failed (HTTP 429)'), {
      status: response.status,
      headers: response.headers,
      failureClass,
      retryAfterMs: bodyRetryAfterMs,
    });
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
  const wait = options.wait;

  for (let attempt = 1; ; attempt++) {
    if (options.signal?.aborted) {
      throw options.signal.reason ?? Object.assign(new Error('Gemini request cancelled'), { name: 'AbortError' });
    }
    try {
      return await request();
    } catch (error) {
      if (options.signal?.aborted) throw error;
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
      const failureClass = status === 429 ? classifyGeminiFailure(error) : 'other';
      if (status === 429 && NON_RECOVERABLE_429_CLASSES.has(failureClass)) throw error;
      // A generic quota-exhausted response is ambiguous. Retry only if the provider
      // explicitly says the limit should clear within the allowed short wait.
      if (status === 429 && failureClass === 'quota_exhausted' && retryAfterMs === undefined) throw error;
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
      const delayMs = Math.max(jitteredDelayMs, retryAfterMs ?? 0);
      if (wait) await wait(delayMs);
      else await waitForRetry(delayMs, options.signal);
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

export function createIdeasAIClient(
  apiKey: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = IDEAS_GEMINI_ATTEMPT_TIMEOUT_MS,
  requestSignal?: AbortSignal
): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
      fetch: createRetryAwareGeminiFetch(fetcher, requestSignal),
      // This per-attempt timeout also communicates the server deadline to Gemini.
      timeout: timeoutMs,
      retryOptions: { attempts: 1 },
    },
  });
}

function getIdeasAIClient(requestSignal?: AbortSignal): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') return null;
  if (requestSignal) return createIdeasAIClient(apiKey, fetch, IDEAS_GEMINI_ATTEMPT_TIMEOUT_MS, requestSignal);
  if (!ideasAiInstance) {
    ideasAiInstance = createIdeasAIClient(apiKey);
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
    const status = getErrorStatus(err);
    console.warn(
      'Gemini 3.8 Flash API call failed. Using deterministic engine fallback.',
      status ? `HTTP ${status}` : 'request/network error'
    );
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
  const ai = dependencies.generateContent ? null : getIdeasAIClient(dependencies.signal);
  const requestEvent = resolveFocusedIdeasEventContext(event, userPrompt);
  const useFallback = () => {
    const fallback = generateFocusedIdeasFallback(event, userPrompt);
    return { title: fallback.title, ideas: fallback.ideas, model: fallback.source };
  };
  const requestStartedAt = Date.now();
  const attemptDurationsMs: number[] = [];

  if (!ai && !dependencies.generateContent) return useFallback();

  try {
    const workspaceContextRelevant = requestEvent.type === event.type;
    const prompt = `
You are Celebria AI, a creative celebration planner.
Answer the user's actual request and never substitute a different event.
When the user request explicitly gives event details, those details take precedence over the supplemental workspace context below.

EVENT: ${requestEvent.name}
TYPE: ${requestEvent.type}
DATE: ${requestEvent.date || 'Not stated in the current question'}${requestEvent.time ? ` at ${requestEvent.time}` : ''}
GUESTS: ${requestEvent.guestCount > 0 ? requestEvent.guestCount : 'Not stated in the current question'}
BUDGET: ${Number.isFinite(requestEvent.totalBudget) ? `${requestEvent.totalBudget} ${requestEvent.currency}`.trim() : 'Not stated in the current question'}
LOCATION: ${requestEvent.location || 'Not stated in the current question'}
VENUE TYPE: ${workspaceContextRelevant ? requestEvent.venueType : 'Not stated in the current question'}
THEME: ${requestEvent.theme || 'Not stated in the current question'}
PRIORITIES: ${requestEvent.priorities?.join(', ') || 'Not specified'}
DIETARY REQUIREMENTS: ${requestEvent.dietaryRequirements?.join(', ') || 'Not specified'}
ACCESSIBILITY NEEDS: ${requestEvent.accessibilityNeeds?.join(', ') || 'Not specified'}
SPECIAL NOTES: ${requestEvent.notes || 'None'}

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

    const generateContent = async () => {
      const attemptStartedAt = Date.now();
      try {
        return await (dependencies.generateContent
          ? dependencies.generateContent(prompt)
          : ai!.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          }));
      } finally {
        attemptDurationsMs.push(Date.now() - attemptStartedAt);
      }
    };

    const response = await retryGeminiRequest(
      generateContent,
      {
        jitter: 0.2,
        retryAbortErrors: true,
        retryFailedFetchErrors: true,
        ...dependencies.retryOptions,
        signal: dependencies.signal ?? dependencies.retryOptions?.signal,
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
    if (dependencies.signal?.aborted) return useFallback();
    // Keep prompts, event notes, API key material, and raw provider errors out of logs.
    const status = getErrorStatus(err);
    const retryAfterMs = status === 429 ? getRetryAfterMs(err) : undefined;
    console.warn(
      'Gemini idea generation failed; using contextual fallback.',
      status ? `HTTP ${status}` : 'request/network error',
      `failureClass=${classifyGeminiFailure(err)}`,
      `retryAfterMs=${retryAfterMs === undefined ? 'unspecified' : Math.round(retryAfterMs)}`,
      `attempts=${attemptDurationsMs.length}`,
      `attemptDurationsMs=${attemptDurationsMs.join(',')}`,
      `totalMs=${Date.now() - requestStartedAt}`
    );
    return useFallback();
  }
}
