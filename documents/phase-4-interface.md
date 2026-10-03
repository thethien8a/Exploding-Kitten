# Phase 4 — Giao diện tiếng Việt, dễ chơi trên điện thoại

**Mục tiêu:** người chơi thao tác được trọn ván trên trình duyệt máy tính/điện thoại mà không dùng công cụ phát triển. Đọc mục 1, 2.3 và 5 của [kế hoạch gốc](../meo-no-implementation-plan.md); phụ thuộc phase 3.

## Màn hình và trạng thái

| Trạng thái | Nội dung / thao tác cần thể hiện |
| --- | --- |
| Trang đầu và link mời | Nhập tên, tạo phòng chọn 3/4/5, vào phòng qua link; báo phòng đầy, đang chơi, hết hạn |
| Phòng chờ | Người chơi, chủ phòng, kết nối, sẵn sàng, sao chép link, bắt đầu, mời ra trước ván |
| Bàn chơi | Người đến lượt, lượt còn nợ, chồng rút/bỏ, người chơi và số bài, tay bài riêng, diễn biến công khai |
| Chọn bài | Chạm để xem tên tiếng Việt, biểu tượng, mô tả tác dụng; chọn nhiều lá và xác nhận combo; rút hoặc kết thúc lượt đúng luật |
| Chờ Nope | Hành động/mục tiêu đang chờ, đồng hồ tối đa 5 giây, nút Nope/Bỏ qua, thông báo quá hạn hoặc chuỗi mới |
| Thao tác riêng | Chọn mục tiêu, người được xin chọn bài cho, gọi loại bài, xem tối đa 3 lá với nút đóng, cài Mèo Nổ kín ở 0..N (nút đầu/cuối và chọn vị trí) |
| Tạm dừng / quay lại | Người mất mạng, tình trạng reconnect, phần thao tác đang chờ; chủ phòng có nút hủy ván |
| Bị loại / kết thúc | Xem công khai nhưng không lộ bài người còn sống; người thắng, trở về phòng chờ, chuẩn bị ván tiếp |

## Yêu cầu thao tác

- Bố cục dọc trên điện thoại, tay bài cuộn ngang, nút rút/đánh dễ tìm; nhật ký thu gọn. Phân biệt loại bài/lượt bằng chữ và biểu tượng, không chỉ màu.
- Nút không hợp lệ bị vô hiệu hóa **kèm lý do**; khóa thao tác đang chờ xác nhận để tránh bấm lặp. Server vẫn là nơi kiểm tra tính hợp lệ và quyền xem.
- Không có minh họa mèo bắt buộc, chat, đăng ký tài khoản hoặc bộ mở rộng. Không áp đồng hồ suy nghĩ cho lượt hay Xem Tương Lai; countdown chỉ cho cửa sổ Nope.
- Hiển thị lỗi mất phiên/trình duyệt khác thay kết nối, link phòng hết hạn, người khác mất mạng và kết quả lệnh đến muộn bằng ngôn ngữ dễ hiểu.

**Điều kiện ra phase:** chạy kịch bản chơi trọn ván, tái đấu và các trạng thái riêng/khôi phục trên desktop và điện thoại; người dùng thao tác được không cần devtools. Ghi thiết bị, kịch bản, ảnh hoặc quan sát thực tế và lỗi còn mở vào [PROGRESS.md](PROGRESS.md). Kiểm thử trên nhiều người/thiết bị vẫn phải làm ở phase 5.
