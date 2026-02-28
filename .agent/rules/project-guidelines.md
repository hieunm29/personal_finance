---
trigger: always_on
---

# Hướng dẫn Dự án PDMS (Project Document Management System)

## Phương pháp Phát triển (Development Approach)

### Kiến trúc Sạch với Thiết kế hướng Tên miền (Clean Architecture & DDD)
* **Domain Layer:** Các thực thể lõi và logic nghiệp vụ.
* **Application Layer:** Các trường hợp sử dụng (use cases) và dịch vụ ứng dụng.
* **Interface Layer:** Các bộ điều khiển (controllers) và giao diện bên ngoài.
* **Infrastructure Layer:** Các phụ thuộc bên ngoài và các triển khai cụ thể.
* **Nguyên tắc:** Phân tách rõ ràng các mối quan tâm với mô hình domain làm trung tâm.

### Phát triển hướng Kiểm thử (TDD)
* Viết unit test trước khi triển khai tính năng.
* Tạo các kịch bản kiểm thử dựa trên yêu cầu.
* Triển khai mã nguồn tối thiểu để vượt qua các bài kiểm tra.
* Tái cấu trúc (refactor) trong khi vẫn duy trì độ bao phủ kiểm thử.
* **Công cụ Backend:** JUnit 5, Mockito, TestContainers.
* **Công cụ Frontend:** Jest, React Testing Library.
* **End-to-end:** Playwright.

### Hệ thống Thiết kế Fluent 2 (Fluent 2 Design System)
* Sử dụng các thành phần tùy chỉnh (custom components) theo nguyên tắc Fluent 2.
* **Quy định:** Không sử dụng nút nổi (floating buttons) theo yêu cầu dự án.
* Giao diện người dùng sạch sẽ, trực quan và phản hồi (responsive).
* **Lưu ý:** Tránh sử dụng Tailwind CSS.

## Phát triển Backend

### Triển khai Spring Boot
* Spring Boot 3.2.x với Java 17.
* RESTful API với Spring Web.
* Spring Security với xác thực JWT.
* Spring Data JPA để truy cập cơ sở dữ liệu.
* Flyway để quản lý di cư (migration) cơ sở dữ liệu.

### Chiến lược Xác thực (Authentication)
* Xác thực dựa trên JWT với access token và refresh token.
* **Thời gian hết hạn:** Access token (30 phút), Refresh token (7 ngày).
* Sử dụng BCrypt để mã hóa mật khẩu.
* Phân quyền dựa trên vai trò (Role-based authorization).

### Xử lý Tài liệu
* Lưu trữ tệp cục bộ (Local file system) với siêu dữ liệu (metadata) trong MySQL.
* Trích xuất văn bản từ nhiều định dạng tài liệu khác nhau.
* Đánh chỉ mục nội dung với **Elasticsearch**.
* Sử dụng Vector embeddings cho tìm kiếm ngữ nghĩa (semantic search).

## Phát triển Frontend

### Triển khai React
* React 18.x với TypeScript.
* **Redux Toolkit** để quản lý trạng thái.
* Sử dụng React Router để điều hướng và Axios để giao tiếp API.

### Cấu trúc Thành phần (Component Structure)
* Tách biệt giữa Container và Presentational components.
* Sử dụng Custom hooks cho các logic chia sẻ.
* Quy ước đặt tên nhất quán.

## Cơ sở hạ tầng (Infrastructure)

### Cấu hình Docker
* Sử dụng Docker Compose cho cả môi trường phát triển và sản xuất.
* Gắn kết Volume để lưu trữ dữ liệu bền vững.
* **Container hóa các dịch vụ:** backend, frontend, MySQL, Elasticsearch, Qdrant.

### Thiết kế Cơ sở dữ liệu
* **MySQL 8.0** cho dữ liệu quan hệ.
* Thiết lập chỉ mục (indexing) phù hợp để tối ưu hiệu suất.
* Kiểm soát phiên bản lược đồ (schema) bằng Flyway.

## Tiêu chuẩn Lập trình (Coding Standards)

### Quy tắc chung
* Tên biến và hàm phải có ý nghĩa.
* Xử lý lỗi toàn diện (comprehensive error handling).

### Backend & Frontend
| Quy tắc | Backend (Java) | Frontend (TS/React) |
| :--- | :--- | :--- |
| **Class/Component** | PascalCase | PascalCase |
| **Method/Function** | camelCase | camelCase |
| **Variable** | camelCase | camelCase |
| **CSS Classes** | N/A | kebab-case |

## Tài liệu (Documentation)
* **Mã nguồn:** JavaDoc cho API backend, JSDoc cho thành phần frontend.
* **Kiến trúc:** Sơ đồ kiến trúc hệ thống, tài liệu mối quan hệ giữa các thành phần.
* **API:** Sử dụng OpenAPI/Swagger.