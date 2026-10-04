# Mèo Nổ — Phase 0–1

Game web tiếng Việt đang xây theo từng phase. Phase 0 có prototype SQLite/WebSocket/reconnect; Phase 1 có engine TypeScript thuần cho luật Original Edition 2022 và test luật. **Engine chưa nối vào Worker hoặc giao diện: trình duyệt vẫn là màn hình thử bộ đếm, chưa chơi bài được và chưa deploy live.**

[Kế hoạch gốc](meo-no-implementation-plan.md) · [Lộ trình](documents/README.md) · [Kết quả thực tế](documents/PROGRESS.md)

## Chạy local

Yêu cầu Node.js **22.12 trở lên** và npm. Đã kiểm tra trên Windows với Node 22.14.0, npm 10.9.2. Không cần tài khoản Cloudflare, API token hay file `.env` để chạy local.

```sh
npm ci
npm run dev
```

Mở <http://127.0.0.1:5173/?room=thu-nghiem>. Mở cùng link trong một cửa sổ thường và một cửa sổ ẩn danh. Bấm **Tăng giá trị +1** ở một cửa sổ: cả hai phải cập nhật. Đổi mã phòng để kiểm tra dữ liệu tách biệt.

Để thử đúng bản build, không có auto-reload của Vite dev:

```sh
npm run build
npm run preview
```

Mở <http://127.0.0.1:4173/?room=thu-nghiem>. Tăng giá trị, dừng server bằng Ctrl+C, rồi chạy lại `npm run preview` ở **cùng thư mục repo**. Không đóng hai trang: trạng thái phải chuyển sang **Đang kết nối lại…**, nút tăng bị khóa; khi server chạy lại, giá trị cũ trở lại và nút dùng được.

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
- `turn.attacked` phân biệt lượt thường với lượt nợ cuối của Attack: Skip/rút/Gỡ Bom chỉ trả một lượt; Attack khi còn nợ chuyển số lượt còn lại + 2.
- `favor` chờ người cho chọn lá; `future` chờ người xem đóng; `defuse` giữ bom công khai đang xử lý, chờ người rút cài lại ở vị trí 0..N rồi mới kết thúc một lượt. Không có đồng hồ suy nghĩ trong engine.
- Gỡ Bom dư được trộn **trước khi chia 7 lá**, đúng bước 3–4 PDF 2022: mỗi người có ít nhất một Gỡ Bom, có thể có thêm. Deck 3/4/5 người vẫn là 29/23/16.
- Favor/combo nhắm người sống khác mình có tay rỗng không chuyển lá nhưng vẫn mất bài đã đánh; không kẹt chờ cho bài. Đây là quyết định xử lý biên đã ghi ở `documents/PROGRESS.md`, không phải kết luận FAQ chính thức đã xác minh.

**Không gửi `GameState` đầy đủ xuống trình duyệt** vì chứa toàn bộ tay bài/chồng rút. Phase 2–3 sẽ xác thực `playerId`, kiểm tra JSON ngoài mạng, tạo góc nhìn riêng, quản lý bỏ qua/deadline Nope 5 giây, lệnh chống trùng và lưu/khôi phục trạng thái. JSON round-trip trong test engine không thay thế test restart storage thực tế.

## Kiểm tra

```sh
npm run check
npm run format:check
npm run test:engine
npx playwright install chromium
npm test
```

`npm run test:engine` chỉ chạy Vitest, không cần Chrome, tài khoản Cloudflare hoặc server. Test gồm chia 3/4/5 người, Attack/Skip, bom, mọi action/combo, Nope, tay rỗng, thứ tự bài, lựa chọn riêng, bất biến ID và không sửa trạng thái đầu vào; có 36 ván rút/Gỡ Bom tới thắng với seed cố định.

`npm test` chạy test engine, rồi build và chạy Playwright. `npm run test:e2e` chỉ chạy phần build/Playwright, khởi tạo runtime Cloudflare local trên cổng **8788**. Hai kịch bản kiểm tra:

- Ba browser context độc lập: hai phiên cùng phòng, một phiên ở phòng khác; cập nhật hai chiều và nhiều lần bấm sát nhau.
- Dừng runtime bằng `await previewServer.close()`, đọc trực tiếp file SQLite bằng `node:sqlite`, tạo runtime mới với cùng dữ liệu/cổng, xác nhận reconnect **không tải lại trang** và vẫn thao tác được.
- Mã phòng 48/49 ký tự, API/method/origin sai, JSON lỗi, binary, payload quá dài và lệnh giả đặt giá trị không làm sai bộ đếm.
- Giao diện desktop/mobile, nút bị khóa lúc mất kết nối, lỗi nhập mã phòng và mở phòng khác.

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

Kết quả JSON và ảnh nằm trong `.amp/in/artifacts/`; dữ liệu SQLite tạm của mỗi test được dọn sau test. Cổng 8788 phải trống. Node 22 có thể báo `node:sqlite` là experimental; module này chỉ dùng để kiểm chứng file lưu trữ trong test, không nằm trong Worker production.

## Stack và cấu trúc

Dependency trực tiếp được pin trong `package.json`, dependency bắc cầu được khóa bằng `package-lock.json`.

| Đường dẫn | Vai trò |
| --- | --- |
| `src/` | React + TypeScript; giao diện thử tiếng Việt và reconnect có backoff |
| `worker/index.ts` | Worker định tuyến; mỗi mã phòng là một `GameRoom` Durable Object |
| `shared/protocol.ts` | Mã phòng và dạng thông điệp dùng chung |
| `shared/engine.ts` | Engine luật thuần; chưa tích hợp vào Worker/React |
| `wrangler.jsonc` | Static Assets, binding `GAME_ROOMS`, migration `new_sqlite_classes` |
| `tests/engine.test.ts`, `vitest.config.ts` | Test luật/inventory/immutability, không nạp plugin Cloudflare |
| `tests/foundation.spec.ts` | Browser, lưu trữ trên đĩa, restart và kiểm tra transport |
| `references/original-edition-2022.pdf` | Luật Original Edition 2022 làm chuẩn cho phase sau |

Server chỉ nhận yêu cầu `increment`, tự thực hiện `UPDATE … RETURNING` và phát snapshot; client không được đặt giá trị. Kết nối dùng `ctx.acceptWebSocket()` / `ctx.getWebSockets()` / `webSocketMessage()`, không dùng timer server hay `ws.accept()` để giữ object thức. Đây là API hỗ trợ hibernation, **không phải bằng chứng đã đo hibernation hoặc billing trên production**.

## Cloudflare Free và giới hạn nghiệm thu

Cấu hình hiện tại dùng SQLite Durable Objects và Workers Static Assets, không có dịch vụ yêu cầu Paid. Tài liệu chính thức xác nhận [SQLite Durable Objects có trên Workers Free](https://developers.cloudflare.com/durable-objects/platform/pricing/) và [request static assets miễn phí](https://developers.cloudflare.com/workers/platform/pricing/). API đã đối chiếu với [WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) và [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/tutorial/).

Kiểm tra đóng gói mà **không deploy**:

```sh
npm run build
npx wrangler deploy --dry-run
```

Chưa đăng nhập/xác minh tài khoản Cloudflare, điều kiện thẻ, quota/CPU/độ trễ thực tế, hibernation sau eviction hoặc khôi phục sau deploy. Dry-run chỉ kiểm tra bundle/config, không chứng minh quyền deploy hoặc hạn mức tài khoản. Quota và Free trên môi trường thật còn phải kiểm tra ở phase 5–6.

Prototype chưa có xác thực người chơi, giới hạn số phòng/tần suất hoặc chống xử lý lệnh trùng; **không dùng như bản game công khai**. Những phần này thuộc phase sau. Không commit `.env`, `.dev.vars` hoặc token; không tự push, deploy hay bật Paid khi làm Phase 0.
