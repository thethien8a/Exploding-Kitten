# Mèo Nổ — Phase 0–3

Game web tiếng Việt đang xây theo từng phase, tên lá bài hiển thị bằng tiếng Anh gốc. Engine dựa trên luật Original Edition 2022 đã nối vào Worker và bàn chơi multiplayer: phòng 3/4/5 người, bài kín, thao tác bài, Nope, tiếp tục khi mất kết nối, khôi phục sau restart, hủy và tái đấu. Ván mới dùng **bộ cơ bản pha Alter the Future, Reverse, Draw from the Bottom và thêm 2 Defuse dư**, mỗi người bắt đầu với **5 lá gồm 1 Defuse bảo đảm và 4 lá ngẫu nhiên**; mỗi người trên 3 vẫn thêm một lá mỗi loại thường, kể cả ba loại mới, không tăng Exploding Kitten/Defuse theo ghế. **Phase 2–3 đã nghiệm thu local; đã triển khai bàn oval phương án B theo yêu cầu, nhưng chưa nghiệm thu toàn bộ Phase 4, điện thoại thật hoặc chơi nhóm production.** Chưa deploy live.

[Kế hoạch gốc](meo-no-implementation-plan.md) · [Lộ trình](documents/README.md) · [Kết quả thực tế](documents/PROGRESS.md)

## Luật nhóm hiện tại

- **Alter the Future (3x):** xem kín tối đa 3 lá đầu, dùng **Trước / Sau** rồi **Xác nhận thứ tự**. Lá số 1 được rút trước; không kết thúc lượt. Chỉ người đánh được xem và xác nhận, thứ tự chưa xác nhận chỉ nằm trên màn hình của họ.
- **Reverse:** đảo thứ tự người chơi, kết thúc một lượt không rút. Khi còn lượt Attack, chỉ trả một lượt; còn 2 người thì tác dụng như Skip. Bàn hiển thị chiều và người tiếp theo.
- **Draw from the Bottom:** rút đúng lá cuối và trả một lượt. Gặp bom vẫn phải Defuse hoặc bị loại như rút đầu. Cả ba lá mới đều có thể bị Nope. Tác dụng theo [luật Imploding Kittens chính thức](https://cdn.shopify.com/s/files/1/0345/9180/1483/files/imploding-english.pdf?v=1734625756); Attack giữ luật nhóm không cộng dồn.
- **Tay khởi đầu 5 lá:** 1 Defuse bảo đảm, rồi chia thêm 4 lá từ bộ không có bom. Defuse dư vẫn trộn trước khi chia nên có thể nhận thêm. Chỉ áp dụng khi bắt đầu ván mới; không thu bớt bài của ván đang chơi/đã lưu.
- **60 giây không hoạt động:** server tự rút đầu khi người tới lượt không thực hiện thao tác chơi hợp lệ. Đánh bài/lựa chọn được chấp nhận cho 60 giây mới; chọn lá, mở menu, heartbeat, lệnh lỗi, replay ACK và đổi tab không gia hạn. Trong reaction dùng đồng hồ Nope riêng; sau khi chốt bắt đầu 60 giây cho lượt/lựa chọn tiếp theo. Hết giờ xem/sắp tương lai thì đóng/giữ thứ tự server hiện tại rồi rút; người đang phải cho bài tự cho một lá ngẫu nhiên; người gỡ bom tự cài ngẫu nhiên để kết thúc lượt. Không rút bù nhiều lượt nếu alarm chạy muộn.
- **Nope 5 giây:** mỗi Nope hợp lệ mở lại 5 giây và xóa các lượt Bỏ qua; cả nhóm Bỏ qua vẫn chốt sớm được. Đây cũng là giá trị đã có trước thay đổi này.
- **Không đóng băng khi offline:** mất mạng, đóng tab hoặc **Rời ván (giữ ghế)** không dừng ván hay gia hạn đồng hồ. Người vắng mặt vẫn có lượt và tự rút khi hết 60 giây; Nope và các lựa chọn đang chờ vẫn chốt theo hạn riêng. Người đã bị loại thoát không đổi lượt, bài hay thời gian; khi quay lại chỉ xem bàn. Người còn sống quay lại nhận bài/lượt hiện tại, kể cả những lá đã tự rút.
- Cả đồng hồ 60 giây và Nope được lưu cùng snapshot/alarm SQLite, tiếp tục kể cả khi tất cả offline. Hủy/kết thúc xóa đồng hồ. Ván cũ đang pause được chuyển sang đồng hồ chạy từ thời gian còn lại một lần khi nạp bằng bản mới. Bộ bài mới chỉ áp dụng khi bắt đầu **ván mới**, không thêm lá hoặc xáo lại ván đã lưu.

| Số người | Mỗi loại mới | Tổng Defuse trong ván (gồm lá chia sẵn) | Defuse dư trộn trước khi chia | Chồng rút ban đầu |
| --- | --- | --- | --- | --- |
| 3 | 3 | 7 | 4 | 49 |
| 4 | 4 | 8 | 4 | 60 |
| 5 | 5 | 8 | 3 | 70 |

## Giao diện

UI theo hướng **Playful paper**: nền kem, xanh rừng–cam, logo mèo và typography bo tròn. Trang tạo/vào phòng có form rõ ràng và hướng dẫn mời bằng link; phòng chờ tách danh sách người chơi, ghế trống và khu vực mời bạn. Bàn oval giữ bố trí cũ, làm mới mặt bàn, tay bài, trạng thái chọn và các panel riêng; khi người còn sống offline, hiện **Ván vẫn tiếp tục** và đồng hồ vẫn chạy, không khóa người đang online. Ghế bị loại luôn hiện **Đã nổ · Bị loại**, kể cả khi offline. Payload bài kín và cơ chế reconnect được bảo toàn.

Hướng thiết kế tham khảo [Envato: UX/UI trends 2026](https://elements.envato.com/learn/ux-ui-design-trends) và [WANDR: Game UI trends 2026](https://www.wandr.studio/blog/game-ui-design-trends-2026): phân cấp rõ, giảm nhiễu, chuyển động phản hồi có mục đích và bố cục riêng cho mobile. Font **Baloo 2** và **Be Vietnam Pro** được đóng gói local trong `src/assets/fonts/`, kèm giấy phép SIL OFL; không phụ thuộc request Google Fonts khi chơi. Logo và mặt bài dùng chung ở `src/Brand.tsx` và `src/CardFace.tsx`; màu và typography tập trung trong CSS variables.

## Chạy local

Yêu cầu Node.js **22.12 trở lên** và npm. Đã kiểm tra trên Windows với Node 22.14.0, npm 10.9.2. Không cần tài khoản Cloudflare, API token hay file `.env` để chạy local.

```sh
npm ci
npm run dev
```

Mở <http://127.0.0.1:5173/>. Nhập tên, chọn **3/4/5 người**, bấm **Tạo phòng**, rồi gửi **Link cùng phòng** cho nhóm. Khi đủ người, tất cả bấm **Sẵn sàng**, chủ phòng bấm **Bắt đầu ván**.

Khi bắt đầu, mọi người tự chuyển từ phòng chờ sang **bàn oval riêng**: chồng rút/bài bỏ ở giữa, các ghế xung quanh, ghế của bạn ở dưới và tay bài riêng bên dưới bàn. Lá vừa đánh, cả combo 2/3 lá và Nope, hiện công khai kèm tên người đánh; Favor và combo ghi rõ “nhắm vào” tên người được chọn. Có hiệu ứng đưa bài ra giữa bàn và hỗ trợ giảm chuyển động. URL phòng và kết nối giữ nguyên, không reload hoặc tạo phòng mới. Tay bài tự gom các lá cùng loại cạnh nhau, kể cả sau khi rút/lấy bài; lựa chọn vẫn theo ID lá. Trên điện thoại, tay bài cuộn ngang để xem đủ các lá.

Sau khi combo 2/3 lá được chốt, **chỉ người lấy và người bị lấy** nhận thông báo tên lá đã chuyển, hoặc kết quả không lấy được bài. Thông báo có nút đóng, giữ qua reconnect/restart và không mở lại khi nhận cùng ID trong phiên đang mở. Người thứ ba và API công khai không nhận thông tin này; combo bị Nope chặn không báo đã lấy bài.

**Combo 5 lá khác loại:** chọn 5 lá có tên khác nhau trên tay, chọn **Lá bài bỏ muốn lấy** từ chồng bài bỏ chung rồi bấm **Đánh 5 lá đã chọn**. Bạn lấy đúng 1 lá đã có trong bài bỏ trước khi đổi, không lấy lại một trong 5 lá vừa trả. Combo này xử lý ngay, **không thể Nope** và **không kết thúc lượt**. Defuse/Nope có thể là một trong 5 loại và không kích hoạt tác dụng riêng khi dùng trong combo.

Khi ai rút trúng Exploding Kitten, cả bàn thấy tên người đó và trạng thái **đang gỡ bom**, **đã gỡ bom an toàn** hoặc **đã nổ và bị loại**. Ghế đang gỡ được đánh dấu; ghế bị loại chuyển sang tông đen/xám, giữ tên và trạng thái đã nổ dễ đọc. Khi ván kết thúc, người thắng có vương miện, viền vàng và nhãn **Người thắng**; dấu hiệu bị loại/thắng không giữ sang ván mới. Thông báo không lộ vị trí cài lại hoặc tay bài.

Để mô phỏng ba người trên một máy, dùng Chrome thường, Chrome ẩn danh và Edge, hoặc các profile riêng. **Tab mới trong cùng profile sẽ lấy lại cùng ghế và thay tab cũ**, không tạo thêm người. Phiên bí mật nằm trong localStorage theo phòng; link mời không chứa token. Xóa dữ liệu trình duyệt hoặc đổi thiết bị không lấy lại ghế bằng tên.

Để thử đúng bản build, không có auto-reload của Vite dev:

```sh
npm run build
npm run preview
```

Mở <http://127.0.0.1:4173/>. Nếu đã có preview bản cũ chạy ở cổng này, cần dừng và chạy lại trước khi thử build mới; không dùng frontend mới với Worker cũ.

Trong lượt, chọn 1 lá tác dụng hoặc 2/3 lá cùng tên, chọn mục tiêu khi cần, rồi xác nhận đánh; rút bài để kết thúc lượt. Người cho tự chọn bài, người xem tương lai có nút đóng, người gỡ bom nhập kín vị trí 0..N hoặc chọn **Ngẫu nhiên**, rồi xác nhận cài bom. Nhập 0/N để chọn đầu/cuối; nhập số sẽ bỏ chọn Ngẫu nhiên. Chọn Ngẫu nhiên chưa gửi lệnh; khi xác nhận, server chọn một trong N+1 vị trí, không trả vị trí đã chọn xuống client. Nope/Bỏ qua chỉ dùng trong cửa sổ 5 giây. Bàn oval B là phần UX đã chọn, chưa phải nghiệm thu đầy đủ Phase 4.

Khi người còn sống mất kết nối, ván và đồng hồ vẫn tiếp tục; hết giờ họ tự rút, cho bài hoặc cài bom theo giai đoạn hiện tại. Không loại họ chỉ vì offline và không cần chờ đủ nhóm quay lại. Menu **Phòng** chứa link mời và **Rời ván (giữ ghế)** để ngừng tự reconnect; bấm **Quay lại ghế** để nhận trạng thái mới. Chủ rời chủ động chuyển quyền cho người online; mất mạng thụ động không đổi chủ. Trong menu này, chủ phòng có thể **Hủy ván về phòng chờ**, hoặc **Về phòng chờ** sau kết thúc để đổi số người và tổ chức ván mới.

Để thử restart không reload trang, dùng production preview và giữ nguyên thư mục dữ liệu; Vite dev có thể tự reload khi server mất kết nối. Không dùng frontend build mới với một preview Worker cũ vẫn đang chạy.

Dữ liệu local mặc định nằm trong `.wrangler/state/v3/`, không nằm trong RAM của React hay một biến bộ đếm trên server. Giữ thư mục này khi thử restart; xóa nó sẽ xóa dữ liệu thử local. Test tự động dùng thư mục riêng, không xóa dữ liệu chạy thủ công. `MEONO_STATE_PATH` trong Vite config chỉ để chọn thư mục lưu local khi kiểm thử.

## Engine Phase 1

`shared/engine.ts` không import React, Cloudflare, WebSocket hoặc storage. Trạng thái chỉ gồm object/array/giá trị JSON; mỗi chuyển trạng thái trả bản mới, không sửa đầu vào. Thứ tự `drawPile[0]` là lá trên cùng; `removedCards` giữ các lá bị loại lúc thiết lập. Tổng inventory ván mới cho 3/4/5 người, kể cả bài bị loại, là 67/81/95 ID duy nhất; bộ nền pha mở rộng có 67 lá.

| API | Hợp đồng |
| --- | --- |
| `createDeck()` | Bộ nền 67 lá, ID duy nhất và 16 mã loại bài độc lập tên hiển thị |
| `createGame(playerIds, random)` | 3/4/5 ghế theo thứ tự đầu vào, mỗi tay 5 lá gồm 1 Defuse bảo đảm và 4 lá ngẫu nhiên; thêm một lá mỗi loại thường cho mỗi ghế trên 3 vào chồng rút, xáo và chọn người đầu |
| `applyCommand(game, command)` | `play`, `draw`, `nope`, `give`, `close_future`, `reorder_future`, `insert_bomb`; từ chối sai lượt, sai chủ lựa chọn, thứ tự không phải hoán vị hoặc bài không sở hữu |
| `resolveReaction(game, random)` | API **server-only** chốt tác dụng theo parity Nope; không phải lệnh client |
| `getFutureCards(game, playerId)` | Tối đa 3 lá theo thứ tự, chỉ trả khi đúng người đang xem/sắp; người khác nhận `[]` |

Nguồn `random` được truyền vào từ server, mỗi mẫu là số trong khoảng từ 0 (bao gồm) đến 1 (không bao gồm). Không cho client truyền seed/kết quả random. Các lỗi luật là `Error` có thông điệp mã như `NOT_YOUR_TURN`, `ACTION_PENDING`, `INVALID_BOMB_POSITION`; adapter sau này dịch thành thông báo tiếng Việt.

- Bài tác dụng và combo 2/3 lá đánh vào discard ngay; tác dụng chỉ bắt đầu sau `resolveReaction`. Nope chỉ được dùng trong `reaction`, có thể chặn Nope hoặc combo 2/3, không chặn rút bom/Defuse hay combo 5 lá.
- Combo 5 lá yêu cầu 5 ID trên tay thuộc 5 loại khác nhau và `discardIndex` trỏ tới một lá đã có trong bài bỏ. Server lấy lá đó rồi bỏ 5 lá trả cùng một thao tác, giữ nguyên lượt/chồng rút và không tạo reaction. Index được kiểm tra cùng phiên bản bàn để không lấy nhầm sau thay đổi; gửi lại cùng ID lệnh không đổi bài lần nữa.
- Không được Nope lá/combo hoặc Nope mình vừa đánh; người đánh ban đầu vẫn được phản Nope của người khác. Engine kiểm tra người đánh gần nhất trước khi tiêu lá; UI khóa nút và giải thích lý do.
- `turn.attacked` phân biệt lượt thường với lượt nợ cuối của Attack: Skip/rút/Defuse chỉ trả một lượt. Theo luật tùy chỉnh, Attack kết thúc toàn bộ lượt còn lại của người đánh và người kế tiếp luôn có đúng 2 lượt, không cộng dồn.
- `favor` chờ người cho chọn lá; `future` chờ người xem đóng; `alter_future` chờ người xem xác nhận hoán vị của tối đa 3 lá; `defuse` giữ bom công khai đang xử lý, chờ người rút cài lại ở vị trí 0..N rồi mới kết thúc một lượt. Đồng hồ và lựa chọn mặc định khi hết giờ do Worker quản lý, không nằm trong engine.
- Defuse dư (4/4/3 lá cho 3/4/5 người) được trộn **trước khi chia 4 lá**: mỗi người có ít nhất một Defuse, có thể có thêm. Tay khởi đầu là 5 lá/người; số bom vẫn bằng số người trừ một.
- Số bài tăng từ bộ nền 3 người theo công thức: mỗi ghế trên 3 thêm **một lá mỗi loại trong 14 loại thường**, sau khi chia. Không thêm bom/Defuse theo ghế và không đặt bảng số lượng riêng cho từng cỡ nhóm. Chồng rút lúc bắt đầu với 3/4/5 người là **49/60/70**; tổng số lá đang dùng (tay bài + chồng rút) là **64/80/95**. Các lá loại khỏi thiết lập không được rút. Mọi ván cũ đã lưu vẫn khôi phục nguyên trạng, không cắt/thêm bài hoặc xáo lại.
- Favor/combo nhắm người sống khác mình có tay rỗng không chuyển lá nhưng vẫn mất bài đã đánh; không kẹt chờ cho bài. Đây là quyết định xử lý biên đã ghi ở `documents/PROGRESS.md`, không phải kết luận FAQ chính thức đã xác minh.

**Không gửi `GameState` đầy đủ xuống trình duyệt** vì chứa toàn bộ tay bài/chồng rút. `worker/room.ts` tạo payload whitelist riêng; Worker xác thực ghế từ token, không nhận `playerId` của client. JSON round-trip trong test engine không thay thế test restart storage thực tế.

## Multiplayer Phase 2

| Đường dẫn / thông điệp | Hợp đồng |
| --- | --- |
| `POST /api/rooms` | JSON `{ name, capacity }`, capacity là số 3/4/5; trả 201 với `{ roomId, playerId, token }` |
| `POST /api/rooms/:id/join` | JSON `{ name }`; chỉ nhận người mới trong phòng chờ còn chỗ |
| `GET /api/rooms/:id` | Góc nhìn công khai, không có tay bài/tương lai của bất kỳ ai; phòng không tồn tại trả 404, không tự tạo phòng |
| `/api/rooms/:id/ws` | WebSocket cùng Origin, subprotocol `["meono", token]`; server chỉ chọn `meono`, không đặt token trong URL |
| Client command | `{ type: "command", id, version, action }`; action không có `playerId`, seed hoặc trạng thái mới |
| ACK | `{ type: "result", id, ok, version, code?, message? }`; lỗi quyền/luật/phiên bản không thực hiện thao tác |

`ready`, `set_capacity`, `start`, `kick`, `leave` quản lý phòng chờ; `cancel_game` dành cho chủ phòng để về lobby. Trong ván, `leave` giữ ghế, không tự loại người sống. `play`, `draw`, `nope`, `pass`, `give`, `close_future`, `reorder_future`, `insert_bomb` tích hợp engine. Người bị loại nhận bài công khai và số bài, không nhận tay người sống. Future chỉ gửi đúng người sau khi chốt; `reorder_future` gửi các index 0..2, không gửi bài/deck mới. ACK không chứa lá chuyển, thứ tự tương lai hoặc vị trí cài bom.

Snapshot có `lastPlay` gồm ID diễn biến, người đánh và những lá vừa được đánh vào bài bỏ bởi `play`/`nope`; `targetId` optional ghi mục tiêu Favor/combo đã được engine xác nhận, không lấy trực tiếp từ dữ liệu client tự khai. Nope hoặc bài không nhắm mục tiêu không mang theo mục tiêu cũ. Không bao gồm bài rút, bài cho nhau, tương lai hoặc vị trí cài bom. Metadata được lưu cùng ván, không cập nhật khi lệnh lỗi/replay; snapshot cũ thiếu metadata/mục tiêu vẫn phục hồi, hủy/tái đấu xóa diễn biến cũ. UI không phát lại hiệu ứng khi nhận lại cùng ID hoặc mới mở bàn từ snapshot.

`lastBomb` optional gồm ID diễn biến, người dính bom và kết quả `defusing`/`defused`/`exploded`; không chứa ID lá bom hoặc vị trí cài. Metadata giữ qua reconnect/restart, được xóa khi có thao tác chơi tiếp hoặc hủy/tái đấu. Bom đã nổ trong payload bài bỏ dùng ID công khai thay cho ID lá thật. `insert_bomb` nhận vị trí số hoặc chuỗi `"random"`; server chuyển lựa chọn random thành vị trí số cho engine. Replay cùng lệnh giữ kết quả đã lưu, không chọn ngẫu nhiên lần nữa.

`lastTransfer` optional lưu kết quả combo gần nhất: ID diễn biến, `fromId`, `toId`, `cardType` (null nếu không lấy được bài). Server suy ra lá thực sự chuyển sau khi chốt reaction bằng pass/deadline, không dự đoán lúc đánh combo. Chỉ snapshot của hai người liên quan có metadata này; các ghế khác và public view nhận null, ACK không có tên/ID lá. Lưu cùng snapshot, không đổi khi lệnh lỗi/replay; hủy/tái đấu xóa kết quả cũ. Snapshot cũ thiếu trường vẫn phục hồi.

Snapshot và journal ACK lưu cùng transaction SQLite trước khi xác nhận. ID lệnh thuộc từng ghế: cùng ID/nội dung trả ACK cũ; đổi nội dung cùng ID bị chặn. Cache trong core giữ 256 kết quả/ghế, nhưng journal SQLite giữ kết quả trước đó để retry không phụ thuộc cache. Phiên bản cũ với ID mới bị từ chối; hai phản ứng cùng phiên bản được tuần tự hóa, lệnh thứ hai phải đọc snapshot mới và gửi ID mới nếu bị `STALE_VERSION`.

Token 256 bit do server phát hành, chỉ hash SHA-256 được lưu trên server. Tab mới hợp lệ thay kết nối cũ; đóng tab cũ không đánh dấu tab mới offline. Chủ phòng mất kết nối vẫn giữ quyền; trong lobby, rời chủ động chuyển quyền theo thứ tự ghế online.

Giới hạn hiện tại: JSON/frame 2.048 byte; 40 frame/10 giây/ghế; 20 yêu cầu tạo/join và 60 kết nối/phút/phòng; tạo tối đa 6 phòng/phút/IP và 60/phút toàn ứng dụng. Bộ giới hạn tạo dùng Durable Object chung, không chỉ biến RAM trong Worker. Đây là giới hạn vận hành ban đầu, không phải số đo quota/CPU production.

## Khôi phục và vòng đời Phase 3

- Snapshot schema **1**, luật **original-2022-mixed** (ván mới pha mở rộng); vẫn đọc **original-2022**, **original-2022-scaled** và **original-2022-long** của các ván cũ. ID ván được lưu cùng bài, chiều chơi, lượt, reaction/pass, deadline không hoạt động và phiên. Snapshot cũ thiếu timer có 60 giây mới, thiếu chiều mặc định theo thứ tự ghế, không chia lại. Pause cũ được xóa và thời gian còn lại chuyển thành deadline mới; snapshot gửi client vẫn giữ `pause: null` để tương thích. Schema/luật không hỗ trợ bị từ chối, không ghi đè ván.
- Một hàng đợi tuần tự hóa mutation/command/alarm. Transaction lưu snapshot, ACK và lịch alarm; lỗi ghi rollback cả dữ liệu và state trong RAM, không gửi ACK thành công. Resend sau mất ACK giữ kết quả rút hoặc xáo đã lưu.
- Heartbeat `{"type":"ping"}` mỗi **10 giây**, auto-response `{"type":"pong"}` bằng Hibernation API. Alarm dùng timestamp thật của socket, phát hiện im lặng tại **25 giây**. Đây không phải giới hạn suy nghĩ hay thời gian được phép quay lại; cần hiệu chỉnh sau kiểm thử điện thoại thật.
- Một alarm bền vững chọn hạn gần nhất giữa Nope, 60 giây không hoạt động, heartbeat và TTL; không có timer RAM server làm nguồn thời hạn. Mất socket thật hoặc restart không đóng băng/gia hạn deadline. Hạn đã qua được xử lý khi alarm chạy, không rút bù nhiều lượt; lượt/lựa chọn mới có thời gian mới.
- Client lấy snapshot riêng mới, giữ nguyên lệnh chưa ACK, reconnect có backoff. Khi tab trở lại hoặc quá hạn pong, bỏ kết nối cũ và nối mới mà không chờ frame đóng; sự kiện muộn từ socket cũ không sửa trạng thái kết nối mới.
- Chủ rời giữa ván chuyển quyền cho ghế online đầu tiên. Nếu tất cả offline, lưu quyền dự phòng và chuyển cho thành viên hợp lệ quay lại đầu tiên. Cả nhóm rớt mạng thụ động thì vẫn giữ chủ cũ. Sau kết thúc giữ nhóm, xóa ready; ván sau có ID mới.
- Phòng hết hạn sau **7 ngày** từ create/join/reconnect hợp lệ hoặc lệnh mới thành công cuối. GET, heartbeat, alarm và replay ACK không gia hạn. Xóa cả snapshot, journal, rate limit và alarm, tắt auto-response; client báo hết hạn và xóa phiên local của phòng, không reconnect vô hạn.

Chi tiết nghiệm thu và giới hạn trong [Phase 3](documents/phase-3-recovery.md) và [PROGRESS](documents/PROGRESS.md). Runtime local không chứng minh hibernation/eviction hay khôi phục sau deploy production.

## Kiểm tra

```sh
npm run check
npm run format:check
npm run test:engine
npx playwright install chromium
npm test
```

`npm run test:engine` chạy Vitest cho engine và lớp phòng, không cần Chrome, tài khoản Cloudflare hoặc server. **275 test** gồm 131 test luật (có 36 ván tới thắng) và 144 test phòng: quyền/validation, projection, chống trùng, deadline sát biên, offline/recovery, heartbeat, migration pause cũ, chuyển chủ, hủy/tái đấu, TTL, metadata, combo, inventory, ba lá mở rộng và tự rút/lựa chọn mặc định sau 60 giây.

`npm test` chạy Vitest, rồi build và chạy Playwright. `npm run test:e2e` chỉ chạy phần build/Playwright, khởi tạo runtime Cloudflare local trên cổng **8788**. **36 kịch bản** gồm 7 hồi quy multiplayer và 29 recovery/bàn chơi:

- 3/4/5 browser context độc lập tạo/vào phòng qua UI, ready/start, chuyển sang bàn chơi, nhận 5 lá riêng; ghế của mỗi người ở dưới, không chồng ghế lên deck ở 1280/390/320px; phòng khác không bị thay đổi.
- Kiểm tra payload mạng không có tay người khác, deck/token; gửi hai lệnh rút cùng ID và lệnh thứ ba cùng phiên bản chỉ rút một lần.
- Tab thay thế, token bị kick vô hiệu, ID lệnh theo ghế, ACK cũ ổn định, chuyển chủ phòng khi rời lobby.
- Origin/token/method sai, JSON/binary/quá dài/giả `playerId` và rate limit không làm đổi ván.
- Alarm runtime 5 giây chốt action; rút/Defuse tới loại một người, kiểm tra payload spectator.
- Ba lá mở rộng qua UI/Worker thật; sắp kín bằng Trước/Sau, replay và restart SQLite không sắp lần hai; người khác offline không khóa lựa chọn hay gia hạn đồng hồ. Kiểm tra render 1280/390/320px. Alarm chạy đủ 60 giây thật vẫn tự rút dù heartbeat đều, chỉ rút một lần và không lộ lá cho người khác.
- UI mobile Nope/future/favor/defuse/combo bằng fixture snapshot **chỉ để kiểm tra render và lệnh UI**; kiểm tra tên bài dài nằm trong thẻ và cuộn được đến lá cuối; nút Rút bài bên trái, Đánh lá đã chọn bên phải ở 1280/390/320px. Không coi fixture là bằng chứng server xử lý luật. Luật mạng được kiểm tra bằng runtime thật và Vitest riêng.
- Mọi ghế thấy người dính bom, gỡ thành công hoặc nổ/bị loại, cả khi đó là lần nổ kết thúc ván; người bị loại chỉ xem công khai. Cài ngẫu nhiên không gửi trước xác nhận, không lộ vị trí và không cài lần nữa khi replay sau restart SQLite.
- UI đánh combo 2/3 lá rồi Nope qua Worker thật: mọi ghế nhận đúng bài/người đánh/mục tiêu, hiệu ứng có giảm chuyển động và không phát lại khi reconnect. Favor giữ thông báo mục tiêu sau restart; không lộ lá được trao và không gắn mục tiêu cũ vào Nope.
- Tay bài cùng loại nằm cạnh nhau; chọn theo ID vẫn đánh/cho đúng lá. Combo 2/3 thành công hoặc không có lá gọi tên báo đúng kết quả cho hai bên, không lộ cho người thứ ba/API công khai; đóng thông báo rồi replay/reconnect không mở lại, restart giữ kết quả.
- Combo 5 lá khác loại lấy Defuse/Exploding Kitten từ bài bỏ qua Worker thật, không mở Nope; lệnh Nope/Bỏ qua bị từ chối, 5 lá trả hiện đúng cho cả bàn, giữ lượt và kết quả qua replay/restart SQLite. UI chặn 4 lá hoặc 5 lá trùng loại, yêu cầu chọn bài bỏ và kiểm tra bố cục 1280/390/320px.
- Attack qua Worker thật luôn chuyển đúng 2 lượt, không cộng dồn khi đánh nối tiếp; rút một lượt còn 1, restart rồi Attack vẫn chỉ chuyển 2 lượt cho người tiếp theo.
- Rút thành công bỏ chọn toàn bộ lá cũ, cả khi còn lượt nợ hoặc gặp bom; lỗi lưu/reconnect không xóa lựa chọn, thử lại thành công mới reset. Kiểm tra trạng thái `aria-pressed`, viền chọn, panel mục tiêu và khả năng chọn bài lại.
- UI khóa tự Nope, server từ chối lệnh gửi trực tiếp mà không tiêu bài/đổi cửa sổ; người đánh ban đầu phản Nope được. Restart SQLite giữa chuỗi Nope giữ đúng người vừa phản ứng và quyền của từng người.
- Đóng và khởi tạo lại production preview với cùng SQLite khi đang lượt thường, Favor, See the Future, cài bom và Nope; giữ bài/lượt nợ/phần riêng, không reload trang, rồi thực hiện tiếp thao tác.
- Nope giữ deadline/pass qua disconnect, chốt sau downtime hơn 6 giây dù thiếu người; người khác vẫn chơi được và tab quay lại nhận trạng thái mới. Rút/Shuffle mất ACK rồi resend không thực hiện lại. Trigger SQLite làm ghi lỗi để xác minh rollback và không ACK thành công.
- Chrome CDP ngừng JavaScript người tới lượt: alarm phát hiện im lặng sau 25 giây, phòng không đóng băng và tự rút đúng hạn 60 giây. Người kế tiếp chơi trong khi ghế đó vẫn offline; tab trở lại nhận cả lá đã tự rút, không reload hay gia hạn đồng hồ. Người đã bị loại rời ván không đổi trạng thái chơi hoặc hiện cảnh báo chờ. Hủy, chơi tới kết thúc, đổi 3→4 và tái đấu; migrate snapshot cũ và dọn phòng hết hạn.

Recovery dùng trạng thái engine hợp lệ, xác định trước để tái hiện các giai đoạn khó; chỉ ghi fixture SQLite lúc runtime đã dừng. Lệnh, alarm, lưu/khôi phục và browser chạy qua Worker thật; không mock server để coi UI đã khôi phục. TTL dùng fixture thời gian hoạt động đã cũ, không chờ thực tế 7 ngày.

Nếu tải Chromium bị timeout, có thể dùng Chrome đã cài sẵn theo [API channel chính thức của Playwright](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge).

PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm test
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Git Bash:

```sh
PLAYWRIGHT_CHANNEL=chrome npm test
```

Kết quả JSON, log và ảnh nằm trong `.amp/in/artifacts/`; dữ liệu SQLite tạm của mỗi test được dọn sau test. Cổng 8788 phải trống. Test bộ đếm Phase 0 đã được thay bằng multiplayer/recovery; bằng chứng lịch sử vẫn ghi trong PROGRESS. Viewport mobile là mô phỏng Chrome, không phải Android/iPhone thật.

## Stack và cấu trúc

Dependency trực tiếp được pin trong `package.json`, dependency bắc cầu được khóa bằng `package-lock.json`.

| Đường dẫn | Vai trò |
| --- | --- |
| `src/` | React + TypeScript; UI tích hợp phòng/bài tiếng Việt, phiên local và reconnect có backoff |
| `worker/index.ts` | Worker định tuyến, hash token, SQLite snapshot/journal, transport và rate limit |
| `worker/room.ts` | Validation, quyền/lobby, phiên bản, reaction, tích hợp engine và góc nhìn riêng |
| `shared/protocol.ts` | Hợp đồng lệnh/payload công khai, thông điệp lỗi và tên bài |
| `shared/engine.ts` | Engine luật thuần; dùng ở server, không gửi toàn bộ state xuống client |
| `wrangler.jsonc` | Static Assets, binding `GAME_ROOMS`, migration `new_sqlite_classes` |
| `tests/engine.test.ts`, `vitest.config.ts` | Test luật/inventory/immutability, không nạp plugin Cloudflare |
| `tests/room.test.ts` | Test lobby, lệnh/version, reaction/deadline, offline/recovery và whitelist dữ liệu |
| `tests/foundation.spec.ts` | Browser multiplayer/runtime thật, transport và render desktop/mobile |
| `tests/recovery.spec.ts` | Restart SQLite, mất ACK/rollback, heartbeat, vòng đời, migration và expiry qua runtime thật |
| `references/original-edition-2022.pdf` | Luật Original Edition 2022 làm chuẩn cho phase sau |

Kết nối dùng `ctx.acceptWebSocket()` / `ctx.getWebSockets()` / `webSocketMessage()` và attachment chỉ chứa ID ghế/kết nối. Snapshot và phiên nằm ở SQLite; alarm bền vững và timestamp auto-response điều phối Nope/không hoạt động/heartbeat/expiry. Dùng API hibernation **không chứng minh** đã đo eviction hoặc billing production.

## Cloudflare Free và giới hạn nghiệm thu

Cấu hình hiện tại dùng SQLite Durable Objects và Workers Static Assets, không có dịch vụ yêu cầu Paid. Tài liệu chính thức xác nhận [SQLite Durable Objects có trên Workers Free](https://developers.cloudflare.com/durable-objects/platform/pricing/) và [request static assets miễn phí](https://developers.cloudflare.com/workers/platform/pricing/). API đã đối chiếu với [WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) và [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/tutorial/).

Kiểm tra đóng gói mà **không deploy**:

```sh
npm run build
npx wrangler deploy --dry-run
```

Chưa đăng nhập/xác minh tài khoản Cloudflare, điều kiện thẻ, quota/CPU/độ trễ thực tế, hibernation sau eviction hoặc khôi phục sau deploy. Dry-run chỉ kiểm tra bundle/config, không chứng minh quyền deploy hoặc hạn mức tài khoản. Quota và Free trên môi trường thật còn phải kiểm tra ở phase 5–6.

Đã có xác thực, góc nhìn riêng, chống trùng, giới hạn vận hành và nghiệm thu recovery local, nhưng **không dùng như bản game công khai** trước kiểm thử thiết bị/nhóm và hạ tầng thật ở Phase 4–6. Không commit `.env`, `.dev.vars` hoặc token; không tự push, deploy hoặc bật Paid.
