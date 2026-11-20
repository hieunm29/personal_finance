# Budget Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the responsive Budget screen and overview APIs represented by `UI/budget-redesign.html`.

**Architecture:** Add a profile-scoped `GET /api/budgets/overview?month=YYYY-MM` projection, retain existing budget CRUD/history routes, and render the page from React Query with a native editor dialog.

**Tech Stack:** Bun, Hono, SQLite/Drizzle, React 19, React Query, Zod, CSS.

**Spec:** `docs/superpowers/specs/2026-10-26-budget-redesign-design.md`

## Global Constraints

- All budget and transaction aggregates must be scoped to the authenticated profile.
- Monetary values remain integer cents over the API boundary.
- Invalid months and non-positive limits return validation errors.
- Mobile layouts must remain usable at 360px without horizontal overflow.

## Review Focus

- A month without a budget must render actionable copy/create cards — page test.
- A budget with no remaining days must not divide by zero — service test.
- Unbudgeted expense categories must be listed without being treated as zero-limit budgets — API test.
- Cross-user budget/category references must be rejected — service test.
- The editor must keep values and errors visible after a failed save — browser smoke check.

### Task 1: Overview API

**Files:** shared budget types/schemas, `apps/server/src/services/budgetService.ts`, `apps/server/src/routes/budget.ts`, server integration test.

- Add overview response fields for current totals, allocation, forecast, unbudgeted categories and six-month history.
- Validate month and preserve ownership/positive-limit checks.

### Task 2: Budget hooks and editor

**Files:** `apps/web/src/hooks/useBudget.ts`, `apps/web/src/components/budget/BudgetFormModal.tsx`, budget components.

- Add overview hook and invalidation for budgets, dashboard and reports.
- Replace raw icon labels with shared SVG category icons and make editor copy/limit controls accessible.

### Task 3: Responsive page

**Files:** `apps/web/src/pages/BudgetPage.tsx`, `apps/web/src/pages/budget.css`, `apps/web/src/components/layout/AppLayout.tsx`.

- Implement the mockup cards, filters, progress bars, history chart/list, empty state and mobile dialog.

### Task 4: Verification

- Run focused budget integration tests, full tests, typecheck/build, `git diff --check`, and desktop/mobile browser smoke checks.
