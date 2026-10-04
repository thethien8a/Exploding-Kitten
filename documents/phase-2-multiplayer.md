# Phase 2 — Phòng chơi và multiplayer an toàn

**Mục tiêu:** nhiều phiên độc lập chơi cùng phòng, server quyết định trạng thái và chỉ gửi đúng góc nhìn cho từng người. Đọc mục 1, 2.3, 3.2–3.3 và 4.2 của [kế hoạch gốc](../meo-no-implementation-plan.md); phụ thuộc engine phase 1.

## Công việc

1. Tạo phòng ID khó đoán từ website, chủ phòng chọn đúng **3/4/5** ghế; mời bằng link không mật khẩu. Vào phòng bằng tên và phiên ẩn danh bí mật do server cấp; không có tài khoản, bot, ghép trận, chat hoặc người mới giữa ván.
2. Quản lý ghế, quyền chủ phòng, sẵn sàng, mời ra **trước ván**, bắt đầu chỉ khi đủ người và tất cả sẵn sàng. Trong phòng chờ, rời thì giải phóng ghế; nếu chủ phòng rời, chuyển quyền cho người online theo thứ tự ghế. Chặn bắt đầu sai điều kiện, kick giữa ván, join khi đang chơi. Luồng rời giữa ván, hủy và tái đấu hoàn thiện ở phase 3.
3. Một Durable Object xử lý một phòng: client chỉ gửi lệnh, server kiểm tra phiên, quyền, giai đoạn và phiên bản trạng thái rồi gọi engine; không nhận bài/lượt do client tự khai. Định nghĩa ID lệnh và kết quả để gửi lại không đánh/rút/xáo thêm lần nữa; phase 3 làm bền cơ chế này qua restart.
4. Phân góc nhìn: mỗi người thấy tay mình, số bài tay người khác và bài công khai; người bị loại chỉ xem diễn biến công khai, không có bài người còn sống. Kết quả Xem Tương Lai và lá nhận từ Xin Bài chỉ đến đúng người, sau khi hành động được chốt. Không gửi thứ tự chồng rút, vị trí cài bom, token hay tay người khác trong payload công khai/log.
5. Mở cửa sổ Nope tối đa **5 giây** trước hành động có thể bị chặn. Người còn sống, kể cả người đánh, có thể Nope hoặc bỏ qua; tất cả bỏ qua thì chốt sớm. Nope hợp lệ mở cửa sổ mới và xóa lựa chọn bỏ qua trước; server quyết định thứ tự và hạn chót, lệnh trễ bị từ chối. Phase 3 làm bền deadline/alarm và tạm dừng.
6. Chỉ một kết nối điều khiển mỗi ghế; tab mới có phiên hợp lệ thay tab cũ, tên trùng không chiếm ghế. Kiểm soát nguồn kết nối, kích thước và tần suất lệnh/tạo phòng để bảo vệ quota.

## Điều kiện ra phase

- 3–5 phiên trình duyệt tách biệt nhận đúng trạng thái; hai phòng không trộn bài hay người; người bị loại vẫn theo dõi được bàn công khai.
- Tên trùng, sai token, lệnh sai quyền/phiên bản, gửi lại lệnh và bấm hai lần không làm ván đổi sai hoặc lộ bài.
- Kiểm thử Nope chẵn/lẻ, bỏ qua đủ người, đến sát hạn/đến muộn và nhiều phản ứng cùng lúc. Ghi bằng chứng trong [PROGRESS.md](PROGRESS.md); khả năng sống sót qua restart là tiêu chí của phase 3, chưa suy ra từ kết quả ở đây.

## Kết quả triển khai — 04/10/2026

**Hoàn thành trên local:** 134 test Vitest (92 luật + 42 multiplayer) và 7 test Playwright đạt; TypeScript, build, format và dry-run đạt. Bằng chứng, giới hạn và các lần thử lỗi được ghi trong [PROGRESS.md](PROGRESS.md).

- `worker/room.ts` sở hữu validation, quyền/lobby, tích hợp engine, reaction và góc nhìn riêng. `worker/index.ts` sở hữu auth, WebSocket, SQLite và rate limit; hợp đồng mạng trong `shared/protocol.ts` và [README](../README.md).
- Snapshot và journal ACK đã lưu transaction SQLite để không phụ thuộc cache/RAM khi dùng hibernation. Đây là nền tích hợp cho Phase 3, chưa có nghiệm thu restart ván hoặc tương thích schema sau deploy.
- Phản ứng cùng phiên bản được tuần tự hóa: lệnh đầu thắng, lệnh sau bị `STALE_VERSION` và không tiêu bài. Người chơi phải đọc snapshot mới rồi gửi thao tác mới; không tự áp lại lệnh cũ với phiên bản khác.
- Có UI thử desktop/mobile cho các thao tác bài. UI fixture chỉ kiểm chứng render/lệnh client, không thay test engine/runtime; chưa nghiệm thu UX Phase 4 hoặc điện thoại thật.
- Tiếp nối đã nghiệm thu local ở [Phase 3](phase-3-recovery.md): pause/resume, heartbeat, alarm bền vững, recovery mọi giai đoạn, rời giữa ván/hủy/tái đấu và dọn phòng/journal. Các kết quả Phase 2 bên trên là mốc kiểm thử trước recovery; xem [PROGRESS](PROGRESS.md) cho trạng thái hiện tại. Chưa commit/push/deploy Phase 2–3.
