# Reports Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the reports screen to match the supplied desktop/mobile mockups with shared date filtering, period comparisons, insights, and report export.

**Architecture:** Keep the existing six report tabs and reporting data model. Extend the Hono report service/routes with range summaries, category comparisons, insights, and CSV export; consume them through React Query hooks. Use browser print for PDF output and a combined Chart.js component for the six-month cash-flow trend.

**Tech Stack:** Bun workspaces, React 19, TypeScript, Hono 4, Drizzle ORM, SQLite, TanStack Query, Chart.js.

**Spec:** `docs/superpowers/specs/2026-11-19-reports-redesign-design.md`

## Global Constraints

- Do not change the SQLite schema or authentication model.
- Keep monetary values in cents in the backend.
- Do not add a PDF dependency; use browser print for PDF output.
- Export only authenticated user's data and protect CSV cells from formula injection.
- Preserve unrelated existing workspace changes.

## Review Focus

- Periods that cross a month/year boundary must compare to the immediately preceding equal-length period; full months compare to the prior full month.
- A zero previous total must produce a null comparison percentage, never divide by zero.
- Missing transactions or budgets must render empty/omitted insight states without fabricated values.
- CSV quoting and formula-leading values must remain safe for spreadsheet software.
- The report controls and six tabs must remain usable at the mobile mockup width.

---

## File Structure

- `packages/shared/src/types/index.ts`: shared report summary, comparison, trend-rate, and insight types.
- `apps/server/src/services/reportService.ts`: range aggregation, previous-period comparison, insight generation, and report CSV formatting.
- `apps/server/src/routes/reports.ts`: validated report overview, insights, and export endpoints; preserve existing year/month overview callers.
- `apps/web/src/hooks/useReports.ts`: typed query hooks for new endpoints and an export mutation.
- `apps/web/src/pages/ReportsPage.tsx`: shared period state, overview cards, export controls, and range props for existing tabs.
- `apps/web/src/components/reports/CashflowTrendChart.tsx`: combined income/expense bars and savings-rate line.
- `apps/web/src/pages/reports.css`: page-specific responsive and print styling.

### Task 1: Add range-aware report summaries and insights

**Files:**
- Modify: `packages/shared/src/types/index.ts`
- Modify: `apps/server/src/services/reportService.ts`
- Modify: `apps/server/src/routes/reports.ts`

**Interfaces:**
- `ReportPeriodOverview`: `{ current: MonthlyOverview; previous: { startDate: string; endDate: string; overview: MonthlyOverview } | null; changes: { incomePercent: number | null; expensePercent: number | null; savingsPercent: number | null } }`.
- `ReportInsight`: `{ kind: 'savings' | 'budget' | 'top_expense'; title: string; description: string; amount?: number; percentage?: number; categoryId?: string; date?: string }`.
- Extend `CategoryExpense` with optional `previousAmount: number` and `changePercent: number | null` fields; add `ReportTabId` as `'overview' | 'categories' | 'trend' | 'budget' | 'assets' | 'annual'`.
- `getReportOverview(authUserId: string, startDate: string, endDate: string): ReportPeriodOverview`.
- `getReportInsights(authUserId: string, startDate: string, endDate: string): ReportInsight[]`.
- `getIncomeExpenseTrendRange(authUserId: string, startDate: string, endDate: string): TrendDataPoint[]` aggregates transactions within the exact selected range by calendar month.
- `GET /reports/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` returns the new range response; when dates are absent, retain the existing `year`/`month` behavior.
- `GET /reports/insights?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` returns `{ data: ReportInsight[] }`.
- `GET /reports/trend?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` returns month aggregates clipped to those exact dates; preserve `?months=6` for the rolling overview chart.
- `GET /reports/categories` adds `previousAmount` and `changePercent` per category when a previous range exists.
- `TrendDataPoint` adds `savingsRate`, computed as `(totalIncome - totalExpense) / totalIncome * 100`, or `null` when income is zero.

- [ ] Implement one previous-range helper in `reportService.ts`: a full calendar month maps to the prior full calendar month; every other range maps to the immediately preceding equal number of days.
- [ ] Implement `getReportOverview` using the existing monthly aggregation query pattern for both ranges, and return null percentages when the previous measure is zero or missing.
- [ ] Extend category aggregation to include the prior-range amount and percentage change, retaining existing category fields.
- [ ] Extend trend points with the savings rate without changing the current income/expense/average fields.
- [ ] Make the trend route return selected-range totals when explicit dates are supplied, while keeping the rolling `months` behavior for the overview chart.
- [ ] Implement `getReportInsights` from the selected-period summary, six-month trend, matching budget comparisons, and largest expense; show a budget insight only when the selected range is a single calendar month, and omit unsupported insights when source data is absent.
- [ ] Validate the new query parameters in `reports.ts`, retain the existing year/month overview path, and add the `/insights` handler.

### Task 2: Add authenticated CSV export for report tabs

**Files:**
- Modify: `apps/server/src/services/reportService.ts`
- Modify: `apps/server/src/routes/reports.ts`

**Interfaces:**
- `exportReportCsv(authUserId: string, tab: ReportTabId, startDate: string, endDate: string): string`.
- `ReportTabId`: `'overview' | 'categories' | 'trend' | 'budget' | 'assets' | 'annual'` in shared report types.
- `GET /reports/export?tab=<ReportTabId>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&assetHistoryPeriod=6|12|all` returns `text/csv; charset=utf-8` with a dated attachment filename. The optional history period applies to Assets and defaults to `12`, matching the tab.

- [ ] Add one CSV cell formatter that quotes values, escapes quotes, preserves finite numeric values (including negatives), and prefixes spreadsheet-sensitive text cells.
- [ ] Format one CSV for each report tab using existing report-service data; overview includes current/previous summary, categories includes category amounts and changes, and remaining tabs include their selected report rows.
- [ ] Add the authenticated export route with validated tab and date parameters and `Cache-Control: no-store`.

### Task 3: Connect the mockup layout to shared report state

**Files:**
- Modify: `apps/web/src/hooks/useReports.ts`
- Modify: `apps/web/src/pages/ReportsPage.tsx`
- Create: `apps/web/src/components/reports/CashflowTrendChart.tsx`
- Create: `apps/web/src/pages/reports.css`

**Interfaces:**
- `useReportOverview(startDate: string, endDate: string)` returns `ReportPeriodOverview`.
- `useReportInsights(startDate: string, endDate: string)` returns `ReportInsight[]`.
- `useExportReport()` accepts `{ tab: ReportTabId; startDate: string; endDate: string; assetHistoryPeriod: '6' | '12' | 'all' }` and downloads the API response.
- `ReportPeriod` is `{ preset: 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'custom'; startDate: string; endDate: string }`.
- `CashflowTrendChart` accepts the existing `TrendDataPoint[]` with `savingsRate` and renders income/expense bars with a savings-rate line.

- [ ] Add report-specific period presets for this month, last month, three months, six months, this year, and custom dates; keep one selected range in `ReportsPage`.
- [ ] Replace the current hero with the mockup title/header, month navigation, period summary, export menu, preset controls, and six report tabs.
- [ ] Build the overview with four KPI cards, a six-month cash-flow chart, and data-backed insight cards; show loading/empty states without placeholder figures.
- [ ] Pass the shared range to category and trend tabs; use the month containing `endDate` in Budget and the year containing `endDate` in Annual, while preserving the assets history selector.
- [ ] Keep category drill-down and existing tab charts/tables working with the shared range.
- [ ] Add CSV export for the active tab and a PDF action that opens the browser print dialog for the report page.
- [ ] Add page-scoped styles for desktop/mobile layouts and print, keeping only the report content visible in print output.

### Task 4: Compile the affected workspaces

**Files:**
- No additional files.

- [ ] Run `bun run typecheck` and resolve TypeScript errors in the touched report code.
- [ ] Run `bun run build` and confirm the web production build completes.

## Validation Note

No automated tests are added or run in this task. The final checks are TypeScript compilation and the existing production build commands.
