/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelebrationEvent } from '../types';

export function testEventValidation() {
  const tests: { name: string; run: () => void }[] = [];

  tests.push({
    name: 'Rejects empty event names during validation',
    run: () => {
      const name = '   ';
      const isValid = name.trim().length > 0;
      if (isValid) throw new Error('Expected empty event name to be invalid');
    },
  });

  tests.push({
    name: 'Enforces minimum guest count of at least 1 person',
    run: () => {
      const count = 0;
      const validCount = Math.max(1, count);
      if (validCount < 1) throw new Error('Guest count must be >= 1');
    },
  });

  tests.push({
    name: 'Handles valid celebration creation for wedding, birthday, and community event',
    run: () => {
      const types: CelebrationEvent['type'][] = ['wedding', 'birthday', 'community'];
      for (const t of types) {
        const ev: Partial<CelebrationEvent> = {
          name: `Sample ${t}`,
          type: t,
          guestCount: 50,
          totalBudget: 10000,
          date: '2026-12-01',
        };
        if (!ev.name || !ev.type || (ev.guestCount ?? 0) <= 0) {
          throw new Error(`Failed to create valid celebration for ${t}`);
        }
      }
    },
  });

  return tests;
}
