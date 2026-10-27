/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CelebrationEvent,
  BudgetCategory,
  AIPlanningResult,
  BudgetItem,
  TimelineTask,
  VendorEntry,
} from '../types/index.ts';

/**
 * Formats a currency amount with ISO symbol or standard format.
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD'
): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Calculate calendar date offset by days.
 */
export function offsetDate(
  baseDateStr: string,
  daysOffset: number
): string {
  try {
    const date = new Date(baseDateStr);

    if (Number.isNaN(date.getTime())) {
      const now = new Date();
      now.setDate(now.getDate() + daysOffset);
      return now.toISOString().split('T')[0];
    }

    date.setDate(date.getDate() - daysOffset);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Returns tailored budget allocation weights based on celebration type
 * and priorities.
 */
export function getCategoryWeights(
  event: CelebrationEvent
): Record<BudgetCategory, number> {
  const isWedding = event.type === 'wedding';
  const isBirthday = event.type === 'birthday';
  const isCommunity = event.type === 'community';

  let weights: Record<BudgetCategory, number>;

  if (isWedding) {
    weights = {
      venue: 0.28,
      catering: 0.26,
      decoration: 0.10,
      photography: 0.10,
      entertainment: 0.08,
      invitations: 0.03,
      transportation: 0.03,
      accommodation: 0.02,
      miscellaneous: 0.02,
      contingency: 0.08,
    };
  } else if (isBirthday) {
    weights = {
      venue: 0.25,
      catering: 0.35,
      decoration: 0.12,
      photography: 0.05,
      entertainment: 0.12,
      invitations: 0.02,
      transportation: 0.02,
      accommodation: 0,
      miscellaneous: 0.02,
      contingency: 0.05,
    };
  } else if (isCommunity) {
    weights = {
      venue: 0.20,
      catering: 0.20,
      decoration: 0.08,
      photography: 0.04,
      entertainment: 0.20,
      invitations: 0.06,
      transportation: 0.06,
      accommodation: 0,
      miscellaneous: 0.06,
      contingency: 0.10,
    };
  } else {
    weights = {
      venue: 0.25,
      catering: 0.30,
      decoration: 0.12,
      photography: 0.08,
      entertainment: 0.10,
      invitations: 0.03,
      transportation: 0.02,
      accommodation: 0.02,
      miscellaneous: 0.02,
      contingency: 0.06,
    };
  }

  // Adjust allocations according to user priorities.
  if (event.priorities?.length) {
    for (const priority of event.priorities) {
      const lower = priority.toLowerCase();

      if (lower.includes('photo') || lower.includes('video')) {
        weights.photography = Math.min(
          0.18,
          weights.photography + 0.04
        );
        weights.miscellaneous = Math.max(
          0.01,
          weights.miscellaneous - 0.02
        );
        weights.contingency = Math.max(
          0.05,
          weights.contingency - 0.02
        );
      }

      if (
        lower.includes('food') ||
        lower.includes('cater') ||
        lower.includes('dining')
      ) {
        weights.catering = Math.min(
          0.40,
          weights.catering + 0.05
        );
        weights.venue = Math.max(
          0.18,
          weights.venue - 0.05
        );
      }

      if (
        lower.includes('music') ||
        lower.includes('dj') ||
        lower.includes('band')
      ) {
        weights.entertainment = Math.min(
          0.20,
          weights.entertainment + 0.04
        );
        weights.decoration = Math.max(
          0.05,
          weights.decoration - 0.04
        );
      }
    }
  }

  // Normalize weights and correct rounding drift.
  const categories = Object.keys(weights) as BudgetCategory[];
  const total = Object.values(weights).reduce(
    (sum, weight) => sum + weight,
    0
  );

  if (total <= 0 || !Number.isFinite(total)) {
    const equalWeight = 1 / categories.length;

    for (const category of categories) {
      weights[category] = equalWeight;
    }

    return weights;
  }

  let roundedTotal = 0;

  for (const category of categories) {
    weights[category] =
      Math.round((weights[category] / total) * 100) / 100;

    roundedTotal += weights[category];
  }

  const largestCategory = categories.reduce((largest, category) =>
    weights[category] > weights[largest] ? category : largest
  );

  weights[largestCategory] = Math.round(
    (weights[largestCategory] + (1 - roundedTotal)) * 100
  ) / 100;

  return weights;
}

/**
 * Generate a complete, contextual planning result deterministically.
 */
export function generateDeterministicPlan(
  event: CelebrationEvent
): AIPlanningResult {
  const weights = getCategoryWeights(event);

  const totalBudget =
    Number.isFinite(event.totalBudget) && event.totalBudget >= 0
      ? event.totalBudget
      : 5000;

  const isWedding = event.type === 'wedding';
  const isBirthday = event.type === 'birthday';
  const isCommunity = event.type === 'community';

  // Allocate whole currency units using the largest-remainder method.
  const categories = Object.keys(weights) as BudgetCategory[];

  const safeBudget = Math.round(totalBudget);

  const rawAllocations = categories.map((category) => {
    const exactAmount = safeBudget * weights[category];
    const baseAmount = Math.floor(exactAmount);

    return {
      category,
      amount: baseAmount,
      remainder: exactAmount - baseAmount,
    };
  });

  const allocatedTotal = rawAllocations.reduce(
    (sum, allocation) => sum + allocation.amount,
    0
  );

  const remainingAmount = Math.max(
    0,
    safeBudget - allocatedTotal
  );

  const sortedAllocations = [...rawAllocations].sort(
    (a, b) => b.remainder - a.remainder
  );

  for (
    let i = 0;
    i < remainingAmount && i < sortedAllocations.length;
    i++
  ) {
    sortedAllocations[i].amount += 1;
  }

  const allocationAmounts = new Map(
    sortedAllocations.map((allocation) => [
      allocation.category,
      allocation.amount,
    ])
  );

  const recommendedCategoryAllocations:
    AIPlanningResult['recommendedCategoryAllocations'] =
    categories.map((category) => {
      const percentage = Math.round(weights[category] * 100);
      const amount = allocationAmounts.get(category) ?? 0;

      let rationale = '';

      switch (category) {
        case 'venue':
          rationale = isCommunity
            ? 'Covers municipal park permits, outdoor pavilion rental, and staging fees.'
            : isWedding
              ? 'Secures ceremony and reception grounds, tables, and standard venue insurance.'
              : 'Covers private venue hire or reservation fee for dedicated gathering space.';
          break;

        case 'catering':
          rationale = `Allocates approximately ${formatCurrency(
            Math.round(amount / Math.max(1, event.guestCount)),
            event.currency
          )} per guest for food, beverages, and service staff.`;
          break;

        case 'decoration':
          rationale =
            'Focused on focal entrance archways, floral centerpieces, and ambient lighting.';
          break;

        case 'photography':
          rationale =
            'Captures candid celebration moments, formal portraits, and recap gallery delivery.';
          break;

        case 'entertainment':
          rationale = isCommunity
            ? 'Features local performers, PA sound system rental, and live acoustic sets.'
            : 'Dedicated DJ or live musicians to curate atmosphere and announcements.';
          break;

        case 'contingency':
          rationale =
            'Provides a safety cushion for weather backups, extra chairs, and last-minute expenses.';
          break;

        default:
          rationale =
            'Carefully balanced based on guest count and logistical requirements.';
      }

      return {
        category,
        percentage,
        recommendedAmount: amount,
        rationale,
      };
    });

  // Overview and strategy.
  let eventOverview = '';
  let planningStrategy = '';

  if (isWedding) {
    eventOverview = `${event.name} is a romantic celebration designed for ${event.guestCount} guests in a ${event.venueType} setting, operating within a budget of ${formatCurrency(totalBudget, event.currency)}. The plan emphasizes meaningful couple traditions, seamless guest hospitality, and stunning photo opportunities.`;

    planningStrategy = `Anchor the primary budget in high-touch guest experiences: exceptional seasonal dining and seamless flow between ceremony and reception. Maintain a strict 8% contingency buffer for weather logistics (${event.venueType === 'outdoor' ? 'tenting and climate fans' : 'room turnover fees'}) and prioritize locking the venue and photographer 6+ months in advance.`;
  } else if (isBirthday) {
    eventOverview = `${event.name} brings together ${event.guestCount} friends and family members for a celebratory milestone in a ${event.venueType} venue with a budget of ${formatCurrency(totalBudget, event.currency)}.`;

    planningStrategy =
      'Focus on high-energy engagement: memorable interactive catering or cocktail stations, curated music playlists or live performer, and photo-ready decor moments rather than expensive stationary.';
  } else if (isCommunity) {
    eventOverview = `${event.name} is a vibrant civic gathering for ${event.guestCount} attendees, bringing neighbors together with a budget of ${formatCurrency(totalBudget, event.currency)}.`;

    planningStrategy =
      'Prioritize volunteer safety, clear crowd navigation, ADA accessibility ramps, municipal permits, and versatile weather shelter. Distribute stage time to feature local artists and community vendors.';
  } else {
    eventOverview = `${event.name} is an intentional gathering for ${event.guestCount} guests with a budget of ${formatCurrency(totalBudget, event.currency)}.`;

    planningStrategy =
      "Balance core hospitality with personalized touches reflecting the hosts' unique values and chosen theme.";
  }

  // Timeline phases with specific milestone tasks.
  const timelinePhases: AIPlanningResult['timelinePhases'] = [
    {
      phase: 'phase_6m_plus',
      phaseTitle: '6+ Months Out (Vision & Foundation)',
      recommendedMilestones: [
        {
          title: 'Establish master budget & priority rankings',
          description:
            'Lock total spending cap and allocate category percentages with your planning partner.',
          priority: 'urgent',
          daysBeforeEvent: 180,
          category: 'Budget',
        },
        {
          title: 'Tour and contract celebration venue',
          description:
            'Confirm maximum capacity, sound ordinances, and mandatory vendor lists.',
          priority: 'high',
          daysBeforeEvent: 165,
          category: 'Venue',
        },
        {
          title: 'Book lead photographer and videographer',
          description:
            'Review full wedding/event galleries and confirm hours of day-of coverage.',
          priority: 'high',
          daysBeforeEvent: 150,
          category: 'Photography',
        },
      ],
    },
    {
      phase: 'phase_2_3m',
      phaseTitle: '2–3 Months Out (Details & Logistics)',
      recommendedMilestones: [
        {
          title: 'Finalize catering menu and dietary counts',
          description: `Account for stated dietary needs: ${event.dietaryRequirements.join(', ') || 'Vegetarian, GF, and Nut-free options'}.`,
          priority: 'high',
          daysBeforeEvent: 75,
          category: 'Catering',
        },
        {
          title: 'Mail invitations or send digital RSVP links',
          description:
            'Set RSVP response deadline for 4 weeks before event date.',
          priority: 'high',
          daysBeforeEvent: 60,
          category: 'Invitations',
        },
        {
          title: 'Review floral and lighting mockups',
          description:
            'Confirm focal arches, table scapes, and string/bistro ambient lighting.',
          priority: 'medium',
          daysBeforeEvent: 50,
          category: 'Decoration',
        },
      ],
    },
    {
      phase: 'phase_1m',
      phaseTitle: '1 Month Out (Confirmations & Headcount)',
      recommendedMilestones: [
        {
          title: 'Compile confirmed RSVP list and special accommodations',
          description: `Ensure wheelchair access and quiet zones for attendees: ${event.accessibilityNeeds.join(', ') || 'Standard accessibility verified'}.`,
          priority: 'urgent',
          daysBeforeEvent: 30,
          category: 'Guests',
        },
        {
          title: 'Conduct venue walkthrough with coordinator and sound tech',
          description:
            'Test electrical outlets, speaker placement, and rain backup layouts.',
          priority: 'high',
          daysBeforeEvent: 25,
          category: 'Venue',
        },
        {
          title: 'Finalize music playlist, cue tracks, and do-not-play list',
          description:
            'Share timeline cues for entrance, toasts, and first dances.',
          priority: 'medium',
          daysBeforeEvent: 20,
          category: 'Entertainment',
        },
      ],
    },
    {
      phase: 'phase_2w',
      phaseTitle: '2 Weeks Out (Final Polish)',
      recommendedMilestones: [
        {
          title: 'Submit final guest count to catering and venue',
          description:
            'Lock in exact plate and chair counts with 5% buffer.',
          priority: 'urgent',
          daysBeforeEvent: 14,
          category: 'Catering',
        },
        {
          title: 'Prepare vendor payment envelopes & gratuity envelopes',
          description:
            'Confirm outstanding balances and distribute contact details to day-of lead.',
          priority: 'medium',
          daysBeforeEvent: 10,
          category: 'Budget',
        },
      ],
    },
    {
      phase: 'phase_week_of',
      phaseTitle: 'Event Week (Execution Preparation)',
      recommendedMilestones: [
        {
          title: 'Pack celebration emergency kit',
          description:
            'Tide pens, sewing kit, safety pins, phone chargers, pain relief, and printed run-of-show.',
          priority: 'high',
          daysBeforeEvent: 4,
          category: 'Logistics',
        },
        {
          title: 'Send comprehensive Run-of-Show brief to all vendors',
          description:
            'Specify loading dock times, parking passes, and contact phone numbers.',
          priority: 'urgent',
          daysBeforeEvent: 2,
          category: 'Vendors',
        },
      ],
    },
    {
      phase: 'phase_day_of',
      phaseTitle: 'Day of Celebration (Run of Show)',
      recommendedMilestones: [
        {
          title: 'Vendor load-in, floorplan setup & AV sound check',
          description:
            'Ensure tables, linens, AV levels, and signage are placed 2 hours before guest arrival.',
          priority: 'urgent',
          daysBeforeEvent: 0,
          category: 'Run of Show',
        },
        {
          title: 'Guest welcome, drinks, and celebration commencement',
          description:
            'Direct attendees, cue music, and begin scheduled celebration programming.',
          priority: 'high',
          daysBeforeEvent: 0,
          category: 'Run of Show',
        },
      ],
    },
  ];

  // Vendor recommendations.
  const vendorRecommendations:
    AIPlanningResult['vendorRecommendations'] = [
      {
        category: 'Venue',
        suggestedSearchCriteria: `Look for venues accommodating ${Math.round(event.guestCount * 1.15)} guests with ${event.venueType} flexibility and clean ADA accessibility.`,
        keyQuestionsToAsk: [
          'What is your rain or inclement weather contingency plan?',
          'Are outside caterers or bartenders permitted without penalty fees?',
          'What are the exact load-in and curfew cut-off hours?',
          'Is venue staff provided for bathroom restocking and garbage removal during the event?',
        ],
        typicalCostPercentage: '25% - 30% of total budget',
        negotiationScript:
          'We love your venue space and are comparing two final options for our date. If we book this week, would you be willing to waive the additional two-hour load-in setup fee or include existing audio equipment in the package?',
      },
      {
        category: 'Catering & Bar',
        suggestedSearchCriteria: `Caterers experienced with dietary requirements (${event.dietaryRequirements.join(', ') || 'Standard allergies'}) and per-person transparent pricing.`,
        keyQuestionsToAsk: [
          'Is table service, water service, and busing included in the staffing ratio?',
          'Can you accommodate individual dietary requests without additional per-plate surcharges?',
          'Do you provide tasting sessions prior to contract finalization?',
        ],
        typicalCostPercentage: '25% - 35% of total budget',
        negotiationScript: `We want to ensure our guests have an extraordinary meal while staying within our budget of ${formatCurrency(Math.round(totalBudget * weights.catering), event.currency)}. Can we swap the second passed appetizer for an elevated seasonal entree, or adjust staff hours to align with our budget?`,
      },
      {
        category: 'Photography / Video',
        suggestedSearchCriteria:
          'Natural light documentary style with consistent portfolio in similar lighting environments.',
        keyQuestionsToAsk: [
          'Will you personally be our photographer on the day, or an associate?',
          'What is your turnaround timeframe for high-resolution gallery delivery?',
          'Do you carry professional liability insurance as required by most venues?',
        ],
        typicalCostPercentage: '8% - 12% of total budget',
        negotiationScript:
          'We adore your portfolio aesthetic. If we book a 6-hour continuous coverage package instead of 8 hours, could you include the raw ceremony audio or a mini portrait session?',
      },
      {
        category: 'Entertainment / DJ',
        suggestedSearchCriteria:
          'Experienced event MC capable of reading crowd energy without cheesy interruptions.',
        keyQuestionsToAsk: [
          'Do you provide dedicated wireless microphones for announcements and toasts?',
          'What backup equipment do you bring on-site in case of hardware malfunction?',
        ],
        typicalCostPercentage: '8% - 12% of total budget',
        negotiationScript:
          'We appreciate your detailed package. We are ready to sign if you can include wireless uplighting or a separate cocktail-hour speaker setup within the base quote.',
      },
    ];

  // Action items.
  const prioritizedActionItems:
    AIPlanningResult['prioritizedActionItems'] = [
      {
        action: 'Confirm and sign primary venue contract',
        urgency: 'high',
        impact:
          'Secures your date and dictates seating, layout, and catering logistics.',
      },
      {
        action: 'Finalize per-person catering budget ceiling',
        urgency: 'high',
        impact: `Prevents the largest variable expense from exceeding ${formatCurrency(Math.round(totalBudget * weights.catering), event.currency)}.`,
      },
      {
        action: 'Send Save-the-Dates or community announcements',
        urgency: 'medium',
        impact:
          'Maximizes attendance and allows guests to plan travel and schedules.',
      },
      {
        action: 'Establish rain and weather backup protocol',
        urgency: event.venueType === 'outdoor' ? 'high' : 'low',
        impact:
          'Guarantees celebration continuity regardless of forecast.',
      },
    ];

  // Theme and decor concepts.
  const themeAndDecorConcepts:
    AIPlanningResult['themeAndDecorConcepts'] = {
      themeTitle:
        event.theme ||
        (isWedding
          ? 'Botanical Elegance & Warm Ivory'
          : isBirthday
            ? 'Luminous Modern Celebration'
            : 'Community Garden Festival'),
      colorPalette: [
        { name: 'Warm Ivory', hex: '#FAF7F2' },
        { name: 'Imperial Indigo', hex: '#312E81' },
        { name: 'Champagne Gold', hex: '#D97706' },
        { name: 'Eucalyptus Sage', hex: '#059669' },
        { name: 'Slate Charcoal', hex: '#1E293B' },
      ],
      lightingIdeas: [
        'Warm white festoon string lights suspended over main dining and gathering zones.',
        'Battery-operated amber tea lights in textured glass votives across guest tables.',
        'Subtle wash uplights along perimeter architectural walls for depth without glare.',
      ],
      decorElements: [
        'Layered natural linen table runners with potted herbs and seasonal greenery.',
        'Hand-lettered welcome signage on natural wood or recycled cardstock.',
        'Dedicated celebratory photo backdrop incorporating customized typography and organic textures.',
      ],
      lowerCostAlternative:
        'Substitute imported cut flowers with hearty potted ferns, eucalyptus garlands, and pillar candle clusters that can be gifted to helpers post-event.',
    };

  // Food and catering.
  const foodAndCateringConsiderations:
    AIPlanningResult['foodAndCateringConsiderations'] = {
      style: isCommunity
        ? 'Interactive food truck stalls or community buffet with clearly labeled allergen cards.'
        : isWedding
          ? 'Plated dual-entree or elevated family-style platters encouraging guest conversation.'
          : 'Gourmet grazing tables followed by passed skewers and signature dessert station.',
      dietaryAccommodations: [
        'Individual plated options for celiac/gluten-free guests sealed during prep.',
        'Substantial plant-based protein options (e.g., wild mushroom risotto or braised lentils).',
        'Non-alcoholic craft mocktails featuring fresh citrus and sparkling botanicals.',
      ],
      costSavingTips: [
        'Offer a signature cocktail plus beer and wine rather than a full open liquor bar.',
        'Opt for sheet cakes sliced in the kitchen paired with a smaller ceremonial display cake.',
        'Feature seasonal, locally harvested produce to reduce supplier freight markups.',
      ],
      presentationIdeas: [
        'Tiered wooden grazing risers with fresh figs, artisan crackers, and edible blooms.',
        'Miniature dessert shooters that allow guests to sample varieties while mingling.',
      ],
    };

  // Guest management.
  const guestManagement: AIPlanningResult['guestManagement'] = {
    rsvpMilestones: [
      'Send invitations 8-10 weeks prior to celebration.',
      'RSVP deadline set at 3-4 weeks prior.',
      'Direct follow-up phone call to unconfirmed guests 18 days prior.',
    ],
    seatingAdvice: [
      'Group guests by organic affinities (college friends, family branches, neighborhood leads).',
      'Ensure at least 36 inches between tables for smooth wheelchair and stroller circulation.',
      'Place older guests and sound-sensitive attendees away from primary speakers and subwoofers.',
    ],
    accessibilityAccommodations: [
      'Zero-step ramp entrance to all event pavilions and primary restrooms.',
      'Designated quiet sensory lounge with soft seating for decompression.',
      'High-contrast signage with minimum 18pt font for menus and schedules.',
    ],
  };

  // Risks and contingencies.
  const riskAndContingency: AIPlanningResult['riskAndContingency'] = [
    {
      risk: 'Sudden rain or extreme temperatures during outdoor segments',
      severity: event.venueType === 'outdoor' ? 'high' : 'medium',
      mitigation:
        'Place a 48-hour tentative hold on a clear-span tent with sidewalls and outdoor heaters/fans.',
      fallbackOption:
        'Pre-plan immediate room turnover to move ceremony/activities into adjacent covered pavilion.',
    },
    {
      risk: 'Primary catering or beverage supplier delivery delay',
      severity: 'medium',
      mitigation:
        'Require deliveries to arrive 3 hours before guest doors open.',
      fallbackOption:
        'Keep local backup bakery and beverage distributor on speed-dial with corporate account.',
    },
    {
      risk: 'Audio microphone feedback or AV failure during key speeches',
      severity: 'medium',
      mitigation:
        'Test all wireless frequencies and pack redundant XLR cables and wired dynamic microphones.',
      fallbackOption:
        'Compact portable battery-powered PA speaker on standby near coordinator table.',
    },
    {
      risk: 'Guest count exceeds RSVP confirmations by 10%+',
      severity: 'low',
      mitigation:
        'Contract venue and catering with standard 5% plate and chair buffer.',
      fallbackOption:
        'Venue keeps 2 folded banquet tables and folding chairs pre-staged in storage.',
    },
  ];

  return {
    eventId: event.id,
    eventOverview,
    planningStrategy,
    recommendedCategoryAllocations,
    timelinePhases,
    vendorRecommendations,
    prioritizedActionItems,
    themeAndDecorConcepts,
    foodAndCateringConsiderations,
    guestManagement,
    riskAndContingency,
    isFallback: true,
    modelUsed: 'Celebria Intelligent Heuristic Engine',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Creates seed budget items from an AI plan or defaults.
 */
export function createSeedBudgetItems(
  event: CelebrationEvent,
  plan?: AIPlanningResult
): BudgetItem[] {
  if (plan?.recommendedCategoryAllocations.length) {
    return plan.recommendedCategoryAllocations.map((allocation) => ({
      id: `budget-${event.id}-${allocation.category}-main`,
      eventId: event.id,
      category: allocation.category,
      name: `Primary ${allocation.category.charAt(0).toUpperCase()}${allocation.category.slice(1)} Contract`,
      plannedAmount: allocation.recommendedAmount,
      actualAmount: Math.round(allocation.recommendedAmount * 0.4),
      paidStatus: 'deposit_paid',
      notes: allocation.rationale,
      createdAt: new Date().toISOString(),
    }));
  }

  const weights = getCategoryWeights(event);
  const budget = Number.isFinite(event.totalBudget) && event.totalBudget >= 0
    ? Math.round(event.totalBudget)
    : 5000;

  const categories = Object.keys(weights) as BudgetCategory[];

  const rawAllocations = categories.map((category) => {
    const exactAmount = budget * weights[category];
    const amount = Math.floor(exactAmount);

    return {
      category,
      amount,
      remainder: exactAmount - amount,
    };
  });

  let remaining = budget - rawAllocations.reduce(
    (sum, allocation) => sum + allocation.amount,
    0
  );

  const sorted = [...rawAllocations].sort(
    (a, b) => b.remainder - a.remainder
  );

  for (let i = 0; i < remaining && i < sorted.length; i++) {
    sorted[i].amount += 1;
    remaining--;
  }

  const amounts = new Map(
    sorted.map((allocation) => [
      allocation.category,
      allocation.amount,
    ])
  );

  return categories.map((category) => ({
    id: `budget-${event.id}-${category}-init`,
    eventId: event.id,
    category,
    name: `Estimated ${category.charAt(0).toUpperCase()}${category.slice(1)} Allocation`,
    plannedAmount: amounts.get(category) ?? 0,
    actualAmount: 0,
    paidStatus: 'unpaid',
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Creates seed timeline tasks from an AI plan.
 */
export function createSeedTimelineTasks(
  event: CelebrationEvent,
  plan?: AIPlanningResult
): TimelineTask[] {
  const tasks: TimelineTask[] = [];
  const phases = plan?.timelinePhases || [];

  let index = 0;

  for (const phase of phases) {
    for (const milestone of phase.recommendedMilestones) {
      index++;

      tasks.push({
        id: `task-${event.id}-${index}`,
        eventId: event.id,
        title: milestone.title,
        description: milestone.description,
        phase: phase.phase,
        dueDate: offsetDate(event.date, milestone.daysBeforeEvent),
        priority: milestone.priority,
        completed: index <= 2,
        category: milestone.category,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return tasks;
}

/**
 * Creates seed vendor entries from an AI plan.
 */
export function createSeedVendors(
  event: CelebrationEvent,
  plan?: AIPlanningResult
): VendorEntry[] {
  const vendors: VendorEntry[] = [];
  const recommendations = plan?.vendorRecommendations || [];

  let index = 0;

  for (const recommendation of recommendations) {
    index++;

    vendors.push({
      id: `vendor-${event.id}-${index}`,
      eventId: event.id,
      category: recommendation.category,
      name: `${recommendation.category} Partner Co.`,
      contactPerson: 'Lead Coordinator',
      email: `hello@${recommendation.category.toLowerCase().replace(/[^a-z]/g, '')}partner.com`,
      phone: '(555) 234-5678',
      status: index === 1 ? 'booked' : index === 2 ? 'quoted' : 'inquired',
      quotedPrice: Math.round(event.totalBudget * 0.15),
      contractPrice:
        index === 1
          ? Math.round(event.totalBudget * 0.14)
          : undefined,
      notes: recommendation.suggestedSearchCriteria,
      negotiationTips: recommendation.keyQuestionsToAsk,
      createdAt: new Date().toISOString(),
    });
  }

  return vendors;
}
