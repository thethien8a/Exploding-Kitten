# Tài liệu kỹ thuật và lịch sử phát triển Mèo Nổ

Hệ thống đã hoàn thiện chức năng và giao diện; **Phase 0–4 hoàn thành**, Phase 4 được chủ dự án nghiệm thu sau khi kiểm thử cùng nhóm người chơi ngày 09/10/2026. [README dự án](../README.md) mô tả cách chơi, luật nhóm hiện tại, cài đặt và vận hành. [PROGRESS](PROGRESS.md) ghi trạng thái, bằng chứng và lịch sử bàn giao.

Các tài liệu phase lưu thiết kế và các mốc triển khai. [Kế hoạch gốc](../meo-no-implementation-plan.md) giữ nguyên để đối chiếu lịch sử; các quy tắc cũ như tay 8 lá, Attack cộng dồn hoặc pause khi offline đã được thay bằng luật hiện tại trong README, không dùng làm mô tả bản đang chạy.

| Phase | Tài liệu | Nội dung / trạng thái |
| --- | --- | --- |
| 0 | [Nền tảng](phase-0-foundation.md) | Hoàn thành — nền Cloudflare, SQLite và WebSocket |
| 1 | [Game engine](phase-1-engine.md) | Hoàn thành — luật, bài, lượt và bất biến độc lập mạng |
| 2 | [Multiplayer](phase-2-multiplayer.md) | Hoàn thành — 3–5 phiên riêng, phòng/bài kín, lệnh chống giả mạo và trùng |
| 3 | [Khôi phục](phase-3-recovery.md) | Hoàn thành — lưu/khôi phục bài/lượt, chống thực hiện lại và vòng đời phòng |
| 4 | [Giao diện](phase-4-interface.md) | Hoàn thành — giao diện đã được chủ dự án và nhóm người chơi nghiệm thu |
| 5 | [Kiểm thử nhóm](phase-5-group-testing.md) | Đã có kiểm thử với nhóm; theo dõi ma trận chi tiết riêng trong PROGRESS |
| 6 | [Deploy](phase-6-deployment.md) | Hướng dẫn triển khai và kiểm chứng hạ tầng; trạng thái vận hành ghi trong PROGRESS |

[PROGRESS.md](PROGRESS.md) phân biệt kiểm thử tự động, nghiệm thu do người dùng xác nhận và số đo hạ tầng. Những nhật ký có ngày phản ánh bản mã tại thời điểm đó, không ghi đè lịch sử để khớp bản mới. Nghiệm thu giao diện không tự suy ra quota, chi phí hoặc khả năng khôi phục qua deploy production.

Khi thay đổi luật hoặc kỹ thuật, cập nhật README, phần trạng thái hiện tại và tài liệu liên quan; giữ bằng chứng và lý do trong nhật ký. Đối chiếu bảng giá/API chính thức tại lúc triển khai. Push, deploy và thay đổi hạ tầng vẫn cần được chấp thuận cho thao tác cụ thể.
