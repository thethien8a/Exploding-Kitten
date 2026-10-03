# Tiến độ dự án Mèo Nổ

## Trạng thái hiện tại — 03/10/2026

- **Phase hiện tại:** 0 — chưa bắt đầu triển khai; mới tách kế hoạch thành tài liệu theo phase.
- **Đã có:** bản kế hoạch yêu cầu/kiến trúc; repository Git local đã khởi tạo và có cấu hình `origin`. Chưa kiểm tra quyền truy cập hay nội dung remote; chưa tính đây là bằng chứng tạo/deploy game trên GitHub.
- **Chưa có bằng chứng:** code, bản thử hạ tầng, tài khoản/gói Cloudflare được kiểm chứng, kết quả kiểm thử, URL chơi hoặc deploy.
- **Bước tiếp theo:** đọc [phase 0](phase-0-foundation.md), kiểm tra tài liệu luật và khả năng dùng Workers Free + Durable Objects SQLite/WebSocket; thực hiện prototype và lưu kết quả kiểm chứng trước khi chuyển phase.

## Theo dõi phase

Trạng thái dùng: **chưa bắt đầu**, **đang thực hiện**, **chờ kiểm chứng**, **bị chặn**, **hoàn thành**. Chỉ dùng **hoàn thành** khi điều kiện ra phase đã được chứng minh bằng kết quả thực tế. Không coi việc tạo file hay chạy lệnh không lỗi là đã đạt.

| Phase | Trạng thái | Bằng chứng nghiệm thu | Trở ngại / bước tiếp theo |
| --- | --- | --- | --- |
| 0 — Nền tảng | Chưa bắt đầu | Chưa có | Prototype hai trình duyệt, restart, Free |
| 1 — Game engine | Chưa bắt đầu | Chưa có | Chờ phase 0 |
| 2 — Multiplayer | Chưa bắt đầu | Chưa có | Chờ phase 1 |
| 3 — Khôi phục | Chưa bắt đầu | Chưa có | Chờ phase 2 |
| 4 — Giao diện | Chưa bắt đầu | Chưa có | Chờ phase 3 |
| 5 — Kiểm thử nhóm | Chưa bắt đầu | Chưa có | Chờ phase 4 |
| 6 — Deploy | Chưa bắt đầu | Chưa có | Chờ phase 5 và chấp thuận thao tác deploy |

## Quy tắc cập nhật và bàn giao

1. Khi bắt đầu: đối chiếu trạng thái file này với code, môi trường và kết quả kiểm thử; đổi phase thành **đang thực hiện** khi thực sự bắt đầu.
2. Khi có kết quả: ghi ngày, thao tác/lệnh hoặc kịch bản, đầu ra quan sát được và đường dẫn bằng chứng. Ghi rõ kiểm thử thất bại hoặc chưa chạy; không điền “đạt” khi chỉ dự đoán.
3. Khi có quyết định mới: ghi điều gì đã **chốt**, điều gì còn **đề xuất**, lý do, phương án không chọn và tài liệu/code cần cập nhật. Nếu thay đổi luật, số người hoặc phạm vi, hỏi người dùng trước.
4. Sau mỗi buổi: ghi trạng thái, lỗi còn mở, dịch vụ đang chạy và **một bước tiếp theo**. Không tự push hay deploy chỉ vì tài liệu đã hoàn thành.

## Nhật ký thực hiện

### 03/10/2026 — Tổ chức tài liệu

- **Thực hiện:** phân tách bản kế hoạch gốc thành README, bảy tài liệu phase và file tiến độ này; không sửa kế hoạch gốc.
- **Quan sát:** thư mục dự án lúc kiểm tra chỉ có kế hoạch gốc và metadata Git, chưa có mã nguồn ứng dụng.
- **Kết luận:** tài liệu được chuẩn bị; không có bằng chứng hoàn thành phase 0 hoặc phase nào khác.
- **Tiếp theo:** bắt đầu thử tính khả thi phase 0; ghi kết quả vào bảng trên và nhật ký.

### Mẫu cho lần cập nhật tiếp theo

- **Ngày / phase / mục tiêu:**
- **Đã làm, môi trường và cách chạy:**
- **Kết quả thực tế / đường dẫn bằng chứng:**
- **Điều kiện ra phase: đạt / chưa đạt / chưa thử (nêu cụ thể):**
- **Lỗi, giới hạn và quyết định mới:**
- **Dịch vụ còn chạy / dữ liệu cần giữ:**
- **Một bước tiếp theo:**
