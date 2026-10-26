/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EventProvider, useEventContext } from './context/EventContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { EventBanner } from './components/EventBanner';
import { NewEventModal } from './components/NewEventModal';
import { OverviewDashboard } from './components/OverviewDashboard';
import { BudgetManager } from './components/BudgetManager';
import { TimelineManager } from './components/TimelineManager';
import { VendorManager } from './components/VendorManager';
import { AIPlannerHub } from './components/AIPlannerHub';
import { RunOfShowExport } from './components/RunOfShowExport';
import { CelebrationEvent } from './types';

const MainAppContent: React.FC = () => {
  const { activeEvent } = useEventContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CelebrationEvent | null>(null);

  const handleOpenNewEvent = () => {
    setEventToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditEvent = () => {
    setEventToEdit(activeEvent);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-900 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewEvent={handleOpenNewEvent}
      />

      {/* Active Event Context Banner */}
      <EventBanner onEditEvent={handleOpenEditEvent} />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'overview' && (
          <OverviewDashboard onNavigateTab={setActiveTab} />
        )}
        {activeTab === 'budget' && <BudgetManager />}
        {activeTab === 'timeline' && <TimelineManager />}
        {activeTab === 'vendors' && <VendorManager />}
        {activeTab === 'planner' && <AIPlannerHub />}
        {activeTab === 'export' && <RunOfShowExport />}
      </main>

      {/* Guided Event Modal (Creation & Editing) */}
      <NewEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventToEdit={eventToEdit}
      />

      {/* Footer */}
      <footer className="no-print border-t border-stone-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div>
            <span className="font-semibold text-stone-800">Celebria AI</span> — “Your vision. Your budget. Your perfect celebration.”
          </div>
          <div className="flex items-center gap-4 text-stone-400">
            <span>Weddings</span>
            <span aria-hidden="true">·</span>
            <span>Birthdays</span>
            <span aria-hidden="true">·</span>
            <span>Community Events</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <EventProvider>
      <MainAppContent />
    </EventProvider>
  );
}
