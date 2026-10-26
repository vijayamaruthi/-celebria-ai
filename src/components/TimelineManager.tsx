/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useEventContext } from '../context/EventContext';
import {
  TimelineTask,
  TimelinePhase,
  TaskPriority,
  TIMELINE_PHASES,
} from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  Calendar,
  AlertCircle,
  Search,
  Filter,
  X,
  Clock,
} from 'lucide-react';

export const TimelineManager: React.FC = () => {
  const {
    activeEvent,
    tasks,
    timelineSummary,
    addTask,
    updateTask,
    toggleTaskComplete,
    deleteTask,
  } = useEventContext();

  const [activePhaseFilter, setActivePhaseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TimelineTask | null>(null);

  // Form inputs
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPhase, setFormPhase] = useState<TimelinePhase>('phase_2_3m');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formCategory, setFormCategory] = useState('Logistics');
  const [formError, setFormError] = useState('');

  if (!activeEvent) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const openAddModal = (defaultPhase?: TimelinePhase) => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormPhase(defaultPhase || 'phase_2_3m');
    setFormDueDate(activeEvent.date);
    setFormPriority('medium');
    setFormCategory('General');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (task: TimelineTask) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormPhase(task.phase);
    setFormDueDate(task.dueDate || activeEvent.date);
    setFormPriority(task.priority);
    setFormCategory(task.category);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }
    if (!formDueDate) {
      setFormError('Due date is required.');
      return;
    }

    if (editingTask) {
      updateTask(editingTask.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        phase: formPhase,
        dueDate: formDueDate,
        priority: formPriority,
        category: formCategory.trim() || 'General',
      });
    } else {
      addTask({
        eventId: activeEvent.id,
        title: formTitle.trim(),
        description: formDescription.trim(),
        phase: formPhase,
        dueDate: formDueDate,
        priority: formPriority,
        completed: false,
        category: formCategory.trim() || 'General',
      });
    }
    setModalOpen(false);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPhase = activePhaseFilter === 'all' || t.phase === activePhaseFilter;

    let matchesStatus = true;
    if (statusFilter === 'completed') matchesStatus = t.completed;
    if (statusFilter === 'pending') matchesStatus = !t.completed;
    if (statusFilter === 'overdue') matchesStatus = !t.completed && Boolean(t.dueDate && t.dueDate < todayStr);

    return matchesSearch && matchesPhase && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Milestone Progress Strip */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900 tracking-tight">
              Celebration Preparation Progress
            </h2>
            <span className="text-xs font-mono tabular-nums font-semibold text-stone-700">
              {timelineSummary.progressPercentage}% Completed ({timelineSummary.completedTasks} of {timelineSummary.totalTasks} milestones)
            </span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-indigo-900 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${timelineSummary.progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={timelineSummary.progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => openAddModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Milestone Task</span>
          </button>
        </div>
      </div>

      {/* Phase Segmented Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActivePhaseFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activePhaseFilter === 'all'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          All Phases ({tasks.length})
        </button>
        {TIMELINE_PHASES.map((p) => {
          const count = tasks.filter((t) => t.phase === p.id).length;
          return (
            <button
              key={p.id}
              onClick={() => setActivePhaseFilter(p.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activePhaseFilter === p.id
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {p.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tasks by title, category, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800 bg-white focus:border-indigo-600"
            aria-label="Filter tasks by completion status"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Only</option>
            <option value="overdue">Overdue Only</option>
            <option value="completed">Completed Only</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => {
            const isOverdue = !task.completed && task.dueDate && task.dueDate < todayStr;
            const phaseLabel =
              TIMELINE_PHASES.find((p) => p.id === task.phase)?.label || task.phase;

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border p-4 shadow-xs transition-colors flex items-start gap-3.5 ${
                  task.completed
                    ? 'border-stone-200 bg-stone-50/50 opacity-80'
                    : isOverdue
                    ? 'border-rose-300 bg-rose-50/30'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                {/* Complete checkbox button */}
                <button
                  onClick={() => toggleTaskComplete(task.id)}
                  className="mt-0.5 text-stone-400 hover:text-indigo-900 focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-sm shrink-0"
                  aria-label={task.completed ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as complete`}
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                  ) : (
                    <Circle className="w-5 h-5 text-stone-300 hover:text-indigo-600" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        task.completed ? 'line-through text-stone-400' : 'text-stone-900'
                      }`}
                    >
                      {task.title}
                    </span>

                    {/* Priority badge */}
                    <span
                      className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-xs ${
                        task.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-800'
                          : task.priority === 'high'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {task.priority}
                    </span>

                    {/* Overdue alert badge */}
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded-xs bg-rose-600 text-white font-mono">
                        <AlertCircle className="w-3 h-3" />
                        <span>OVERDUE</span>
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p
                      className={`text-xs mt-1 ${
                        task.completed ? 'text-stone-400' : 'text-stone-600'
                      }`}
                    >
                      {task.description}
                    </p>
                  )}

                  {/* Metadata line */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-stone-500 mt-2 font-mono">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      <span>Due: {task.dueDate || 'Flexible'}</span>
                    </span>
                    <span aria-hidden="true" className="text-stone-300">·</span>
                    <span>Phase: {phaseLabel}</span>
                    <span aria-hidden="true" className="text-stone-300">·</span>
                    <span className="text-stone-700 font-semibold">{task.category}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(task)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                    title="Edit task"
                    aria-label={`Edit ${task.title}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${task.title}"?`)) {
                        deleteTask(task.id);
                      }
                    }}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="Delete task"
                    aria-label={`Delete ${task.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-xs text-stone-500">
            No milestones found matching your filter criteria. Click "Add Milestone Task" or explore the AI Planning Assistant to generate phase-based milestones.
          </div>
        )}
      </div>

      {/* Add / Edit Task Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
        >
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <h3 id="task-modal-title" className="text-sm font-bold text-stone-900 tracking-tight">
                {editingTask ? 'Edit Milestone Task' : 'Add New Milestone Task'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Confirm wedding florist mockups, Lock PA sound rental"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Actionable Details / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Review centerpieces, table runners, and delivery timeline."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Timeline Phase *
                  </label>
                  <select
                    value={formPhase}
                    onChange={(e) => setFormPhase(e.target.value as TimelinePhase)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
                  >
                    {TIMELINE_PHASES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 font-mono focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Category Tag
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Venue, Catering, Music, Logistics"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                  />
                </div>
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
                  {editingTask ? 'Save Updates' : 'Add Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
