# Phase 3 — Lưu bền, tạm dừng và khôi phục

**Mục tiêu:** một ván tiếp tục đúng sau rớt mạng, hibernation hoặc tiến trình server khởi động lại, kể cả khi đang ở giữa một hành động. Đọc mục 3.2–3.3, 4 và 7 của [kế hoạch gốc](../meo-no-implementation-plan.md); phụ thuộc phase 2.

## Công việc

1. Lưu bền ID ván/phiên bản schema, ghế/phiên, chủ phòng, tay bài, chồng rút/bỏ, lượt nợ, hành động đang chờ, người bỏ qua, deadline, thông tin pause, ID lệnh và kết quả đã xử lý. Sau kiểm tra quyền và trạng thái, lưu **nguyên tử** trạng thái tiếp theo cùng kết quả lệnh rồi mới xác nhận/gửi góc nhìn; nếu lưu lỗi thì không báo thành công.
2. Xử lý lệnh và alarm không ghi đè nhau; ghi nhận kết quả ngẫu nhiên ở lần thành công đầu để resend sau mất ACK trả đúng kết quả cũ. Reconnect nhận snapshot phiên bản đúng và phần riêng đang xem, không phải tự đoán các sự kiện bị lỡ. Không để dữ liệu ván/phiên quan trọng chỉ trong RAM hay attachment của WebSocket.
3. Theo dõi mất kết nối: **đề xuất** heartbeat 10 giây, phát hiện im lặng sau 25 giây (cần kiểm tra trên điện thoại thật). Người còn sống rớt mạng thì tạm dừng, giữ bài, lượt, hành động chờ và **thời gian Nope còn lại**; khi tất cả người còn sống trở lại thì tiếp tục. Người đã bị loại rớt mạng không làm dừng ván. Hibernation không được hiểu nhầm là cả nhóm mất mạng.
4. Người còn sống rời chủ động vẫn giữ ghế và tạm dừng; nếu là chủ phòng, chuyển quyền cho người online còn lại để có thể hủy ván về phòng chờ. Mất mạng thụ động không làm đổi chủ phòng; nếu không còn ai online thì giữ trạng thái để thành viên hợp lệ quay lại. Không tự loại người vắng mặt. Chủ phòng có thể hủy ván; sau kết thúc giữ nhóm, xóa sẵn sàng và cho chọn lại 3/4/5 nhưng không ít hơn số người đang có.
5. Khôi phục từ storage sau restart, không chia bài hay chọn người đầu lại. Nếu kết nối thật bị mất, vào trạng thái tạm dừng/chờ reconnect; **không** chốt Nope đã quá hạn khi cả nhóm chưa trở lại. Dùng một alarm bền vững cho các lịch trong phòng; handler có thể chạy lại mà không làm tác dụng hai lần, không dùng timer RAM làm nguồn duy nhất. Đảm bảo deploy cập nhật tương thích schema ván đang chạy hoặc chờ ván kết thúc.
6. Dữ liệu phiên cùng trình duyệt cho phép lấy lại ghế; đổi thiết bị hoặc xóa dữ liệu phiên không được lấy ghế bằng tên. Chính sách dọn phòng **đề xuất** sau 7 ngày kể từ hoạt động người chơi cuối; heartbeat/alarm không gia hạn phòng trống. Ghi rõ thông báo phòng hết hạn.

## Điều kiện ra phase

- Khôi phục lượt thường, cửa sổ Nope, đang Xin Bài, Xem Tương Lai, cài bom và trường hợp đã lưu nhưng chưa ACK; không mất/lộ bài hoặc xử lý lại một hành động.
- Thử rớt mạng chủ phòng/người khác/người bị loại, nhiều người cùng rớt, tab mới thay tab cũ, giữ countdown và quyền chủ phòng theo quy ước.
- Thử lệnh cạnh tranh với alarm, alarm chạy lại, restart và dọn phòng; ghi kịch bản, kết quả quan sát, giới hạn còn lại vào [PROGRESS.md](PROGRESS.md).

## Kết quả triển khai — 04/10/2026

**Hoàn thành nghiệm thu local:** 153 test Vitest (92 luật + 61 phòng) và 19 kịch bản Playwright (7 hồi quy multiplayer + 12 recovery) đạt, retries 0; TypeScript, build, format và dry-run đạt. [PROGRESS](PROGRESS.md) ghi bằng chứng, những lần thử lỗi và giới hạn; [README](../README.md) ghi cách chơi/thử khôi phục và hợp đồng mạng.

- `worker/room.ts` sở hữu schema 1 / luật `original-2022`, ID ván, pause đóng băng Nope, reconciliation kết nối, quyền/chuyển chủ, hủy/tái đấu và lịch alarm chung. `worker/index.ts` khôi phục trong constructor, tuần tự hóa các mutation, transaction snapshot + ACK + alarm, auto-response heartbeat và dọn storage.
- Mặc định đã triển khai: heartbeat **10 giây**, phát hiện im lặng **25 giây**, TTL **7 ngày** từ hoạt động thực của người chơi; GET/heartbeat/alarm/replay không gia hạn. Đây là tham số vận hành local, chưa hiệu chỉnh qua điện thoại thật.
- Restart thực tế kiểm tra turn/favor/future/defuse/Nope với SQLite giữ nguyên, không reload browser, không chia/chọn người đầu lại và vẫn thao tác tiếp. Mất ACK rút hoặc Xáo Bài giữ kết quả lần đầu; lỗi SQLite không báo thành công. Fixture hợp lệ chỉ ghi khi runtime dừng; sau đó chạy Worker/alarm/mạng thật, không coi UI mock là recovery.
- Người sống offline giữ ghế/bài và pause; người bị loại offline không pause. Host rời chủ động chuyển quyền cho người online hoặc giữ cờ chuyển khi thành viên hợp lệ quay lại; cả nhóm rớt mạng thụ động vẫn giữ chủ cũ. Hủy/kết thúc về lobby, xóa ready, đổi capacity không dưới số ghế và bắt đầu ID mới.
- Client nối lại khi tab trở lại hoặc pong quá hạn, không dựa vào bảo đảm frame đóng của runtime. Chrome CDP ngừng JavaScript một tab rồi cho trở lại xác minh đúng bài/lượt mà không reload. UI có pause/countdown đóng băng, action khóa, host cancel, Quay lại ghế và thông báo phòng hết hạn.

**Bàn giao GitHub — 05/10/2026:** đã commit/push Phase 2–3 cùng bàn B và các bản sửa lên `origin/main`; xem [PROGRESS](PROGRESS.md) cho commit và trạng thái hiện tại.

**Giới hạn:** chưa deploy, chưa kiểm thử điện thoại/Safari thật, hibernation sau eviction/khôi phục qua deploy hoặc quota/CPU production. TTL dùng fixture timestamp đã cũ, không chạy liên tục 7 ngày. Schema tương thích đã kiểm tra cho snapshot Phase 2 không phiên bản; phiên bản schema/luật lạ bị từ chối chứ không tự chuyển đổi. Chưa nghiệm thu toàn bộ Phase 4; Phase 5–6 chưa bắt đầu.
