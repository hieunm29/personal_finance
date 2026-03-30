# Design: Sửa luồng cập nhật & hiển thị giá trị vàng

**Date:** 2026-03-21
**Status:** Approved

## Mục tiêu

Sửa 2 vấn đề trong luồng tài sản vàng:
1. **Display:** `getSubText` hiển thị "Giá mua" — nên hiển thị giá thị trường hiện tại
2. **Update:** `UpdateValueModal` nhập raw VND — nên nhập đơn giá VND/lượng rồi tự tính tổng

## Cơ sở dữ liệu & API

- **Không thay đổi** — API chỉ nhận `currentValue` (tổng VND, dạng cents)
- Metadata vàng: `{ unit, quantity, buyPrice }` — không đổi

## File thay đổi

### 1. `apps/web/src/components/assets/AssetList.tsx`

**Trước** (`getSubText`, case 'gold'):
```
"0.3 Lượng | Giá mua: 6.000.000đ"
```
`buyPrice` là giá mua gốc — không phản ánh thị trường.

**Sau:**
```
const currentUnitPrice = asset.currentValue / quantity
return `${qty} ${unit} | Giá TT: ${formatCurrency(currentUnitPrice)}/lượng`
```
`currentUnitPrice` là đơn giá thị trường hiện tại, tự động đúng sau mỗi lần user cập nhật giá.

### 2. `apps/web/src/components/assets/UpdateValueModal.tsx`

**Trước:**
- Label: "Giá trị mới (VND)"
- Value: `currentValue / 100` (tổng VND)
- Submit: gửi `Math.round(display * 100)` lên API

**Sau** (khi `asset.type === 'gold'`):
- Label: "Đơn giá mới (VND/lượng)"
- Value: `currentValue / quantity / 100` (đơn giá hiện tại)
- Preview: `"X lượng → Tổng: Yđ"`
- Submit: `newTotal = quantity × newUnitPrice`, gửi `Math.round(newTotal * 100)` lên API

**Non-gold:** giữ nguyên behavior hiện tại.

## Không thay đổi

- Backend API (nhận tổng VND, không cần biết loại asset)
- PnLDisplay (đã dùng `currentValue`, tự động đúng)
- Database schema
