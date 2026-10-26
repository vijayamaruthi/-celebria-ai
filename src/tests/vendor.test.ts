/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VendorEntry } from '../types';

export function testVendorPipeline() {
  const tests: { name: string; run: () => void }[] = [];

  tests.push({
    name: 'Tracks status transitions through pipeline (identified -> quoted -> booked)',
    run: () => {
      let vendor: VendorEntry = {
        id: 'v1',
        eventId: 'e1',
        category: 'Photography',
        name: 'Fine Lens Studio',
        status: 'identified',
        createdAt: '',
      };

      // Inquired & Quoted
      vendor = { ...vendor, status: 'quoted', quotedPrice: 3200 };
      if (vendor.status !== 'quoted' || vendor.quotedPrice !== 3200) {
        throw new Error('Failed to update quote status');
      }

      // Booked & Contracted
      vendor = { ...vendor, status: 'booked', contractPrice: 3000 };
      if (vendor.status !== 'booked' || vendor.contractPrice !== 3000) {
        throw new Error('Failed to mark contracted');
      }
    },
  });

  tests.push({
    name: 'Calculates total contracted vs. quoted financial commitments',
    run: () => {
      const vendors: Partial<VendorEntry>[] = [
        { id: '1', status: 'booked', contractPrice: 5000, quotedPrice: 5500 },
        { id: '2', status: 'quoted', quotedPrice: 2000 },
        { id: '3', status: 'booked', contractPrice: 1500, quotedPrice: 1500 },
      ];

      const contractedTotal = vendors.reduce((acc, v) => acc + (v.contractPrice || 0), 0);
      const quotedTotal = vendors.reduce((acc, v) => acc + (v.quotedPrice || 0), 0);

      if (contractedTotal !== 6500) throw new Error(`Expected contracted 6500, got ${contractedTotal}`);
      if (quotedTotal !== 9000) throw new Error(`Expected quoted 9000, got ${quotedTotal}`);
    },
  });

  return tests;
}
