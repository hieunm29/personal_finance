# Categories redesign — design

## Intent

Rebuild `/categories` to match `UI/categories-redesign.html` while preserving existing category data and making every control functional. Desktop uses grouped category cards with a sticky editor; mobile uses the same editor as a bottom sheet.

## Goals

- Show income/expense tabs, counts, search, hidden-category toggle and grouped tiles.
- Edit name, color, icon and visibility from a real editor.
- Create categories/groups, edit groups, delete categories with transaction replacement.
- Add API support for group deletion, ordering and usage metadata, scoped to the authenticated profile.

## Non-goals

- Changing the database meaning of categories or migrating existing names/icons.
- Adding drag-and-drop before the API contract is stable.

## Approach

Keep the current REST resources and React Query hooks, add narrowly scoped category/group endpoints, and replace only the page/form presentation. This keeps transaction/budget references compatible and lets the editor invalidate the existing category queries after every mutation.

## Decisions

- Use native dialogs for mobile sheet behavior and a sticky panel for desktop.
- Use the shared `TransactionCategoryIcon` SVG map so category IDs never render as raw text.
- Enforce ownership, default-group/category protections, and replacement validation in the service layer.
