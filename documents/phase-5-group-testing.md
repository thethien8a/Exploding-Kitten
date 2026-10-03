# Phase 5 — Kiểm thử nhóm và sửa lỗi cản trở chơi

**Mục tiêu:** chứng minh các luồng engine, mạng, giao diện và khôi phục hoạt động cùng nhau trong một nhóm thực. Đọc ma trận ở mục 7 và tiêu chí nghiệm thu mục 9 của [kế hoạch gốc](../meo-no-implementation-plan.md); phụ thuộc phase 4.

## Ma trận cần chạy

| Nhóm | Kịch bản cần chứng minh |
| --- | --- |
| Ván hoàn chỉnh | 3/4/5 người, mỗi người 8 lá ban đầu, đúng chồng rút/bom/Gỡ Bom, cuối ván xác định thắng và chơi ván tiếp |
| Bài và lượt | ID lá không trùng/mất; Attack liên tiếp, đã trả một phần nợ, Skip, người bị loại, bom cài đầu/giữa/cuối |
| Nope và tác dụng | Chuỗi Nope chẵn/lẻ, đủ người bỏ qua, sát hạn/đến muộn; Xin Bài, Xem Tương Lai, Xáo Bài và combo gọi loại có/không có |
| Riêng tư và phiên | Kiểm tra payload mạng của nhiều ghế; spectator chỉ công khai; tên trùng/sai token/hai tab không lấy được bài hoặc điều khiển sai |
| Đồng thời | Hai Nope gần đồng thời, lệnh với alarm, rút hai lần, gửi lại sau mất ACK, lệnh theo phiên bản cũ |
| Restart | Dừng/khôi phục tại lượt thường, Nope, Xin Bài, Xem Tương Lai, cài bom, sau lưu trước ACK |
| Mất mạng | Chủ phòng/người khác/người bị loại, nhiều người mất mạng, tab nền, giữ thời gian Nope và ghế khi reconnect |
| Phòng | Thiếu người/chưa sẵn sàng, đầy phòng, vào giữa ván, kick sau bắt đầu, hủy, chuyển quyền, tái đấu |
| Thiết bị | Chrome desktop và Android; Safari iPhone nếu nhóm dùng; tay nhiều bài, màn hình dọc, chuyển ứng dụng rồi quay lại |
| Hạ tầng | Hai phòng không trộn dữ liệu, mở trực tiếp link phòng, giới hạn lệnh/tạo phòng; quan sát quota sau buổi thử khi có môi trường phù hợp |

## Cách ghi bằng chứng

1. Dùng các phiên trình duyệt độc lập, không chung cookie, mô phỏng tối đa 5 người; kết hợp cả kịch bản có kiểm soát và ván chơi thật. Đầu ra kỳ vọng tính từ luật, không lấy từ engine để làm đáp án.
2. Ghi ngày, môi trường, thiết bị, dữ liệu/chuỗi thao tác, kết quả mong đợi và quan sát được cho từng hàng; **chưa chạy** khác **đã thử nhưng lỗi**. Sửa và thử lại những lỗi cản trở chơi, riêng tư hoặc khôi phục.
3. Ghi số đo sử dụng CPU/quota/độ trễ khi có môi trường thật; không suy từ một lần chạy local rằng Free đủ cho mọi nhóm.

**Điều kiện ra phase:** các ca bắt buộc trong ma trận đạt; lỗi cản trở chơi, riêng tư hoặc khôi phục đã được sửa và thử lại. Nếu còn ca chưa chạy/chưa đạt, ghi rõ trong [PROGRESS.md](PROGRESS.md) và chưa chuyển sang deploy. Không gộp “đã viết test” với “test đã chạy và đạt”.
