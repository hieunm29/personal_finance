# Categories Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the Categories screen and supporting APIs represented by `UI/categories-redesign.html`.

**Architecture:** Keep existing Hono category resources and React Query data flow. Add service-level group deletion/order/usage operations, then compose a responsive page with a shared editor and SVG icon picker.

**Tech Stack:** Bun, Hono, SQLite/Drizzle, React 19, React Query, React Hook Form, Zod, CSS.

**Spec:** `docs/superpowers/specs/2026-10-26-categories-redesign-design.md`

## Global Constraints

- All category and group queries must be scoped to the authenticated profile.
- Existing transaction and budget foreign-key references must remain valid.
- API validation uses shared Zod schemas and semantic HTTP status codes.
- Mobile editor must remain usable at 360px width without horizontal overflow.

## Review Focus

- Search and hidden toggles must not mutate server state unexpectedly — page interaction test.
- Deleting a group with categories/transactions must return a clear conflict — service test.
- Replacement category must belong to the same user and type — API test.
- Unknown icon IDs must render an SVG fallback, never raw icon text — component test.
- Narrow viewport editor must be scrollable and dismissible — browser smoke check.

### Task 1: Category APIs

**Files:** `packages/shared/src/schemas/index.ts`, `apps/server/src/services/categoryService.ts`, `apps/server/src/routes/categories.ts`, `apps/server/src/routes/category-groups.ts`, tests under `apps/server/src/services/`.

- Add validated group delete, category/group reorder, and category usage summary operations.
- Preserve ownership/default protections and use 409 for non-empty group deletion.
- Test success, cross-user rejection, replacement type mismatch and conflict paths.

### Task 2: Category hooks and icon/editor components

**Files:** `apps/web/src/hooks/useCategories.ts`, `apps/web/src/hooks/useCategoryGroups.ts`, `apps/web/src/components/category/*`, `apps/web/src/components/transaction/TransactionCategoryIcon.tsx`.

- Add mutations/query types for new APIs and invalidate categories, groups, transactions and budgets.
- Replace text icon picker with searchable SVG icon grid and accessible color/visibility controls.

### Task 3: Responsive Categories page

**Files:** `apps/web/src/pages/CategoriesPage.tsx`, `apps/web/src/pages/categories.css`.

- Implement mockup layout, grouped tiles, search, tabs, hidden state, selection and native mobile editor dialog.
- Wire create/edit/delete/group actions to the real hooks.

### Task 4: Verification

- Run focused service/component tests, typecheck, `git diff --check`, and a Playwright desktop/mobile smoke check against the existing dev servers.
