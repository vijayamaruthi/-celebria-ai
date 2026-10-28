/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { testBudgetCalculations } from './budget.test';
import { testEventValidation } from './event.test';
import { testTimelineLogic } from './timeline.test';
import { testVendorPipeline } from './vendor.test';
import { testAIPlanner } from './aiPlanner.test';
import { testStoragePersistence } from './storage.test';
import { testGeminiBackend } from './geminiBackend.test';

console.log('====================================================');
console.log(' Celebria AI Automated Verification & Test Suite');
console.log('====================================================\n');

interface TestDef {
  name: string;
  run: () => void | Promise<void>;
}

const suites: { suiteName: string; tests: TestDef[] }[] = [
  { suiteName: 'Budget Calculations & Variance Logic', tests: testBudgetCalculations() },
  { suiteName: 'Event Creation & Validation Constraints', tests: testEventValidation() },
  { suiteName: 'Timeline Milestones & Overdue Logic', tests: testTimelineLogic() },
  { suiteName: 'Vendor Pipeline & Quote Reconciliation', tests: testVendorPipeline() },
  { suiteName: 'GenAI Strategy & Contextual Adaptation', tests: testAIPlanner() },
  { suiteName: 'Gemini Retries, Fallback & Budget Accuracy', tests: testGeminiBackend() },
  { suiteName: 'State Persistence & JSON Backup Integrity', tests: testStoragePersistence() },
];

let totalCount = 0;
let passedCount = 0;
let failedCount = 0;

async function runTests() {
  for (const suite of suites) {
    console.log(`▶ Test Suite: ${suite.suiteName}`);
    for (const test of suite.tests) {
      totalCount++;
      try {
        await test.run();
        console.log(`  ✓ PASS: ${test.name}`);
        passedCount++;
      } catch (err: unknown) {
        console.error(`  ✗ FAIL: ${test.name}`);
        console.error(`    Error: ${err instanceof Error ? err.message : String(err)}`);
        failedCount++;
      }
    }
    console.log('');
  }

  console.log('----------------------------------------------------');
  console.log(`Summary: ${passedCount}/${totalCount} tests passed (${failedCount} failed)`);
  console.log('----------------------------------------------------');

  if (failedCount > 0) {
    process.exitCode = 1;
  } else {
    console.log('All automated tests executed and verified successfully! 🎉\n');
  }
}

await runTests();
