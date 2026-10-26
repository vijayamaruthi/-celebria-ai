/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Plus } from 'lucide-react';

export type ActiveTab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'planner' | 'export';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewEvent: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewEvent,
}) => {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'budget', label: 'Budget Planner' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'vendors', label: 'Vendors' },
    { id: 'planner', label: 'AI Planning Assistant' },
    { id: 'export', label: 'Run of Show & Export' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text wordmark with subtle brand icon */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-900 text-amber-300 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </div>
            <a
              href="#overview"
              onClick={(e) => {
                e.preventDefault();
                onSelectTab('overview');
              }}
              className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-sm"
            >
              Celebria AI
            </a>
          </div>

          {/* Zone 2: 4-6 clean single-line text navigation links */}
          <nav
            className="hidden md:flex items-center gap-1 sm:gap-2 text-sm font-medium text-stone-600"
            aria-label="Main Navigation"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 text-sm font-medium ${
                    isActive
                      ? 'bg-stone-200/80 text-stone-900 font-semibold'
                      : 'hover:text-stone-900 hover:bg-stone-100'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenNewEvent}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create Event</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation tab strip */}
      <div className="md:hidden border-t border-stone-200 px-4 py-2 overflow-x-auto flex items-center gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
              activeTab === item.id
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 bg-stone-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
