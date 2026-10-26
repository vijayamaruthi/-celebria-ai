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
  TimelinePhase,
  TaskPriority,
} from '../types/index.ts';

/**
 * Formats a currency amount with ISO symbol or standard format
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(isNaN(amount) ? 0 : amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Calculate calendar date offset by days
 */
export function offsetDate(baseDateStr: string, daysOffset: number): string {
  try {
    const d = new Date(baseDateStr);
    if (isNaN(d.getTime())) {
      const now = new Date();
      now.setDate(now.getDate() + daysOffset);
      return now.toISOString().split('T')[0];
    }
    d.setDate(d.getDate() - daysOffset);
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Returns tailored budget allocation weights based on celebration type and priorities
 */
export function getCategoryWeights(event: CelebrationEvent): Record<BudgetCategory, number> {
  const isWedding = event.type === 'wedding';
  const isBirthday = event.type === 'birthday';
  const isCommunity = event.type === 'community';

  // Base percentages that sum to 100%
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
      accommodation: 0.00,
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
      accommodation: 0.00,
      miscellaneous: 0.06,
      contingency: 0.10,
    };
  } else {
    // Generic celebration
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

  // Adjust for user priorities
  if (event.priorities && event.priorities.length > 0) {
    for (const p of event.priorities) {
      const lower = p.toLowerCase();
      if (lower.includes('photo') || lower.includes('video')) {
        weights.photography = Math.min(0.18, weights.photography + 0.04);
        weights.miscellaneous = Math.max(0.01, weights.miscellaneous - 0.02);
        weights.contingency = Math.max(0.05, weights.contingency - 0.02);
      }
      if (lower.includes('food') || lower.includes('cater') || lower.includes('dining')) {
        weights.catering = Math.min(0.40, weights.catering + 0.05);
        weights.venue = Math.max(0.18, weights.venue - 0.05);
      }
      if (lower.includes('music') || lower.includes('dj') || lower.includes('band')) {
        weights.entertainment = Math.min(0.20, weights.entertainment + 0.04);
        weights.decoration = Math.max(0.05, weights.decoration - 0.04);
      }
    }
  }

  // Normalize so sum is exactly 1.0
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const cat of Object.keys(weights) as BudgetCategory[]) {
    weights[cat] = Math.round((weights[cat] / total) * 100) / 100;
  }

  return weights;
}

/**
 * Generate a complete, highly contextual AI planning result deterministically
 */
export function generateDeterministicPlan(event: CelebrationEvent): AIPlanningResult {
  const weights = getCategoryWeights(event);
  const totalBudget = event.totalBudget || 5000;
  const isWedding = event.type === 'wedding';
  const isBirthday = event.type === 'birthday';
  const isCommunity = event.type === 'community';

  // Category allocations
  const recommendedCategoryAllocations: AIPlanningResult['recommendedCategoryAllocations'] = (
    Object.keys(weights) as BudgetCategory[]
  ).map((cat) => {
    const pct = Math.round(weights[cat] * 100);
    const amount = Math.round(totalBudget * weights[cat]);
    let rationale = '';
    switch (cat) {
      case 'venue':
        rationale = isCommunity
          ? 'Covers municipal park permits, outdoor pavilion rental, and staging fees.'
          : isWedding
          ? 'Secures ceremony and reception grounds, tables, and standard venue insurance.'
          : 'Covers private venue hire or reservation fee for dedicated gathering space.';
        break;
      case 'catering':
        rationale = `Allocates ~$${Math.round(amount / Math.max(1, event.guestCount))} per guest for food, beverages, and service staff.`;
        break;
      case 'decoration':
        rationale = 'Focused on focal entrance archways, floral centerpieces, and ambient lighting.';
        break;
      case 'photography':
        rationale = 'Captures candid celebration moments, formal portraits, and recap gallery delivery.';
        break;
      case 'entertainment':
        rationale = isCommunity
          ? 'Features local performers, PA sound system rental, and live acoustic sets.'
          : 'Dedicated DJ or live musicians to curate atmosphere and announcements.';
        break;
      case 'contingency':
        rationale = 'Vital safety cushion (8-10%) reserved for weather backups, extra chairs, and last-minute tips.';
        break;
      default:
        rationale = 'Carefully balanced based on guest count and logistical requirements.';
    }

    return {
      category: cat,
      percentage: pct,
      recommendedAmount: amount,
      rationale,
    };
  });

  // Overview and strategy
  let eventOverview = '';
  let planningStrategy = '';

  if (isWedding) {
    eventOverview = `${event.name} is a romantic celebration designed for ${event.guestCount} guests in a ${event.venueType} setting, operating within a budget of ${formatCurrency(totalBudget, event.currency)}. The plan emphasizes meaningful couple traditions, seamless guest hospitality, and stunning photo opportunities.`;
    planningStrategy = `Anchor the primary budget in high-touch guest experiences: exceptional seasonal dining and seamless flow between ceremony and reception. Maintain a strict 8% contingency buffer for weather logistics (${event.venueType === 'outdoor' ? 'tenting and climate fans' : 'room turnover fees'}) and prioritize locking the venue and photographer 6+ months in advance.`;
  } else if (isBirthday) {
    eventOverview = `${event.name} brings together ${event.guestCount} friends and family members for a celebratory milestone in a ${event.venueType} venue with a budget of ${formatCurrency(totalBudget, event.currency)}.`;
    planningStrategy = `Focus on high-energy engagement: memorable interactive catering or cocktail stations, curated music playlists or live performer, and photo-ready decor moments rather than expensive stationary.`;
  } else if (isCommunity) {
    eventOverview = `${event.name} is a vibrant civic gathering for ${event.guestCount} attendees, bringing neighbors together with a budget of ${formatCurrency(totalBudget, event.currency)}.`;
    planningStrategy = `Prioritize volunteer safety, clear crowd navigation, ADA accessibility ramps, municipal permits, and versatile weather shelter. Distribute stage time to feature local artists and community vendors.`;
  } else {
    eventOverview = `${event.name} is an intentional gathering for ${event.guestCount} guests with a budget of ${formatCurrency(totalBudget, event.currency)}.`;
    planningStrategy = `Balance core hospitality with personalized touches reflecting the hosts' unique values and chosen theme.`;
  }

  // Timeline phases with specific milestone tasks
  const timelinePhases: AIPlanningResult['timelinePhases'] = [
    {
      phase: 'phase_6m_plus',
      phaseTitle: '6+ Months Out (Vision & Foundation)',
      recommendedMilestones: [
        {
          title: 'Establish master budget & priority rankings',
          description: 'Lock total spending cap and allocate category percentages with your planning partner.',
          priority: 'urgent',
          daysBeforeEvent: 180,
          category: 'Budget',
        },
        {
          title: 'Tour and contract celebration venue',
          description: 'Confirm maximum capacity, sound ordinances, and mandatory vendor lists.',
          priority: 'high',
          daysBeforeEvent: 165,
          category: 'Venue',
        },
        {
          title: 'Book lead photographer and videographer',
          description: 'Review full wedding/event galleries and confirm hours of day-of coverage.',
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
          description: 'Set RSVP response deadline for 4 weeks before event date.',
          priority: 'high',
          daysBeforeEvent: 60,
          category: 'Invitations',
        },
        {
          title: 'Review floral and lighting mockups',
          description: 'Confirm focal arches, table scapes, and string/bistro ambient lighting.',
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
          description: 'Test electrical outlets, speaker placement, and rain backup layouts.',
          priority: 'high',
          daysBeforeEvent: 25,
          category: 'Venue',
        },
        {
          title: 'Finalize music playlist, cue tracks, and do-not-play list',
          description: 'Share timeline cues for entrance, toasts, and first dances.',
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
          description: 'Lock in exact plate and chair counts with 5% buffer.',
          priority: 'urgent',
          daysBeforeEvent: 14,
          category: 'Catering',
        },
        {
          title: 'Prepare vendor payment envelopes & gratuity envelopes',
          description: 'Confirm outstanding balances and distribute contact details to day-of lead.',
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
          description: 'Tide pens, sewing kit, safety pins, phone chargers, pain relief, and printed run-of-show.',
          priority: 'high',
          daysBeforeEvent: 4,
          category: 'Logistics',
        },
        {
          title: 'Send comprehensive Run-of-Show brief to all vendors',
          description: 'Specify loading dock times, parking passes, and contact phone numbers.',
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
          description: 'Ensure tables, linens, AV levels, and signage are placed 2 hours before guest arrival.',
          priority: 'urgent',
          daysBeforeEvent: 0,
          category: 'Run of Show',
        },
        {
          title: 'Guest welcome, drinks, and celebration commencement',
          description: 'Direct attendees, cue music, and begin scheduled celebration programming.',
          priority: 'high',
          daysBeforeEvent: 0,
          category: 'Run of Show',
        },
      ],
    },
  ];

  // Vendor recommendations
  const vendorRecommendations: AIPlanningResult['vendorRecommendations'] = [
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
      negotiationScript: `“We love your venue space and are comparing two final options for our date. If we book this week, would you be willing to waive the additional two-hour load-in setup fee or include existing audio equipment in the package?”`,
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
      negotiationScript: `“We want to ensure our guests have an extraordinary meal while staying within our budget of ${formatCurrency(Math.round(totalBudget * weights.catering), event.currency)}. Can we swap the second passed appetizer for an elevated seasonal entree, or adjust staff hours to align with our budget?”`,
    },
    {
      category: 'Photography / Video',
      suggestedSearchCriteria: 'Natural light documentary style with consistent portfolio in similar lighting environments.',
      keyQuestionsToAsk: [
        'Will you personally be our photographer on the day, or an associate?',
        'What is your turnaround timeframe for high-resolution gallery delivery?',
        'Do you carry professional liability insurance as required by most venues?',
      ],
      typicalCostPercentage: '8% - 12% of total budget',
      negotiationScript: `“We adore your portfolio aesthetic. If we book a 6-hour continuous coverage package instead of 8 hours, could you include the raw ceremony audio or a mini portrait session?”`,
    },
    {
      category: 'Entertainment / DJ',
      suggestedSearchCriteria: 'Experienced event MC capable of reading crowd energy without cheesy interruptions.',
      keyQuestionsToAsk: [
        'Do you provide dedicated wireless microphones for announcements and toasts?',
        'What backup equipment do you bring on-site in case of hardware malfunction?',
      ],
      typicalCostPercentage: '8% - 12% of total budget',
      negotiationScript: `“We appreciate your detailed package. We are ready to sign if you can include wireless uplighting or a separate cocktail-hour speaker setup within the base quote.”`,
    },
  ];

  // Action items
  const prioritizedActionItems: AIPlanningResult['prioritizedActionItems'] = [
    {
      action: 'Confirm and sign primary venue contract',
      urgency: 'high',
      impact: 'Secures your date and dictates seating, layout, and catering logistics.',
    },
    {
      action: 'Finalize per-person catering budget ceiling',
      urgency: 'high',
      impact: `Prevents the largest variable expense from exceeding ${formatCurrency(Math.round(totalBudget * weights.catering), event.currency)}.`,
    },
    {
      action: 'Send Save-the-Dates or community announcements',
      urgency: 'medium',
      impact: 'Maximizes attendance and allows guests to plan travel and schedules.',
    },
    {
      action: 'Establish rain and weather backup protocol',
      urgency: event.venueType === 'outdoor' ? 'high' : 'low',
      impact: 'Guarantees celebration continuity regardless of forecast.',
    },
  ];

  // Theme & decor concepts
  const themeAndDecorConcepts: AIPlanningResult['themeAndDecorConcepts'] = {
    themeTitle: event.theme || (isWedding ? 'Botanical Elegance & Warm Ivory' : isBirthday ? 'Luminous Modern Celebration' : 'Community Garden Festival'),
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

  // Food & catering
  const foodAndCateringConsiderations: AIPlanningResult['foodAndCateringConsiderations'] = {
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
      'Offer a signature his/hers cocktail plus beer and wine rather than a full open liquor bar.',
      'Opt for sheet cakes sliced in the kitchen paired with a smaller ceremonial display cake.',
      'Feature seasonal, locally harvested produce to reduce supplier freight markups.',
    ],
    presentationIdeas: [
      'Tiered wooden grazing risers with fresh figs, artisan crackers, and edible blooms.',
      'Miniature dessert shooters that allow guests to sample varieties while mingling.',
    ],
  };

  // Guest management
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

  // Risks & contingencies
  const riskAndContingency: AIPlanningResult['riskAndContingency'] = [
    {
      risk: 'Sudden rain or extreme temperatures during outdoor segments',
      severity: event.venueType === 'outdoor' ? 'high' : 'medium',
      mitigation: 'Place a 48-hour tentative hold on a clear-span tent with sidewalls and outdoor heaters/fans.',
      fallbackOption: 'Pre-plan immediate room turnover to move ceremony/activities into adjacent covered pavilion.',
    },
    {
      risk: 'Primary catering or beverage supplier delivery delay',
      severity: 'medium',
      mitigation: 'Require deliveries to arrive 3 hours before guest doors open.',
      fallbackOption: 'Keep local backup bakery and beverage distributor on speed-dial with corporate account.',
    },
    {
      risk: 'Audio microphone feedback or AV failure during key speeches',
      severity: 'medium',
      mitigation: 'Test all wireless frequencies and pack redundant XLR cables and wired dynamic microphones.',
      fallbackOption: 'Compact portable battery-powered PA speaker on standby near coordinator table.',
    },
    {
      risk: 'Guest count exceeds RSVP confirmations by 10%+',
      severity: 'low',
      mitigation: 'Contract venue and catering with standard 5% plate and chair buffer.',
      fallbackOption: 'Venue keeps 2 folded banquet tables and folding chairs pre-staged in storage.',
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
 * Creates seed budget items from an AI plan or defaults
 */
export function createSeedBudgetItems(event: CelebrationEvent, plan?: AIPlanningResult): BudgetItem[] {
  const result: BudgetItem[] = [];
  const allocations = plan?.recommendedCategoryAllocations || [];

  if (allocations.length > 0) {
    for (const alloc of allocations) {
      result.push({
        id: `budget-${event.id}-${alloc.category}-main`,
        eventId: event.id,
        category: alloc.category,
        name: `Primary ${alloc.category.charAt(0).toUpperCase() + alloc.category.slice(1)} Contract`,
        plannedAmount: alloc.recommendedAmount,
        actualAmount: Math.round(alloc.recommendedAmount * 0.4), // Partial actual for realistic start
        paidStatus: 'deposit_paid',
        notes: alloc.rationale,
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    const weights = getCategoryWeights(event);
    for (const cat of Object.keys(weights) as BudgetCategory[]) {
      const amount = Math.round(event.totalBudget * weights[cat]);
      result.push({
        id: `budget-${event.id}-${cat}-init`,
        eventId: event.id,
        category: cat,
        name: `Estimated ${cat.charAt(0).toUpperCase() + cat.slice(1)} Allocation`,
        plannedAmount: amount,
        actualAmount: 0,
        paidStatus: 'unpaid',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return result;
}

/**
 * Creates seed timeline tasks from an AI plan
 */
export function createSeedTimelineTasks(event: CelebrationEvent, plan?: AIPlanningResult): TimelineTask[] {
  const tasks: TimelineTask[] = [];
  const phases = plan?.timelinePhases || [];

  let idx = 0;
  for (const p of phases) {
    for (const m of p.recommendedMilestones) {
      idx++;
      tasks.push({
        id: `task-${event.id}-${idx}`,
        eventId: event.id,
        title: m.title,
        description: m.description,
        phase: p.phase,
        dueDate: offsetDate(event.date, m.daysBeforeEvent),
        priority: m.priority,
        completed: idx <= 2, // First two completed for realistic state
        category: m.category,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return tasks;
}

/**
 * Creates seed vendor entries from an AI plan
 */
export function createSeedVendors(event: CelebrationEvent, plan?: AIPlanningResult): VendorEntry[] {
  const vendors: VendorEntry[] = [];
  const recs = plan?.vendorRecommendations || [];

  let idx = 0;
  for (const v of recs) {
    idx++;
    vendors.push({
      id: `vendor-${event.id}-${idx}`,
      eventId: event.id,
      category: v.category,
      name: `${v.category} Partner Co.`,
      contactPerson: 'Lead Coordinator',
      email: `hello@${v.category.toLowerCase().replace(/[^a-z]/g, '')}partner.com`,
      phone: '(555) 234-5678',
      status: idx === 1 ? 'booked' : idx === 2 ? 'quoted' : 'inquired',
      quotedPrice: Math.round(event.totalBudget * 0.15),
      contractPrice: idx === 1 ? Math.round(event.totalBudget * 0.14) : undefined,
      notes: v.suggestedSearchCriteria,
      negotiationTips: v.keyQuestionsToAsk,
      createdAt: new Date().toISOString(),
    });
  }

  return vendors;
}
