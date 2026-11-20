# Asset redesign — thiết kế

## Intent

Thiết kế lại màn Tài sản theo mockup trong `UI/assets-redesign-desktop.png` và `UI/assets-redesign-mobile.png`, giúp người dùng nhìn nhanh tài sản ròng, phân bổ, biến động và quản lý từng nhóm tài sản trong một luồng thống nhất.

## Goals

- Hiển thị tài sản ròng, tổng tài sản, tổng nợ và lãi/lỗ đầu tư trên hero card.
- Hiển thị phân bổ theo loại, lịch sử tài sản ròng và bộ lọc nhóm tài sản.
- Trình bày chi tiết khác nhau cho vàng, cổ phiếu, tiết kiệm, tiền mặt/ngân hàng, nợ và BĐS.
- Form tạo/sửa đổi trường theo loại tài sản, hỗ trợ tính giá trị/lãi lỗ ở phía client.
- Bổ sung API overview để frontend không phải tự ghép nhiều nguồn dữ liệu.

## Non-goals

- Không xây dựng nguồn giá thị trường tự động hoặc tích hợp bên thứ ba.
- Không thay đổi mô hình giao dịch hiện có ngoài việc giữ đồng bộ số dư tài khoản ngân hàng.
- Không thêm migration nếu schema hiện tại đủ chứa metadata theo loại.

## Approaches

1. **Tạo hẳn module tài sản mới** — tách hoàn toàn khỏi CRUD hiện tại; bị loại vì dễ phá liên kết giao dịch và định giá vàng đang dùng.
2. **Chỉ thay CSS/components hiện tại** — giữ nguyên payload nhưng không đủ dữ liệu nhóm/lãi/kỳ hạn cho mockup; bị loại vì sẽ đẩy logic vào frontend.
3. **Mở rộng service hiện tại + overview API và thay UI** — được chọn vì giữ tương thích API, gom phép tính ở backend, đồng thời cho phép form mockup dùng lại CRUD hiện có.

## Decisions

- Dùng `GET /api/assets/overview` trả summary, allocation, history và các nhóm asset đã chuẩn hoá.
- Giữ `GET/POST/PUT/DELETE /api/assets`, `PUT /api/assets/:id/value`, `GET /api/assets/networth*` để backward compatible.
- Metadata tiếp tục lưu JSON theo type; server chỉ tính các trường dẫn xuất và không tự động gọi nguồn giá ngoài.
- UI dùng CSS riêng, responsive breakpoint theo mockup; mobile chuyển bảng thành card.

