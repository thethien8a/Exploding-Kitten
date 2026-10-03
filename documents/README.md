# Tài liệu triển khai Mèo Nổ theo phase

Đây là lộ trình **dự kiến triển khai**, không phải mô tả một game đã chạy. [Kế hoạch gốc](../meo-no-implementation-plan.md) lưu đầy đủ phạm vi đã chốt, luật Original Edition, lựa chọn kiến trúc, ma trận kiểm thử và nguồn tham khảo; giữ nguyên để đối chiếu. Các file dưới đây tách công việc theo thứ tự thực hiện. Khi cần chi tiết luật hay quy ước online, đọc kế hoạch gốc, nhất là mục 1–4. Các thông số kỹ thuật được ghi là *đề xuất* chưa phải kết quả đo hay API đã triển khai.

| Thứ tự | Tài liệu | Kết quả cần có trước khi chuyển phase |
| --- | --- | --- |
| 0 | [Nền tảng](phase-0-foundation.md) | Prototype hai trình duyệt, SQLite và WebSocket khôi phục sau restart; xác minh Free |
| 1 | [Game engine](phase-1-engine.md) | Luật, bài, lượt và bất biến được kiểm thử độc lập mạng |
| 2 | [Multiplayer](phase-2-multiplayer.md) | 3–5 phiên riêng, phòng và góc nhìn riêng, lệnh chống giả mạo/trùng |
| 3 | [Khôi phục](phase-3-recovery.md) | Mọi giai đoạn tồn tại qua restart; pause/reconnect không mất hoặc lộ bài |
| 4 | [Giao diện](phase-4-interface.md) | Chơi trọn ván trên desktop/điện thoại bằng giao diện tiếng Việt |
| 5 | [Kiểm thử nhóm](phase-5-group-testing.md) | Ma trận tình huống đạt; ghi bằng chứng và sửa lỗi cản trở chơi |
| 6 | [Deploy](phase-6-deployment.md) | Nhóm chơi qua link thật trên Free, reconnect/chơi ván mới được |

[PROGRESS.md](PROGRESS.md) là nơi theo dõi **trạng thái và bằng chứng thực tế**, không suy ra tiến độ từ việc đã viết tài liệu. Khi bắt đầu một phase, đọc file phase, các mục được dẫn trong kế hoạch gốc và tiến độ; khi kết thúc, ghi kết quả kiểm chứng, vấn đề còn mở và bước tiếp theo vào PROGRESS. Chỉ đánh dấu hoàn thành khi có bằng chứng đáp ứng điều kiện ra phase. Các kiểm thử riêng từng phase không thay thế kiểm thử nhóm và triển khai ở phase 5–6.

Nếu điều chỉnh kỹ thuật sau khi thử nghiệm, ghi quyết định, lý do và nơi thay đổi vào PROGRESS rồi sửa tài liệu phase liên quan. Không tự đổi luật, số người hay phạm vi đã chốt. Không dùng bảng giá hay API trong bản kế hoạch lập ngày 03/10/2026 mà không kiểm tra lại tài liệu chính thức tại lúc thực hiện.
