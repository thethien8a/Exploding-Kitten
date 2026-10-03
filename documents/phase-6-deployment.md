# Phase 6 — Deploy Free và nghiệm thu qua link thật

**Mục tiêu:** nhóm vào bằng link thật, chơi hết ván và ván tiếp, mất mạng quay lại không sai bài/lượt. Đọc mục 8–9 của [kế hoạch gốc](../meo-no-implementation-plan.md); phụ thuộc phase 5. Deploy, push lên remote và thay đổi hạ tầng chỉ thực hiện khi người dùng cho phép thao tác cụ thể.

## Công việc

1. Kiểm tra lại [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) và API/migration hiện hành; số hạn mức trong kế hoạch gốc là số **đã kiểm tra tại lúc lập kế hoạch**, không phải cam kết còn đúng lúc deploy. Xác minh tài khoản đang ở Free; nếu quy trình yêu cầu nâng gói hoặc thẻ, dừng và trao đổi, không tự bật Paid.
2. Chuẩn bị mã nguồn, lockfile và README tiếng Việt: chạy local, test, deploy/cập nhật, quota, lỗi thường gặp, cách khôi phục. Không đưa token hay bí mật deploy vào Git. Chỉ push/deploy sau khi được chấp thuận.
3. Cấu hình GameRoom binding, SQLite migration, static assets và đường dẫn SPA/API/WebSocket theo tài liệu Cloudflare tại thời điểm thực hiện. Build, deploy Free bằng công cụ chính thức; mở trực tiếp link phòng trên điện thoại để kiểm tra HTTPS và kết nối.
4. Smoke test trên môi trường đã deploy: 3–5 người vào bằng link, chia bài, Attack/Nope/combo, dừng/kết nối lại, khôi phục qua restart phù hợp môi trường, hết ván và chơi ván tiếp. Theo dõi request, CPU, độ trễ và quota sau buổi thử; hạn mức tài khoản dùng chung, vượt Free có thể lỗi.
5. Giữ giới hạn tạo phòng, tần suất lệnh và thời gian lưu; khi lỗi quota, thông báo dễ hiểu. Chỉ bổ sung deploy tự động từ GitHub nếu sau này cần và được thống nhất.

## Điều kiện nghiệm thu

- Có URL hoạt động, kiểm tra trực tiếp link phòng, HTTPS/WebSocket và bằng chứng nhóm hoàn thành ván, tái đấu, reconnect trên thiết bị thật.
- Kiểm chứng không lộ bài; quyền chủ phòng, hủy và khôi phục giữ đúng trạng thái sau các tình huống đã chốt.
- Ghi URL, thời điểm, tài khoản/gói được xác nhận, số đo quota, kết quả smoke test và giới hạn còn lại vào [PROGRESS.md](PROGRESS.md). Không gọi “Free đáp ứng ổn định” khi chưa có số đo thực tế.
