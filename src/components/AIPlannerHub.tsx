/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useEventContext } from '../context/EventContext';
import {
  generateCelebrationPlan,
  generateFocusedIdeas,
} from '../services/geminiService';
import {
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  Palette,
  Utensils,
  Users,
  DollarSign,
  Calendar,
  Send,
  Download,
  Info,
} from 'lucide-react';
import { formatCurrency } from '../utils/deterministicPlanner';

export const AIPlannerHub: React.FC = () => {
  const { activeEvent, activePlan, saveAIPlan, applyPlanToWorkspace } = useEventContext();

  const [isLoading, setIsLoading] = useState(false);
  const [activePlanTab, setActivePlanTab] = useState<
    'strategy' | 'budget' | 'timeline' | 'vendors' | 'theme' | 'catering' | 'guests' | 'risks'
  >('strategy');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Custom creative ideas prompt state
  const [ideasPrompt, setIdeasPrompt] = useState('');
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [customIdeas, setCustomIdeas] = useState<{ title: string; ideas: string[]; source: string } | null>(null);

  if (!activeEvent) return null;

  const handleGeneratePlan = async (forceDeterministic: boolean = false) => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const plan = await generateCelebrationPlan(activeEvent, { forceDeterministic });
      saveAIPlan(plan);
      setStatusMessage(
        plan.isFallback
          ? 'Generated plan using Celebria Heuristic Engine.'
          : 'Successfully generated personalized strategy using Gemini 3.8 Flash!'
      );
    } catch {
      setStatusMessage('Unable to complete request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToWorkspace = () => {
    if (!activePlan) return;
    if (
      confirm(
        'Apply this AI plan to your active workspace? This will populate the Budget, Timeline, and Vendors with recommended milestones and allocations.'
      )
    ) {
      applyPlanToWorkspace(activePlan);
      alert('AI plan applied to active workspace!');
    }
  };

  const handleAskCreativeIdeas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideasPrompt.trim()) return;

    setIdeasLoading(true);
    try {
      const result = await generateFocusedIdeas(activeEvent, ideasPrompt.trim());
      setCustomIdeas(result);
    } catch {
      // Handled in service fallback
    } finally {
      setIdeasLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-950 text-amber-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              AI Celebration Strategy & Architecture
            </h2>
          </div>
          <p className="text-xs text-stone-600 mt-1 max-w-2xl">
            Generates 10 dimensional recommendations for budgets, chronological timelines, vendor questions, aesthetic themes, and contingency plans tailored to {activeEvent.guestCount} guests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activePlan && (
            <button
              onClick={handleApplyToWorkspace}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Apply to Workspace</span>
            </button>
          )}

          <button
            onClick={() => handleGeneratePlan(false)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Synthesizing Plan...' : 'Generate with Gemini 3.8'}</span>
          </button>
        </div>
      </div>

      {/* Model & Source Transparency Status Bar */}
      {activePlan && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            activePlan.isFallback
              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
              : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
          }`}
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              <strong>Active Engine:</strong> {activePlan.modelUsed} · Generated at{' '}
              {new Date(activePlan.generatedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activePlan.isFallback && (
              <span className="text-2xs italic text-amber-800">
                (Real-time Gemini service unavailable; using deterministic planning engine)
              </span>
            )}
            <button
              onClick={() => handleGeneratePlan(true)}
              className="underline text-stone-700 hover:text-stone-900 text-2xs"
            >
              Force Heuristic Mode
            </button>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="p-3 bg-stone-100 rounded-lg text-xs text-stone-800 border border-stone-200">
          {statusMessage}
        </div>
      )}

      {/* Navigation Tabs for the 10 Dimensions */}
      {activePlan && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="border-b border-stone-200 px-4 py-2 bg-stone-50/80 flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActivePlanTab('strategy')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlanTab === 'strategy'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Overview & Strategy
            </button>
            <button
              onClick={() => setActivePlanTab('budget')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlanTab === 'budget'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Budget Allocation
            </button>
            <button
              onClick={() => setActivePlanTab('timeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlanTab === 'timeline'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Preparation Timeline
            </button>
            <button
              onClick={() => setActivePlanTab('vendors')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlanTab === 'vendors'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Vendor Negotiation
            </button>
            <button
              onClick={() => setActivePlanTab('theme')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlanTab === 'theme'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Theme & Decor
            </button>
            <button
              onClick={() => setActivePlanTab('catering')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlanTab === 'catering'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Food & Dietary
            </button>
            <button
              onClick={() => setActivePlanTab('guests')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlanTab === 'guests'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Guest & Inclusivity
            </button>
            <button
              onClick={() => setActivePlanTab('risks')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlanTab === 'risks'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Contingency & Risks
            </button>
          </div>

          <div className="p-6">
            {/* TAB 1: OVERVIEW & STRATEGY */}
            {activePlanTab === 'strategy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Executive Celebration Summary
                  </h3>
                  <p className="text-sm text-stone-800 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-200/80">
                    {activePlan.eventOverview}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Strategic Planning Guidance
                  </h3>
                  <p className="text-sm text-stone-800 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-200/80">
                    {activePlan.planningStrategy}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-3">
                    Top Priority Action Items
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activePlan.prioritizedActionItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg border border-stone-200 bg-white shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-stone-900">{item.action}</span>
                          <span
                            className={`text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-xs ${
                              item.urgency === 'high'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {item.urgency}
                          </span>
                        </div>
                        <p className="text-2xs text-stone-600 mt-1.5">{item.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BUDGET ALLOCATION */}
            {activePlanTab === 'budget' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Recommended Category Spending Allocations
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Calibrated specifically for {activeEvent.guestCount} guests within{' '}
                    {formatCurrency(activeEvent.totalBudget, activeEvent.currency)}.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {activePlan.recommendedCategoryAllocations.map((alloc) => (
                    <div
                      key={alloc.category}
                      className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-stone-800">
                          {alloc.category}
                        </span>
                        <span className="text-xs font-mono font-bold text-indigo-950">
                          {alloc.percentage}% ({formatCurrency(alloc.recommendedAmount, activeEvent.currency)})
                        </span>
                      </div>
                      <p className="text-2xs text-stone-600 mt-2 leading-relaxed">
                        {alloc.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: TIMELINE */}
            {activePlanTab === 'timeline' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Chronological Preparation Roadmap
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Organized across preparation phases counting down to celebration day
                  </p>
                </div>

                <div className="space-y-4">
                  {activePlan.timelinePhases.map((phase) => (
                    <div key={phase.phase} className="border border-stone-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-stone-100/70 border-b border-stone-200 text-xs font-bold text-stone-800">
                        {phase.phaseTitle}
                      </div>
                      <div className="p-4 space-y-2 bg-white divide-y divide-stone-100">
                        {phase.recommendedMilestones.map((m, idx) => (
                          <div key={idx} className="pt-2 first:pt-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-semibold text-stone-900">
                                {m.title}
                              </span>
                              <span className="text-2xs font-mono text-stone-400 shrink-0">
                                {m.daysBeforeEvent > 0
                                  ? `${m.daysBeforeEvent}d before`
                                  : 'Day-of Event'}
                              </span>
                            </div>
                            <p className="text-2xs text-stone-600 mt-0.5">{m.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: VENDORS */}
            {activePlanTab === 'vendors' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Vendor Search Criteria & Negotiation Scripts
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Strategic questions to ask before signing supplier contracts
                  </p>
                </div>

                <div className="space-y-4">
                  {activePlan.vendorRecommendations.map((v, idx) => (
                    <div key={idx} className="p-5 rounded-xl border border-stone-200 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                          {v.category}
                        </h4>
                        <span className="text-2xs font-mono text-stone-500">
                          Typical Budget Share: {v.typicalCostPercentage}
                        </span>
                      </div>

                      <p className="text-xs text-stone-700">
                        <strong className="text-stone-900">Search Strategy: </strong>
                        {v.suggestedSearchCriteria}
                      </p>

                      <div>
                        <span className="text-2xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                          Key Questions to Ask:
                        </span>
                        <ul className="list-disc pl-4 text-xs text-stone-600 space-y-1">
                          {v.keyQuestionsToAsk.map((q, qIdx) => (
                            <li key={qIdx}>{q}</li>
                          ))}
                        </ul>
                      </div>

                      {v.negotiationScript && (
                        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200/80 text-xs italic text-stone-700">
                          <strong className="not-italic text-stone-900 block mb-0.5">
                            Negotiation Script:
                          </strong>
                          {v.negotiationScript}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: THEME & DECOR */}
            {activePlanTab === 'theme' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Aesthetic Concept: {activePlan.themeAndDecorConcepts.themeTitle}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Harmonized palette and sensory decor elements
                  </p>
                </div>

                {/* Color Palette */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-2">
                    Harmonized Color Palette
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {activePlan.themeAndDecorConcepts.colorPalette.map((col, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-stone-200 bg-stone-50/50">
                        <div
                          className="w-7 h-7 rounded-md border border-stone-300 shadow-2xs"
                          style={{ backgroundColor: col.hex }}
                        />
                        <div className="text-xs">
                          <div className="font-semibold text-stone-800">{col.name}</div>
                          <div className="text-2xs font-mono text-stone-400">{col.hex}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lighting Ideas */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                    Ambient Lighting Direction
                  </span>
                  <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1">
                    {activePlan.themeAndDecorConcepts.lightingIdeas.map((l, idx) => (
                      <li key={idx}>{l}</li>
                    ))}
                  </ul>
                </div>

                {/* Decor Elements */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                    Signature Decor Elements
                  </span>
                  <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1">
                    {activePlan.themeAndDecorConcepts.decorElements.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>

                {/* Lower-cost alternative */}
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-950">
                  <strong className="block mb-1 font-semibold text-emerald-900">
                    Smart Value Alternative:
                  </strong>
                  {activePlan.themeAndDecorConcepts.lowerCostAlternative}
                </div>
              </div>
            )}

            {/* TAB 6: CATERING & DIETARY */}
            {activePlanTab === 'catering' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Dining Style & Hospitality Protocol
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {activePlan.foodAndCateringConsiderations.style}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                    Dietary Inclusivity Safeguards
                  </span>
                  <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1">
                    {activePlan.foodAndCateringConsiderations.dietaryAccommodations.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                    Catering Cost-Saving Strategies
                  </span>
                  <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1">
                    {activePlan.foodAndCateringConsiderations.costSavingTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                    Presentation & Plating Ideas
                  </span>
                  <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1">
                    {activePlan.foodAndCateringConsiderations.presentationIdeas.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 7: GUESTS & INCLUSIVITY */}
            {activePlanTab === 'guests' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Guest Hospitality, Seating & Accessibility
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Logistics for managing {activeEvent.guestCount} attendees smoothly
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                    RSVP Communication Milestones
                  </span>
                  <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1">
                    {activePlan.guestManagement.rsvpMilestones.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                    Seating Layout & Flow Guidance
                  </span>
                  <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1">
                    {activePlan.guestManagement.seatingAdvice.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                    Accessibility & Special Accommodations
                  </span>
                  <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1">
                    {activePlan.guestManagement.accessibilityAccommodations.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 8: RISKS & CONTINGENCIES */}
            {activePlanTab === 'risks' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Risk Assessment & Contingency Fallback Plan
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Anticipated points of failure and pre-planned mitigations
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {activePlan.riskAndContingency.map((rc, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-stone-200 bg-white space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900">{rc.risk}</span>
                        <span
                          className={`text-2xs font-semibold uppercase px-2 py-0.5 rounded-full ${
                            rc.severity === 'high'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {rc.severity} Severity
                        </span>
                      </div>
                      <p className="text-xs text-stone-700">
                        <strong className="text-stone-900">Prevention Mitigation: </strong>
                        {rc.mitigation}
                      </p>
                      <p className="text-xs text-indigo-900 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                        <strong className="text-indigo-950">Immediate Fallback: </strong>
                        {rc.fallbackOption}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Custom Creative Inquiry Box */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">
              Interactive Idea Generator
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Ask Gemini specific creative questions about entertainment, cocktails, favors, or decor
            </p>
          </div>
        </div>

        <form onSubmit={handleAskCreativeIdeas} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Unique cocktail hour interactive games for 140 wedding guests in an outdoor garden..."
            value={ideasPrompt}
            onChange={(e) => setIdeasPrompt(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600"
          />
          <button
            type="submit"
            disabled={ideasLoading || !ideasPrompt.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors shrink-0"
          >
            {ideasLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Ask AI</span>
          </button>
        </form>

        {/* Custom Ideas Result */}
        {customIdeas && (
          <div className="mt-4 p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">{customIdeas.title}</span>
              <span className="text-2xs font-mono text-stone-400">Source: {customIdeas.source}</span>
            </div>
            <ul className="list-disc pl-4 text-xs text-stone-700 space-y-1.5">
              {customIdeas.ideas.map((idea, idx) => (
                <li key={idx}>{idea}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
