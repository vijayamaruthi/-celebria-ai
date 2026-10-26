/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelebrationEvent } from '../types';
import { generateDeterministicPlan, getCategoryWeights } from '../utils/deterministicPlanner';

export function testAIPlanner() {
  const tests: { name: string; run: () => void }[] = [];

  tests.push({
    name: 'Deterministic heuristic engine generates all 10 required celebration dimensions',
    run: () => {
      const event: CelebrationEvent = {
        id: 'test-1',
        name: 'Grand Garden Wedding',
        type: 'wedding',
        date: '2027-06-15',
        guestCount: 150,
        totalBudget: 35000,
        currency: 'USD',
        location: 'Estate Gardens',
        venueType: 'outdoor',
        theme: 'Botanical Luxury',
        priorities: ['Photography & Video', 'Catering'],
        dietaryRequirements: ['Vegetarian', 'Gluten-Free'],
        accessibilityNeeds: ['Wheelchair Ramps'],
        notes: '',
        createdAt: '',
        updatedAt: '',
      };

      const plan = generateDeterministicPlan(event);

      if (!plan.eventOverview) throw new Error('Missing dimension 1: eventOverview');
      if (!plan.planningStrategy) throw new Error('Missing dimension 2: planningStrategy');
      if (!plan.recommendedCategoryAllocations || plan.recommendedCategoryAllocations.length === 0)
        throw new Error('Missing dimension 3: categoryAllocations');
      if (!plan.timelinePhases || plan.timelinePhases.length === 0)
        throw new Error('Missing dimension 4: timelinePhases');
      if (!plan.vendorRecommendations || plan.vendorRecommendations.length === 0)
        throw new Error('Missing dimension 5: vendorRecommendations');
      if (!plan.prioritizedActionItems || plan.prioritizedActionItems.length === 0)
        throw new Error('Missing dimension 6: prioritizedActionItems');
      if (!plan.themeAndDecorConcepts || !plan.themeAndDecorConcepts.colorPalette)
        throw new Error('Missing dimension 7: themeAndDecorConcepts');
      if (!plan.foodAndCateringConsiderations || !plan.foodAndCateringConsiderations.dietaryAccommodations)
        throw new Error('Missing dimension 8: foodAndCateringConsiderations');
      if (!plan.guestManagement || !plan.guestManagement.rsvpMilestones)
        throw new Error('Missing dimension 9: guestManagement');
      if (!plan.riskAndContingency || plan.riskAndContingency.length === 0)
        throw new Error('Missing dimension 10: riskAndContingency');
    },
  });

  tests.push({
    name: 'Adapts budget weights dynamically based on wedding vs birthday vs community event',
    run: () => {
      const weddingEvent: CelebrationEvent = {
        id: 'w1',
        name: 'Wedding',
        type: 'wedding',
        date: '2027-01-01',
        guestCount: 100,
        totalBudget: 20000,
        currency: 'USD',
        location: '',
        venueType: 'indoor',
        theme: '',
        priorities: [],
        dietaryRequirements: [],
        accessibilityNeeds: [],
        notes: '',
        createdAt: '',
        updatedAt: '',
      };

      const communityEvent: CelebrationEvent = {
        id: 'c1',
        name: 'Festival',
        type: 'community',
        date: '2027-01-01',
        guestCount: 500,
        totalBudget: 15000,
        currency: 'USD',
        location: '',
        venueType: 'outdoor',
        theme: '',
        priorities: [],
        dietaryRequirements: [],
        accessibilityNeeds: [],
        notes: '',
        createdAt: '',
        updatedAt: '',
      };

      const weddingWeights = getCategoryWeights(weddingEvent);
      const communityWeights = getCategoryWeights(communityEvent);

      // Wedding photography should have higher allocation than community photography
      if (weddingWeights.photography <= communityWeights.photography) {
        throw new Error('Wedding photography allocation should exceed community event photography');
      }
      // Community entertainment/staging should have higher weight than wedding entertainment
      if (communityWeights.entertainment <= weddingWeights.entertainment) {
        throw new Error('Community entertainment allocation should exceed wedding entertainment');
      }
    },
  });

  return tests;
}
