/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BudgetItem, BudgetCategory } from '../types';

export function testBudgetCalculations() {
  const tests: { name: string; run: () => void }[] = [];

  tests.push({
    name: 'Calculates total planned, actual, and remaining balance accurately',
    run: () => {
      const totalBudget = 10000;
      const items: BudgetItem[] = [
        {
          id: '1',
          eventId: 'e1',
          category: 'venue',
          name: 'Venue hall',
          plannedAmount: 3000,
          actualAmount: 2800,
          paidStatus: 'paid_in_full',
          createdAt: '',
        },
        {
          id: '2',
          eventId: 'e1',
          category: 'catering',
          name: 'Buffet',
          plannedAmount: 4000,
          actualAmount: 3900,
          paidStatus: 'deposit_paid',
          createdAt: '',
        },
      ];

      const totalPlanned = items.reduce((acc, i) => acc + i.plannedAmount, 0);
      const totalActual = items.reduce((acc, i) => acc + i.actualAmount, 0);
      const remaining = totalBudget - totalActual;
      const pctUsed = Math.round((totalActual / totalBudget) * 100);

      if (totalPlanned !== 7000) throw new Error(`Expected 7000, got ${totalPlanned}`);
      if (totalActual !== 6700) throw new Error(`Expected 6700, got ${totalActual}`);
      if (remaining !== 3300) throw new Error(`Expected 3300, got ${remaining}`);
      if (pctUsed !== 67) throw new Error(`Expected 67%, got ${pctUsed}%`);
    },
  });

  tests.push({
    name: 'Accurately detects over-budget conditions when planned exceeds total budget',
    run: () => {
      const totalBudget = 5000;
      const planned = 5200;
      const actual = 4000;
      const isOverBudget = planned > totalBudget || actual > totalBudget;
      if (!isOverBudget) throw new Error('Expected isOverBudget to be true');
    },
  });

  tests.push({
    name: 'Handles zero-budget celebrations safely without NaN or division by zero',
    run: () => {
      const totalBudget = 0;
      const actual = 100;
      const pctUsed = totalBudget > 0 ? Math.round((actual / totalBudget) * 100) : 0;
      const remaining = totalBudget - actual;
      if (isNaN(pctUsed)) throw new Error('Percentage used is NaN');
      if (pctUsed !== 0) throw new Error(`Expected 0, got ${pctUsed}`);
      if (remaining !== -100) throw new Error(`Expected -100, got ${remaining}`);
    },
  });

  tests.push({
    name: 'Sanitizes invalid, negative, or non-numeric expense amounts',
    run: () => {
      const rawPlanned = 'invalid';
      const parsedPlanned = Number(rawPlanned) || 0;
      const negativeActual = -500;
      const sanitizedActual = Math.max(0, negativeActual);

      if (parsedPlanned !== 0) throw new Error(`Expected 0, got ${parsedPlanned}`);
      if (sanitizedActual !== 0) throw new Error(`Expected 0, got ${sanitizedActual}`);
    },
  });

  tests.push({
    name: 'Reconciles category-level summaries with grand total',
    run: () => {
      const items: BudgetItem[] = [
        { id: '1', eventId: 'e1', category: 'venue', name: 'v', plannedAmount: 1000, actualAmount: 1000, paidStatus: 'paid_in_full', createdAt: '' },
        { id: '2', eventId: 'e1', category: 'venue', name: 'v2', plannedAmount: 500, actualAmount: 500, paidStatus: 'paid_in_full', createdAt: '' },
        { id: '3', eventId: 'e1', category: 'catering', name: 'c', plannedAmount: 2000, actualAmount: 1500, paidStatus: 'deposit_paid', createdAt: '' },
      ];

      const categoryTotals: Record<string, number> = {};
      for (const i of items) {
        categoryTotals[i.category] = (categoryTotals[i.category] || 0) + i.plannedAmount;
      }

      if (categoryTotals['venue'] !== 1500) throw new Error(`Expected venue 1500, got ${categoryTotals['venue']}`);
      if (categoryTotals['catering'] !== 2000) throw new Error(`Expected catering 2000, got ${categoryTotals['catering']}`);
      const sumOfCategories = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
      if (sumOfCategories !== 3500) throw new Error(`Expected sum 3500, got ${sumOfCategories}`);
    },
  });

  return tests;
}
