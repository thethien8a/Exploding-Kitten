# Phase 4 — Giao diện tiếng Việt, dễ chơi trên điện thoại

**Mục tiêu:** người chơi thao tác được trọn ván trên trình duyệt máy tính/điện thoại mà không dùng công cụ phát triển. Đọc mục 1, 2.3 và 5 của [kế hoạch gốc](../meo-no-implementation-plan.md); phụ thuộc phase 3.

## Phần đã triển khai theo yêu cầu — 04/10/2026

Người dùng chọn **B — Vòng bạn bè**: sau khi bắt đầu, cả nhóm chuyển sang màn hình bàn oval riêng, chồng bài ở giữa, ghế quanh bàn và tay bài riêng phía dưới. Ghế của người xem luôn ở dưới, giữ thứ tự vòng của phòng; thông tin lượt, số bài, mất kết nối/bị loại nằm trên từng ghế. Lá đánh/combo/Nope xuất hiện công khai kèm người đánh, có hiệu ứng và hỗ trợ giảm chuyển động; reconnect không phát lại diễn biến cũ.

Menu Phòng chứa link mời, rời ván và hủy/về lobby. Giữ các lựa chọn riêng, pause/recovery và luật Phase 2–3. Render và thao tác đã kiểm tra bằng Chrome desktop và viewport 390/320px, gồm cuộn tay bài, tên dài, combo/Nope và các trạng thái riêng.

### Bổ sung theo yêu cầu — 05/10/2026

Cả bàn thấy tên người rút trúng Mèo Nổ và trạng thái đang gỡ, đã gỡ an toàn hoặc đã nổ/bị loại; ghế đang gỡ được làm nổi bật. Người gỡ có thêm lựa chọn **Ngẫu nhiên**, chỉ cài sau khi xác nhận, server chọn kín vị trí; khóa thao tác khi chờ ACK/pause/mất kết nối. Bỏ hai nút đầu/cuối theo yêu cầu; chọn đầu/cuối bằng ô số 0/N, nhập số sẽ bỏ chọn Ngẫu nhiên. Ván mới dùng biến thể chồng rút thêm 24 lá thường, vẫn chia 8 lá/người và giữ số bom; ván đã lưu không đổi. Chi tiết bộ bài trong [README](../README.md).

Đã rút gọn chữ ở trang tạo/vào phòng, phòng chờ và bàn chơi: bỏ chú thích kỹ thuật, nhãn loại bài và hướng dẫn lặp. Giữ lượt/nợ, tên người bị nhắm hoặc dính bom, trạng thái kết nối/pause, lỗi, countdown Nope và xác nhận lá/người nhận. Tác dụng bài chỉ hiện khi chọn bài để đánh; nút cho bài ghi ngắn **Xác nhận**, câu hỏi vẫn nêu đầy đủ lá và người nhận, tên truy cập của nút vẫn đầy đủ.

Đây là **phần bàn chơi được yêu cầu, không phải hoàn thành toàn bộ Phase 4**. Nghiệm thu thao tác trọn ván trên điện thoại/Safari thật và đánh giá sử dụng với người chơi vẫn còn cần làm. Kết quả, ảnh và giới hạn trong [PROGRESS.md](PROGRESS.md).

## Màn hình và trạng thái

| Trạng thái | Nội dung / thao tác cần thể hiện |
| --- | --- |
| Trang đầu và link mời | Nhập tên, tạo phòng chọn 3/4/5, vào phòng qua link; báo phòng đầy, đang chơi, hết hạn |
| Phòng chờ | Người chơi, chủ phòng, kết nối, sẵn sàng, sao chép link, bắt đầu, mời ra trước ván |
| Bàn chơi | Người đến lượt, lượt còn nợ, chồng rút/bỏ, người chơi và số bài, tay bài riêng, diễn biến công khai |
| Chọn bài | Chạm để xem tên tiếng Việt, biểu tượng, mô tả tác dụng; chọn nhiều lá và xác nhận combo; rút hoặc kết thúc lượt đúng luật |
| Chờ Nope | Hành động/mục tiêu đang chờ, chấm than trên ghế bị nhắm và cảnh báo riêng cho mục tiêu khi hành động còn hiệu lực, đồng hồ tối đa 5 giây, nút Nope/Bỏ qua, thông báo quá hạn hoặc chuỗi mới |
| Mèo Nổ công khai | Tên người dính bom; đang gỡ, đã gỡ an toàn hoặc đã nổ/bị loại; thông báo cho mọi ghế, không lộ vị trí cài |
| Thao tác riêng | Chọn mục tiêu, người được Xin Bài chọn một lá rồi xác nhận rõ lá/người nhận hoặc hủy chọn, gọi loại bài, xem tối đa 3 lá với nút đóng, cài Mèo Nổ kín ở 0..N (nhập vị trí hoặc Ngẫu nhiên, rồi xác nhận) |
| Tạm dừng / quay lại | Người mất mạng, tình trạng reconnect, phần thao tác đang chờ; chủ phòng có nút hủy ván |
| Bị loại / kết thúc | Xem công khai nhưng không lộ bài người còn sống; người thắng, trở về phòng chờ, chuẩn bị ván tiếp |

## Yêu cầu thao tác

- Bố cục dọc trên điện thoại, tay bài cuộn ngang, nút rút/đánh dễ tìm; nhật ký thu gọn. Phân biệt loại bài/lượt bằng chữ và biểu tượng, không chỉ màu.
- Nút không hợp lệ bị vô hiệu hóa **kèm lý do**; khóa thao tác đang chờ xác nhận để tránh bấm lặp. Server vẫn là nơi kiểm tra tính hợp lệ và quyền xem.
- Không có minh họa mèo bắt buộc, chat, đăng ký tài khoản hoặc bộ mở rộng. Không áp đồng hồ suy nghĩ cho lượt hay Xem Tương Lai; countdown chỉ cho cửa sổ Nope.
- Hiển thị lỗi mất phiên/trình duyệt khác thay kết nối, link phòng hết hạn, người khác mất mạng và kết quả lệnh đến muộn bằng ngôn ngữ dễ hiểu.

**Điều kiện ra phase:** chạy kịch bản chơi trọn ván, tái đấu và các trạng thái riêng/khôi phục trên desktop và điện thoại; người dùng thao tác được không cần devtools. Ghi thiết bị, kịch bản, ảnh hoặc quan sát thực tế và lỗi còn mở vào [PROGRESS.md](PROGRESS.md). Kiểm thử trên nhiều người/thiết bị vẫn phải làm ở phase 5.
