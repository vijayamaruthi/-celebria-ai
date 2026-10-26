/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  CelebrationEvent,
  BudgetItem,
  TimelineTask,
  VendorEntry,
  AIPlanningResult,
  CelebriaStorageState,
  BudgetCategory,
  CategoryBudgetSummary,
  BUDGET_CATEGORIES,
} from '../types';
import {
  buildInitialStorageState,
} from '../utils/defaultTemplates';
import {
  createSeedBudgetItems,
  createSeedTimelineTasks,
  createSeedVendors,
} from '../utils/deterministicPlanner';

const STORAGE_KEY = 'celebria_ai_workspace_v1';

export interface BudgetSummary {
  totalBudget: number;
  totalPlanned: number;
  totalActual: number;
  remainingBalance: number;
  percentageUsed: number;
  isOverBudget: boolean;
  categorySummaries: CategoryBudgetSummary[];
}

export interface TimelineSummary {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  progressPercentage: number;
  urgentTasks: TimelineTask[];
}

export interface VendorSummary {
  totalVendors: number;
  bookedVendors: number;
  quotedVendors: number;
  inquiredVendors: number;
  contractedTotal: number;
  quotedTotal: number;
}

interface EventContextType {
  state: CelebriaStorageState;
  activeEvent: CelebrationEvent | null;
  events: CelebrationEvent[];
  budgetItems: BudgetItem[];
  tasks: TimelineTask[];
  vendors: VendorEntry[];
  activePlan: AIPlanningResult | null;
  budgetSummary: BudgetSummary;
  timelineSummary: TimelineSummary;
  vendorSummary: VendorSummary;

  // Event actions
  setActiveEventId: (id: string) => void;
  createEvent: (data: Omit<CelebrationEvent, 'id' | 'createdAt' | 'updatedAt'>) => CelebrationEvent;
  updateEvent: (id: string, updates: Partial<CelebrationEvent>) => void;
  deleteEvent: (id: string) => void;

  // Budget actions
  addBudgetItem: (item: Omit<BudgetItem, 'id' | 'createdAt'>) => BudgetItem;
  updateBudgetItem: (id: string, updates: Partial<BudgetItem>) => void;
  deleteBudgetItem: (id: string) => void;

  // Timeline actions
  addTask: (task: Omit<TimelineTask, 'id' | 'createdAt'>) => TimelineTask;
  updateTask: (id: string, updates: Partial<TimelineTask>) => void;
  toggleTaskComplete: (id: string) => void;
  deleteTask: (id: string) => void;

  // Vendor actions
  addVendor: (vendor: Omit<VendorEntry, 'id' | 'createdAt'>) => VendorEntry;
  updateVendor: (id: string, updates: Partial<VendorEntry>) => void;
  deleteVendor: (id: string) => void;

  // AI Plan actions
  saveAIPlan: (plan: AIPlanningResult) => void;
  applyPlanToWorkspace: (plan: AIPlanningResult) => void;

  // Backup & Reset
  resetToDefaults: () => void;
  exportStateToJson: () => string;
  importStateFromJson: (jsonStr: string) => { success: boolean; message: string };
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CelebriaStorageState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CelebriaStorageState;
        if (parsed && parsed.version === 1 && Array.isArray(parsed.events) && parsed.events.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Storage unavailable or corrupt; fall back to preloaded initial state
    }
    return buildInitialStorageState();
  });

  // Persist state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Browser storage quota exceeded or disabled in privacy mode
    }
  }, [state]);

  const activeEvent = useMemo(() => {
    return state.events.find((e) => e.id === state.activeEventId) || state.events[0] || null;
  }, [state.events, state.activeEventId]);

  const budgetItems = useMemo(() => {
    if (!activeEvent) return [];
    return state.budgetItems.filter((b) => b.eventId === activeEvent.id);
  }, [state.budgetItems, activeEvent]);

  const tasks = useMemo(() => {
    if (!activeEvent) return [];
    return state.tasks.filter((t) => t.eventId === activeEvent.id);
  }, [state.tasks, activeEvent]);

  const vendors = useMemo(() => {
    if (!activeEvent) return [];
    return state.vendors.filter((v) => v.eventId === activeEvent.id);
  }, [state.vendors, activeEvent]);

  const activePlan = useMemo(() => {
    if (!activeEvent) return null;
    return state.aiPlans[activeEvent.id] || null;
  }, [state.aiPlans, activeEvent]);

  // Derived budget summary calculations
  const budgetSummary = useMemo<BudgetSummary>(() => {
    const totalBudget = activeEvent ? activeEvent.totalBudget : 0;
    let totalPlanned = 0;
    let totalActual = 0;

    const categoryMap = new Map<BudgetCategory, { planned: number; actual: number; count: number }>();
    for (const cat of BUDGET_CATEGORIES) {
      categoryMap.set(cat.id, { planned: 0, actual: 0, count: 0 });
    }

    for (const item of budgetItems) {
      const p = Number(item.plannedAmount) || 0;
      const a = Number(item.actualAmount) || 0;
      totalPlanned += p;
      totalActual += a;

      const current = categoryMap.get(item.category) || { planned: 0, actual: 0, count: 0 };
      current.planned += p;
      current.actual += a;
      current.count += 1;
      categoryMap.set(item.category, current);
    }

    const remainingBalance = totalBudget - totalActual;
    const percentageUsed = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
    const isOverBudget = totalPlanned > totalBudget || totalActual > totalBudget;

    const categorySummaries: CategoryBudgetSummary[] = BUDGET_CATEGORIES.map((cat) => {
      const data = categoryMap.get(cat.id) || { planned: 0, actual: 0, count: 0 };
      const catRemaining = data.planned - data.actual;
      const catPct = data.planned > 0 ? Math.round((data.actual / data.planned) * 100) : 0;
      return {
        category: cat.id,
        label: cat.label,
        plannedAmount: data.planned,
        actualAmount: data.actual,
        remainingAmount: catRemaining,
        percentageUsed: catPct,
        itemCount: data.count,
      };
    });

    return {
      totalBudget,
      totalPlanned,
      totalActual,
      remainingBalance,
      percentageUsed,
      isOverBudget,
      categorySummaries,
    };
  }, [activeEvent, budgetItems]);

  // Derived timeline summary calculations
  const timelineSummary = useMemo<TimelineSummary>(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const overdueTasks = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < todayStr).length;
    const urgentTasks = tasks
      .filter((t) => !t.completed && (t.priority === 'urgent' || t.priority === 'high'))
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      progressPercentage,
      urgentTasks,
    };
  }, [tasks]);

  // Derived vendor summary calculations
  const vendorSummary = useMemo<VendorSummary>(() => {
    const totalVendors = vendors.length;
    const bookedVendors = vendors.filter((v) => v.status === 'booked').length;
    const quotedVendors = vendors.filter((v) => v.status === 'quoted').length;
    const inquiredVendors = vendors.filter((v) => v.status === 'inquired').length;

    let contractedTotal = 0;
    let quotedTotal = 0;
    for (const v of vendors) {
      if (v.contractPrice) contractedTotal += Number(v.contractPrice) || 0;
      if (v.quotedPrice) quotedTotal += Number(v.quotedPrice) || 0;
    }

    return {
      totalVendors,
      bookedVendors,
      quotedVendors,
      inquiredVendors,
      contractedTotal,
      quotedTotal,
    };
  }, [vendors]);

  // Actions
  const setActiveEventId = (id: string) => {
    setState((prev) => ({ ...prev, activeEventId: id }));
  };

  const createEvent = (data: Omit<CelebrationEvent, 'id' | 'createdAt' | 'updatedAt'>): CelebrationEvent => {
    const id = `event-${Date.now()}`;
    const now = new Date().toISOString();
    const newEvent: CelebrationEvent = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    setState((prev) => ({
      ...prev,
      events: [newEvent, ...prev.events],
      activeEventId: id,
    }));

    return newEvent;
  };

  const updateEvent = (id: string, updates: Partial<CelebrationEvent>) => {
    setState((prev) => ({
      ...prev,
      events: prev.events.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      ),
    }));
  };

  const deleteEvent = (id: string) => {
    setState((prev) => {
      const remainingEvents = prev.events.filter((e) => e.id !== id);
      const nextActiveId =
        prev.activeEventId === id
          ? remainingEvents[0]?.id || ''
          : prev.activeEventId;

      return {
        ...prev,
        events: remainingEvents,
        activeEventId: nextActiveId,
        budgetItems: prev.budgetItems.filter((b) => b.eventId !== id),
        tasks: prev.tasks.filter((t) => t.eventId !== id),
        vendors: prev.vendors.filter((v) => v.eventId !== id),
      };
    });
  };

  const addBudgetItem = (item: Omit<BudgetItem, 'id' | 'createdAt'>): BudgetItem => {
    const newItem: BudgetItem = {
      ...item,
      id: `budget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      budgetItems: [...prev.budgetItems, newItem],
    }));
    return newItem;
  };

  const updateBudgetItem = (id: string, updates: Partial<BudgetItem>) => {
    setState((prev) => ({
      ...prev,
      budgetItems: prev.budgetItems.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  };

  const deleteBudgetItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      budgetItems: prev.budgetItems.filter((b) => b.id !== id),
    }));
  };

  const addTask = (task: Omit<TimelineTask, 'id' | 'createdAt'>): TimelineTask => {
    const newTask: TimelineTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }));
    return newTask;
  };

  const updateTask = (id: string, updates: Partial<TimelineTask>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const toggleTaskComplete = (id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    }));
  };

  const deleteTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  };

  const addVendor = (vendor: Omit<VendorEntry, 'id' | 'createdAt'>): VendorEntry => {
    const newVendor: VendorEntry = {
      ...vendor,
      id: `vendor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      vendors: [...prev.vendors, newVendor],
    }));
    return newVendor;
  };

  const updateVendor = (id: string, updates: Partial<VendorEntry>) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    }));
  };

  const deleteVendor = (id: string) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.filter((v) => v.id !== id),
    }));
  };

  const saveAIPlan = (plan: AIPlanningResult) => {
    setState((prev) => ({
      ...prev,
      aiPlans: {
        ...prev.aiPlans,
        [plan.eventId]: plan,
      },
    }));
  };

  const applyPlanToWorkspace = (plan: AIPlanningResult) => {
    if (!activeEvent) return;
    const newBudgetItems = createSeedBudgetItems(activeEvent, plan);
    const newTasks = createSeedTimelineTasks(activeEvent, plan);
    const newVendors = createSeedVendors(activeEvent, plan);

    setState((prev) => {
      // Remove previous items for this event and replace with new generated items
      const filteredBudget = prev.budgetItems.filter((b) => b.eventId !== activeEvent.id);
      const filteredTasks = prev.tasks.filter((t) => t.eventId !== activeEvent.id);
      const filteredVendors = prev.vendors.filter((v) => v.eventId !== activeEvent.id);

      return {
        ...prev,
        budgetItems: [...filteredBudget, ...newBudgetItems],
        tasks: [...filteredTasks, ...newTasks],
        vendors: [...filteredVendors, ...newVendors],
        aiPlans: {
          ...prev.aiPlans,
          [activeEvent.id]: plan,
        },
      };
    });
  };

  const resetToDefaults = () => {
    const initial = buildInitialStorageState();
    setState(initial);
  };

  const exportStateToJson = (): string => {
    return JSON.stringify(state, null, 2);
  };

  const importStateFromJson = (jsonStr: string): { success: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonStr) as CelebriaStorageState;
      if (!parsed || !Array.isArray(parsed.events) || parsed.events.length === 0) {
        return { success: false, message: 'Invalid format: missing events collection.' };
      }
      setState({
        version: 1,
        activeEventId: parsed.activeEventId || parsed.events[0].id,
        events: parsed.events,
        budgetItems: Array.isArray(parsed.budgetItems) ? parsed.budgetItems : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
        aiPlans: parsed.aiPlans || {},
      });
      return { success: true, message: `Successfully restored ${parsed.events.length} celebrations.` };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid JSON file.';
      return { success: false, message: `Import failed: ${errorMsg}` };
    }
  };

  return (
    <EventContext.Provider
      value={{
        state,
        activeEvent,
        events: state.events,
        budgetItems,
        tasks,
        vendors,
        activePlan,
        budgetSummary,
        timelineSummary,
        vendorSummary,
        setActiveEventId,
        createEvent,
        updateEvent,
        deleteEvent,
        addBudgetItem,
        updateBudgetItem,
        deleteBudgetItem,
        addTask,
        updateTask,
        toggleTaskComplete,
        deleteTask,
        addVendor,
        updateVendor,
        deleteVendor,
        saveAIPlan,
        applyPlanToWorkspace,
        resetToDefaults,
        exportStateToJson,
        importStateFromJson,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEventContext = (): EventContextType => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext must be used within an EventProvider');
  }
  return context;
};
