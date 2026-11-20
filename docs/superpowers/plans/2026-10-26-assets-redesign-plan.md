# Asset redesign — implementation plan

1. Add shared overview types and asset metadata helpers for derived fields.
2. Extend asset service with ownership-scoped overview, allocation, monthly history and per-type summaries; expose `GET /api/assets/overview`.
3. Add React Query hook and replace `AssetsPage` with mockup-aligned hero, charts, filter chips, grouped tables/cards and responsive editor.
4. Keep existing mutations, wire invalidation for overview/net-worth/history, and add integration coverage for summary, ownership and type-specific calculations.
5. Run typecheck, full tests, production build, and a desktop/mobile smoke check.

