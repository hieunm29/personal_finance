# Plan: Viết file tổng quan sản phẩm 1.product.md

## Metadata
- **Created**: 2026-02-27
- **Status**: Ready for execution
- **Complexity**: Trivial (single file copy from draft)

## Objective
Copy nội dung từ `.sisyphus/drafts/product-overview.md` vào `doc/1.product.md`.

## Context
- Prometheus đã soạn toàn bộ nội dung tổng quan sản phẩm Personal Finance (263 dòng).
- Nội dung bao gồm: tầm nhìn, đối tượng người dùng, vấn đề cần giải quyết, tính năng chính, module chính, user flows, nguyên tắc thiết kế, so sánh với đối thủ, lộ trình phát triển.
- Draft đã hoàn chỉnh tại `.sisyphus/drafts/product-overview.md`.

## Pre-conditions
- File `doc/1.product.md` chưa tồn tại.
- Thư mục `doc/` đã tồn tại.

---

## Tasks

### Task 1: Tạo file doc/1.product.md
- **Action**: Đọc nội dung từ `.sisyphus/drafts/product-overview.md`, viết nguyên bản vào `doc/1.product.md`.
- **Source**: `.sisyphus/drafts/product-overview.md`
- **Target**: `doc/1.product.md`
- **Rule**: Giữ nguyên 100% nội dung, KHÔNG thêm bớt.
- **QA**: Đọc lại file vừa tạo, xác nhận đủ 9 mục chính (Tầm nhìn → Lộ trình) và ~263 dòng.

### Task 2: Cập nhật Memory Bank
- **Action**: Cập nhật `memory-bank/activeContext.md` — ghi nhận đã tạo file `doc/1.product.md`.
- **Detail**: Thêm vào mục "Các Thay đổi Gần đây": `- Tạo file doc/1.product.md — tổng quan sản phẩm đầy đủ.`
- **QA**: Đọc lại `activeContext.md`, xác nhận dòng mới xuất hiện.

### Task 3: Cleanup draft
- **Action**: Xóa file `.sisyphus/drafts/product-overview.md` sau khi Task 1 hoàn tất.
- **QA**: Xác nhận file draft không còn tồn tại.

---

## Final Verification Wave
- [x] `doc/1.product.md` tồn tại với nội dung đầy đủ 9 mục.
- [x] `memory-bank/activeContext.md` đã cập nhật.
- [x] `.sisyphus/drafts/product-overview.md` đã bị xóa.

## Acceptance Criteria
- File `doc/1.product.md` chứa nội dung chính xác từ draft, không thiếu sót.
