/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useEventContext } from '../context/EventContext';
import {
  DollarSign,
  CheckCircle2,
  Users,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Calendar,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '../utils/deterministicPlanner';
import { ActiveTab } from './Navbar';

interface OverviewDashboardProps {
  onNavigateTab: (tab: ActiveTab) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ onNavigateTab }) => {
  const {
    activeEvent,
    budgetSummary,
    timelineSummary,
    vendorSummary,
    activePlan,
  } = useEventContext();

  if (!activeEvent) return null;

  const currency = activeEvent.currency;

  return (
    <div className="space-y-6">
      {/* Over-budget critical warning banner */}
      {budgetSummary.isOverBudget && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 shadow-xs"
        >
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Budget Alert: </span>
            Planned commitments (
            <span className="font-mono tabular-nums font-semibold">
              {formatCurrency(budgetSummary.totalPlanned, currency)}
            </span>
            ) or actual expenditures exceed the allocated total budget of{' '}
            <span className="font-mono tabular-nums font-semibold">
              {formatCurrency(budgetSummary.totalBudget, currency)}
            </span>
            . Review the{' '}
            <button
              onClick={() => onNavigateTab('budget')}
              className="underline font-semibold text-amber-950 hover:text-indigo-900"
            >
              Budget Planner
            </button>{' '}
            to rebalance categories or release contingency reserves.
          </div>
        </div>
      )}

      {/* 4-Column Key Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Budget Health */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center justify-between">
              <span>Total Budget</span>
              <DollarSign className="w-4 h-4 text-stone-400" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-stone-900 mt-2">
              {formatCurrency(budgetSummary.totalBudget, currency)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <span>Spent: {formatCurrency(budgetSummary.totalActual, currency)}</span>
            <span
              className={`font-mono font-medium ${
                budgetSummary.remainingBalance < 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              Rem: {formatCurrency(budgetSummary.remainingBalance, currency)}
            </span>
          </div>
        </div>

        {/* Metric 2: Timeline Completion */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center justify-between">
              <span>Milestone Progress</span>
              <CheckCircle2 className="w-4 h-4 text-stone-400" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-stone-900 mt-2 flex items-baseline gap-2">
              <span>{timelineSummary.progressPercentage}%</span>
              <span className="text-xs font-normal text-stone-500">
                ({timelineSummary.completedTasks}/{timelineSummary.totalTasks} tasks)
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <span className="text-stone-500">Pending: {timelineSummary.pendingTasks}</span>
            {timelineSummary.overdueTasks > 0 ? (
              <span className="text-rose-600 font-semibold font-mono">
                {timelineSummary.overdueTasks} Overdue
              </span>
            ) : (
              <span className="text-emerald-700">On Track</span>
            )}
          </div>
        </div>

        {/* Metric 3: Vendors Contracted */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center justify-between">
              <span>Vendor Pipeline</span>
              <Users className="w-4 h-4 text-stone-400" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-stone-900 mt-2">
              {vendorSummary.bookedVendors} / {vendorSummary.totalVendors}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <span>Quoted: {vendorSummary.quotedVendors}</span>
            <span className="font-mono">
              Committed: {formatCurrency(vendorSummary.contractedTotal, currency)}
            </span>
          </div>
        </div>

        {/* Metric 4: AI Strategic Confidence */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center justify-between">
              <span>AI Plan Status</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-base font-bold text-stone-900 mt-2 truncate">
              {activePlan ? (activePlan.isFallback ? 'Heuristic Strategy' : 'Gemini 3.8 Active') : 'Plan Ready to Run'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-stone-500">
              {activePlan ? `${activePlan.riskAndContingency.length} risks modeled` : 'Not initialized'}
            </span>
            <button
              onClick={() => onNavigateTab('planner')}
              className="text-indigo-900 font-semibold hover:underline inline-flex items-center gap-0.5"
            >
              View Plan →
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Budget Gauge & Timeline Action Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Financial Allocation & Visual Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">
                Budget Allocation vs. Actual Spending
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Category allocation breakdown and remaining headroom
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('budget')}
              className="text-xs font-semibold text-indigo-900 hover:text-indigo-950 inline-flex items-center gap-1"
            >
              Manage Budget <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Overall Spending Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-stone-700">
              <span>Overall Budget Utilization</span>
              <span className="font-mono tabular-nums">
                {budgetSummary.percentageUsed}% used ({formatCurrency(budgetSummary.totalActual, currency)} of{' '}
                {formatCurrency(budgetSummary.totalBudget, currency)})
              </span>
            </div>
            <div
              className="w-full bg-stone-100 rounded-full h-3 overflow-hidden flex"
              role="progressbar"
              aria-valuenow={budgetSummary.percentageUsed}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall budget usage"
            >
              <div
                className={`h-full transition-all duration-300 ${
                  budgetSummary.percentageUsed > 100
                    ? 'bg-rose-600'
                    : budgetSummary.percentageUsed > 85
                    ? 'bg-amber-500'
                    : 'bg-indigo-900'
                }`}
                style={{ width: `${Math.min(100, budgetSummary.percentageUsed)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <span>Planned Commitments: {formatCurrency(budgetSummary.totalPlanned, currency)}</span>
              <span>Remaining Buffer: {formatCurrency(budgetSummary.remainingBalance, currency)}</span>
            </div>
          </div>

          {/* Top Category Split (Top 5 Categories) */}
          <div className="pt-3 border-t border-stone-100">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
              Top Categories by Allocation
            </div>
            <div className="space-y-3">
              {budgetSummary.categorySummaries
                .filter((cat) => cat.plannedAmount > 0)
                .slice(0, 5)
                .map((cat) => {
                  const catPct =
                    budgetSummary.totalBudget > 0
                      ? Math.round((cat.plannedAmount / budgetSummary.totalBudget) * 100)
                      : 0;
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-stone-800">{cat.label}</span>
                        <div className="flex items-center gap-2 font-mono tabular-nums text-stone-600">
                          <span>{formatCurrency(cat.actualAmount, currency)} spent</span>
                          <span className="text-stone-300">/</span>
                          <span>{formatCurrency(cat.plannedAmount, currency)} plan</span>
                          <span className="text-stone-400 text-2xs">({catPct}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-700 h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              cat.plannedAmount > 0 ? (cat.actualAmount / cat.plannedAmount) * 100 : 0
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Urgent Milestones & Immediate Actions */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900 tracking-tight">
                Upcoming Priority Milestones
              </h2>
              <button
                onClick={() => onNavigateTab('timeline')}
                className="text-xs font-semibold text-indigo-900 hover:text-indigo-950 inline-flex items-center gap-1"
              >
                All Tasks <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              High priority items requiring near-term focus
            </p>

            <div className="mt-4 space-y-3">
              {timelineSummary.urgentTasks.slice(0, 4).length > 0 ? (
                timelineSummary.urgentTasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-stone-200 hover:border-stone-300 transition-colors bg-stone-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-900 leading-snug">
                        {task.title}
                      </span>
                      <span
                        className={`text-2xs uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-xs shrink-0 ${
                          task.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-stone-500 mt-2 font-mono">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      <span>Due: {task.dueDate || 'Flexible'}</span>
                      <span className="text-stone-300">·</span>
                      <span>{task.category}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-stone-500 bg-stone-50 rounded-lg">
                  No urgent milestones pending! Check the timeline for full schedule.
                </div>
              )}
            </div>
          </div>

          {/* Quick link button to AI Assistant */}
          <div className="pt-3 border-t border-stone-100">
            <button
              onClick={() => onNavigateTab('planner')}
              className="w-full py-2.5 px-4 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Open AI Planning Assistant</span>
            </button>
          </div>
        </div>
      </div>

      {/* Strategic Highlights & Risk Summary Card */}
      {activePlan && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-900" />
              <h2 className="text-base font-bold text-stone-900 tracking-tight">
                AI Strategic Overview & Risk Management
              </h2>
            </div>
            <span className="text-xs text-stone-500">
              Source: <strong className="text-stone-700">{activePlan.modelUsed}</strong>
            </span>
          </div>

          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded-lg border border-stone-200/80">
            {activePlan.planningStrategy}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {activePlan.riskAndContingency.slice(0, 3).map((risk, i) => (
              <div key={i} className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-stone-800 truncate">
                    {risk.risk}
                  </span>
                  <span
                    className={`text-2xs uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-xs shrink-0 ${
                      risk.severity === 'high'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {risk.severity} risk
                  </span>
                </div>
                <p className="text-2xs text-stone-600 line-clamp-2">
                  <strong className="text-stone-700">Mitigation: </strong>
                  {risk.mitigation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
