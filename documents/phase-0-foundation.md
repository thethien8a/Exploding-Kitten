# Phase 0 — Nền tảng và thử tính khả thi

**Mục tiêu:** chứng minh stack miễn phí có thể giữ một phòng, đồng bộ hai trình duyệt và khôi phục dữ liệu thử sau khi server restart **trước** khi xây toàn bộ game. Đọc mục 1, 2, 3 và 8 của [kế hoạch gốc](../meo-no-implementation-plan.md); trạng thái thực tế ở [PROGRESS.md](PROGRESS.md).

## Công việc

1. Lưu bản tham chiếu luật [Original Edition 2022](https://cdn.svc.asmodee.net/production-asmodeeca/uploads/2023/04/English.pdf) trong repository; dùng một phiên bản làm chuẩn, không trộn luật từ bản cũ hoặc bộ mở rộng. Đối chiếu FAQ chính thức khi luật chưa nói rõ; không tự thêm luật mới.
2. Kiểm tra tài liệu hiện hành và điều kiện dùng **Cloudflare Workers Free + Durable Objects SQLite + WebSocket Hibernation**. Đề xuất ban đầu là React/TypeScript/Vite, Worker phục vụ static assets/API và mỗi phòng một Durable Object. Nếu điều kiện Free/API không phù hợp, ghi bằng chứng và đề xuất phương án khác trước khi đầu tư tiếp; không tự bật gói trả phí.
3. Khởi tạo cấu trúc ứng dụng và công cụ chạy local/test phù hợp; kiểm tra API thực tế rồi khóa phiên bản và lockfile. Git local đã khởi tạo; kiểm tra quyền truy cập remote thay vì suy ra repo GitHub đã dùng được chỉ từ cấu hình `origin`.
4. Làm thử luồng tối thiểu: hai trình duyệt vào cùng một phòng, nhận cập nhật qua WebSocket; lưu một giá trị trong SQLite, khởi động lại tiến trình và xác nhận giá trị đó vẫn còn. Thử lại kết nối WebSocket sau restart; không cần triển khai bài hay luật ở phase này.
5. Ghi hướng dẫn chạy thử, kết quả quan sát được và yêu cầu cấu hình tối thiểu; không commit bí mật deploy.

## Điều kiện ra phase

- Hai phiên trình duyệt nhận cùng cập nhật từ một phòng; phòng khác không nhận nhầm.
- Giá trị đã lưu đọc lại được sau restart mà không dựa vào biến RAM; trình duyệt có thể kết nối lại.
- Có bằng chứng stack và cấu hình dự kiến không đòi nâng lên gói Paid; những hạn mức chưa đo được ghi là **chưa kiểm chứng**.
- Lưu lệnh/kịch bản, đầu ra và trở ngại trong [PROGRESS.md](PROGRESS.md). Chưa chứng minh được một điều kiện thì chưa chuyển phase.
