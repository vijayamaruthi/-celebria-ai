# Celebria AI — Your Intelligent Celebration Planner

> “Your vision. Your budget. Your perfect celebration.”

**H2S PromptWars Virtual Challenge 5: Celebration & Event Planner**  
**Submission Category / Vertical:** Weddings, Birthday Celebrations & Community Events  

---

## 1. Project Name & Challenge
- **Project Name:** Celebria AI — Your Intelligent Celebration Planner
- **Challenge:** H2S PromptWars Virtual Challenge 5 (Celebration & Event Planner)
- **Chosen Vertical:** Multi-Event Celebration Management (Weddings, Milestone Birthdays, Community Festivals & Galas)

---

## 2. Problem Statement
Organizing celebrations involves complex, fragmented tasks: tracking dynamic category budgets, navigating volatile vendor quotes, calibrating chronological task timelines against event deadlines, and tailoring aesthetic ideas to guest scale and venue constraints. Traditional spreadsheets lack contextual intelligence, while generic AI chatbots produce disconnected bullet points that cannot be audited, reconciled against financial limits, or executed on the ground.

---

## 3. Solution Overview
Celebria AI is an integrated, full-stack celebration planning workspace. It unites context-sensitive GenAI planning assistance with deterministic financial calculations, multi-phase timeline tracking, vendor inquiry-to-booking pipelines, and downloadable day-of run-of-show briefs. Celebria AI adapts its planning logic across small intimate birthdays (20–50 guests), complex weddings (100–300 guests), and large civic community gatherings (400+ attendees).

---

## 4. Main Features

### A. Intelligent Event Setup & Editing
- 4-step guided intake wizard capturing event type, target date, guest count, total budget, currency, location, indoor/outdoor/hybrid venue setting, user priorities, dietary protocols, and accessibility accommodations.
- Built-in validation guarding against missing names, past/invalid dates, negative budgets, and zero guest counts.
- Preloaded with 3 rich demonstration templates:
  1. *Sophia & Liam's Garden Wedding* (140 guests, $32,000 USD, hybrid setting)
  2. *Marcus's 40th Retro Vinyl & Jazz Night* (45 guests, $4,500 USD, indoor loft)
  3. *Oakridge Spring Community Arts Festival* (450 guests, $15,000 USD, outdoor civic park)

### B. AI-Powered Planning Assistant (10 Dimensions)
Generates structured, actionable recommendations spanning:
1. **Event Overview**: Narrative summary calibrated to guest density and venue.
2. **Recommended Planning Strategy**: Guidance on booking sequence and risk management.
3. **Category Budget Allocation**: Percentage and currency targets tailored to event type.
4. **Chronological Milestones**: Distributed across 6 preparation phases.
5. **Vendor Guidance**: Search criteria, key questions, typical budget share, and negotiation scripts.
6. **Prioritized Action Items**: Ranked by urgency and impact.
7. **Theme & Decor Concepts**: Harmonized color palettes with hex values, ambient lighting, decor elements, and high-value lower-cost alternatives.
8. **Food & Catering Protocol**: Service style, dietary safeguards (GF, vegan, nut-free), and cost-saving tips.
9. **Guest Management & Inclusivity**: RSVP schedule, table spacing, and sensory/mobility accommodations.
10. **Risk & Contingency Matrix**: Weather buffers, delivery delays, AV redundancy, and overflow plans.
- One-click **"Apply to Workspace"** action populates active budget items, timeline milestones, and vendor checklists directly from the generated plan.

### C. Budget Management Workspace
- Stated total budget ceiling vs. total planned commitments vs. actual expenditures vs. remaining balance.
- Automated **Over-Budget Warning Banner** triggering whenever planned costs exceed the budget ceiling.
- 10 standard categories: Venue, Catering, Decoration, Photography, Entertainment, Transportation, Invitations, Accommodation, Miscellaneous, and Emergency Contingency.
- Expense item CRUD with paid status toggles (`Unpaid`, `Deposit Paid`, `Paid in Full`), currency formatting, and category filtering.

### D. Interactive Chronological Timeline
- Organized by 6 preparation phases: *6+ Months Out*, *2–3 Months Out*, *1 Month Out*, *2 Weeks Out*, *Event Week*, and *Day of Celebration*.
- Checkbox status toggles with real-time completion progress bar updates.
- Priority indicators (`Urgent`, `High`, `Medium`, `Low`) and dynamic **Overdue** status highlights for pending tasks past their due date.
- Search, filter, and milestone task CRUD.

### E. Vendor Checklist & Pipeline
- Track suppliers across pipeline stages: `Identified` → `Inquiry Sent` → `Quote Received` → `Contracted & Booked` → `Declined`.
- Track quoted estimates vs. final contracted prices to monitor supplier savings.
- Record contact person, email, phone, and AI-suggested vendor negotiation questions.

### F. Run-of-Show & Comprehensive Export
- Printable executive brief and day-of itinerary with CSS `@media print` stylesheets for one-click PDF generation.
- Full JSON backup export and restore with schema validation and error reporting.

---

## 5. Application Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Celebria AI Frontend (React 19)                 │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand Wordmark · View Links · "+ Create Event" CTA)   │
├────────────────────────────────────────────────────────────────────────┤
│  Event Context Banner (Switcher · Countdown · Unboxed Metadata)        │
├────────────────────────────────────────────────────────────────────────┤
│  Active Workspace Tab:                                                 │
│  ├── OverviewDashboard (KPI Cards, Budget Gauge, Upcoming Milestones) │
│  ├── BudgetManager (10 Categories, Expense CRUD, Reconcile Checks)    │
│  ├── TimelineManager (6 Phases, Status Filters, Overdue Detection)    │
│  ├── VendorManager (5 Pipeline States, Quotes vs Contracts, Contacts) │
│  ├── AIPlannerHub (10 Strategic Dimensions, Apply to Workspace)       │
│  └── RunOfShowExport (Printable Master Brief, JSON Backup/Restore)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP POST /api/plan & /api/ideas
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│       Full-Stack Backend API Proxy (Vite Dev Plugin & server.ts)       │
├────────────────────────────────────────────────────────────────────────┤
│  - Endpoint validation & boundary enforcement                          │
│  - GoogleGenAI SDK (`gemini-3.8-flash`) with User-Agent header         │
│  - Structured JSON response schema enforcement                         │
│  - High-precision Heuristic Fallback Engine if API key is absent       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Technology Stack
- **Frontend Framework:** React 19, TypeScript 5.8
- **Build Tool:** Vite 8.3
- **Styling:** Tailwind CSS 4.3 (warm ivory `#FAF7F2`, deep indigo `#312E81`, celebratory gold `#D97706`, slate `#1E293B`)
- **Icons:** Lucide React
- **Full-Stack Server:** Express 4.21 with `tsx` runner
- **GenAI SDK:** `@google/genai` (v2.4.0) with model `gemini-3.8-flash`
- **Testing:** Native automated verification test runner (`src/tests/runTests.ts`)

---

## 7. GenAI Service & Exact Usage
- **Service:** Google Gemini API via official `@google/genai` TypeScript SDK.
- **Model:** `gemini-3.8-flash`
- **Where GenAI is Used:**
  1. `/api/plan`: Generates the complete 10-dimensional celebration strategy, budget allocations, and milestone tasks based on event context.
  2. `/api/ideas`: Generates custom interactive creative ideas for user queries (decor, mocktails, favors, games).
- **Request & Response Flow:**
  - Client sends sanitized event parameters to backend `/api/plan`.
  - Backend initializes `GoogleGenAI` with `process.env.GEMINI_API_KEY` and sets `User-Agent: 'aistudio-build'`.
  - Gemini generates structured JSON matching the Celebria planning schema.
  - Backend parses, validates, and returns data with model attribution (`Gemini 3.8 Flash`).
  - If the API key is not configured or network disruptions occur, Celebria automatically transitions to the built-in deterministic planning engine, explicitly labeling the result with `isFallback: true`.

---

## 8. Data Storage & Persistence
- Versioned client-side storage (`celebria_ai_workspace_v1`) in `localStorage`.
- Automatic migration and fallback to seed templates if storage is corrupt.
- Full backup export to `.json` and restoration parser with structural validation.
- Zero server-side session leaks or unauthorized data exposure.

---

## 9. Security Decisions
- **Zero Client Credential Leakage:** `process.env.GEMINI_API_KEY` is strictly confined to the backend server and dev server middleware. Never exposed in browser bundles.
- **No API Key UI:** Adheres to Google AI Studio constraints; no client input fields for API keys.
- **Input Sanitization:** Numerical guest counts and budgets are bounded (`guestCount >= 1`, `budget >= 0`).
- **No Unsafe HTML:** All rendered AI responses use React text node escaping to eliminate XSS risks.

---

## 10. Accessibility Decisions (WCAG AA Compliance)
- **Contrast:** High-contrast text pairing (slate `#0F172A` on warm ivory `#FAF7F2` and `#FFFFFF` containers) exceeding 4.5:1 ratio.
- **Visible Focus Rings:** Distinct `focus-visible:ring-2 focus-visible:ring-indigo-600` on all interactive buttons, tabs, and form controls.
- **Screen Reader Readiness:** Form fields feature explicit `<label htmlFor="...">`, ARIA live alerts for budget overages, and `role="progressbar"` on progress gauges.
- **Tabular Figures:** All financial currencies, dates, and percentages enforce `tabular-nums` / `font-mono` to prevent layout jitter.
- **Color Independence:** Status indicators always pair color with text labels (e.g. `OVERDUE`, `Paid in Full`, `High`).

---

## 11. Testing Strategy & Actual Results
The automated verification suite was executed via `npm test`:

```
====================================================
 Celebria AI Automated Verification & Test Suite
====================================================

▶ Test Suite: Budget Calculations & Variance Logic
  ✓ PASS: Calculates total planned, actual, and remaining balance accurately
  ✓ PASS: Accurately detects over-budget conditions when planned exceeds total budget
  ✓ PASS: Handles zero-budget celebrations safely without NaN or division by zero
  ✓ PASS: Sanitizes invalid, negative, or non-numeric expense amounts
  ✓ PASS: Reconciles category-level summaries with grand total

▶ Test Suite: Event Creation & Validation Constraints
  ✓ PASS: Rejects empty event names during validation
  ✓ PASS: Enforces minimum guest count of at least 1 person
  ✓ PASS: Handles valid celebration creation for wedding, birthday, and community event

▶ Test Suite: Timeline Milestones & Overdue Logic
  ✓ PASS: Calculates milestone progress percentage accurately
  ✓ PASS: Correctly identifies overdue uncompleted tasks relative to target date

▶ Test Suite: Vendor Pipeline & Quote Reconciliation
  ✓ PASS: Tracks status transitions through pipeline (identified -> quoted -> booked)
  ✓ PASS: Calculates total contracted vs. quoted financial commitments

▶ Test Suite: GenAI Strategy & Contextual Adaptation
  ✓ PASS: Deterministic heuristic engine generates all 10 required celebration dimensions
  ✓ PASS: Adapts budget weights dynamically based on wedding vs birthday vs community event

▶ Test Suite: State Persistence & JSON Backup Integrity
  ✓ PASS: Initializes default state with 3 preloaded celebration templates
  ✓ PASS: Validates JSON backup import integrity and rejects malformed payloads

----------------------------------------------------
Summary: 16/16 tests passed (0 failed)
----------------------------------------------------
All automated tests executed and verified successfully! 🎉
```

- **Typecheck & Linting:** `npm run lint` (`tsc --noEmit`) passes with 0 errors.
- **Production Build:** `npm run build` (`vite build`) successfully produces production bundles in `dist/`.

---

## 12. Installation & Local Development Instructions

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x

### Environment Variables (`.env`)
```bash
# GEMINI_API_KEY: Required for Gemini AI API calls.
# Automatically configured in Google AI Studio or set locally:
GEMINI_API_KEY="your-gemini-api-key"

# PORT: Server port (defaults to 3000)
PORT=3000
```

### Installation
```bash
npm install
```

### Run Development Server
```bash
npm run dev
# Server starts on http://localhost:3000 with API proxy middleware
```

### Run Automated Tests
```bash
npm test
```

### Run Production Build
```bash
npm run build
```

### Run Full-Stack Production Server
```bash
npm start
# Launches Express server on port 3000 serving dist/ with /api/plan
```

---

## 13. Assumptions & Limitations
- **Vendor Discovery:** Celebria provides an active manual vendor tracking pipeline and negotiation question engine. It does not scrape live business directories or claim to send automated real-world booking inquiries without user action.
- **Local Persistence:** Event plans are stored in the user's browser `localStorage` for privacy, instant offline availability, and zero database setup. For long-term preservation, users can export and restore their structured `.json` backup file.
- **Legal & Contract Advice:** AI-generated negotiation scripts and contract tips are suggestions and do not constitute formal legal counsel.

---

## 14. Responsible AI Considerations
- **Transparent Attribution:** Every AI-generated output is accompanied by an attribution tag explicitly disclosing the active model (`Gemini 3.8 Flash` vs. `Celebria Heuristic Engine`).
- **No Stereotyping:** Planning recommendations adapt strictly to the user-supplied event parameters (guest count, budget, venue type, dietary choices, accessibility requirements) without making biased cultural or religious assumptions.
- **Inclusivity by Design:** Accessibility accommodations and dietary protocols are first-class citizens in every generated brief, ensuring celebrations are welcoming and safe for all attendees.
