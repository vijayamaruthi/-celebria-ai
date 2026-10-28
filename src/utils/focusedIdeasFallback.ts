/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CelebrationEvent, EventType } from '../types/index.ts';
import { generateDeterministicPlan } from './deterministicPlanner.ts';

export interface FocusedIdeasResult {
  title: string;
  ideas: string[];
  source: string;
}

const FALLBACK_SOURCE = 'Celebria Heuristic Engine (Contextual Fallback)';

function parseExplicitEventType(prompt: string): EventType | undefined {
  const eventTypes: [RegExp, EventType][] = [
    [/\bbaby[ -]+shower\b/i, 'baby_shower'],
    [/\bweddings?\b|\bmarriage\b/i, 'wedding'],
    [/\bbirthdays?\b/i, 'birthday'],
    [/\banniversaries\b|\banniversary\b/i, 'anniversary'],
    [/\bgala\b/i, 'gala'],
    [/\bcommunity\b/i, 'community'],
  ];
  return eventTypes.find(([pattern]) => pattern.test(prompt))?.[1];
}

function parseExplicitLocation(prompt: string): string | undefined {
  const match = prompt.match(
    /\b(?:in|near)\s+([^,.;!?]+?)(?=\s+\b(?:with|for|and|including|within|on)\b|[,.;!?]|$)/i
  );
  const location = match?.[1]?.trim().replace(/\s+/g, ' ');
  if (!location || /^(?:the\s+)?(?:evening|morning|afternoon|summer|winter|spring|fall|autumn)$/i.test(location)) {
    return undefined;
  }
  return location;
}

function parseExplicitGuestCount(prompt: string): number | undefined {
  const match = prompt.match(/\b(\d[\d,]*)\s*(?:guests?|attendees|people|persons|pax)\b/i);
  if (!match) return undefined;
  const count = Number(match[1].replace(/,/g, ''));
  return Number.isSafeInteger(count) && count > 0 ? count : undefined;
}

function currencyFromToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const normalized = token.toUpperCase().replace(/\./g, '');
  if (['₹', 'INR', 'RS', 'RUPEE', 'RUPEES'].includes(normalized)) return 'INR';
  if (['$', 'USD', 'DOLLAR', 'DOLLARS'].includes(normalized)) return 'USD';
  if (['€', 'EUR'].includes(normalized)) return 'EUR';
  if (['£', 'GBP'].includes(normalized)) return 'GBP';
  if (['CAD'].includes(normalized)) return 'CAD';
  if (['AUD'].includes(normalized)) return 'AUD';
  if (['¥', 'JPY'].includes(normalized)) return 'JPY';
  return undefined;
}

function parseExplicitBudget(prompt: string): { amount: number; currency?: string } | undefined {
  const budgetMarkers = /\b(?:total\s+)?budget\b/ig;
  let marker: RegExpExecArray | null;
  while ((marker = budgetMarkers.exec(prompt)) !== null) {
    const remainder = prompt.slice(marker.index + marker[0].length);
    const match = remainder.match(
      /^\s*(?:(?:of|is|at|around|approximately)\s+)?(₹|Rs\.?|INR\b|USD\b|CAD\b|AUD\b|EUR\b|GBP\b|JPY\b|\$|€|£|¥)?\s*(\d[\d,]*(?:\.\d+)?)\s*(INR|USD|CAD|AUD|EUR|GBP|JPY|rupees?|dollars?)?\b/i
    );
    if (!match) continue;
    const amount = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0) continue;
    return { amount, currency: currencyFromToken(match[1] || match[3]) };
  }
  return undefined;
}

function displayEventType(type: EventType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Merge only facts stated in the current question over the persisted workspace event. */
export function resolveFocusedIdeasEventContext(
  event: CelebrationEvent,
  prompt: string
): CelebrationEvent {
  const explicitType = parseExplicitEventType(prompt);
  const type = explicitType ?? event.type;
  const workspaceContextRelevant = !explicitType || explicitType === event.type;
  const explicitBudget = parseExplicitBudget(prompt);
  const explicitLocation = parseExplicitLocation(prompt);
  const explicitGuestCount = parseExplicitGuestCount(prompt);
  const name = explicitType && explicitType !== event.type
    ? `${displayEventType(type)} Celebration`
    : (event.name || `${displayEventType(type)} Celebration`).replace(/\bweeding\b/gi, (word) =>
        word[0] === word[0].toUpperCase() ? 'Wedding' : 'wedding'
      );

  return {
    ...event,
    name,
    type,
    date: workspaceContextRelevant ? event.date : '',
    time: workspaceContextRelevant ? event.time : undefined,
    location: explicitLocation ?? (workspaceContextRelevant ? event.location : ''),
    guestCount: explicitGuestCount ?? (workspaceContextRelevant ? event.guestCount : 0),
    totalBudget: explicitBudget?.amount ?? (workspaceContextRelevant ? event.totalBudget : Number.NaN),
    currency: explicitBudget?.currency ?? (workspaceContextRelevant ? event.currency : ''),
    theme: workspaceContextRelevant ? event.theme : '',
    priorities: workspaceContextRelevant ? event.priorities : [],
    dietaryRequirements: workspaceContextRelevant ? event.dietaryRequirements : [],
    accessibilityNeeds: workspaceContextRelevant ? event.accessibilityNeeds : [],
    notes: workspaceContextRelevant ? event.notes : '',
  };
}

function formatContextCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`;
  }
}

function matches(question: string, terms: string[]): boolean {
  return terms.some((term) => question.includes(term));
}

/** Produce practical event-specific ideas without inventing live vendors, prices, or bookings. */
export function generateFocusedIdeasFallback(
  event: CelebrationEvent,
  prompt: string
): FocusedIdeasResult {
  const resolvedEvent = resolveFocusedIdeasEventContext(event, prompt);
  const question = prompt.trim().replace(/\s+/g, ' ').slice(0, 240) || 'your event-planning question';
  const eventType = String(resolvedEvent.type || 'celebration').replace(/_/g, ' ');
  const eventName = resolvedEvent.name?.trim() || 'your celebration';
  const guestCount = Number.isFinite(resolvedEvent.guestCount) && resolvedEvent.guestCount > 0
    ? resolvedEvent.guestCount
    : 'your guests';
  const location = resolvedEvent.location?.trim() || 'location not stated in the question';
  const workspaceContextRelevant = resolvedEvent.type === event.type;
  const venueType = workspaceContextRelevant ? resolvedEvent.venueType || 'venue' : 'venue type not stated in the question';
  const dateTime = resolvedEvent.date
    ? `${resolvedEvent.date}${resolvedEvent.time ? ` at ${resolvedEvent.time}` : ''}`
    : 'date to be confirmed';
  const currency = resolvedEvent.currency || (workspaceContextRelevant ? 'USD' : '');
  const totalBudget = Number.isFinite(resolvedEvent.totalBudget)
    ? currency
      ? formatContextCurrency(Math.max(0, resolvedEvent.totalBudget), currency)
      : `${Math.max(0, resolvedEvent.totalBudget).toLocaleString('en-IN')} (currency not specified)`
    : 'budget not stated in the question';
  const theme = resolvedEvent.theme?.trim() || `${eventType} celebration`;
  const priorities = resolvedEvent.priorities?.filter(Boolean).slice(0, 3).join(', ');
  const dietaryNeeds = resolvedEvent.dietaryRequirements?.filter(Boolean).slice(0, 3).join(', ');
  const accessibilityNeeds = resolvedEvent.accessibilityNeeds?.filter(Boolean).slice(0, 3).join(', ');
  const tableTeams = typeof guestCount === 'number'
    ? `${Math.ceil(guestCount / 10)} teams of around 10`
    : 'teams of around 10';
  const regionalPlaylist = /\b(?:Bangalore|Bengaluru)\b/i.test(location)
    ? 'a curated Kannada or other regional playlist'
    : 'a curated local or regional playlist';
  const context = `${eventType} “${eventName}” on ${dateTime}, for ${guestCount} guests at ${location} (${venueType}), within a total budget of ${totalBudget}`;
  const contextDetails = [
    `theme: ${theme}`,
    priorities ? `priorities: ${priorities}` : '',
    dietaryNeeds ? `dietary needs: ${dietaryNeeds}` : '',
    accessibilityNeeds ? `accessibility needs: ${accessibilityNeeds}` : '',
    resolvedEvent.notes?.trim() ? `planning notes: ${resolvedEvent.notes.trim().slice(0, 180)}` : '',
  ].filter(Boolean).join('; ');
  const normalizedQuestion = question.toLowerCase();
  let ideas: string[];

  if (matches(normalizedQuestion, ['entertain', 'game', 'activity', 'activities', 'trivia', 'photo booth', 'music', 'dj', 'band', 'performance', 'dance', 'guest engagement'])) {
    ideas = [
      `For “${question}” at ${context}, run a low-cost couple-and-guest trivia round: print question cards per table, form teams sized to the seating plan (approximately ${tableTeams}), and ask the MC to host a 10-minute round. Keep questions couple-approved and use a handheld mic so the activity reaches the whole room.`,
      `Set out DIY table games such as wedding bingo or conversation-prompt cards so guests can join without moving across a ${guestCount}-person room. Place a card and pen at each table, keep instructions brief, and collect completed cards through a volunteer rather than creating a queue.`,
      `Create a simple photo spot with a reusable fabric backdrop and shared props instead of hiring a staffed booth. Put it away from entrances and accessible routes, add a volunteer only during busy periods, and plan for lighting and a queue that will not block service.`,
      `Open a guest-message and memory station with prompt cards, pens, and a clearly labeled box or album. Run it during arrival or between meal courses, provide a seated writing surface, and replenish supplies with one designated helper.`,
      `If it fits the couple’s traditions, use ${regionalPlaylist}, guest song requests, or a short guest-led dance moment. Confirm music choices with the couple, check the venue’s sound limits and available audio equipment, and keep participation optional.`,
      `Use a simple run of show: keep the photo and message stations open during arrival; schedule 10 minutes of trivia after the meal; add a 10–15 minute music or dance segment; then close with a brief MC cue. Stagger activities, assign one coordinator, and check sound, timing, access, and weather backup with the venue in ${location}.`,
    ];
  } else if (matches(normalizedQuestion, ['accessib', 'wheelchair', 'sensory', 'step-free', 'mobility'])) {
    ideas = [
      `For “${question}” at ${context}, map a step-free route from arrival through the main activity and keep its turning and seating areas clear.`,
      `Use your stated accessibility needs (${accessibilityNeeds || 'confirm attendee needs'}) to plan visible signs, nearby seating, and a quieter place to pause.`,
      `Confirm route dimensions, restroom access, and any temporary setup with the venue before finalizing the layout.`,
    ];
  } else if (matches(normalizedQuestion, ['budget', 'save', 'cost', 'cheap', 'afford', 'spend'])) {
    ideas = [
      `For “${question}” at ${context}, rank the requested elements by guest impact and choose the one or two that matter most for this ${theme} event.`,
      `Use the deterministic category plan as a starting allocation, then compare written, itemized quotes against your total budget before committing.`,
      `Keep a contingency reserve and simplify quantities, rentals, or setup before cutting accessibility, dietary accommodations, or guest comfort.`,
    ];
  } else if (matches(normalizedQuestion, ['price', 'quote', 'vendor', 'supplier', 'book', 'availability', 'available', 'hire', 'photographer', 'caterer', 'planner'])) {
    ideas = [
      `For “${question}” at ${context}, I can’t verify live availability or current prices; shortlist options by fit for ${guestCount} guests and the ${venueType} setting.`,
      `Ask each candidate for written availability, an itemized scope, staffing and setup details, cancellation terms, and any travel or rental charges.`,
      `Compare proposals against your priorities (${priorities || 'guest experience and budget'}) and confirm venue requirements before making a booking.`,
    ];
  } else if (matches(normalizedQuestion, ['cocktail', 'drink', 'beverage', 'bar', 'mocktail'])) {
    ideas = [
      `For “${question}” at ${context}, offer one themed signature drink, a zero-proof option, and water together so guests have a clear choice.`,
      `Use ${theme} for the menu names and serving details; clearly label ingredients and account for ${dietaryNeeds || 'dietary and allergy requests'}.`,
      `Place the station away from entrances and narrow walkways, and confirm service rules and replenishment responsibilities with the venue or caterer.`,
    ];
  } else if (matches(normalizedQuestion, ['food', 'cater', 'menu', 'meal', 'dessert', 'snack', 'dietary'])) {
    const catering = generateDeterministicPlan(resolvedEvent).foodAndCateringConsiderations;
    ideas = [
      `For “${question}” at ${context}, build the menu around ${catering.style.toLowerCase()} and make dietary choices easy to identify.`,
      `${catering.costSavingTips[0] || 'Use a focused menu and confirm quantities against the guest count'}; ask the caterer to confirm ingredients and cross-contact handling for ${dietaryNeeds || 'reported dietary needs'}.`,
      `Set service points so guests can move through without blocking accessible routes, and confirm final counts and setup timing in writing.`,
    ];
  } else if (matches(normalizedQuestion, ['decor', 'theme', 'flower', 'floral', 'lighting', 'centerpiece', 'color'])) {
    const decor = generateDeterministicPlan(resolvedEvent).themeAndDecorConcepts;
    ideas = [
      `For “${question}” at ${context}, use ${decor.themeTitle} as one visual anchor and repeat a small set of colors instead of decorating every surface.`,
      `${decor.lightingIdeas[0] || 'Use warm, even lighting around the main gathering area'} and keep signs, cords, and displays clear of circulation paths.`,
      `Reuse venue features and choose decor that can be moved or repurposed; confirm installation, flame, and removal rules before ordering anything.`,
    ];
  } else if (matches(normalizedQuestion, ['favor', 'favour', 'gift', 'take-home', 'keepsake'])) {
    ideas = [
      `For “${question}” at ${context}, make the favor optional and useful, with a simple presentation that fits ${theme}.`,
      `Offer a non-food choice or clearly label ingredients so guests with dietary needs can participate comfortably.`,
      `Use a self-serve pickup point near the exit and confirm quantities only after the guest count is settled.`,
    ];
  } else if (matches(normalizedQuestion, ['game', 'activity', 'entertain', 'music', 'dj', 'band', 'performance', 'dance'])) {
    ideas = [
      `For “${question}” at ${context}, plan a short, opt-in activity that works for mixed ages and does not require every guest to join at once.`,
      `Use ${theme} as the activity’s visual cue, and provide a seated or quieter alternative that reflects ${accessibilityNeeds || 'different comfort and mobility needs'}.`,
      `Check sound, power, setup time, and weather backup requirements with the venue before confirming equipment or performers.`,
    ];
  } else {
    ideas = [
      `For “${question}” at ${context}, turn the request into one clear guest-facing moment tied to ${theme}${contextDetails ? ` (${contextDetails})` : ''}.`,
      `Offer a simple way for guests to participate and a lower-effort alternative, then check both against the venue layout and your stated priorities.`,
      `Write down the materials, setup time, accessibility considerations, and budget category needed before purchasing or asking a vendor for a quote.`,
    ];
  }

  return {
    title: `Practical ideas for ${eventName}`,
    ideas,
    source: FALLBACK_SOURCE,
  };
}
