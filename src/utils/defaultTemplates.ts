/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelebrationEvent, CelebriaStorageState } from '../types';
import {
  generateDeterministicPlan,
  createSeedBudgetItems,
  createSeedTimelineTasks,
  createSeedVendors,
} from './deterministicPlanner';

function getFutureDate(daysInFuture: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysInFuture);
  return d.toISOString().split('T')[0];
}

export const TEMPLATE_EVENTS: CelebrationEvent[] = [
  {
    id: 'event-wedding-sophia-liam',
    name: "Sophia & Liam's Garden Wedding",
    type: 'wedding',
    date: getFutureDate(135),
    time: '16:00',
    guestCount: 140,
    totalBudget: 32000,
    currency: 'USD',
    location: 'Meadowood Glass Conservatory, Napa Valley',
    venueType: 'hybrid',
    theme: 'Botanical Elegance, Linen & Champagne Accents',
    priorities: [
      'Documentary Photography & Heirloom Video',
      'Seasonal Farm-to-Table Plated Dining',
      'Live Acoustic & Jazz Trio',
    ],
    dietaryRequirements: ['Vegetarian option', 'Nut-free protocol', 'Gluten-free cake tier'],
    accessibilityNeeds: [
      'Step-free ramp navigation to garden pavilion',
      'Wheelchair-accessible seating at ceremony front row',
      'Quiet lounge suite for elderly grandparents',
    ],
    notes:
      'Ceremony at 4:00 PM followed by cocktail hour on the lawn terrace and dinner in the glass greenhouse.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isTemplate: true,
  },
  {
    id: 'event-birthday-marcus-40th',
    name: "Marcus's 40th Retro Vinyl & Jazz Night",
    type: 'birthday',
    date: getFutureDate(42),
    time: '19:30',
    guestCount: 45,
    totalBudget: 4500,
    currency: 'USD',
    location: 'Velvet Lounge & Loft, Downtown Chicago',
    venueType: 'indoor',
    theme: 'Mid-Century Speakeasy & Vintage Vinyl',
    priorities: [
      'Craft Cocktail Tasting Flight',
      'All-Vinyl Funk & Jazz DJ Set',
      'Instant Polaroid Guestbook Station',
    ],
    dietaryRequirements: ['Artisan vegan tapas', 'Non-alcoholic craft botanical mocktails'],
    accessibilityNeeds: ['Elevator access to 3rd-floor private loft', 'Designated seating near entrance'],
    notes: 'Surprise entrance at 8:00 PM followed by signature drinks and jazz record spins.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isTemplate: true,
  },
  {
    id: 'event-community-oakridge-fest',
    name: 'Oakridge Spring Community Arts Festival',
    type: 'community',
    date: getFutureDate(85),
    time: '11:00',
    guestCount: 450,
    totalBudget: 15000,
    currency: 'USD',
    location: 'Oakridge Civic Park & Waterfront Promenade',
    venueType: 'outdoor',
    theme: 'Civic Creativity & Zero-Waste Sustainability',
    priorities: [
      'Local Youth Maker Stalls & Interactive Workshops',
      'Community Open-Mic Amphitheater Stage',
      'Zero-Waste Compost & Recycling Hubs',
    ],
    dietaryRequirements: ['Diverse multicultural food trucks', 'Nut-free family picnic lawn'],
    accessibilityNeeds: [
      'Paved ADA pathway circulation throughout park',
      'ASL interpreter scheduled for stage announcements',
      'Sensory recharge tent for neurodivergent visitors',
      'Braille and large-print physical event schedules',
    ],
    notes: 'Free public festival organized in partnership with the local library and arts council.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isTemplate: true,
  },
];

/**
 * Builds the initial complete state with preloaded template data
 */
export function buildInitialStorageState(): CelebriaStorageState {
  const allEvents = [...TEMPLATE_EVENTS];
  const allBudgetItems = [];
  const allTasks = [];
  const allVendors = [];
  const allPlans: CelebriaStorageState['aiPlans'] = {};

  for (const event of allEvents) {
    const plan = generateDeterministicPlan(event);
    allPlans[event.id] = plan;
    allBudgetItems.push(...createSeedBudgetItems(event, plan));
    allTasks.push(...createSeedTimelineTasks(event, plan));
    allVendors.push(...createSeedVendors(event, plan));
  }

  return {
    version: 1,
    activeEventId: allEvents[0].id,
    events: allEvents,
    budgetItems: allBudgetItems,
    tasks: allTasks,
    vendors: allVendors,
    aiPlans: allPlans,
  };
}
