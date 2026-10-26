/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useEventContext } from '../context/EventContext';
import {
  BudgetItem,
  BudgetCategory,
  BUDGET_CATEGORIES,
  ExpensePaymentStatus,
} from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  X,
  PieChart,
} from 'lucide-react';
import { formatCurrency } from '../utils/deterministicPlanner';

export const BudgetManager: React.FC = () => {
  const {
    activeEvent,
    budgetItems,
    budgetSummary,
    addBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
  } = useEventContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  // Form inputs
  const [formCategory, setFormCategory] = useState<BudgetCategory>('catering');
  const [formName, setFormName] = useState('');
  const [formPlanned, setFormPlanned] = useState<number>(0);
  const [formActual, setFormActual] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<ExpensePaymentStatus>('unpaid');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  if (!activeEvent) return null;

  const currency = activeEvent.currency;

  const openAddModal = (defaultCategory?: BudgetCategory) => {
    setEditingItem(null);
    setFormCategory(defaultCategory || 'catering');
    setFormName('');
    setFormPlanned(500);
    setFormActual(0);
    setFormStatus('unpaid');
    setFormNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item: BudgetItem) => {
    setEditingItem(item);
    setFormCategory(item.category);
    setFormName(item.name);
    setFormPlanned(item.plannedAmount);
    setFormActual(item.actualAmount);
    setFormStatus(item.paidStatus);
    setFormNotes(item.notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Expense name is required.');
      return;
    }
    const planned = Number(formPlanned);
    const actual = Number(formActual);
    if (isNaN(planned) || planned < 0) {
      setFormError('Planned amount must be 0 or greater.');
      return;
    }
    if (isNaN(actual) || actual < 0) {
      setFormError('Actual amount must be 0 or greater.');
      return;
    }

    if (editingItem) {
      updateBudgetItem(editingItem.id, {
        category: formCategory,
        name: formName.trim(),
        plannedAmount: planned,
        actualAmount: actual,
        paidStatus: formStatus,
        notes: formNotes.trim(),
      });
    } else {
      addBudgetItem({
        eventId: activeEvent.id,
        category: formCategory,
        name: formName.trim(),
        plannedAmount: planned,
        actualAmount: actual,
        paidStatus: formStatus,
        notes: formNotes.trim(),
      });
    }
    setModalOpen(false);
  };

  // Filter expenses
  const filteredItems = budgetItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || item.paidStatus === selectedStatus;
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Over-budget alert */}
      {budgetSummary.isOverBudget && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 shadow-xs"
        >
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Over-Budget Warning: </span>
            Total planned allocations (
            <span className="font-mono tabular-nums font-semibold">
              {formatCurrency(budgetSummary.totalPlanned, currency)}
            </span>
            ) exceed the total event budget of{' '}
            <span className="font-mono tabular-nums font-semibold">
              {formatCurrency(budgetSummary.totalBudget, currency)}
            </span>{' '}
            by{' '}
            <span className="font-mono tabular-nums font-bold text-rose-700">
              {formatCurrency(budgetSummary.totalPlanned - budgetSummary.totalBudget, currency)}
            </span>
            . Consider trimming discretionary items or reducing guest count variables.
          </div>
        </div>
      )}

      {/* Financial Health KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total Event Budget
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-stone-900 mt-1">
            {formatCurrency(budgetSummary.totalBudget, currency)}
          </div>
          <div className="text-xs text-stone-500 mt-1">Stated ceiling</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Planned Total
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-indigo-950 mt-1">
            {formatCurrency(budgetSummary.totalPlanned, currency)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            {budgetSummary.totalBudget > 0
              ? `${Math.round((budgetSummary.totalPlanned / budgetSummary.totalBudget) * 100)}% of ceiling`
              : 'No cap set'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Actual Spent
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-stone-900 mt-1">
            {formatCurrency(budgetSummary.totalActual, currency)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            {budgetSummary.percentageUsed}% of total budget
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Remaining Headroom
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold font-mono tabular-nums mt-1 ${
              budgetSummary.remainingBalance < 0 ? 'text-rose-600' : 'text-emerald-700'
            }`}
          >
            {formatCurrency(budgetSummary.remainingBalance, currency)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            {budgetSummary.remainingBalance >= 0 ? 'Available surplus' : 'Deficit'}
          </div>
        </div>
      </div>

      {/* Category Allocation Summary Panel */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-900" />
              <span>Category Allocation Breakdown</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Reconciled spending targets across 10 celebration categories
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {budgetSummary.categorySummaries.map((cat) => {
            const catPlanned = cat.plannedAmount;
            const catActual = cat.actualAmount;
            const catPct = catPlanned > 0 ? Math.round((catActual / catPlanned) * 100) : 0;
            return (
              <div
                key={cat.category}
                className="p-3 rounded-lg border border-stone-200/80 bg-stone-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-800">
                    <span className="truncate">{cat.label}</span>
                    <span className="text-2xs text-stone-400 font-mono">({cat.itemCount})</span>
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-stone-900 mt-1">
                    {formatCurrency(catPlanned, currency)}
                  </div>
                  <div className="text-2xs text-stone-500 font-mono tabular-nums mt-0.5">
                    Spent: {formatCurrency(catActual, currency)} ({catPct}%)
                  </div>
                </div>

                <div className="w-full bg-stone-200/70 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      catPct > 100 ? 'bg-rose-600' : 'bg-indigo-900'
                    }`}
                    style={{ width: `${Math.min(100, catPct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expense Line Items Table & Controls */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Expense Line Items ({filteredItems.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Detailed tracking of contract commitments and paid receipts
            </p>
          </div>

          <button
            onClick={() => openAddModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-stone-50/60 border-b border-stone-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800 bg-white focus:border-indigo-600"
              aria-label="Filter expenses by category"
            >
              <option value="all">All Categories</option>
              {BUDGET_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800 bg-white focus:border-indigo-600"
              aria-label="Filter expenses by payment status"
            >
              <option value="all">All Payment Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="deposit_paid">Deposit Paid</option>
              <option value="paid_in_full">Paid in Full</option>
            </select>
          </div>
        </div>

        {/* Expenses Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-2xs font-semibold uppercase tracking-wider text-stone-500">
                <th className="py-3 px-4">Item & Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Planned Amount</th>
                <th className="py-3 px-4 text-right">Actual Spent</th>
                <th className="py-3 px-4 text-center">Payment Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const catLabel =
                    BUDGET_CATEGORIES.find((c) => c.id === item.category)?.label || item.category;
                  return (
                    <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900">{item.name}</div>
                        {item.notes && (
                          <div className="text-2xs text-stone-500 truncate max-w-xs mt-0.5">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        <span className="inline-block px-2 py-0.5 rounded-sm bg-stone-100 text-stone-700 text-2xs font-medium">
                          {catLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-stone-900">
                        {formatCurrency(item.plannedAmount, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-stone-900">
                        {formatCurrency(item.actualAmount, currency)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-2xs font-semibold ${
                            item.paidStatus === 'paid_in_full'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.paidStatus === 'deposit_paid'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {item.paidStatus === 'paid_in_full'
                            ? 'Paid in Full'
                            : item.paidStatus === 'deposit_paid'
                            ? 'Deposit Paid'
                            : 'Unpaid'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                            title="Edit expense"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${item.name}"?`)) {
                                deleteBudgetItem(item.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete expense"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-stone-500">
                    No expense line items found. Click "Add Expense" to record a planned or actual cost.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-modal-title"
        >
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <h3 id="expense-modal-title" className="text-sm font-bold text-stone-900 tracking-tight">
                {editingItem ? 'Edit Expense Item' : 'Add New Expense Item'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Glass Greenhouse Pavilion Rental, Acoustic Duo Deposit"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Budget Category *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as BudgetCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
                >
                  {BUDGET_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Planned Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={formPlanned}
                    onChange={(e) => setFormPlanned(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 font-mono tabular-nums focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Actual Spent ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={formActual}
                    onChange={(e) => setFormActual(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 font-mono tabular-nums focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ExpensePaymentStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
                >
                  <option value="unpaid">Unpaid / Invoiced</option>
                  <option value="deposit_paid">Deposit Paid</option>
                  <option value="paid_in_full">Paid in Full</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Notes or Contract Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50% due 30 days before date, includes security deposit"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-xs"
                >
                  {editingItem ? 'Save Updates' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
