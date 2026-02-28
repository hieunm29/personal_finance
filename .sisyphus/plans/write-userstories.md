# Plan: Copy User Stories Drafts to doc/

## Metadata
- **Created**: 2026-02-27
- **Status**: Ready for execution
- **Complexity**: Trivial (8 file copies + memory bank update + cleanup)

## Objective
Copy 8 user story draft files từ `.sisyphus/drafts/` vào `doc/`, cập nhật Memory Bank, và xóa drafts.

## Context
- Prometheus đã soạn 8 file user stories nhóm theo tính năng, sắp xếp theo ưu tiên (Phase 1 → Phase 3).
- Tổng cộng **59 user stories** bao phủ 7 modules.
- Drafts đã hoàn chỉnh tại `.sisyphus/drafts/2[a-h].userstories_*.md`.

## File Mapping

| # | Source (draft) | Target (doc) | Module | Phase | Stories |
|:--|:---|:---|:---|:---|:--|
| 1 | `2a.userstories_authentication.md` | `doc/2a.userstories_authentication.md` | Auth & User Mgmt | MVP | 6 |
| 2 | `2b.userstories_transaction.md` | `doc/2b.userstories_transaction.md` | Transaction Engine | MVP | 9 |
| 3 | `2c.userstories_category.md` | `doc/2c.userstories_category.md` | Category Mgmt | MVP | 7 |
| 4 | `2d.userstories_dashboard.md` | `doc/2d.userstories_dashboard.md` | Dashboard | MVP | 7 |
| 5 | `2e.userstories_budget.md` | `doc/2e.userstories_budget.md` | Budget Planner | Phase 2 | 7 |
| 6 | `2f.userstories_asset.md` | `doc/2f.userstories_asset.md` | Asset Tracker | Phase 2 | 10 |
| 7 | `2g.userstories_report.md` | `doc/2g.userstories_report.md` | Reporting | Phase 2 | 9 |
| 8 | `2h.userstories_settings.md` | `doc/2h.userstories_settings.md` | Settings | Phase 3 | 7 |

## Pre-conditions
- 8 draft files tồn tại trong `.sisyphus/drafts/`.
- Thư mục `doc/` đã tồn tại.

---

## Tasks

### Task 1: Copy 8 draft files to doc/
- **Action**: Đọc từng file trong `.sisyphus/drafts/2[a-h].userstories_*.md`, viết nguyên bản vào `doc/`.
- **Rule**: Giữ nguyên 100% nội dung, KHÔNG thêm bớt.
- **Command**: `cp .sisyphus/drafts/2a.userstories_authentication.md doc/` (repeat for all 8 files).
- **QA**: Đọc `doc/` directory listing → xác nhận 8 file mới tồn tại. Spot-check 2 file (đầu và cuối) so nội dung.

### Task 2: Cập nhật Memory Bank
- **Action**: Cập nhật `memory-bank/activeContext.md`.
- **Detail**: Thêm vào mục "Các Thay đổi Gần đây":
  ```
  - Tạo 8 file user stories trong `doc/`: authentication, transaction, category, dashboard, budget, asset, report, settings.
  ```
- **QA**: Đọc lại `activeContext.md`, xác nhận dòng mới xuất hiện.

### Task 3: Cleanup drafts
- **Action**: Xóa 8 file draft trong `.sisyphus/drafts/2[a-h].userstories_*.md`.
- **QA**: Xác nhận `.sisyphus/drafts/` trống.

---

## Final Verification Wave
- [x] 8 file `doc/2[a-h].userstories_*.md` tồn tại.
- [x] Nội dung files trong `doc/` khớp với drafts.
- [x] `memory-bank/activeContext.md` đã cập nhật.
- [x] `.sisyphus/drafts/` đã sạch.

## Acceptance Criteria
- 8 file user stories nằm trong `doc/`, nội dung chính xác từ draft.
- Memory Bank phản ánh thay đổi mới.
