# Mèo Nổ — Phase 0

Prototype kiểm tra nền tảng cho game web tiếng Việt. **Chưa có luật, lá bài hoặc phòng chơi hoàn chỉnh.** Phase 0 chỉ chứng minh mỗi phòng có một giá trị SQLite bền vững, đồng bộ WebSocket và tự kết nối lại sau khi runtime khởi động lại.

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

## Kiểm tra

```sh
npm run check
npm run format:check
npx playwright install chromium
npm test
```

`npm test` tự build rồi khởi tạo runtime Cloudflare local trên cổng **8788**. Hai kịch bản Playwright kiểm tra:

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
| `wrangler.jsonc` | Static Assets, binding `GAME_ROOMS`, migration `new_sqlite_classes` |
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
