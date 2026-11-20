# Budget redesign — design

## Intent

Rebuild `/budget` to match `UI/budget-redesign.html`, including a month navigator, budget health summary, category allocation, budget filters, six-month history and a mobile-friendly editor.

## Goals

- Use one authenticated overview API for current budget, category progress, unallocated categories, forecast metrics and history.
- Preserve existing CRUD/copy behavior and budget/category references.
- Make empty months actionable with copy-previous, suggested and custom creation paths.
- Keep money values in integer cents in API responses and render localized currency in the UI.

## Non-goals

- Automatic budget creation without an explicit user action.
- Changing existing budget persistence or category ownership rules.

## Approach

Extend the existing budget service with a scoped overview projection and keep existing endpoints as compatibility wrappers. Replace the inline-style page with a dedicated responsive CSS layout and a native dialog editor that reuses the existing React Query mutations.

## Decisions

- Forecast is based on current-month average daily expense projected through the last day of the month.
- Remaining daily allowance uses calendar days remaining, never a negative denominator.
- Category progress includes budgeted categories plus a separate list of expense categories without limits.
