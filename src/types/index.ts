/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EventType =
  | 'wedding'
  | 'birthday'
  | 'community'
  | 'gala'
  | 'anniversary'
  | 'baby_shower'
  | 'other';

export type VenueType = 'indoor' | 'outdoor' | 'hybrid';

export interface CelebrationEvent {
  id: string;
  name: string;
  type: EventType;
  date: string; // ISO date string YYYY-MM-DD
  time?: string; // e.g. "16:00"
  guestCount: number;
  totalBudget: number;
  currency: string; // 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'INR' | 'JPY'
  location: string;
  venueType: VenueType;
  theme: string;
  priorities: string[];
  dietaryRequirements: string[];
  accessibilityNeeds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  isTemplate?: boolean;
}

export type BudgetCategory =
  | 'venue'
  | 'catering'
  | 'decoration'
  | 'photography'
  | 'entertainment'
  | 'transportation'
  | 'invitations'
  | 'accommodation'
  | 'miscellaneous'
  | 'contingency';

export const BUDGET_CATEGORIES: { id: BudgetCategory; label: string; icon: string }[] = [
  { id: 'venue', label: 'Venue & Facilities', icon: 'Building' },
  { id: 'catering', label: 'Food & Beverage', icon: 'Utensils' },
  { id: 'decoration', label: 'Decor & Florals', icon: 'Sparkles' },
  { id: 'photography', label: 'Photo & Video', icon: 'Camera' },
  { id: 'entertainment', label: 'Music & Entertainment', icon: 'Music' },
  { id: 'transportation', label: 'Transportation & Logistics', icon: 'Car' },
  { id: 'invitations', label: 'Invitations & Paper', icon: 'Mail' },
  { id: 'accommodation', label: 'Guest Accommodations', icon: 'Hotel' },
  { id: 'miscellaneous', label: 'Permits & Miscellaneous', icon: 'FileText' },
  { id: 'contingency', label: 'Emergency Contingency', icon: 'ShieldAlert' },
];

export type ExpensePaymentStatus = 'unpaid' | 'deposit_paid' | 'paid_in_full';

export interface BudgetItem {
  id: string;
  eventId: string;
  category: BudgetCategory;
  name: string;
  plannedAmount: number;
  actualAmount: number;
  paidStatus: ExpensePaymentStatus;
  notes?: string;
  createdAt: string;
}

export interface CategoryBudgetSummary {
  category: BudgetCategory;
  label: string;
  plannedAmount: number;
  actualAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  itemCount: number;
}

export type TimelinePhase =
  | 'phase_6m_plus'
  | 'phase_2_3m'
  | 'phase_1m'
  | 'phase_2w'
  | 'phase_week_of'
  | 'phase_day_of';

export const TIMELINE_PHASES: { id: TimelinePhase; label: string; description: string }[] = [
  { id: 'phase_6m_plus', label: '6+ Months Out', description: 'Foundational vision, budget, and major vendor bookings' },
  { id: 'phase_2_3m', label: '2–3 Months Out', description: 'Design details, invitations, menus, and logistics' },
  { id: 'phase_1m', label: '1 Month Out', description: 'RSVP confirmations, final fittings, and vendor walkthroughs' },
  { id: 'phase_2w', label: '2 Weeks Out', description: 'Seating charts, headcount deadlines, and shot lists' },
  { id: 'phase_week_of', label: 'Event Week', description: 'Packing kits, final payments, and vendor schedule confirmations' },
  { id: 'phase_day_of', label: 'Day of Celebration', description: 'Run of show timeline, setup, coordination, and tear-down' },
];

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TimelineTask {
  id: string;
  eventId: string;
  title: string;
  description: string;
  phase: TimelinePhase;
  dueDate: string; // YYYY-MM-DD
  timeOfDay?: string; // "14:00" for day-of tasks
  priority: TaskPriority;
  completed: boolean;
  category: string;
  assignedTo?: string;
  createdAt: string;
}

export type VendorStatus = 'identified' | 'inquired' | 'quoted' | 'booked' | 'declined';

export const VENDOR_STATUSES: { id: VendorStatus; label: string }[] = [
  { id: 'identified', label: 'Identified' },
  { id: 'inquired', label: 'Inquiry Sent' },
  { id: 'quoted', label: 'Quote Received' },
  { id: 'booked', label: 'Contracted & Booked' },
  { id: 'declined', label: 'Declined' },
];

export interface VendorEntry {
  id: string;
  eventId: string;
  category: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  status: VendorStatus;
  quotedPrice?: number;
  contractPrice?: number;
  notes?: string;
  negotiationTips?: string[];
  createdAt: string;
}

export interface AIPlanningResult {
  eventId: string;
  eventOverview: string;
  planningStrategy: string;
  recommendedCategoryAllocations: Array<{
    category: BudgetCategory;
    percentage: number;
    recommendedAmount: number;
    rationale: string;
  }>;
  timelinePhases: Array<{
    phase: TimelinePhase;
    phaseTitle: string;
    recommendedMilestones: Array<{
      title: string;
      description: string;
      priority: TaskPriority;
      daysBeforeEvent: number;
      category: string;
    }>;
  }>;
  vendorRecommendations: Array<{
    category: string;
    suggestedSearchCriteria: string;
    keyQuestionsToAsk: string[];
    typicalCostPercentage: string;
    negotiationScript: string;
  }>;
  prioritizedActionItems: Array<{
    action: string;
    urgency: 'high' | 'medium' | 'low';
    impact: string;
  }>;
  themeAndDecorConcepts: {
    themeTitle: string;
    colorPalette: Array<{ name: string; hex: string }>;
    lightingIdeas: string[];
    decorElements: string[];
    lowerCostAlternative: string;
  };
  foodAndCateringConsiderations: {
    style: string;
    dietaryAccommodations: string[];
    costSavingTips: string[];
    presentationIdeas: string[];
  };
  guestManagement: {
    rsvpMilestones: string[];
    seatingAdvice: string[];
    accessibilityAccommodations: string[];
  };
  riskAndContingency: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high';
    mitigation: string;
    fallbackOption: string;
  }>;
  isFallback: boolean;
  modelUsed: string;
  generatedAt: string;
}

export interface CelebriaStorageState {
  version: number;
  activeEventId: string;
  events: CelebrationEvent[];
  budgetItems: BudgetItem[];
  tasks: TimelineTask[];
  vendors: VendorEntry[];
  aiPlans: Record<string, AIPlanningResult>;
}
