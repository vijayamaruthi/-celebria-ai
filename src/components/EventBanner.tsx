/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useEventContext } from '../context/EventContext';
import { ChevronDown, Calendar, Users, MapPin, DollarSign, Check, Trash2, Edit2 } from 'lucide-react';
import { formatCurrency } from '../utils/deterministicPlanner';

interface EventBannerProps {
  onEditEvent: () => void;
}

export const EventBanner: React.FC<EventBannerProps> = ({ onEditEvent }) => {
  const { activeEvent, events, setActiveEventId, deleteEvent } = useEventContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!activeEvent) return null;

  // Calculate days remaining
  const calculateDaysRemaining = (dateStr: string): { days: number; isPast: boolean } => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(dateStr);
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { days: Math.abs(diffDays), isPast: diffDays < 0 };
    } catch {
      return { days: 0, isPast: false };
    }
  };

  const { days, isPast } = calculateDaysRemaining(activeEvent.date);

  const formattedType = activeEvent.type.charAt(0).toUpperCase() + activeEvent.type.slice(1);

  return (
    <div className="bg-white border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: Event switcher and title */}
          <div className="relative">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="group flex items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-lg p-1 -m-1"
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
                aria-label="Switch celebration event"
              >
                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight group-hover:text-indigo-950 transition-colors">
                  {activeEvent.name}
                </h1>
                <ChevronDown className="w-5 h-5 text-stone-400 group-hover:text-stone-700 transition-colors" />
              </button>

              <button
                onClick={onEditEvent}
                title="Edit Event Details"
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                aria-label="Edit event details"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            {/* Unboxed clean metadata with typographic separators */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-stone-600 mt-1.5">
              <span className="font-semibold text-indigo-900">{formattedType}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>{activeEvent.date}</span>
              </span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                <span className="tabular-nums font-mono">{activeEvent.guestCount}</span> guests
              </span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                <span className="truncate max-w-[200px]">{activeEvent.location || 'Location TBD'}</span>
              </span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-stone-800">
                <DollarSign className="w-3.5 h-3.5 text-stone-400" />
                <span className="tabular-nums font-mono">
                  {formatCurrency(activeEvent.totalBudget, activeEvent.currency)}
                </span>
              </span>
            </div>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div
                  role="listbox"
                  className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-stone-200 z-50 py-2 divide-y divide-stone-100"
                >
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Your Celebrations ({events.length})
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {events.map((ev) => {
                      const isCurrent = ev.id === activeEvent.id;
                      return (
                        <div
                          key={ev.id}
                          className={`flex items-center justify-between px-3 py-2.5 hover:bg-stone-50 transition-colors ${
                            isCurrent ? 'bg-indigo-50/60' : ''
                          }`}
                        >
                          <button
                            onClick={() => {
                              setActiveEventId(ev.id);
                              setDropdownOpen(false);
                            }}
                            className="flex-1 text-left min-w-0 pr-2"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-semibold truncate ${
                                  isCurrent ? 'text-indigo-950 font-bold' : 'text-stone-800'
                                }`}
                              >
                                {ev.name}
                              </span>
                              {isCurrent && <Check className="w-4 h-4 text-indigo-700 shrink-0" />}
                            </div>
                            <div className="text-xs text-stone-500 mt-0.5 truncate">
                              {ev.type} · {ev.date} · {ev.guestCount} guests
                            </div>
                          </button>

                          {events.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete "${ev.name}"?`)) {
                                  deleteEvent(ev.id);
                                }
                              }}
                              className="p-1 text-stone-400 hover:text-rose-600 rounded-md transition-colors"
                              title="Delete event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Days countdown chip */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2 bg-stone-100 rounded-lg border border-stone-200 text-stone-900 flex items-center gap-2.5">
              <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-indigo-950">
                {days}
              </span>
              <span className="text-xs leading-tight text-stone-600 uppercase font-semibold tracking-wider">
                {isPast ? 'Days Ago' : 'Days Until'}<br />Celebration
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
