# Research: Service Decomposition Patterns — Personal Finance App

**Author:** Claude (Research)
**Date:** 2026-03-22
**Status:** Analysis Complete

---

## TL;DR — My Recommendation

**Option B (4 services)** is the right move, but **not yet**. The app is small, single-user-focused, and still evolving. Decompose when you hit one of these triggers:

- Docker image > 500 MB
- More than 2 developers working concurrently on different modules
- Need to scale reporting independently (heavy chart computation)
- Adding a public API or third-party integrations

Until then: **modular monolith** — split code into packages/domains, keep one database, gate with feature flags.

---

## 1. Bounded Contexts (Domain-Driven Design)

From analyzing the schema (14 tables) and existing services, here are the natural domain boundaries:

### BC-1: Identity & Access (`auth-service`)
**Responsibility:** User registration, login, sessions, account management.

| | |
|:---|:---|
| **Core aggregates** | `User`, `Session`, `Account`, `Verification` |
| **Public API** | `POST /auth/sign-in`, `POST /auth/sign-up`, `POST /auth/sign-out`, `GET /auth/session`, `POST /auth/change-password` |
| **Owns** | `user`, `session`, `account`, `verification` tables (better-auth managed) |
| **Does NOT own** | App data (profiles, transactions, budgets). No cross-cutting reads of business tables. |

> **Key insight:** better-auth owns this boundary entirely. The `user_profiles` table (app-level profile with currency/theme) is a **join point** — it belongs to BC-2 (Core).

---

### BC-2: Core Finance (`core-service`)
**Responsibility:** Transactions, categories, wallets, budgets — the daily-use CRUD core.

| | |
|:---|:---|
| **Core aggregates** | `Transaction` (root), `Category` (group+sub), `Wallet`, `Budget` (with line items) |
| **Public API** | `CRUD /transactions`, `CRUD /categories`, `CRUD /category-groups`, `GET /wallets`, `CRUD /budgets`, `GET /budgets/progress`, `GET /budgets/history` |
| **Owns** | `user_profiles`, `category_groups`, `categories`, `wallets`, `transactions`, `recurring_templates`, `budgets`, `category_budgets` |
| **Does NOT own** | Asset valuations (external price feeds may be needed later), Reporting computation |

> **Key insight:** `user_profiles` lives here despite containing auth references — it's the **application profile** (currency, theme), not the authentication identity. The FK `authUserId` is a read-only reference.

---

### BC-3: Wealth Tracking (`asset-service`)
**Responsibility:** Multi-asset portfolio, net worth, asset history.

| | |
|:---|:---|
| **Core aggregates** | `Asset` (root), `AssetHistory` (value log) |
| **Public API** | `CRUD /assets`, `GET /assets/networth`, `GET /assets/networth-history`, `POST /assets/:id/value` (update value + history snapshot) |
| **Owns** | `assets`, `asset_history` |
| **Does NOT own** | Wallets (separate concept — a wallet is a payment method, not an investment vehicle). Transactions that reference assets are owned by BC-2. |

> **Key insight:** Asset types include `bank`, `cash`, `gold`, `stock`, `savings`, `real_estate`, `debt`. Only `bank` and `cash` overlap semantically with BC-2's wallets, but they serve different purposes. Keep them separate but note the conceptual overlap.

---

### BC-4: Analytics (`analytics-service`)
**Responsibility:** Dashboard summaries, reporting, charts.

| | |
|:---|:---|
| **Core aggregates** | None (this is a read-heavy projection layer) |
| **Public API** | `GET /dashboard/summary`, `GET /reports/...` |
| **Owns** | Nothing directly. Reads from BC-2 and BC-3. |
| **Does NOT own** | Any source-of-truth data. This is a consumer. |

> **Key insight:** This service is the prime candidate for extraction first because it has **zero write operations** — it only aggregates data from other services. Extracting it has the lowest risk of data inconsistency.

---

## 2. Service Granularity Options

### Option A: Coarse-Grained (2 Services)

```
┌──────────────┐     ┌──────────────────────────────────────┐
│ Auth Service │     │           Core + Everything           │
│ (better-auth)│     │  transactions, categories, wallets,   │
│   :3001      │     │  budgets, assets, reports, settings   │
└──────────────┘     └──────────────────────────────────────┘
```

| Pros | Cons |
|:---|:---|
| Minimal operational overhead | Still a monolith in disguise — 8 domain modules in one service |
| Single deployment unit | Asset service and reporting are the most likely to need independent scaling — they're blocked |
| Shared SQLite trivially | Database becomes a bottleneck under load |
| Lowest migration effort | Team coordination still painful (8 modules, 1 service) |

**Verdict: Too coarse.** You get almost no benefits of decomposition while adding inter-service complexity if/when you grow.

---

### Option B: Medium-Grained (4 Services) — **Recommended When Ready**

```
┌────────────┐  ┌──────────────────┐  ┌────────────┐  ┌─────────────┐
│   Auth     │  │   Core Finance   │  │   Assets   │  │  Analytics  │
│ (better-   │  │  transactions,    │  │  assets,   │  │ dashboard,  │
│   auth)    │  │  categories,     │  │  asset_    │  │ reports,    │
│  :3001     │  │  wallets,        │  │  history   │  │ charts      │
│            │  │  budgets         │  │  :3003     │  │  :3004      │
│            │  │  :3002           │  │            │  │             │
└────────────┘  └──────────────────┘  └────────────┘  └─────────────┘
```

| Pros | Cons |
|:---|:---|
| Natural DDD boundaries match real domain lines | 4 databases to migrate and maintain |
| Analytics can scale independently (compute-heavy) | Shared SQLite becomes distributed data — need sync strategy |
| Asset service can add external price feeds (gold, stock) without touching core | Cross-service joins (e.g., net worth + budget) need API calls or shared read DB |
| Clear ownership: each team/dev owns one service | Operational complexity increases |
| Still manageable for 1-3 devs | |

**Verdict: Right target architecture.** This matches the 4 bounded contexts identified above. Extract Analytics first (zero writes), then Assets, then migrate Core.

---

### Option C: Fine-Grained (6-8 Services)

```
Auth | Transactions | Categories | Budgets | Assets | Wallets | Analytics | Settings
```

| Pros | Cons |
|:---|:---|
| Maximum independent scaling | Overkill for a personal finance app used by 1 person |
| Team boundaries map 1:1 | 8 databases, 8 deployments, 8× operational overhead |
| Each service is trivial to understand | `wallets` and `settings` as separate services is absurd at this scale |
| | Cross-service transactions (e.g., creating a transaction that references a wallet) become distributed sagas — complexity explodes |
| | Budget → CategoryBudget → Category is a tight cluster. Separating them is pure pain. |

**Verdict: Over-engineered.** This is the Netflix pattern. A personal finance app has zero need for this. You'd spend more time managing service boundaries than building features.

---

## 3. Recommended Service Design

**Transition path: Modular Monolith → 4-Services**

### Phase 1: Modular Monolith (Current → ~6 months)
Organize code as separate packages even before deployment separation:

```
packages/
├── auth/          # better-auth + session handling
├── core/           # transactions, categories, wallets, budgets
├── assets/         # assets, asset_history
└── analytics/     # dashboard, reports (imports from core/assets)
```

- Single database (SQLite)
- Single deployment
- Feature flags to enable/disable modules
- **Benefit:** Clean boundaries without operational overhead

### Phase 2: Extract Analytics (6-12 months)
The first extraction is the lowest risk:

- Analytics service gets its **own SQLite read replica**
- Core service writes to primary SQLite; analytics syncs via a simple event log or polling
- Analytics has **zero writes** → no data consistency risk
- Independent scaling for heavy chart computations

### Phase 3: Extract Assets (12-18 months)
- Natural boundary: assets don't share FKs with core tables (except `user_profiles`)
- Can use different storage strategy (e.g., PostgreSQL for assets if scaling)
- Independent deployment for future external integrations (stock/gold price APIs)

### Phase 4: Core + Auth (18+ months)
- Only if team grows or you add a public API
- Core and Auth can stay together for a long time — they're tightly coupled by design

---

## 4. API Contract Strategy

### REST Resource Naming Per Service

```
Auth Service (:3001/api/auth)
├── POST /sign-in
├── POST /sign-up
├── POST /sign-out
├── GET  /session
└── POST /change-password

Core Service (:3002/api)
├── GET/POST           /transactions
├── GET/PUT/DELETE    /transactions/:id
├── GET               /transactions/filters
├── GET/POST          /categories
├── GET/PUT/DELETE    /categories/:id
├── PATCH             /categories/:id/visibility
├── GET/POST          /category-groups
├── PUT/DELETE        /category-groups/:id
├── GET               /wallets
├── GET/POST          /budgets
├── PUT/DELETE        /budgets/:id
├── GET               /budgets/progress
├── GET               /budgets/history
├── POST              /budgets/copy-previous
└── GET/PUT           /settings/profile

Asset Service (:3003/api)
├── GET/POST          /assets
├── GET/PUT/DELETE    /assets/:id
├── POST              /assets/:id/value
├── GET               /assets/networth
└── GET               /assets/networth-history

Analytics Service (:3004/api)
├── GET               /dashboard/summary
└── GET               /reports/...
```

### Versioning Strategy

**URL path versioning for external APIs** (`/api/v1/...`), **no versioning for internal APIs** (services talk to each other directly, not over public HTTP).

```bash
# External API (mobile app, third-party)
GET /api/v1/transactions?month=2026-03

# Internal API (service-to-service)
GET :3002/api/transactions?month=2026-03
```

### Internal vs External API

| Concern | Internal | External |
|:---|:---|:---|
| Auth | Shared secret / mTLS | JWT Bearer token |
| Transport | HTTP/JSON (direct) | REST with versioning |
| Rate limiting | Per-service, permissive | Per-user, strict |
| Error format | Detailed (for debugging) | Sanitized (no internals leaked) |

---

## 5. Cross-Cutting Concerns

### Logging & Tracing

**Request ID propagation across services:**

```
┌─ Core Service ─┐  header: X-Request-ID: abc123
│                │──────────────────────────►
│                │   Asset Service           │
│                │──────────────────────────► Analytics Service
```

- Generate `X-Request-ID` at API gateway (or first service)
- Propagate via HTTP headers
- Log format: `{ timestamp, service, requestId, method, path, userId, duration_ms, status }`
- Use **pino** (Hono-compatible, structured JSON logging)
- Tool: **Grafana Tempo** or **OpenTelemetry** for distributed traces (Phase 2+)

### Error Handling

**Service-level error shape:**

```json
{
  "error": {
    "code": "CATEGORY_NOT_FOUND",
    "message": "Category with id 'xyz' does not exist",
    "requestId": "abc123"
  }
}
```

- `code`: Machine-readable string (use as enum)
- `message`: Human-readable (external-safe, no stack traces)
- `requestId`: For cross-service correlation

**Error propagation:** Each service catches its own errors and maps to standard shape. Downstream service errors propagate as-is (don't hide them behind generic 500s).

**Error codes by service:**

| Service | Prefix | Examples |
|:---|:---|:---|
| Core | `TXN_`, `CAT_`, `WAL_`, `BUD_` | `TXN_NOT_FOUND`, `CAT_DELETE_HAS_TRANSACTIONS` |
| Assets | `AST_` | `AST_NOT_FOUND`, `AST_INVALID_TYPE` |
| Analytics | `RPT_` | `RPT_INVALID_PERIOD` |
| Auth | (better-auth codes) | `INVALID_CREDENTIALS` |

### Shared Validation Schemas

**`packages/shared` package** (`@pf/shared`):

```
packages/shared/src/
├── schemas/
│   ├── transaction.ts    # Zod schemas for create/update
│   ├── category.ts
│   ├── budget.ts
│   ├── asset.ts
│   └── common.ts         # Pagination, date range, currency
├── types/                # TypeScript types (mirrors schemas)
├── constants/           # Category types, asset types, budget intervals
└── errors.ts            # Shared error code enum
```

All 4 services import from `@pf/shared`. Schemas are the **single source of truth** — validated at the service boundary, not duplicated.

---

## 6. Data Ownership Summary

### Recommended 4-Service Database Ownership

| Table | Core Service (:3002) | Asset Service (:3003) | Analytics (:3004) | Auth (:3001) |
|:---|:---:|:---:|:---:|:---:|
| `user` | — | — | — | ✅ |
| `session` | — | — | — | ✅ |
| `account` | — | — | — | ✅ |
| `verification` | — | — | — | ✅ |
| `user_profiles` | ✅ | R | — | — |
| `category_groups` | ✅ | — | R | — |
| `categories` | ✅ | — | R | — |
| `wallets` | ✅ | — | R | — |
| `transactions` | ✅ | — | R | — |
| `recurring_templates` | ✅ | — | R | — |
| `budgets` | ✅ | — | R | — |
| `category_budgets` | ✅ | — | R | — |
| `assets` | — | ✅ | R | — |
| `asset_history` | — | ✅ | R | — |

**R** = read-only access (no writes). Analytics service reads from Core and Asset databases to compute dashboards without owning any data.

### Shared Data Strategy

Since this app uses SQLite per service (not PostgreSQL), here's the practical approach:

1. **Core + Auth share SQLite** (via `user_profiles.authUserId` FK) — stay co-located in early phases
2. **Analytics** syncs via **polling** (simple cron, every 5 min) or **event log table** in Core's DB
3. **Asset** is fully independent — no shared tables
4. **Future:** If migrating to PostgreSQL → use **Foreign Data Wrappers** or **event sourcing** for cross-service reads

---

## 7. Decision Matrix — When to Extract Each Service

| Trigger | Analytics | Assets | Core Split |
|:---|:---|:---|:---|
| Docker image > 500 MB | ✅ | ✅ | — |
| > 2 devs working in parallel | ✅ | ✅ | — |
| Report queries slow down transaction writes | ✅ | — | — |
| Need stock/gold price API integration | — | ✅ | — |
| Need to share app with > 1 user concurrently | — | — | Re-evaluate |
| Public API needed | — | ✅ | ✅ |
| Database write contention | — | ✅ | — |

---

## 8. Implementation Roadmap

```
Now ─────────────────────────────────────────────────────────►
 │
 │  Phase 0: Modular Monolith
 │  ├── Restructure apps/server/src/ into packages/
 │  │   ├── src/services/core/      (transactions, categories, wallets, budgets)
 │  │   ├── src/services/assets/    (assets, asset_history)
 │  │   └── src/services/analytics/ (dashboard, reports)
 │  ├── @pf/shared validates all schemas in one place
 │  └── Single SQLite, single deployment
 │
 │  Phase 1: Extract Analytics (Month 6+)
 │  ├── New Docker service: analytics-service
 │  ├── Separate SQLite (read replica or polling)
 │  └── GET /dashboard/summary → :3004/api/dashboard/summary
 │
 │  Phase 2: Extract Assets (Month 12+)
 │  ├── New Docker service: asset-service
 │  ├── Own SQLite, no shared tables
 │  └── GET /assets/networth → :3003/api/assets/networth
 │
 │  Phase 3: Scale Core (Month 18+)
 │  ├── Core service stays monolith but is stable
 │  ├── Add PostgreSQL if needed
 │  └── Consider public API with versioning
```

---

## Summary

| Aspect | Decision |
|:---|:---|
| **Target architecture** | 4 services: Auth + Core + Assets + Analytics |
| **Start now?** | No — modular monolith first |
| **First extraction** | Analytics (lowest risk, zero writes) |
| **Database per service?** | Yes, but SQLite → PostgreSQL only when needed |
| **Shared package** | `@pf/shared` — Zod schemas, types, constants, error codes |
| **Versioning** | URL path (`/api/v1/`) for external only |
| **Cross-service data** | Polling or event log (no distributed transactions needed at this scale) |
| **Key principle** | This is personal finance, not enterprise SaaS. Operational simplicity beats theoretical purity. |
