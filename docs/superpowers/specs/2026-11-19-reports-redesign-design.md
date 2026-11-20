# Thiết kế: Làm mới màn Báo cáo

## Mục tiêu

Làm lại trang Báo cáo theo mockup desktop/mobile trong `UI/reports-redesign-*`, giữ sáu nhóm báo cáo hiện có và dùng dữ liệu thật. Bộ lọc kỳ dùng chung cho các tab; trang tổng quan có bốn KPI, biểu đồ dòng tiền sáu tháng và các điểm nổi bật. Người dùng có thể xuất CSV và lưu bản in dạng PDF.

## Phạm vi

- Cập nhật trang React, bộ lọc kỳ dùng chung, giao diện responsive, trạng thái tải/rỗng và điều khiển xuất báo cáo.
- Mở rộng Hono report API/service để trả tổng thu/chi của kỳ, số liệu kỳ liền trước, phần trăm thay đổi và dữ liệu insight cần cho trang tổng quan.
- Bổ sung API xuất CSV theo kỳ/tab. PDF được tạo từ chế độ in của trình duyệt để tránh thêm thư viện PDF phía server.
- Giữ các tab danh mục, xu hướng, ngân sách, tài sản và báo cáo năm; đồng bộ kỳ đã chọn vào các tab có dữ liệu tương ứng.

## Không làm

- Không thay đổi sidebar, trang dashboard, giao dịch hay mô hình dữ liệu.
- Không đưa các khối ghi chú triển khai/API và trạng thái minh họa trong mockup vào giao diện sản phẩm.
- Không thêm dependency PDF hoặc thay đổi cơ chế xác thực.

## Các hướng đã cân nhắc

1. **UI thuần, dùng các API hiện tại:** ít phạm vi backend hơn, nhưng không đáp ứng so sánh kỳ tùy chỉnh và xuất báo cáo như mockup.
2. **UI và API báo cáo (được chọn):** thêm dữ liệu tổng hợp theo kỳ, so sánh kỳ trước, insight và xuất CSV; PDF dùng luồng in của trình duyệt. Hướng này phù hợp với lựa chọn của người dùng và các ghi chú chức năng trong mockup.
3. **Mockup tĩnh:** không phù hợp vì trang hiện tại đã kết nối tới dữ liệu người dùng và các báo cáo cần tiếp tục hoạt động.

## Quy tắc dữ liệu

- Khoảng so sánh là khoảng ngay trước kỳ đang chọn, có cùng số ngày; với một kỳ trọn tháng thì so sánh tháng trọn liền trước.
- Giá trị tiền giữ đơn vị cents theo backend hiện tại; phần trăm thay đổi là `null` khi kỳ trước bằng 0.
- Insight được tổng hợp từ giao dịch, ngân sách và sáu tháng xu hướng. Khi không đủ dữ liệu hoặc chưa có ngân sách, ẩn insight tương ứng thay vì hiển thị số giả.
- CSV tuân theo quy tắc quoting và bảo vệ công thức CSV hiện có; chỉ xuất dữ liệu thuộc người dùng đã xác thực.

## Ranh giới triển khai

- Frontend: ReportsPage, hook báo cáo và component biểu đồ/điểm nổi bật cần thiết; thêm stylesheet riêng cho trang báo cáo nếu cần.
- Backend: route và service báo cáo; không thay đổi schema SQLite.
- Giữ nguyên các sửa đổi chưa commit khác trong workspace. Cách xác minh sẽ theo các lệnh typecheck/build sẵn có sau khi thiết kế được duyệt.

## Chỗ còn để người triển khai quyết định

- Nhãn và cách trình bày kỳ trước trong thẻ KPI.
- CSV chứa phần tóm tắt kỳ hiện tại và breakdown danh mục; bản in PDF chỉ in trang báo cáo đang mở.
- Với tab ngân sách, dùng tháng tương ứng với kỳ đang chọn; với tab tài sản, giữ bộ chọn lịch sử net worth hiện có.
