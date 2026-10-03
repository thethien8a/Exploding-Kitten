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
