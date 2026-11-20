# Thiết kế lại màn Giao dịch

Tham chiếu: `UI/transactions-redesign.html`, hai ảnh desktop/mobile và `UI/transactions-add-modal.png`.

## Phạm vi

- Dùng chung sidebar với Dashboard, bố cục responsive, giao diện sáng và font IBM Plex Sans.
- Tổng thu, tổng chi, chênh lệch và biểu đồ chi tiêu theo ngày tính trên dữ liệu thật.
- Tìm kiếm ghi chú, danh mục, ví/tài khoản và số tiền; lọc loại, ngày, danh mục, nhiều ví và khoảng tiền.
- Danh sách nhóm theo ngày, tải thêm, xem chi tiết, sửa và xác nhận xóa.
- Tổng hợp chi theo danh mục và xuất CSV theo toàn bộ kết quả đang lọc, không chỉ trang hiện tại.
- Form thêm/sửa: số tiền nhanh, danh mục mở rộng, ví/tài khoản, hôm nay/hôm qua, ghi chú, chu kỳ lặp, lưu và thêm tiếp.
- Giữ liên kết lọc từ Dashboard và các đường dẫn thêm/sửa hiện có.

## Hợp đồng API

Các API nằm sau middleware session, chỉ truy cập bản ghi của chủ tài khoản. Tiền lưu dưới dạng số nguyên cents.

| Phương thức | Đường dẫn | Công dụng |
| --- | --- | --- |
| GET | `/api/transactions` | Danh sách phân trang và tổng hợp thu/chi trên toàn bộ kết quả lọc |
| GET | `/api/transactions/analytics` | Tổng thu/chi, số giao dịch, chênh lệch, dữ liệu theo ngày và danh mục |
| GET | `/api/transactions/export` | CSV toàn bộ kết quả lọc |
| GET | `/api/transactions/:id` | Chi tiết giao dịch thuộc người dùng hiện tại |
| POST | `/api/transactions` | Tạo giao dịch, tùy chọn tạo lịch lặp |
| PUT | `/api/transactions/:id` | Sửa giao dịch, giữ nguyên loại thu/chi |
| DELETE | `/api/transactions/:id` | Xóa giao dịch, hoàn lại ảnh hưởng đến số dư ngân hàng |

Bộ lọc dùng chung: `type`, `categoryId`, `walletId`, `walletIds` (danh sách phân cách bằng dấu phẩy), `dateFrom`, `dateTo`, `amountFrom`, `amountTo`, `search`. `page` và `limit` chỉ có ý nghĩa với danh sách. Ví ngân hàng dùng định danh `asset-<uuid>`.

POST/PUT hỗ trợ `isRecurring` và `recurrenceInterval` (`weekly`, `monthly`, `yearly`). Số tiền và tham chiếu danh mục/ví được kiểm tra phía server. Thay đổi giao dịch và thay đổi số dư nằm trong cùng transaction SQLite.

## Kiểm chứng

Kiểm thử API dùng SQLite tạm, gồm phân quyền, tổng hợp vượt phạm vi phân trang, bộ lọc nhiều ví, tìm kiếm tiếng Việt, CSV, chu kỳ lịch và số dư ngân hàng. Kiểm tra trình duyệt gồm desktop/mobile, lọc, tải thêm, xuất, thêm/sửa/xóa, lưu tiếp và trạng thái lỗi/rỗng. Migration phải được thử trên cơ sở dữ liệu mới và bản sao schema cũ trước khi áp dụng local.

## Giao dịch định kỳ

`POST/GET /api/recurring`, `GET/PUT/DELETE /api/recurring/:id` và `POST /api/recurring/generate` quản lý lịch và tạo các kỳ đến hạn. Alias `/api/recurring-templates` được hỗ trợ. Khi bật lặp trong form giao dịch, server tạo bản ghi đầu tiên và lịch trong cùng transaction. Chỉnh sửa cập nhật lịch; tắt lặp hoặc xóa giao dịch sẽ dừng lịch liên kết. Worker chạy mỗi giờ khi server hoạt động; endpoint generate phục vụ tạo ngay. Các kỳ bị bỏ lỡ được tạo bù theo ngày đến hạn, không trùng; ngày cuối tháng và năm nhuận được giữ theo ngày bắt đầu.

## Migration và vận hành

Chạy `bun run db:migrate` trước khi chạy bản server mới. Lệnh dùng runner `apps/server/src/db/migrate.ts`, lưu ledger `_pf_migrations`, hỗ trợ database MVP chưa có ledger và giữ các cột ngân hàng đã được thêm thủ công. Các migration đã áp dụng không được sửa; runner kiểm tra hash và kiểm tra foreign key trước khi commit. Nếu kiểm tra thất bại, toàn bộ nâng cấp được rollback.

Trong lần triển khai local này, bản sao trước nâng cấp nằm tại `apps/server/data/backups/before-transactions-redesign-2026-10-25-d087b97a.db`. Database thử nghiệm browser nằm riêng, không ghi giao dịch thử vào dữ liệu local của người dùng.
