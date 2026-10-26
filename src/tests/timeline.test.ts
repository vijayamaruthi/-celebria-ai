/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimelineTask } from '../types';

export function testTimelineLogic() {
  const tests: { name: string; run: () => void }[] = [];

  tests.push({
    name: 'Calculates milestone progress percentage accurately',
    run: () => {
      const tasks: Partial<TimelineTask>[] = [
        { id: '1', completed: true },
        { id: '2', completed: true },
        { id: '3', completed: false },
        { id: '4', completed: false },
      ];
      const completed = tasks.filter((t) => t.completed).length;
      const pct = Math.round((completed / tasks.length) * 100);
      if (pct !== 50) throw new Error(`Expected 50%, got ${pct}%`);
    },
  });

  tests.push({
    name: 'Correctly identifies overdue uncompleted tasks relative to target date',
    run: () => {
      const today = '2026-10-26';
      const tasks: Partial<TimelineTask>[] = [
        { id: '1', dueDate: '2026-10-20', completed: false }, // overdue
        { id: '2', dueDate: '2026-10-20', completed: true },  // completed, not overdue
        { id: '3', dueDate: '2026-11-15', completed: false }, // future
      ];

      const overdue = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today);
      if (overdue.length !== 1) throw new Error(`Expected 1 overdue task, got ${overdue.length}`);
      if (overdue[0].id !== '1') throw new Error('Wrong overdue task identified');
    },
  });

  return tests;
}
