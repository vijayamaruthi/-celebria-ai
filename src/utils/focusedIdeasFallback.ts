/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CelebrationEvent } from '../types/index.ts';
import { formatCurrency, generateDeterministicPlan } from './deterministicPlanner.ts';

export interface FocusedIdeasResult {
  title: string;
  ideas: string[];
  source: string;
}

const FALLBACK_SOURCE = 'Celebria Heuristic Engine (Contextual Fallback)';

function matches(question: string, terms: string[]): boolean {
  return terms.some((term) => question.includes(term));
}

/** Produce practical event-specific ideas without inventing live vendors, prices, or bookings. */
export function generateFocusedIdeasFallback(
  event: CelebrationEvent,
  prompt: string
): FocusedIdeasResult {
  const question = prompt.trim().replace(/\s+/g, ' ').slice(0, 240) || 'your event-planning question';
  const eventType = String(event.type || 'celebration').replace(/_/g, ' ');
  const eventName = event.name?.trim() || 'your celebration';
  const guestCount = Number.isFinite(event.guestCount) && event.guestCount > 0
    ? event.guestCount
    : 'your guests';
  const location = event.location?.trim() || 'the selected venue';
  const venueType = event.venueType || 'venue';
  const dateTime = event.date
    ? `${event.date}${event.time ? ` at ${event.time}` : ''}`
    : 'date to be confirmed';
  const currency = event.currency || 'USD';
  const totalBudget = Number.isFinite(event.totalBudget)
    ? formatCurrency(Math.max(0, event.totalBudget), currency)
    : 'the stated budget';
  const theme = event.theme?.trim() || `${eventType} celebration`;
  const priorities = event.priorities?.filter(Boolean).slice(0, 3).join(', ');
  const dietaryNeeds = event.dietaryRequirements?.filter(Boolean).slice(0, 3).join(', ');
  const accessibilityNeeds = event.accessibilityNeeds?.filter(Boolean).slice(0, 3).join(', ');
  const context = `${eventType} “${eventName}” on ${dateTime}, for ${guestCount} guests at ${location} (${venueType}), within a total budget of ${totalBudget}`;
  const contextDetails = [
    `theme: ${theme}`,
    priorities ? `priorities: ${priorities}` : '',
    dietaryNeeds ? `dietary needs: ${dietaryNeeds}` : '',
    accessibilityNeeds ? `accessibility needs: ${accessibilityNeeds}` : '',
    event.notes?.trim() ? `planning notes: ${event.notes.trim().slice(0, 180)}` : '',
  ].filter(Boolean).join('; ');
  const deterministicPlan = generateDeterministicPlan(event);
  const normalizedQuestion = question.toLowerCase();
  let ideas: string[];

  if (matches(normalizedQuestion, ['accessib', 'wheelchair', 'sensory', 'step-free', 'mobility'])) {
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
    const catering = deterministicPlan.foodAndCateringConsiderations;
    ideas = [
      `For “${question}” at ${context}, build the menu around ${catering.style.toLowerCase()} and make dietary choices easy to identify.`,
      `${catering.costSavingTips[0] || 'Use a focused menu and confirm quantities against the guest count'}; ask the caterer to confirm ingredients and cross-contact handling for ${dietaryNeeds || 'reported dietary needs'}.`,
      `Set service points so guests can move through without blocking accessible routes, and confirm final counts and setup timing in writing.`,
    ];
  } else if (matches(normalizedQuestion, ['decor', 'theme', 'flower', 'floral', 'lighting', 'centerpiece', 'color'])) {
    const decor = deterministicPlan.themeAndDecorConcepts;
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
