# Phase 1 — Game engine và kiểm thử luật

**Mục tiêu:** engine xử lý luật Original Edition không phụ thuộc React, mạng hoặc cơ chế lưu trữ. Đọc mục 2 và ma trận luật ở mục 7 của [kế hoạch gốc](../meo-no-implementation-plan.md). Chỉ bắt đầu sau khi phase 0 đạt điều kiện ra phase.

## Phạm vi luật cần hiện thực

- Bộ gốc **56 lá**: 4 Mèo Nổ, 6 Gỡ Bom, 4 Tấn Công, 4 Bỏ Lượt, 4 Xin Bài, 4 Xáo Bài, 5 Xem Tương Lai, 5 Nope và 5 nhóm mèo × 4 lá. Mã loại bài độc lập tên tiếng Việt hiển thị.
- Phòng 3, 4 hoặc 5 người: mỗi người nhận **1 Gỡ Bom + 7 lá khác**; chồng rút nhận số Mèo Nổ bằng số người trừ 1. Với 3 người, chỉ thêm **2 Gỡ Bom dư** vào chồng; với 4/5 người, thêm toàn bộ số dư. Kiểm thử độc lập số lá chồng rút sau chia: **29 / 23 / 16** tương ứng 3 / 4 / 5 người.
- Chọn người đầu ngẫu nhiên mỗi ván, thứ tự theo ghế. Có thể đánh nhiều lá hoặc không đánh rồi rút để kết thúc một lượt; không giới hạn số bài trên tay. Bỏ lượt kết thúc đúng **một** lượt còn nợ; Tấn Công chuyển 2 lượt, hoặc chuyển số lượt còn nợ + 2 khi đang chịu Tấn Công, kể cả khi đã trả một phần nợ.
- Mèo Nổ được công khai khi rút: không Gỡ Bom thì loại và đưa bài vào chồng bỏ; có Gỡ Bom thì dùng lá đó, chọn kín vị trí 0..N để cài Mèo Nổ lại. Người cuối cùng còn sống thắng.
- Xin Bài do **người được chọn** chọn lá cho; Xem Tương Lai chỉ người dùng thấy tối đa 3 lá đầu đúng thứ tự; Xáo Bài thực hiện ở server. Combo 2 lá cùng tên lấy ngẫu nhiên, combo 3 lá cùng tên gọi tên loại muốn lấy; không cộng tác dụng riêng của các lá trong combo. Không tự thêm combo 5 lá từ luật cũ.
- Nope chỉ chặn hành động/combo chưa thực hiện, không chặn Mèo Nổ/Gỡ Bom; Nope chặn được Nope. Các lá đã đánh vẫn vào chồng bỏ. Quyết định tác dụng khi cửa sổ phản ứng kết thúc; cơ chế hạn 5 giây, bỏ qua, restart được tích hợp ở phase 2–3 theo mục 2.3 của kế hoạch gốc.

## Cách kiểm chứng

1. Tách phần tính trạng thái mới khỏi giao diện và mạng. Cho phép kiểm soát nguồn ngẫu nhiên trong test để dựng ca khó; khi chơi thật dùng ngẫu nhiên phía server.
2. Test mỗi ID lá chỉ tồn tại đúng một nơi, kể cả khi lá đang xử lý; không tạo/mất lá ngoài các lá loại lúc chia. Dùng các bộ bài/ghế không đối xứng để phát hiện sai thứ tự, lẫn tay bài hoặc sai số lượt.
3. Test Attack liên tiếp, Attack sau khi trả một lượt, Skip khi nợ nhiều lượt, bỏ qua người bị loại; bom không/có Gỡ Bom ở vị trí đầu–giữa–cuối; combo có/không có loại được gọi; Nope chuỗi chẵn/lẻ. Test cả trường hợp cần chọn mục tiêu mà không còn bài theo nguồn luật/FAQ đã đối chiếu.
4. Ghi quyết định còn thiếu của luật online trước khi code áp dụng; thay đổi luật hoặc số người phải hỏi người dùng.

**Điều kiện ra phase:** toàn bộ hành vi luật và bất biến bài/lượt có kiểm thử với kết quả kỳ vọng độc lập; engine không phụ thuộc mạng; ghi lệnh và kết quả thực tế trong [PROGRESS.md](PROGRESS.md).
