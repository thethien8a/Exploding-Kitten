# Mèo Nổ — Phase 0–3

Game web tiếng Việt đang xây theo từng phase. Engine Original Edition 2022 đã nối vào Worker và bàn chơi multiplayer: phòng 3/4/5 người, bài kín, thao tác bài, Nope, pause/resume, khôi phục sau restart, hủy và tái đấu. **Phase 2–3 đã nghiệm thu local; đã triển khai bàn oval phương án B theo yêu cầu, nhưng chưa nghiệm thu toàn bộ Phase 4, điện thoại thật hoặc chơi nhóm production.** Chưa deploy live.

[Kế hoạch gốc](meo-no-implementation-plan.md) · [Lộ trình](documents/README.md) · [Kết quả thực tế](documents/PROGRESS.md)

## Chạy local

Yêu cầu Node.js **22.12 trở lên** và npm. Đã kiểm tra trên Windows với Node 22.14.0, npm 10.9.2. Không cần tài khoản Cloudflare, API token hay file `.env` để chạy local.

```sh
npm ci
npm run dev
```

Mở <http://127.0.0.1:5173/>. Nhập tên, chọn **3/4/5 người**, bấm **Tạo phòng**, rồi gửi **Link cùng phòng** cho nhóm. Khi đủ người, tất cả bấm **Sẵn sàng**, chủ phòng bấm **Bắt đầu ván**.

Khi bắt đầu, mọi người tự chuyển từ phòng chờ sang **bàn oval riêng**: chồng rút/bài bỏ ở giữa, các ghế xung quanh, ghế của bạn ở dưới và tay bài riêng bên dưới bàn. Lá vừa đánh, cả combo 2/3 lá và Nope, hiện công khai kèm tên người đánh; Xin Bài và combo ghi rõ “nhắm vào” tên người được chọn. Có hiệu ứng đưa bài ra giữa bàn và hỗ trợ giảm chuyển động. URL phòng và kết nối giữ nguyên, không reload hoặc tạo phòng mới. Tay bài trên điện thoại cuộn ngang để xem đủ các lá.

Để mô phỏng ba người trên một máy, dùng Chrome thường, Chrome ẩn danh và Edge, hoặc các profile riêng. **Tab mới trong cùng profile sẽ lấy lại cùng ghế và thay tab cũ**, không tạo thêm người. Phiên bí mật nằm trong localStorage theo phòng; link mời không chứa token. Xóa dữ liệu trình duyệt hoặc đổi thiết bị không lấy lại ghế bằng tên.

Để thử đúng bản build, không có auto-reload của Vite dev:

```sh
npm run build
npm run preview
```

Mở <http://127.0.0.1:4173/>. Nếu đã có preview bản cũ chạy ở cổng này, cần dừng và chạy lại trước khi thử build mới; không dùng frontend mới với Worker cũ.

Trong lượt, chọn 1 lá tác dụng hoặc 2/3 lá cùng tên, chọn mục tiêu khi cần, rồi xác nhận đánh; rút bài để kết thúc lượt. Người cho tự chọn bài, người xem tương lai có nút đóng, người gỡ bom chọn kín vị trí 0..N hoặc nút Trên cùng/Dưới cùng. Nope/Bỏ qua chỉ dùng trong cửa sổ 5 giây. Bàn oval B là phần UX đã chọn, chưa phải nghiệm thu đầy đủ Phase 4.

Khi người còn sống mất kết nối, ván tạm dừng và giữ bài, lượt nợ, lựa chọn đang chờ cùng thời gian Nope còn lại. Cả nhóm sống quay lại thì tiếp tục. Menu **Phòng** chứa link mời và **Rời ván (giữ ghế)** để ngừng tự reconnect; bấm **Quay lại ghế** để trở lại. Chủ rời chủ động chuyển quyền cho người online; mất mạng thụ động không đổi chủ. Trong menu này, chủ phòng có thể **Hủy ván về phòng chờ**, hoặc **Về phòng chờ** sau kết thúc để đổi số người và tổ chức ván mới.

Để thử restart không reload trang, dùng production preview và giữ nguyên thư mục dữ liệu; Vite dev có thể tự reload khi server mất kết nối. Không dùng frontend build mới với một preview Worker cũ vẫn đang chạy.

Dữ liệu local mặc định nằm trong `.wrangler/state/v3/`, không nằm trong RAM của React hay một biến bộ đếm trên server. Giữ thư mục này khi thử restart; xóa nó sẽ xóa dữ liệu thử local. Test tự động dùng thư mục riêng, không xóa dữ liệu chạy thủ công. `MEONO_STATE_PATH` trong Vite config chỉ để chọn thư mục lưu local khi kiểm thử.

## Engine Phase 1

`shared/engine.ts` không import React, Cloudflare, WebSocket hoặc storage. Trạng thái chỉ gồm object/array/giá trị JSON; mỗi chuyển trạng thái trả bản mới, không sửa đầu vào. Thứ tự `drawPile[0]` là lá trên cùng; `removedCards` giữ các lá bị loại lúc thiết lập để kiểm tra đủ 56 ID.

| API | Hợp đồng |
| --- | --- |
| `createDeck()` | 56 lá, ID duy nhất và 13 mã loại bài độc lập tên hiển thị |
| `createGame(playerIds, random)` | 3/4/5 ghế theo thứ tự đầu vào, xáo/chia và chọn người đầu |
| `applyCommand(game, command)` | `play`, `draw`, `nope`, `give`, `close_future`, `insert_bomb`; từ chối sai lượt, sai chủ lựa chọn hoặc bài không sở hữu |
| `resolveReaction(game, random)` | API **server-only** chốt tác dụng theo parity Nope; không phải lệnh client |
| `getFutureCards(game, playerId)` | Tối đa 3 lá theo thứ tự, chỉ trả khi đúng người đang xem; người khác nhận `[]` |

Nguồn `random` được truyền vào từ server, mỗi mẫu là số trong khoảng từ 0 (bao gồm) đến 1 (không bao gồm). Không cho client truyền seed/kết quả random. Các lỗi luật là `Error` có thông điệp mã như `NOT_YOUR_TURN`, `ACTION_PENDING`, `INVALID_BOMB_POSITION`; adapter sau này dịch thành thông báo tiếng Việt.

- Bài đánh vào discard ngay; tác dụng chỉ bắt đầu sau `resolveReaction`. Nope chỉ được dùng trong `reaction`, có thể chặn Nope hoặc combo, không chặn rút bom/Gỡ Bom.
- Không được Nope lá/combo hoặc Nope mình vừa đánh; người đánh ban đầu vẫn được phản Nope của người khác. Engine kiểm tra người đánh gần nhất trước khi tiêu lá; UI khóa nút và giải thích lý do.
- `turn.attacked` phân biệt lượt thường với lượt nợ cuối của Attack: Skip/rút/Gỡ Bom chỉ trả một lượt; Attack khi còn nợ chuyển số lượt còn lại + 2.
- `favor` chờ người cho chọn lá; `future` chờ người xem đóng; `defuse` giữ bom công khai đang xử lý, chờ người rút cài lại ở vị trí 0..N rồi mới kết thúc một lượt. Không có đồng hồ suy nghĩ trong engine.
- Gỡ Bom dư được trộn **trước khi chia 7 lá**, đúng bước 3–4 PDF 2022: mỗi người có ít nhất một Gỡ Bom, có thể có thêm. Deck 3/4/5 người vẫn là 29/23/16.
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

`ready`, `set_capacity`, `start`, `kick`, `leave` quản lý phòng chờ; `cancel_game` dành cho chủ phòng để về lobby. Trong ván, `leave` giữ ghế, không tự loại người sống. `play`, `draw`, `nope`, `pass`, `give`, `close_future`, `insert_bomb` tích hợp engine. Người bị loại nhận bài công khai và số bài, không nhận tay người sống. Future chỉ gửi đúng người sau khi chốt; ACK không chứa lá chuyển hoặc vị trí cài bom.

Snapshot có `lastPlay` gồm ID diễn biến, người đánh và những lá vừa được đánh vào bài bỏ bởi `play`/`nope`; `targetId` optional ghi mục tiêu Xin Bài/combo đã được engine xác nhận, không lấy trực tiếp từ dữ liệu client tự khai. Nope hoặc bài không nhắm mục tiêu không mang theo mục tiêu cũ. Không bao gồm bài rút, bài cho nhau, tương lai hoặc vị trí cài bom. Metadata được lưu cùng ván, không cập nhật khi lệnh lỗi/replay; snapshot cũ thiếu metadata/mục tiêu vẫn phục hồi, hủy/tái đấu xóa diễn biến cũ. UI không phát lại hiệu ứng khi nhận lại cùng ID hoặc mới mở bàn từ snapshot.

Snapshot và journal ACK lưu cùng transaction SQLite trước khi xác nhận. ID lệnh thuộc từng ghế: cùng ID/nội dung trả ACK cũ; đổi nội dung cùng ID bị chặn. Cache trong core giữ 256 kết quả/ghế, nhưng journal SQLite giữ kết quả trước đó để retry không phụ thuộc cache. Phiên bản cũ với ID mới bị từ chối; hai phản ứng cùng phiên bản được tuần tự hóa, lệnh thứ hai phải đọc snapshot mới và gửi ID mới nếu bị `STALE_VERSION`.

Token 256 bit do server phát hành, chỉ hash SHA-256 được lưu trên server. Tab mới hợp lệ thay kết nối cũ; đóng tab cũ không đánh dấu tab mới offline. Chủ phòng mất kết nối vẫn giữ quyền; trong lobby, rời chủ động chuyển quyền theo thứ tự ghế online.

Giới hạn hiện tại: JSON/frame 2.048 byte; 40 frame/10 giây/ghế; 20 yêu cầu tạo/join và 60 kết nối/phút/phòng; tạo tối đa 6 phòng/phút/IP và 60/phút toàn ứng dụng. Bộ giới hạn tạo dùng Durable Object chung, không chỉ biến RAM trong Worker. Đây là giới hạn vận hành ban đầu, không phải số đo quota/CPU production.

## Khôi phục và vòng đời Phase 3

- Snapshot schema **1**, luật **original-2022** và ID ván được lưu cùng bài, lượt, reaction/pass, pause và phiên. Snapshot Phase 2 chưa có schema được migrate mà không chia lại; schema/luật không hỗ trợ bị từ chối, không ghi đè ván.
- Một hàng đợi tuần tự hóa mutation/command/alarm. Transaction lưu snapshot, ACK và lịch alarm; lỗi ghi rollback cả dữ liệu và state trong RAM, không gửi ACK thành công. Resend sau mất ACK giữ kết quả rút hoặc xáo đã lưu.
- Heartbeat `{"type":"ping"}` mỗi **10 giây**, auto-response `{"type":"pong"}` bằng Hibernation API. Alarm dùng timestamp thật của socket, phát hiện im lặng tại **25 giây**. Đây không phải giới hạn suy nghĩ hay thời gian được phép quay lại; cần hiệu chỉnh sau kiểm thử điện thoại thật.
- Một alarm bền vững chọn hạn gần nhất giữa Nope, heartbeat và TTL; không có timer RAM server làm nguồn thời hạn. Hibernation còn socket khỏe không tạo pause; restart mất socket thật giữ giai đoạn và chờ người sống quay lại, không chốt Nope trong lúc pause.
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

`npm run test:engine` chạy Vitest cho engine và lớp phòng, không cần Chrome, tài khoản Cloudflare hoặc server. **164 test** gồm 96 test luật (có 36 ván tới thắng) và 68 test phòng: quyền/validation, projection, chống trùng, deadline sát biên, pause/recovery, heartbeat, migration, chuyển chủ, hủy/tái đấu, TTL, metadata bài vừa đánh/mục tiêu và phân biệt tự Nope/phản Nope.

`npm test` chạy Vitest, rồi build và chạy Playwright. `npm run test:e2e` chỉ chạy phần build/Playwright, khởi tạo runtime Cloudflare local trên cổng **8788**. **24 kịch bản** gồm 7 hồi quy multiplayer và 17 recovery/bàn chơi:

- 3/4/5 browser context độc lập tạo/vào phòng qua UI, ready/start, chuyển sang bàn chơi, nhận 8 lá riêng; ghế của mỗi người ở dưới, không chồng ghế lên deck ở 1280/390/320px; phòng khác không bị thay đổi.
- Kiểm tra payload mạng không có tay người khác, deck/token; gửi hai lệnh rút cùng ID và lệnh thứ ba cùng phiên bản chỉ rút một lần.
- Tab thay thế, token bị kick vô hiệu, ID lệnh theo ghế, ACK cũ ổn định, chuyển chủ phòng khi rời lobby.
- Origin/token/method sai, JSON/binary/quá dài/giả `playerId` và rate limit không làm đổi ván.
- Alarm runtime 5 giây chốt action; rút/Gỡ Bom tới loại một người, kiểm tra payload spectator.
- UI mobile Nope/future/favor/defuse/combo bằng fixture snapshot **chỉ để kiểm tra render và lệnh UI**; kiểm tra tên bài dài nằm trong thẻ và cuộn được đến lá cuối. Không coi fixture là bằng chứng server xử lý luật. Luật mạng được kiểm tra bằng runtime thật và Vitest riêng.
- UI đánh combo 2/3 lá rồi Nope qua Worker thật: mọi ghế nhận đúng bài/người đánh/mục tiêu, hiệu ứng có giảm chuyển động và không phát lại khi reconnect. Xin Bài giữ thông báo mục tiêu sau restart; không lộ lá được trao và không gắn mục tiêu cũ vào Nope.
- Rút thành công bỏ chọn toàn bộ lá cũ, cả khi còn lượt nợ hoặc gặp bom; lỗi lưu/reconnect không xóa lựa chọn, thử lại thành công mới reset. Kiểm tra trạng thái `aria-pressed`, viền chọn, panel mục tiêu và khả năng chọn bài lại.
- UI khóa tự Nope, server từ chối lệnh gửi trực tiếp mà không tiêu bài/đổi cửa sổ; người đánh ban đầu phản Nope được. Restart SQLite giữa chuỗi Nope giữ đúng người vừa phản ứng và quyền của từng người.
- Đóng và khởi tạo lại production preview với cùng SQLite khi đang lượt thường, Xin Bài, Xem Tương Lai, cài bom và Nope; giữ bài/lượt nợ/phần riêng, không reload trang, rồi thực hiện tiếp thao tác.
- Nope giữ pass/thời gian qua downtime hơn 6 giây, chờ đủ người sống; rút/Xáo Bài mất ACK rồi resend không thực hiện lại. Trigger SQLite làm ghi lỗi để xác minh rollback và không ACK thành công.
- Chrome CDP ngừng JavaScript một tab: alarm phát hiện im lặng, hai người còn lại nhận pause; tab trở lại nối mới và tiếp tục đúng ghế/bài. Hủy, chơi tới kết thúc, đổi 3→4 và tái đấu; migrate snapshot cũ và dọn phòng hết hạn.

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
| `tests/room.test.ts` | Test lobby, lệnh/version, reaction/deadline, pause/recovery và whitelist dữ liệu |
| `tests/foundation.spec.ts` | Browser multiplayer/runtime thật, transport và render desktop/mobile |
| `tests/recovery.spec.ts` | Restart SQLite, mất ACK/rollback, heartbeat, vòng đời, migration và expiry qua runtime thật |
| `references/original-edition-2022.pdf` | Luật Original Edition 2022 làm chuẩn cho phase sau |

Kết nối dùng `ctx.acceptWebSocket()` / `ctx.getWebSockets()` / `webSocketMessage()` và attachment chỉ chứa ID ghế/kết nối. Snapshot và phiên nằm ở SQLite; alarm bền vững và timestamp auto-response điều phối Nope/heartbeat/expiry. Dùng API hibernation **không chứng minh** đã đo eviction hoặc billing production.

## Cloudflare Free và giới hạn nghiệm thu

Cấu hình hiện tại dùng SQLite Durable Objects và Workers Static Assets, không có dịch vụ yêu cầu Paid. Tài liệu chính thức xác nhận [SQLite Durable Objects có trên Workers Free](https://developers.cloudflare.com/durable-objects/platform/pricing/) và [request static assets miễn phí](https://developers.cloudflare.com/workers/platform/pricing/). API đã đối chiếu với [WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) và [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/tutorial/).

Kiểm tra đóng gói mà **không deploy**:

```sh
npm run build
npx wrangler deploy --dry-run
```

Chưa đăng nhập/xác minh tài khoản Cloudflare, điều kiện thẻ, quota/CPU/độ trễ thực tế, hibernation sau eviction hoặc khôi phục sau deploy. Dry-run chỉ kiểm tra bundle/config, không chứng minh quyền deploy hoặc hạn mức tài khoản. Quota và Free trên môi trường thật còn phải kiểm tra ở phase 5–6.

Đã có xác thực, góc nhìn riêng, chống trùng, giới hạn vận hành và nghiệm thu recovery local, nhưng **không dùng như bản game công khai** trước kiểm thử thiết bị/nhóm và hạ tầng thật ở Phase 4–6. Không commit `.env`, `.dev.vars` hoặc token; không tự push, deploy hoặc bật Paid.
