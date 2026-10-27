/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type { CelebrationEvent, AIPlanningResult } from '../types/index.ts';
import { generateDeterministicPlan } from '../utils/deterministicPlanner.ts';

let aiInstance: GoogleGenAI | null = null;

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
      },
    });
  }
  return aiInstance;
}

export async function processPlanRequest(
  event: CelebrationEvent,
  customFocus?: string
): Promise<{ plan: AIPlanningResult; model: string }> {
  const ai = getAIClient();

  if (!ai) {
    const fallback = generateDeterministicPlan(event);
    return {
      plan: {
        ...fallback,
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

Ensure numeric budget allocations sum to approximately the total budget. Ensure realistic deadlines.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '';
    const cleanJson = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      plan: {
        ...parsed,
        eventId: event.id,
        isFallback: false,
        modelUsed: 'Gemini 3.8 Flash',
        generatedAt: new Date().toISOString(),
      },
      model: 'Gemini 3.8 Flash',
    };
  } catch (err) {
    console.warn('Gemini 3.8 Flash API call failed. Using deterministic engine fallback.', err);
    const fallback = generateDeterministicPlan(event);
    return {
      plan: {
        ...fallback,
        isFallback: true,
        modelUsed: 'Celebria Heuristic Engine (Gemini Service Fallback)',
      },
      model: 'Celebria Heuristic Engine',
    };
  }
}
export async function processIdeasRequest(
  event: CelebrationEvent,
  userPrompt: string
): Promise<{ title: string; ideas: string[]; model: string }> {
  const ai = getAIClient();

  if (!ai) {
    console.error('Gemini unavailable: GEMINI_API_KEY is missing or invalid.');
    return {
      title: `AI unavailable — ${event.name}`,
      ideas: [
        'Gemini is not configured. Check the GEMINI_API_KEY environment variable in Render.',
      ],
      model: 'AI Unavailable',
    };
  }

  try {
    const prompt = `
You are Celebria AI, a creative celebration planner.
Answer the user's actual request and never substitute a different event.

EVENT: ${event.name}
TYPE: ${event.type}
GUESTS: ${event.guestCount}
BUDGET: ${event.totalBudget} ${event.currency}
THEME: ${event.theme || 'Not specified'}

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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const rawText = (response.text || '')
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(rawText);

    if (
      typeof parsed.title !== 'string' ||
      !Array.isArray(parsed.ideas) ||
      parsed.ideas.length === 0
    ) {
      throw new Error('Gemini returned an invalid ideas response.');
    }

    const ideas = parsed.ideas
      .filter((idea: unknown): idea is string => typeof idea === 'string')
      .slice(0, 3);

    if (ideas.length === 0) {
      throw new Error('Gemini returned no valid ideas.');
    }

    return {
      title: parsed.title,
      ideas,
      model: 'Gemini 3.8 Flash',
    };
  } catch (err) {
    console.error('Gemini idea generation failed:', err);
    return {
      title: `AI temporarily unavailable — ${event.name}`,
      ideas: [
        'The Gemini request failed. Check the Render application logs for details.',
        'Verify that the API key is valid and Gemini 3.8 Flash is accessible.',
      ],
      model: 'AI Unavailable',
    };
  }
}
