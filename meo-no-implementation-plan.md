# Kế hoạch xây dựng game Mèo Nổ trên web

Ngày chốt: 03/10/2026. Trạng thái: đã chốt yêu cầu, chưa viết code hoặc deploy.

## 1. Mục tiêu và phạm vi

Xây dựng một game web cho nhóm bạn chơi đồng thời trên máy tính và điện thoại. Giao diện tiếng Việt, đọc được ngay, ưu tiên chức năng hơn trang trí. Deploy bằng dịch vụ miễn phí, mã nguồn trong GitHub của người dùng.

| Hạng mục | Yêu cầu đã chốt |
| --- | --- |
| Luật | Original Edition, theo tài liệu chính thức; không thêm bộ mở rộng |
| Số người | Chủ phòng chọn đúng một trong ba lựa chọn: 3, 4, 5 |
| Vào chơi | Nhập tên, không đăng ký tài khoản |
| Tạo phòng | Ai truy cập website cũng tạo được; người tạo là chủ phòng |
| Mời người | Gửi link phòng; không có mật khẩu |
| Bắt đầu | Đủ số người đã chọn, tất cả sẵn sàng, chủ phòng bấm bắt đầu |
| Người đi đầu | Chọn ngẫu nhiên mỗi ván |
| Thời gian lượt | Không giới hạn thời gian suy nghĩ |
| Nope | Chờ tối đa 5 giây; mọi người bỏ qua thì xử lý sớm; Nope mới mở lại cửa sổ |
| Mất mạng | Người còn sống mất kết nối thì tạm dừng ván; trở lại đúng chỗ, giữ bài và lượt |
| Khôi phục | Phải khôi phục được cả sau khi tiến trình server khởi động lại |
| Chủ phòng | Chọn số người, bắt đầu, mời ra trước ván, hủy ván, tổ chức ván tiếp |
| Quyền khi mất mạng | Giữ quyền chủ phòng; rời chủ động thì chuyển quyền |
| Người bị loại | Tiếp tục xem diễn biến công khai; không được xem bài người còn sống |
| Người mới | Không nhận người chơi mới giữa ván; cho người cũ kết nối lại |
| Giao tiếp | Discord/Messenger riêng; không làm chat trong game |
| Lá bài | Tên tiếng Việt, biểu tượng, mô tả tác dụng; không cần minh họa mèo |

Bản đầu không có bot, ghép trận công khai, tài khoản, bảng xếp hạng, lịch sử dài hạn hoặc chế độ 6 người.

## 2. Luật làm chuẩn

Nguồn chuẩn là [tờ luật Original Edition năm 2022 do Asmodee phân phối](https://cdn.svc.asmodee.net/production-asmodeeca/uploads/2023/04/English.pdf). Lưu một bản tài liệu tham chiếu trong repository khi triển khai. Không trộn quy tắc từ các phiên bản luật khác.

### 2.1. Bộ bài và chia bài

| Loại bài | Tên hiển thị đề xuất | Số lượng trong bộ gốc |
| --- | --- | --- |
| Exploding Kitten | Mèo Nổ | 4 |
| Defuse | Gỡ Bom | 6 |
| Attack | Tấn Công | 4 |
| Skip | Bỏ Lượt | 4 |
| Favor | Xin Bài | 4 |
| Shuffle | Xáo Bài | 4 |
| See the Future | Xem Tương Lai | 5 |
| Nope | Chặn — Nope | 5 |
| Cat Cards | 5 nhóm mèo phân biệt bằng tên và biểu tượng | 4 lá mỗi nhóm |

Tổng bộ gốc: 56 lá. Tên tiếng Việt là lựa chọn giao diện; mã loại bài nội bộ không phụ thuộc vào bản dịch.

Thiết lập ván:

1. Tách toàn bộ Mèo Nổ và Gỡ Bom khỏi bộ bài.
2. Mỗi người nhận 1 Gỡ Bom. Với 3 người: cho 2 Gỡ Bom dư vào bộ, loại Gỡ Bom dư còn lại. Với 4 hoặc 5 người: cho toàn bộ Gỡ Bom dư vào bộ.
3. Xáo bộ chưa có Mèo Nổ, rồi chia thêm 7 lá mỗi người: tổng 8 lá ban đầu, có thể nhận thêm Gỡ Bom. Thứ tự này được đối chiếu lại ở Phase 1 theo bước 3–4 trang 1 PDF Original Edition 2022.
4. Cho số Mèo Nổ bằng số người trừ 1 vào chồng rút; loại Mèo Nổ dư.
5. Xáo chồng rút, chọn ngẫu nhiên người đầu tiên; thứ tự vòng chơi cố định theo vị trí trong phòng.

Kiểm tra tính toán sau chia: chồng rút có 29 lá với 3 người, 23 lá với 4 người, 16 lá với 5 người. Đây là số suy ra từ cấu hình trên, dùng làm kiểm thử khởi tạo.

### 2.2. Hành vi phải triển khai

- Trong lượt, người chơi được đánh nhiều lá hoặc không đánh; rút bài để hoàn thành một lượt, trừ khi tác dụng lá bài thay đổi việc này.
- Không giới hạn số bài trên tay; hết bài trên tay vẫn tiếp tục chơi.
- Mèo Nổ phải được công khai khi rút. Không có Gỡ Bom thì bị loại; bài trên tay và Mèo Nổ đó vào chồng bỏ.
- Có Gỡ Bom thì thực hiện gỡ bom và chọn kín vị trí đưa Mèo Nổ trở lại chồng rút, không xem hay đổi thứ tự các lá khác.
- Bỏ Lượt kết thúc một lượt phải thực hiện, không rút bài; dưới Tấn Công không xóa toàn bộ số lượt còn nợ.
- Tấn Công bình thường chuyển 2 lượt cho người tiếp theo. Khi đang chịu Tấn Công, chuyển số lượt còn nợ cộng thêm 2; kiểm thử riêng trường hợp đã hoàn thành một phần số lượt.
- Xin Bài: người bị chọn tự chọn một lá để cho; không hiển thị toàn bộ tay bài của họ cho người xin.
- Xem Tương Lai: chỉ người dùng thấy tối đa 3 lá đầu theo thứ tự, không đổi thứ tự. Có nút đóng để tiếp tục, không áp đồng hồ suy nghĩ.
- Xáo Bài: server xáo chồng rút; không tiết lộ kết quả.
- Nope chặn hành động chưa thực hiện, kể cả combo; không chặn Mèo Nổ hay Gỡ Bom. Nope có thể chặn Nope. Bài đã dùng vẫn vào chồng bỏ dù hành động bị chặn.
- Combo 2 lá cùng tên: lấy ngẫu nhiên một lá từ người được chọn. Combo 3 lá cùng tên: gọi tên loại bài muốn lấy; chỉ lấy được nếu mục tiêu có loại đó. Không đồng thời áp tác dụng riêng của những lá dùng làm combo.
- Các lá mèo đơn lẻ không có tác dụng; dùng theo cặp hoặc combo phù hợp.
- Người cuối cùng còn sống thắng. Không tự thêm combo 5 lá khác nhau từ tài liệu luật cũ.

Các tình huống tài liệu không mô tả trực tiếp cho giao diện online, như chọn mục tiêu không còn bài, phải đối chiếu FAQ chính thức khi viết engine. Nếu vẫn không có câu trả lời, ghi rõ quyết định triển khai và hỏi người dùng khi quyết định đó làm đổi luật.

### 2.3. Quy ước online đã chọn

Đây là quy ước vận hành cho bản web, không mô tả thành luật của bộ bài vật lý:

- Trước hành động có thể bị Nope, server mở cửa sổ 5 giây. Người còn sống, kể cả người đánh bài, có thể Nope hoặc bỏ qua. Người đã bị loại không tham gia phản ứng.
- Tất cả người còn sống bỏ qua thì chốt sớm. Không gửi thông tin ai đang có Nope; không bỏ qua tự động dựa vào tay bài.
- Mỗi Nope hợp lệ mở cửa sổ 5 giây mới và xóa các lựa chọn bỏ qua của cửa sổ trước.
- Client gửi lựa chọn; server quyết định hạn chót và thứ tự xử lý. Hành động đến muộn bị từ chối với thông báo rõ ràng.
- Không lộ kết quả Xem Tương Lai, lá rút hoặc lá chuyển cho người nhận trước khi hành động tương ứng được chốt.
- Vị trí cài Mèo Nổ hiển thị từ 0 đến N: 0 là trên cùng, N là dưới cùng, N là số lá hiện có. Có nút nhanh trên cùng/dưới cùng và lựa chọn vị trí cụ thể.

## 3. Các phương án kiến trúc và lựa chọn

| Phương án | Ưu điểm cho dự án | Đánh đổi |
| --- | --- | --- |
| Cloudflare Workers + một Durable Object cho mỗi phòng, lưu SQLite | Một nơi deploy giao diện, API, kết nối thời gian thực và trạng thái bền vững | Cần triển khai đúng vòng đời Durable Object, hibernation và giới hạn gói Free |
| Frontend tách riêng + backend Node + database | Dễ tổ chức backend theo mô hình server truyền thống | Phải chọn và vận hành nhiều thành phần; chưa xác minh được một tổ hợp miễn phí phù hợp trong kế hoạch này |
| Trình duyệt chủ phòng điều phối | Giảm phần xử lý ở server | Vẫn phải thêm lưu trữ đáng tin cậy để đáp ứng khôi phục khi chủ phòng rời; làm chuyển quyền và bảo vệ bài kín phức tạp hơn |

**Đề xuất: Cloudflare Workers Free + Durable Objects dùng SQLite.** Đây là lựa chọn thiết kế, dựa trên yêu cầu một nhóm nhỏ, nhiều thiết bị và lưu được ván qua lần khởi động lại.

Tài liệu hiện tại xác nhận Workers Free hỗ trợ Durable Objects dùng SQLite; static assets được phục vụ miễn phí; WebSocket Hibernation cho phép giữ kết nối trong lúc object nghỉ. Nguồn: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

### 3.1. Thành phần đề xuất

- Giao diện: React + TypeScript, build bằng Vite; CSS đơn giản, ưu tiên màn hình dọc điện thoại. Đây là stack đề xuất, không yêu cầu người dùng đã có dự án tương ứng.
- Worker: phục vụ API, xác thực phiên chơi, chuyển yêu cầu vào đúng phòng; giao diện deploy bằng Workers Static Assets.
- GameRoom Durable Object: quản lý một phòng, xử lý lệnh, lưu trạng thái, gửi góc nhìn riêng cho từng người.
- SQLite trong Durable Object: lưu snapshot ván, phiên người chơi, hành động đã xử lý, deadline và nhật ký có giới hạn.
- WebSocket Hibernation: đồng bộ diễn biến; không cần Redis, database bên ngoài hoặc Socket.IO trong phương án này.
- Công cụ kiểm thử dự kiến: Vitest cho engine, Playwright cho luồng trình duyệt, môi trường local của Cloudflare cho tích hợp. Tra tài liệu Context7 và khóa phiên bản thực tế trước khi viết cấu hình/API; không cố định số phiên bản chưa kiểm chứng trong kế hoạch.

Tài liệu cho việc deploy React SPA và API cùng Worker: [Cloudflare Vite tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/).

### 3.2. Nguyên tắc dữ liệu

Server quyết định luật, chồng bài, lượt và kết quả ngẫu nhiên. Client chỉ gửi yêu cầu như đánh lá nào, chọn ai, rút bài, Nope, bỏ qua; không gửi một trạng thái mới để server tin theo.

Mỗi phòng cần lưu:

| Nhóm dữ liệu | Nội dung thiết kế |
| --- | --- |
| Phòng | ID khó đoán, số chỗ 3/4/5, chủ phòng, danh sách ghế và sẵn sàng |
| Ván | ID ván, phiên bản luật/schema, thứ tự lượt, người hiện tại, số lượt còn nợ |
| Bài kín | Tay từng người, thứ tự chồng rút, vị trí Mèo Nổ đang được gỡ |
| Bài công khai | Chồng bỏ, người bị loại, số bài trên tay, số bài chồng rút |
| Hành động chờ | Loại hành động, người thực hiện, mục tiêu, chuỗi Nope, người bỏ qua, hạn chót |
| Tạm dừng | Giai đoạn trước dừng, người mất kết nối, thời gian Nope còn lại |
| Khôi phục | Phiên người chơi, phiên bản trạng thái, ID lệnh đã xử lý và kết quả xác nhận |

Các tên trường hoặc tên lệnh trong code sẽ do bước thiết kế chi tiết xác định; bảng trên là hợp đồng dữ liệu đề xuất, không phải API có sẵn của thư viện.

Sau mỗi thay đổi hợp lệ: kiểm tra quyền và trạng thái → tính trạng thái tiếp theo → lưu nguyên tử cùng kết quả lệnh → xác nhận/gửi góc nhìn mới. Nếu lưu lỗi thì không xác nhận thành công. Dùng hàng đợi xử lý hoặc cơ chế khóa phù hợp để lệnh và alarm không ghi đè nhau khi có thao tác bất đồng bộ.

Một lệnh gửi lại phải trả cùng kết quả, không rút thêm bài, chuyển thêm lượt hay xáo lần nữa. Kết quả ngẫu nhiên được lưu trong lần xử lý thành công đầu tiên. Khi reconnect, gửi snapshot đúng phiên bản, không bắt client đoán các sự kiện đã mất.

### 3.3. Bảo vệ bài và nhận diện người chơi

- Phát hành một phiên ẩn danh và thông tin khôi phục bí mật; kiểm tra phía server. Tên hiển thị không phải bằng chứng sở hữu ghế.
- Không cho người mới lấy ghế/bài bằng cách nhập tên của người đã chơi.
- Không gửi tay bài người khác hoặc chồng rút xuống trình duyệt rồi chỉ ẩn bằng CSS.
- Người bị loại nhận góc nhìn công khai. Người dùng Xem Tương Lai nhận kết quả riêng; reconnect cũng khôi phục được phần đang xem.
- Không ghi bài kín, token phiên hoặc vị trí cài Mèo Nổ vào nhật ký công khai hay log vận hành.
- Link phòng chỉ để vào phòng, không chứa token lấy lại ghế. Kiểm tra nguồn kết nối, giới hạn kích thước/tần suất lệnh và số phòng tạo để tránh tiêu hao quota.
- Mặc định thiết kế: một ghế có một kết nối điều khiển; mở tab mới hợp lệ thay thế kết nối cũ, không tạo thêm người và không tạm dừng nhầm.
- Khôi phục ghế trên cùng trình duyệt còn dữ liệu phiên. Đổi thiết bị, dùng ẩn danh mới hoặc xóa dữ liệu trình duyệt không tự lấy lại ghế bằng tên; chưa đưa chuyển thiết bị vào bản đầu.

## 4. Vòng đời phòng và mất kết nối

Các giai đoạn cần có: phòng chờ, lượt thường, chờ phản ứng Nope, chọn bài cho, xem tương lai, cài Mèo Nổ, tạm dừng, kết thúc. Tạm dừng bao bọc giai đoạn đang xử lý, không xóa nó.

### 4.1. Mất mạng và quay lại

1. Theo dõi kết nối và heartbeat; đề xuất ban đầu gửi heartbeat mỗi 10 giây, coi là mất kết nối sau 25 giây không có phản hồi. Đây là tham số kỹ thuật cần hiệu chỉnh trên điện thoại thật.
2. Kết nối đóng rõ ràng hoặc quá hạn của người còn sống làm ván tạm dừng. Điện thoại chuyển nền có thể dẫn đến tạm dừng; giao diện phải thông báo nguyên nhân.
3. Đóng băng số giây còn lại của cửa sổ Nope. Không chạy tiếp việc rút, chuyển bài, cài bom hoặc chốt tác dụng trong lúc dừng.
4. Người cũ xác thực phiên, nhận đúng bài và giai đoạn chờ. Khi tất cả người còn sống online, tự tiếp tục với thời gian còn lại.
5. Người bị loại mất mạng không làm dừng ván. Nếu đó là chủ phòng, vẫn giữ quyền chủ phòng như đã chốt.
6. Chủ phòng có thể hủy ván về phòng chờ. Không tự loại người mất mạng vì yêu cầu là chờ họ quay lại.

Thời gian 25 giây là thời gian phát hiện mất mạng âm thầm, không phải giới hạn lượt hay thời gian được phép quay lại.

### 4.2. Rời chủ động và chuyển quyền

- Trong phòng chờ: rời thì giải phóng ghế; chủ phòng rời thì chuyển quyền cho người online theo thứ tự ghế.
- Trong ván: người còn sống rời thì giữ ghế và tạm dừng; nếu họ là chủ phòng thì chuyển quyền cho người online còn lại để nhóm có thể hủy ván. Không âm thầm coi rời là bị nổ.
- Nếu không còn ai online, giữ trạng thái và quyền dự phòng để xử lý khi thành viên hợp lệ quay lại.
- Sau khi kết thúc: giữ nhóm, xóa sẵn sàng, cho phép thay người hoặc chọn lại 3/4/5 trước ván mới. Không cho giảm số chỗ xuống thấp hơn số người hiện có.

### 4.3. Server khởi động lại

- Khôi phục từ trạng thái đã lưu, không chia bài hay chọn người đầu lại.
- Khôi phục giai đoạn đang chờ, số lượt nợ, token và ID lệnh đã xử lý.
- Không coi việc hibernation là mất mạng của cả nhóm. Metadata kết nối dùng attachment; trạng thái ván và phiên phải ở storage, không chỉ trong attachment.
- Khi khởi động lại làm mất kết nối thật, vào chế độ khôi phục/tạm dừng và chờ người còn sống reconnect. Không tự chốt một cửa sổ Nope đã quá hạn trong lúc nhóm chưa kết nối lại.
- Dùng alarm bền vững cho hạn Nope và lịch phát hiện kết nối; có bộ lập lịch chung trong phòng vì một Durable Object chỉ có một alarm tại một thời điểm. Handler chống xử lý trùng vì alarm có thể chạy lại. Nguồn: [Alarms API](https://developers.cloudflare.com/durable-objects/api/alarms/).
- Không dùng timer RAM làm nguồn duy nhất cho thời hạn cần khôi phục. Sau deploy cập nhật code phải giữ tương thích schema ván đang chạy, hoặc chỉ cập nhật khi nhóm đã kết thúc.

Mặc định đề xuất lưu phòng 7 ngày kể từ hoạt động người chơi cuối cùng, kể cả ván tạm dừng; phòng hết hạn hiển thị thông báo và tạo phòng mới. Heartbeat/alarm không làm gia hạn phòng trống. Đây là chính sách dọn dữ liệu, có thể chỉnh sau, không phải giới hạn của nhà cung cấp.

## 5. Thiết kế màn hình

| Màn hình | Nội dung và thao tác |
| --- | --- |
| Trang đầu | Nhập tên, tạo phòng, chọn 3/4/5; hướng dẫn ngắn |
| Link mời | Hiển thị phòng, nhập tên, vào phòng; báo đủ chỗ/đang chơi/hết hạn |
| Phòng chờ | Danh sách người, chủ phòng, kết nối, sẵn sàng, sao chép link, bắt đầu |
| Bàn chơi | Người đang tới lượt, số lượt phải thực hiện, chồng rút, chồng bỏ, người chơi và số bài, tay bài riêng |
| Chọn lá | Chạm để đọc tác dụng; bấm xác nhận đánh; chọn nhiều lá cho combo |
| Phản ứng Nope | Hành động đang chờ, người đánh/mục tiêu, countdown, Nope và Bỏ qua |
| Thao tác riêng | Chọn mục tiêu, chọn bài cho, gọi loại bài, xem 3 lá hoặc chọn vị trí cài bom |
| Tạm dừng | Ai đang mất mạng, trạng thái reconnect, nút hủy ván cho chủ phòng |
| Bị loại | Thông báo đã nổ; tiếp tục xem bàn và nhật ký công khai |
| Kết thúc | Người thắng, quay về phòng chờ, chuẩn bị ván mới |

Điện thoại dùng bố cục dọc, tay bài cuộn ngang, nút rút/đánh luôn dễ tìm; nhật ký thu gọn để không chiếm chỗ. Phân biệt lượt và loại bài bằng chữ/biểu tượng, không chỉ bằng màu. Nút không hợp lệ bị vô hiệu hóa kèm lý do; khóa thao tác đang chờ xác nhận để giảm bấm lặp.

## 6. Kế hoạch triển khai theo mốc

| Mốc | Công việc cụ thể | Điều kiện hoàn thành |
| --- | --- | --- |
| 0. Nền tảng | Tạo repo, chốt tài liệu luật, khóa phiên bản công cụ, cấu hình local và Workers Free, thử SQLite + WebSocket hibernation | Hai trình duyệt cùng phòng; dữ liệu thử khôi phục sau restart; không cần bật gói trả phí |
| 1. Game engine | Khởi tạo 3/4/5, lượt, toàn bộ bài, combo, Nope, thắng/thua; tách engine khỏi giao diện | Kiểm thử luật và bất biến bài/lượt đạt; không có phụ thuộc mạng trong logic luật |
| 2. Multiplayer | Tạo/vào phòng, sẵn sàng, quyền chủ phòng, phiên ẩn danh, góc nhìn riêng, xử lý lệnh có phiên bản và chống trùng | 3–5 phiên độc lập nhận đúng trạng thái; giả mạo/bấm trùng không đổi ván sai |
| 3. Khôi phục | Lưu snapshot sau mỗi thay đổi, deadline, alarm, pause/resume, reconnect, chuyển quyền, dọn phòng | Khôi phục mọi giai đoạn sau restart, không mất/lộ bài hoặc xử lý hành động hai lần |
| 4. Giao diện | Các màn hình tiếng Việt và thao tác bài; bố cục điện thoại, lỗi dễ hiểu, hướng dẫn | Chơi trọn ván trên máy tính và điện thoại, không cần công cụ phát triển |
| 5. Kiểm thử nhóm | Ván 3/4/5 người, chuỗi Attack/Nope, mạng yếu, tab nền, restart, nhiều phòng | Ma trận kiểm thử dưới đây đạt; ghi nhận và sửa lỗi cản trở chơi |
| 6. Deploy | Build, deploy Free, kiểm tra link trực tiếp vào phòng, HTTPS/WebSocket, quota và smoke test | Nhóm vào qua link, hoàn thành ván thật, chơi ván tiếp và reconnect được |

Không cần chốt số ngày giả định trước khi có code. Mốc 0 kiểm tra tính khả thi của hạ tầng trước khi đầu tư toàn bộ giao diện. Ưu tiên một ván hoàn chỉnh có kiểm thử rồi mới thêm hiệu ứng.

## 7. Ma trận kiểm thử bắt buộc

| Nhóm | Tình huống và kết quả cần đạt |
| --- | --- |
| Khởi tạo | Đúng 3/4/5 người; mỗi tay 8 lá; đúng số bom, Gỡ Bom và chồng rút; không có bom ban đầu |
| Bất biến bài | Mỗi ID lá ở đúng một nơi, kể cả lá đang xử lý; không sinh/mất lá ngoài các lá loại khi thiết lập |
| Lượt | Rút một lần; Skip dưới Attack; Attack liên tiếp; Attack sau khi trả một lượt; bỏ qua người bị loại |
| Bom | Không Gỡ Bom thì loại; có Gỡ Bom thì cài đầu/giữa/cuối; xử lý khi nợ nhiều lượt; bom cuối kết thúc ván |
| Nope | Chặn tác dụng/combo, chặn Nope, chuỗi chẵn/lẻ, bỏ qua đủ người, hết 5 giây, lệnh đúng sát hạn/đến muộn |
| Tác dụng riêng | Favor do người cho chọn; See the Future không đổi thứ tự; Shuffle không lộ kết quả; combo gọi bài có/không có |
| Riêng tư | Payload mạng không chứa bài người khác, chồng rút hoặc vị trí cài bom; spectator chỉ thấy công khai |
| Đồng thời | Hai Nope cùng lúc, lệnh và alarm tranh nhau, bấm rút hai lần, gửi lại lệnh sau mất ACK, trạng thái cũ |
| Restart | Khởi động lại ở lượt thường, cửa sổ Nope, đang xin bài, xem tương lai, cài bom, sau lưu nhưng trước ACK |
| Mất mạng | Chủ phòng/người khác/người bị loại mất mạng; nhiều người mất mạng; giữ thời gian Nope; reconnect không tạo ghế mới |
| Phiên | Trùng tên không chiếm ghế; sai token bị từ chối; hai tab không điều khiển song song; mất dữ liệu phiên báo rõ |
| Phòng | Không bắt đầu thiếu người/chưa ready; đầy phòng; join giữa ván; kick sau bắt đầu bị chặn; hủy, chuyển quyền, chơi lại |
| Thiết bị | Chrome desktop/Android, Safari iPhone nếu nhóm dùng; màn hình dọc, tay nhiều bài, chuyển ứng dụng rồi quay lại |
| Hạ tầng | Hai phòng không trộn dữ liệu; phục vụ link phòng khi mở trực tiếp; giới hạn lệnh/tạo phòng; xem quota sau buổi thử |

Kiểm thử engine với nguồn ngẫu nhiên có thể điều khiển để tái hiện ca khó. Bản chơi thật dùng nguồn ngẫu nhiên phía server. Kiểm thử trình duyệt dùng các phiên độc lập, không chia sẻ cookie để mô phỏng 5 người.

## 8. Deploy miễn phí và giới hạn thực tế

Tại thời điểm kiểm tra, Cloudflare công bố:

| Tài nguyên | Hạn mức Free được xác minh |
| --- | --- |
| Worker động | 100.000 request/ngày; 10 ms CPU mỗi invocation |
| Static assets | Request miễn phí, không giới hạn theo bảng pricing |
| Durable Objects | 100.000 request/ngày; 13.000 GB-s/ngày |
| SQLite trong Durable Objects | 5 triệu hàng đọc/ngày; 100.000 hàng ghi/ngày; tổng lưu trữ 5 GB |

Nguồn: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) và [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/). Đây là hạn mức tài khoản, không cấp riêng cho mỗi phòng; các dự án khác cùng tài khoản cũng có thể dùng quota.

Nhận định thiết kế: lưu lượng một nhóm 3–5 người có khả năng phù hợp với Free nếu handler ngắn, dùng hibernation và không ghi heartbeat liên tục xuống database. Đây chưa phải kết quả đo. Mốc 5–6 phải đo mức sử dụng thực tế, kiểm tra CPU và độ trễ trước khi kết luận.

Các bước deploy dự kiến:

1. Người dùng tạo hoặc dùng tài khoản Cloudflare, giữ Workers Free. GitHub đã có sẵn.
2. Tạo repository và đưa mã nguồn, tài liệu, lockfile vào GitHub; không commit bí mật deploy.
3. Cấu hình binding GameRoom, migration SQLite, static assets và đường dẫn SPA/API/WebSocket. Hướng dẫn cụ thể và lệnh lấy theo tài liệu tại lúc viết code.
4. Deploy lần đầu bằng công cụ chính thức Cloudflare; dùng địa chỉ được cấp, không cần mua domain riêng.
5. Mở link phòng trực tiếp trên điện thoại, kiểm tra chia bài, Nope, pause/reconnect, khôi phục dữ liệu, kết thúc và ván mới.
6. Theo dõi quota sau buổi chơi thử. Giới hạn tạo phòng, dữ liệu lưu và tần suất lệnh trong ứng dụng; xử lý lỗi quota thành thông báo dễ hiểu.
7. Có thể bổ sung deploy từ GitHub sau khi lần deploy thủ công đã chạy đúng; không cần thiết cho bản đầu.

Gói Free không đồng nghĩa không có gián đoạn. Tài liệu Durable Objects ghi rõ thao tác vượt hạn mức Free sẽ lỗi, giới hạn ngày reset lúc 00:00 UTC. Không tự bật Paid hoặc sản phẩm trả phí để xử lý lỗi.

Chưa xác minh quy trình đăng ký Cloudflare cụ thể có yêu cầu thẻ cho tài khoản của người dùng hay không. Không cam kết “không cần thẻ” khi chưa quan sát; nếu quy trình yêu cầu nâng gói, dừng bước đó và tìm phương án khác. Chưa có tài khoản Cloudflare được kết nối, URL deploy, repository được tạo hoặc số đo hiệu năng thực tế trong lần lập kế hoạch này.

## 9. Bàn giao và tiêu chí nghiệm thu

Deliverables khi thực hiện kế hoạch:

- Repository mã nguồn trong GitHub của người dùng; phiên bản dependencies được khóa.
- Game web đã deploy theo gói miễn phí và link chơi.
- README tiếng Việt: chạy local, kiểm thử, deploy, cập nhật, quota, lỗi thường gặp và khôi phục.
- Tài liệu luật làm chuẩn, bản dịch mô tả bài và các quy ước online.
- Bộ kiểm thử engine, multiplayer, bảo vệ bài và restart; ghi nhận kết quả kiểm thử buổi chơi nhóm.

Nghiệm thu khi nhóm chơi trọn ván ở cả 3/4/5 người, thao tác trên điện thoại rõ ràng, chỉ thấy bài được phép thấy, Nope/Attack/combo đúng tài liệu, mất mạng tạm dừng và quay lại đúng trạng thái, restart giữ ván đã lưu, chủ phòng tổ chức được ván tiếp, hạ tầng vẫn ở Free.

Các điều chỉnh kỹ thuật mặc định trong kế hoạch — heartbeat 10 giây, phát hiện mất mạng 25 giây, lưu phòng 7 ngày, một kết nối điều khiển mỗi ghế — có thể hiệu chỉnh qua kiểm thử. Thay đổi luật, số người hoặc phạm vi đã chốt thì hỏi lại người dùng.

## 10. Nguồn tham khảo

- [Original Edition rules 2022](https://cdn.svc.asmodee.net/production-asmodeeca/uploads/2023/04/English.pdf)
- [FAQ số người chơi của nhà phát hành](https://exploding-kittens.gorgias.help/en-US/how-many-players-does-the-game-support-190870)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Durable Objects WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Durable Objects Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [React SPA và API cùng Cloudflare Worker](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)

Thông tin hạ tầng được kiểm tra ngày 03/10/2026 bằng Exa và tài liệu chính thức; hướng dẫn kỹ thuật được đối chiếu qua Context7. Kiểm tra lại hạn mức và API trước lúc triển khai thực tế.
