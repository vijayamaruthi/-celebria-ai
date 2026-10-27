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
  tests.push({
    name: 'Budget weights total exactly 1.00 for all celebration types and priorities',
    run: () => {
      const eventTypes: CelebrationEvent['type'][] = [
        'wedding',
        'birthday',
        'community',
      ];

      for (const type of eventTypes) {
        const event: CelebrationEvent = {
          id: `weight-test-${type}`,
          name: `${type} Test`,
          type,
          date: '2027-06-15',
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

        const weights = getCategoryWeights(event);
        const total = Object.values(weights).reduce(
          (sum, weight) => sum + weight,
          0
        );

        if (Math.abs(total - 1) > 1e-9) {
          throw new Error(
            `${type} budget weights should total 1.00, but got ${total}`
          );
        }

        for (const [category, weight] of Object.entries(weights)) {
          if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
            throw new Error(
              `Invalid weight for ${type} category ${category}: ${weight}`
            );
          }
        }

        event.priorities = [
          'Photography & Video',
          'Catering',
          'Music and Entertainment',
        ];

        const priorityWeights = getCategoryWeights(event);
        const priorityTotal = Object.values(priorityWeights).reduce(
          (sum, weight) => sum + weight,
          0
        );

        if (Math.abs(priorityTotal - 1) > 1e-9) {
          throw new Error(
            `${type} weights with priorities should total 1.00, but got ${priorityTotal}`
          );
        }
      }
    },
  });
  tests.push({
    name: 'Recommended category allocations exactly match the total budget',
    run: () => {
      const budgets = [10003, 25001, 99999];

      for (const budget of budgets) {
        const event: CelebrationEvent = {
          id: `budget-test-${budget}`,
          name: 'Budget Allocation Test',
          type: 'wedding',
          date: '2027-06-15',
          guestCount: 100,
          totalBudget: budget,
          currency: 'USD',
          location: 'Test Location',
          venueType: 'indoor',
          theme: '',
          priorities: [],
          dietaryRequirements: [],
          accessibilityNeeds: [],
          notes: '',
          createdAt: '',
          updatedAt: '',
        };

        const plan = generateDeterministicPlan(event);

        const allocatedTotal =
          plan.recommendedCategoryAllocations.reduce(
            (sum, allocation) => sum + allocation.recommendedAmount,
            0
          );

        if (allocatedTotal !== budget) {
          throw new Error(
            `Budget ${budget}: allocated ${allocatedTotal} instead of ${budget}`
          );
        }
      }
    },
  });
  return tests;
}
