# Phase 4 — Giao diện tiếng Việt, dễ chơi trên điện thoại

**Trạng thái: Hoàn thành — chủ dự án nghiệm thu ngày 09/10/2026.** Chủ dự án xác nhận đã kiểm thử hệ thống cùng nhóm người chơi và chấp nhận hoàn tất Phase 4. Giao diện phục vụ trọn vòng chơi trên trình duyệt máy tính/điện thoại, không cần công cụ phát triển.

## Giao diện đã bàn giao

Thiết kế **Playful paper**, bàn oval **B — Vòng bạn bè**: sau khi bắt đầu, cả nhóm chuyển sang bàn chơi riêng, chồng bài ở giữa, ghế quanh bàn và tay bài riêng phía dưới. Ghế của người xem luôn ở dưới, giữ thứ tự vòng của phòng; thông tin lượt, số bài, mất kết nối/bị loại nằm trên từng ghế. Lá đánh/combo/Nope xuất hiện công khai kèm người đánh, có hiệu ứng và hỗ trợ giảm chuyển động; reconnect không phát lại diễn biến cũ.

Menu **Phòng** chứa link mời, rời ván và hủy/về phòng chờ. Giao diện dùng tiếng Việt, tên lá bài bằng tiếng Anh. Trang đầu/phòng chờ bỏ khẩu hiệu và hướng dẫn lặp; mặt bài chỉ giữ biểu tượng và tên, nhãn thao tác được rút gọn. Tay bài gom các lá cùng loại cạnh nhau, giữ lựa chọn theo ID và cuộn ngang trên điện thoại. Mô tả tác dụng chỉ hiện khi chọn lá; lỗi, mục tiêu, countdown và các xác nhận quan trọng luôn được giữ rõ ràng.

- **Mục tiêu và combo:** thông báo người đánh/người bị nhắm; kết quả lấy bài của combo 2/3 chỉ gửi cho hai người liên quan, có thể đóng và giữ qua reconnect/restart. Combo 5 lá có lựa chọn bài bỏ muốn lấy.
- **Favor:** chạm lá chỉ chọn, có thể đổi/hủy; xác nhận mới trao đúng lá cho đúng người.
- **Exploding Kitten:** cả bàn thấy người dính bom, đang gỡ, đã gỡ an toàn hoặc đã nổ/bị loại. Cài bom kín bằng vị trí 0..N hoặc **Ngẫu nhiên**, xác nhận mới gửi; không lộ vị trí.
- **Lá mở rộng:** Alter the Future hiển thị kín tối đa 3 lá, nút Trước/Sau và xác nhận thứ tự; Reverse hiển thị chiều chơi mới và người tiếp theo; Draw from the Bottom có mô tả rút đáy và vẫn xử lý bom bình thường.
- **Đồng hồ và offline:** Nope 5 giây; lượt/lựa chọn có 60 giây không hoạt động. Đồng hồ ghi thời gian còn lại và thao tác tự động, thêm tên người phải cho bài khi khác người đang tới lượt. Người còn sống offline được báo **Ván vẫn tiếp tục**, không khóa người online hay dừng đồng hồ. Ghế bị loại luôn hiện **Bị loại**, kể cả khi người đó thoát.
- **Kết thúc/tái đấu:** người thắng có vương miện và nhãn riêng; về phòng chờ để chuẩn bị ván tiếp, không giữ dấu hiệu thắng/bị loại của ván trước.

Ván mới chia 5 lá/người và dùng bộ cơ bản pha ba loại mở rộng, thêm 2 Defuse dư. Chồng rút 3/4/5 người là 49/60/70; ván đã lưu không bị chia lại. [README](../README.md) mô tả luật hiện tại; [PROGRESS](PROGRESS.md) giữ lịch sử thay đổi và nghiệm thu.

## Màn hình và trạng thái

| Trạng thái | Nội dung / thao tác cần thể hiện |
| --- | --- |
| Trang đầu và link mời | Nhập tên, tạo phòng chọn 3/4/5, vào phòng qua link; báo phòng đầy, đang chơi, hết hạn |
| Phòng chờ | Người chơi, chủ phòng, kết nối, sẵn sàng, sao chép link, bắt đầu, mời ra trước ván |
| Bàn chơi | Người đến lượt, lượt còn nợ, chiều chơi/người tiếp theo, đồng hồ không hoạt động, chồng rút/bỏ, người chơi và số bài, tay bài riêng, diễn biến công khai |
| Chọn bài | Tên tiếng Anh, biểu tượng và mô tả tác dụng tiếng Việt; chọn nhiều lá và xác nhận combo; rút hoặc kết thúc lượt đúng luật |
| Chờ Nope | Hành động/mục tiêu đang chờ, chấm than trên ghế bị nhắm và cảnh báo riêng cho mục tiêu khi hành động còn hiệu lực, đồng hồ tối đa 5 giây, nút Nope/Bỏ qua, thông báo quá hạn hoặc chuỗi mới |
| Exploding Kitten công khai | Tên người dính bom; đang gỡ, đã gỡ an toàn hoặc đã nổ/bị loại; thông báo cho mọi ghế, không lộ vị trí cài |
| Thao tác riêng | Chọn mục tiêu, người phải cho Favor chọn một lá rồi xác nhận rõ lá/người nhận hoặc hủy chọn, gọi loại bài, xem/sắp tối đa 3 lá tương lai, cài Exploding Kitten kín ở 0..N hoặc Ngẫu nhiên |
| Mất kết nối / quay lại | Người vắng mặt, đồng hồ vẫn chạy, phần thao tác đang chờ; quay lại nhận bài/lượt hiện tại, chủ phòng có nút hủy ván |
| Bị loại / kết thúc | Xem công khai nhưng không lộ bài người còn sống; người thắng, trở về phòng chờ, chuẩn bị ván tiếp |

## Thao tác và nghiệm thu

- Bố cục dọc trên điện thoại, tay bài cuộn ngang, nút rút/đánh dễ tìm; nhật ký thu gọn. Phân biệt loại bài/lượt bằng chữ và biểu tượng, không chỉ màu.
- Nút chưa hợp lệ bị vô hiệu hóa; hướng dẫn theo lựa chọn và lỗi từ server giúp sửa thao tác. Khóa thao tác đang chờ xác nhận để tránh bấm lặp; server vẫn kiểm tra tính hợp lệ và quyền xem.
- Xác nhận trước khi cho bài, đổi bài bỏ, sắp tương lai hoặc cài bom; chọn lá/chế độ ngẫu nhiên chưa thực hiện thao tác trên server.
- Hiển thị lỗi mất phiên/trình duyệt khác thay kết nối, link phòng hết hạn, người khác mất mạng và kết quả lệnh đến muộn bằng ngôn ngữ dễ hiểu.

**Nghiệm thu:** chủ dự án và nhóm người chơi đã kiểm thử hệ thống và chấp nhận hoàn thành Phase 4. Bản mã hiện tại đạt 275 test Vitest và 36 kịch bản Playwright; render/thao tác được kiểm tra tự động ở 1280/390/320px, gồm bài kín, combo/Nope, các lựa chọn riêng, offline/reconnect và tái đấu. Kiểm thử tự động dùng runtime local/Chrome; không suy ra số đo hạ tầng hoặc danh sách thiết bị thực tế của nhóm. Duy trì kiểm thử hồi quy cho những thay đổi tiếp theo.
