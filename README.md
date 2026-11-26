# Smart Roster Management System

A full-stack, constraint-aware operations roster management application built for multi-brand D2C CX teams. It separates **client operating demand** from **employee availability**, generates monthly team rosters across operational pods, detects hard and soft conflicts transparently, recommends ranked backup floats, supports manual live-validated overrides, and handles mid-month availability changes without rebuilding unaffected schedules.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions, Route Handlers)
- **Language:** TypeScript (strict mode)
- **Database & ORM:** SQLite with Prisma ORM (`prisma/schema.prisma`)
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix primitives) + Lucide icons
- **Testing:** Vitest (`src/lib/scheduler/__tests__/scheduler.test.ts`)
- **Export:** CSV & Excel (`.xlsx` via SheetJS `xlsx`)

---

## Key Features Implemented

1. **Master Configuration Without Code Changes (`/manage/*`)**
   - Manage **Operational Pods & Pod Leads**, **Employees** (roles, shift windows, max weekly workdays, preferred off days), **D2C Brands & Client Operating Rules** (`EVERY_DAY` / 365-day, `DAILY_NO_HOLIDAYS`, `NO_SUNDAYS_NO_HOLIDAYS`, `CUSTOM` day-specific min-staff overrides), **Processes** (`CS`, `ACC`, `NDR`, `RET`), **Primary & Backup Assignments**, **Public Holidays** (Global & brand-specific), and **Leaves / Comp-Offs**.
2. **Deterministic Monthly Roster Generator (`/roster/generate`)**
   - 7-step constraint solver (`src/lib/scheduler/engine.ts`) computing daily demand, locking immovable unavailability, assigning coverage-aware weekly offs, filling primary slots, activating backup floats, and running pure validation.
3. **Interactive Editor & Live Conflict Resolution (`/roster/[id]`)**
   - Click any cell in the monthly matrix to edit day status, shift window, or brand/process allocations with instant re-validation.
   - Displays **Hard Conflicts** (`UNCOVERED`, `UNDERSTAFFED`, `LEAVE_CLASH`, `INCOMPATIBLE_SHIFT`, `DOUBLE_BOOKED`, `CASCADING_GAP`, `WEEKLY_OFF_DEFICIT`) and **Soft Preferences** (`PREFERENCE_VIOLATED`, `FAIRNESS_WARNING`) separately.
   - One-click **Backup Resource Recommendations** ranked by explicit backup status, process training, pod affinity, and weekly load.
4. **Post-Generation Change Handler (`Handle Change` tab in Interactive Editor)**
   - Simulate an employee leave or sudden unavailability mid-month (`src/lib/scheduler/partial-regen.ts`): preserves all unaffected entries, evaluates whether multi-resource peers maintain coverage, flags single-resource brand gaps, and optionally auto-assigns backups.
5. **Five Stakeholder Views (`/views/*`)**
   - **Company-Wide View** (`/views/company`)
   - **Pod-Wise View** (`/views/pod`) with weekly-off fairness ledger
   - **Brand-Wise View** (`/views/brand`) with Daily Actual vs. Required headcount matrix
   - **Process-Wise View** (`/views/process`) across all brands
   - **Employee-Wise View** (`/views/employee`) with monthly calendar & brand/process chips
6. **CSV & Excel Export (`/api/roster/export`)**

---

## Pre-Seeded Realistic Dataset (`prisma/seed.ts`)

- **34 Active Employees** across **4 Operational Pods** (`Pod Alpha`, `Pod Beta`, `Pod Gamma`, `Pod Delta`), including 4 Pod Leads, 4 Backup Floats, and 26 Agents.
- **20 Fictional D2C Brands** reflecting the **80/20 topology**:
  - **16 Single-Resource Brands (80%)**: 1 dedicated employee covering all processes for the brand (including **3 cross-brand employees** covering 2 accounts each).
  - **4 Multi-Resource Brands (20%)**: `Vanguard Electronics`, `UrbanStride Footwear`, `Lumina Beauty`, and `Pulse Nutrition` demonstrating split processes, shared processes, and day-specific `minStaff = 2` overrides.
- **December 2026** pre-generated roster with 3 global public holidays and pre-seeded approved leaves/comp-offs demonstrating backup activations, multi-resource resilience, single-resource gaps, and cross-brand cascading gaps.

---

## Local Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
3. **Initialize database & run seed script:**
   ```bash
   npx prisma db push
   npm run db:seed
   ```
4. **Run automated test suite:**
   ```bash
   npm test
   ```
5. **Start development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

---

## Tell Us How You Think

### 1. How did you model employees, brands, processes, pods, and their relationships?
I separated the domain into four orthogonal layers in `prisma/schema.prisma`:
- **Organization (`Pod`, `Employee`)**: Employees belong to an operational pod and carry supply attributes (`role`: `AGENT | POD_LEAD | BACKUP_FLOAT`, `maxWeeklyWorkdays`, `preferredOffDay`, `shiftWindow`). Pods reference a designated Pod Lead.
- **Demand (`Brand`, `Process`, `BrandProcessConfig`, `PublicHoliday`)**: `BrandProcessConfig` stores each `(brandId, processId)` operating rule (`EVERY_DAY`, `DAILY_NO_HOLIDAYS`, `NO_SUNDAYS_NO_HOLIDAYS`, or `CUSTOM` with JSON day overrides) and `minStaff`. This guarantees a brand's operating calendar is strictly decoupled from employee schedules—even allowing two processes inside the same brand (e.g., `CS` vs `NDR`) to run on different calendars.
- **Allocation (`Assignment`, `TimeOff`)**: Instead of locking an employee to a single brand column, `Assignment` models a many-to-many join on `(employeeId, brandId, processId)` with `allocationType` (`PRIMARY` | `BACKUP`), `shiftWindow`, and `capacityWeight`. This handles 1-employee-many-processes (the 80% single-resource case), many-employees-1-process, and 1-employee-many-brands uniformly.
- **Generated Schedule (`Roster`, `RosterEntry`, `RosterAllocation`, `RosterConflict`, `RosterChangeLog`)**: Each employee-date has one `RosterEntry` status (`WORKING`, `WEEKLY_OFF`, `PUBLIC_HOLIDAY`, `PLANNED_LEAVE`, `COMP_OFF`, `UNAVAILABLE`) and zero or more `RosterAllocation` child rows listing every `(brand, process)` covered that day.

### 2. How does your system generate a roster and determine whether it satisfies the required constraints?
`runScheduler()` (`src/lib/scheduler/engine.ts`) executes a 7-step deterministic pipeline:
1. Build the month's calendar grid with Monday-aligned week buckets and global/brand holidays (`calendar.ts`).
2. Compute daily headcount `DemandSlot[]` from `BrandProcessConfig` (`demand.ts`).
3. Lock immovable absences: approved `PLANNED_LEAVE` / `COMP_OFF` / `UNAVAILABLE` and `PUBLIC_HOLIDAY` for employees whose primary brands do not operate on holidays (`supply.ts`).
4. Assign weekly offs week-by-week (`weekly-offs.ts`), scoring every candidate day so mandatory coverage (`uncoveredCount * 10000`) strictly overrides preferred off-days (`25`).
5. Allocate available `PRIMARY` staff to operating `DemandSlot`s (`coverage.ts`).
6. Activate `BACKUP` or same-pod `BACKUP_FLOAT` resources when primaries are short (`backup-recommender.ts`).
7. Run the pure validator `validateRoster()` (`validator.ts`) to audit the full schedule for 9 hard/soft conflict types (`UNCOVERED`, `UNDERSTAFFED`, `LEAVE_CLASH`, `INCOMPATIBLE_SHIFT`, `DOUBLE_BOOKED`, `CASCADING_GAP`, `WEEKLY_OFF_DEFICIT`, `PREFERENCE_VIOLATED`, `FAIRNESS_WARNING`). Every manual edit re-runs this exact same validator.

### 3. How did you handle the difference between single-resource brands and brands with multiple employees?
Both use the identical `DemandSlot` vs. `Assignment` abstraction, with distinct outcomes emerging naturally from staffing math:
- On **single-resource brands (~80%)**, if the brand runs `NO_SUNDAYS_NO_HOLIDAYS`, the employee's weekly off aligns cleanly with Sunday closure. If the brand runs `DAILY_NO_HOLIDAYS` or `EVERY_DAY`, giving that sole owner a rest day reduces primary coverage to `0`, so the scheduler either routes a pod `BACKUP_FLOAT` / designated `BACKUP` to cover that off day or flags an explicit `HARD` gap if no backup is available.
- On **multi-resource brands (~20%)**, the weekly-off solver orders peers by fewest Sunday offs so far and evaluates remaining working primaries against `minStaff`, automatically staggering weekly offs across the week without needing backups when remaining headcount meets `minStaff`.

### 4. What happens when an employee manages all processes for a brand but is unavailable on a required working day?
- During initial generation or post-generation change simulation (`applyEmployeeUnavailability()` in `src/lib/scheduler/partial-regen.ts`), the employee's entry becomes `PLANNED_LEAVE` / `COMP_OFF` / `UNAVAILABLE` and their allocations are cleared.
- Every operating process configured on their brand (`CS`, `ACC`, `NDR`, etc.) immediately fails the `actualStaff >= requiredStaff` check in `validateRoster()`, generating `UNCOVERED` hard conflicts.
- `rankBackupCandidates()` ranks available peers and pod floats by explicit backup status, process training, same-pod membership, and lowest weekly load—surfacing one-click **Assign Backup** actions in the Interactive Editor (or auto-assigning them if the manager enables auto-backup during partial regeneration).

### 5. How does your system handle conflicting requirements or insufficient staffing?
It **never silently hides invalid states**. Constraints are tiered into:
- **Hard constraints (`HARD`)**: client coverage (`UNCOVERED`, `UNDERSTAFFED`), approved leaves (`LEAVE_CLASH`), shift compatibility (`INCOMPATIBLE_SHIFT`), FTE overload (`DOUBLE_BOOKED`), cross-brand absences (`CASCADING_GAP`), and weekly workday caps (`WEEKLY_OFF_DEFICIT`). Publishing is blocked while hard conflicts remain unresolved.
- **Soft constraints (`SOFT`)**: preferred weekly-off overrides (`PREFERENCE_VIOLATED`) and long cross-week streaks (`FAIRNESS_WARNING`). When a preferred off-day collides with mandatory client coverage, client coverage wins automatically and a soft diagnostic explains why.

### 6. Which parts of the process did you automate, and which did you leave under human control? Why?
- **Automated:** Monthly calendar construction, operating-rule demand calculation, immovable leave/holiday locking, coverage-first weekly-off placement, automatic float activation for pre-designated backups, conflict detection, and ranked backup candidate scoring.
- **Human control:** Defining client rules & backup eligibility, approving leave requests, making ad-hoc cross-brand reassignments or accepting recommended backups during mid-month disruptions, and final roster publishing. Real CX operations carry nuances (client rapport, urgent priority shifts, employee burnout context) that software should surface and support rather than override silently.

### 7. If the company doubled its team and brand count, what would you change about your solution?
1. **Database & Deployment:** Move from local SQLite to managed PostgreSQL (or LibSQL/Turso) with composite indexes on `(rosterId, date)` and pagination/virtualization in the Company-Wide matrix (`70+ rows × 31 columns`).
2. **Solver Upgrade:** Replace greedy week-by-week weekly-off selection with an exact CP-SAT / MILP formulation (e.g., OR-Tools microservice or simulated annealing pass) to optimize global fairness and cross-brand swap chains across larger pod graphs.
3. **Background Jobs & Notifications:** Offload full-month generation to an async worker queue and trigger Slack/email alerts on published roster edits.

### 8. If you had one additional week to work on this, what would you improve first?
1. **Two-step swap recommendations:** Beyond suggesting idle floats, detect peer weekly-off swaps (e.g., *"Move Tara's Tuesday off to Thursday so Rohan's Tuesday leave causes zero gap on Pulse CS"*).
2. **Multi-month rolling state:** Track consecutive working days and Sunday-off fairness across month boundaries (e.g., Nov 28–30 carrying into Dec 1–4).
3. **Role-based Pod Lead approval workflow:** Let Pod Leads propose and approve pod-level changes before final Ops Director sign-off.
