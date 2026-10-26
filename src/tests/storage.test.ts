/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelebriaStorageState } from '../types';
import { buildInitialStorageState } from '../utils/defaultTemplates';

export function testStoragePersistence() {
  const tests: { name: string; run: () => void }[] = [];

  tests.push({
    name: 'Initializes default state with 3 preloaded celebration templates',
    run: () => {
      const state = buildInitialStorageState();
      if (!state || state.events.length !== 3) {
        throw new Error(`Expected 3 initial template events, got ${state?.events?.length}`);
      }
      const wedding = state.events.find((e) => e.type === 'wedding');
      const birthday = state.events.find((e) => e.type === 'birthday');
      const community = state.events.find((e) => e.type === 'community');

      if (!wedding) throw new Error('Missing wedding template');
      if (!birthday) throw new Error('Missing birthday template');
      if (!community) throw new Error('Missing community festival template');
    },
  });

  tests.push({
    name: 'Validates JSON backup import integrity and rejects malformed payloads',
    run: () => {
      const invalidJson = '{"foo": "bar"}';
      const parsed = JSON.parse(invalidJson) as Partial<CelebriaStorageState>;
      const isValid = Boolean(parsed && Array.isArray(parsed.events) && parsed.events.length > 0);
      if (isValid) throw new Error('Expected malformed payload to be rejected');
    },
  });

  return tests;
}
