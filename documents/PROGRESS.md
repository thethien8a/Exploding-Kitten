# Tiến độ dự án Mèo Nổ

## Trạng thái hiện tại — 04/10/2026 (Asia/Bangkok)

- **Phase hiện tại:** 1 — hoàn thành điều kiện ra phase; chưa bắt đầu Phase 2.
- **Đã có:** nền Phase 0 đã push; engine Original Edition 2022 TypeScript thuần, 92 test luật đạt (gồm 36 ván rút/Gỡ Bom có seed); hai test trình duyệt nền vẫn đạt; TypeScript/build/format/dry-run đạt; README tiếng Việt.
- **Giới hạn bằng chứng:** tài liệu chính thức xác nhận cấu hình hỗ trợ Workers Free; chưa xác minh tài khoản, thẻ, quota/CPU/hibernation production hoặc deploy. Đây chưa phải game chơi được.
- **Bàn giao:** engine ở `shared/engine.ts`, test ở `tests/engine.test.ts`; README ghi hợp đồng tích hợp. Preview nền tại `http://127.0.0.1:4173/?room=thu-nghiem` còn chạy; giữ `.wrangler/state/v3/`; chưa deploy.

## Theo dõi phase

Trạng thái dùng: **chưa bắt đầu**, **đang thực hiện**, **chờ kiểm chứng**, **bị chặn**, **hoàn thành**. Chỉ dùng **hoàn thành** khi điều kiện ra phase đã được chứng minh bằng kết quả thực tế. Không coi việc tạo file hay chạy lệnh không lỗi là đã đạt.

| Phase | Trạng thái | Bằng chứng nghiệm thu | Trở ngại / bước tiếp theo |
| --- | --- | --- | --- |
| 0 — Nền tảng | Hoàn thành (đã push) | Kiểm tra lại: `2 passed (9.6s)`; TypeScript/build/format đạt; push `main` thành công | Quota và hibernation production chưa kiểm chứng |
| 1 — Game engine | Hoàn thành | `92 passed`; 36 ván tới thắng; TypeScript/build/format đạt; hồi quy nền `2 passed (8.3s)` | Chưa tích hợp mạng/UI; timer/bỏ qua Nope ở Phase 2–3 |
| 2 — Multiplayer | Chưa bắt đầu | Chưa có | Bước tiếp theo sau Phase 1 |
| 3 — Khôi phục | Chưa bắt đầu | Chưa có | Chờ phase 2 |
| 4 — Giao diện | Chưa bắt đầu | Chưa có | Chờ phase 3 |
| 5 — Kiểm thử nhóm | Chưa bắt đầu | Chưa có | Chờ phase 4 |
| 6 — Deploy | Chưa bắt đầu | Chưa có | Chờ phase 5 và chấp thuận thao tác deploy |

## Quy tắc cập nhật và bàn giao

1. Khi bắt đầu: đối chiếu trạng thái file này với code, môi trường và kết quả kiểm thử; đổi phase thành **đang thực hiện** khi thực sự bắt đầu.
2. Khi có kết quả: ghi ngày, thao tác/lệnh hoặc kịch bản, đầu ra quan sát được và đường dẫn bằng chứng. Ghi rõ kiểm thử thất bại hoặc chưa chạy; không điền “đạt” khi chỉ dự đoán.
3. Khi có quyết định mới: ghi điều gì đã **chốt**, điều gì còn **đề xuất**, lý do, phương án không chọn và tài liệu/code cần cập nhật. Nếu thay đổi luật, số người hoặc phạm vi, hỏi người dùng trước.
4. Sau mỗi buổi: ghi trạng thái, lỗi còn mở, dịch vụ đang chạy và **một bước tiếp theo**. Không tự push hay deploy chỉ vì tài liệu đã hoàn thành.

## Nhật ký thực hiện

### 03/10/2026 — Tổ chức tài liệu

- **Thực hiện:** phân tách bản kế hoạch gốc thành README, bảy tài liệu phase và file tiến độ này; không sửa kế hoạch gốc.
- **Quan sát:** thư mục dự án lúc kiểm tra chỉ có kế hoạch gốc và metadata Git, chưa có mã nguồn ứng dụng.
- **Kết luận:** tài liệu được chuẩn bị; không có bằng chứng hoàn thành phase 0 hoặc phase nào khác.
- **Tiếp theo:** bắt đầu thử tính khả thi phase 0; ghi kết quả vào bảng trên và nhật ký.

### 04/10/2026 — Phase 0: scaffold và nghiệm thu local

**Môi trường và phạm vi**

- Windows; Node `22.14.0`, npm `10.9.2`, Chrome `154.0.8037.93`; viewport desktop 1280×900 và mobile 390×844. Mobile là mô phỏng trên Chrome, không phải điện thoại/Safari thật.
- Pin các dependency trực tiếp trong `package.json`, khóa dependency bắc cầu trong `package-lock.json`; `npm install` báo 0 vulnerabilities. Chưa thêm Vitest vì engine chỉ bắt đầu ở Phase 1; Playwright kiểm tra xuyên suốt browser và runtime ở Phase 0.
- Mỗi mã phòng định tuyến đến một `GameRoom`; bộ đếm đọc/ghi bằng SQL, không cache giá trị trong RAM. Dùng WebSocket Hibernation API và migration `new_sqlite_classes`; không thêm Redis/D1/database ngoài, luật bài hoặc xác thực phiên game.
- PDF có dòng `ORIGINAL EDITION!` và `Copyright Exploding Kittens 2022`. SHA-256 của file local và dữ liệu tải lại từ [nguồn chính thức](https://cdn.svc.asmodee.net/production-asmodeeca/uploads/2023/04/English.pdf) trùng nhau: `93729c182cf5daf86a19e8cc673a587974f44ffbb125fa23896a67624b79fc67`.

**Lệnh và kết quả**

| Lệnh / kịch bản | Quan sát thực tế |
| --- | --- |
| `npm run check` và `npm run build` | TypeScript frontend/Worker/test đạt; tạo `dist/client` và `dist/meo_no` |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` (Git Bash) | Build + `2 passed (6.4s)`, không skipped, không retry, không flaky |
| `npx playwright test --grep 'phòng đồng bộ'` với cùng hai biến môi trường | Kiểm tra tập trung trước lần chạy toàn bộ: `1 passed (6.0s)` |
| `npx wrangler deploy --dry-run --outdir .amp/in/dry-run` | Bundle Worker 2.63 KiB; binding `GAME_ROOMS` và `ASSETS`; `--dry-run: exiting now.`; không upload/deploy, thư mục dry-run đã dọn |
| `git ls-remote --exit-code origin HEAD` | Đọc được HEAD remote GitHub; đây không phải bằng chứng có quyền push. Máy không có GitHub CLI, chưa xác minh quyền ghi |
| `npm run preview` | Bản build phục vụ local ở cổng 4173; để chạy cho người dùng xem |

**Điều kiện ra phase**

1. **Đạt — đồng bộ và tách phòng:** ba browser context độc lập; desktop/mobile cùng `nhom-a` cập nhật hai chiều `0 → 1 → 2 → 7`, phòng `nhom-b` vẫn 0. Tăng phòng B lên 3 không đổi phòng A.
2. **Đạt — SQLite qua restart:** `await previewServer.close()` đóng cả HTTP server và Miniflare/workerd; khi runtime dừng, test mở trực tiếp file SQLite read-only bằng `node:sqlite`, đọc được `[3, 7]`. Tạo runtime mới với cùng thư mục/cổng, hai phiên A nhận lại 7 và phiên B nhận lại 3.
3. **Đạt — reconnect không nhờ reload:** `performance.timeOrigin` của từng trang không thay đổi qua restart. Nút tăng bị khóa lúc mất kết nối; khi nối lại, mobile tăng A lên 8, desktop nhận 8, B vẫn 3. Không có `pageerror`; không tràn ngang ở mobile.
4. **Đạt ở mức cấu hình/tài liệu — không đòi Paid:** [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) xác nhận SQLite DO có trên Free; [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) xác nhận static assets miễn phí. Config chỉ dùng hai tài nguyên này; chạy local/dry-run không cần đăng nhập hoặc bật Paid. **Chưa kiểm chứng** đăng ký/thẻ, gói tài khoản hiện tại, quota/CPU/độ trễ thực tế hoặc billing/eviction trên Cloudflare; phải đo ở phase 5–6.

Hạn mức công bố khi kiểm tra: Worker động 100.000 request/ngày, 10 ms CPU/invocation; DO 100.000 request/ngày, 13.000 GB-s/ngày; SQLite 5 triệu hàng đọc/ngày, 100.000 hàng ghi/ngày, tổng 5 GB. Đây là hạn mức tài khoản theo tài liệu, **không phải số đo sử dụng của prototype**.

**Bằng chứng local** — lưu trong `.amp/in/artifacts/`, được ignore, không phải file đã xuất bản trên GitHub:

- `phase-0-test.log`, `playwright-results.json`: output và kết quả cuối cùng.
- `phase-0-focused-restart-test.log`, `phase-0-dry-run.log`: lần kiểm tra tập trung và đóng gói.
- `playwright/foundation-phòng-đồng-bộ-t-35724--SQLite-sau-restart-runtime/restart-evidence.json`: giá trị SQLite, browser version, time origins trước/sau và giá trị cuối `["8", "8", "3"]`.
- Cùng thư mục có `phase-0-desktop.png`, `phase-0-mobile.png`, `phase-0-reconnecting.png`; thư mục test transport có `phase-0-invalid-room.png`. Đã inspect cả bốn ảnh: chữ/nút đọc được, không clipping/overlap; trạng thái reconnect và lỗi nhập mã hiển thị đúng. Ảnh chỉ minh họa trạng thái, không thay thế kết quả test.

**Lỗi/giới hạn và quyết định đã ghi nhận**

- `npx playwright install chromium` timeout tải CDN sau nhiều lần thử. Dùng Chrome cài sẵn bằng option `channel` chính thức, không đổi phiên bản dependency để né lỗi. Hướng dẫn PowerShell/Git Bash nằm trong README.
- Lần đầu test bằng Vite dev có 1 failed/1 passed: SQLite phục hồi được nhưng `performance.timeOrigin` đổi. Trace xác nhận `@vite/client` báo `server connection lost. Polling for restart...` rồi tải lại trang. Chuyển test sang **production preview**, không bỏ assertion: lần cuối hai test đạt, time origins giữ nguyên. Log cũ ở `phase-0-initial-dev-test.log`.
- Lần đầu khởi tạo preview trong test bị timeout ở `beforeEach`; nguyên nhân **chưa xác định, chưa tái hiện**. Kiểm tra tách biệt sau đó: startup 1.361 giây, stop 60.203 ms, HTML không chứa `@vite/client`; test tập trung và test toàn bộ đều đạt. Giữ timeout 90 giây và retries 0. Output lỗi ở `phase-0-production-startup-test.log`, `playwright-startup-failure.json` để điều tra nếu tái diễn.
- Serena báo không có language server (`Active language servers: []`); không sửa cấu hình `.serena` đang có. Dùng công cụ file, TypeScript, build và browser để hoàn thành kiểm chứng.
- Runtime local và API hỗ trợ hibernation không chứng minh eviction/billing production. Chưa có auth, rate limit, lệnh idempotent hoặc snapshot game; không coi prototype là hoàn thành Phase 2–3 hay đủ an toàn để mở công khai.

**Dịch vụ/dữ liệu bàn giao:** preview cổng 4173 đang chạy; giữ `.wrangler/state/v3/`. Các thư mục SQLite test/smoke và output dry-run tạm đã dọn. Không commit, push, deploy hoặc nâng gói Cloudflare.

**Một bước tiếp theo:** khi người dùng yêu cầu, bắt đầu Phase 1 — engine thuần TypeScript và kiểm thử luật Original Edition 2022, không mở rộng phạm vi trong Phase 0.

### 04/10/2026 — Push Phase 0 và bắt đầu Phase 1

- Kiểm tra lại `npm run check`, `npm run format:check` và `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test`: đạt, `2 passed (9.6s)`.
- Commit/push nền Phase 0 lên `origin/main`: [885d444](https://github.com/thethien8a/Exploding-Kitten/commit/885d444e22202c973c915ba58691e47bf93e4871). Đánh dấu PDF là binary trong `.gitattributes` để Git giữ nguyên byte tài liệu luật.
- Pin Vitest `5.0.3`; [registry](https://registry.npmjs.org/vitest/5.0.3) xác nhận tương thích Node 22.14/Vite 8.3.2; install báo 0 vulnerabilities. Dùng config riêng theo [hướng dẫn Vitest](https://vitest.dev/guide/), không nạp plugin Cloudflare vào test engine.
- **Đối chiếu luật trước khi code:** PDF local trang 1, bước 3 thêm Gỡ Bom dư **trước** bước 4 chia 7 lá. Sửa diễn giải thứ tự trong kế hoạch để khớp nguồn chuẩn, không đổi luật: mỗi tay có ít nhất một Gỡ Bom, có thể nhận thêm trong 7 lá; deck vẫn 29/23/16.
- **Mục tiêu hết bài:** PDF cho phép tay 0 lá và chỉ nói “any other player”; tìm FAQ chính thức chưa thấy kết luận riêng cho trường hợp này. Engine cho phép chọn người sống khác mình có 0 lá; Favor/combo chốt thành không chuyển lá, vẫn mất bài đã đánh và không kẹt chờ trao bài. Không gọi đây là quy tắc FAQ đã xác minh.
- **Ranh giới engine:** lưu trạng thái reaction/favor/future/defuse bằng dữ liệu thuần. `resolveReaction` là API dành cho server, không phải lệnh người chơi. Đồng hồ 5 giây, lựa chọn bỏ qua, phiên, projection payload, storage và pause/resume thuộc Phase 2–3.
- Khi có nhiều Gỡ Bom, tự dùng lá đầu tiên (cùng loại/tác dụng); hoàn tất một lượt sau khi cài bom. Người nổ mất toàn bộ tay bài; các lượt nợ của họ không chuyển cho người kế tiếp. Lá mèo lẻ chỉ dùng trong combo; cặp/bộ ba Gỡ Bom hoặc Nope là combo có thể bị Nope, không kích hoạt tác dụng riêng.
- Serena báo `Active language servers: []` và `No language servers available in the manager` cả khi đọc/sửa; không sửa `.serena`, dùng công cụ file và TypeScript để kiểm chứng.

### 04/10/2026 — Phase 1: nghiệm thu engine

**Thực hiện:** thêm `shared/engine.ts`, `tests/engine.test.ts`, config Vitest riêng; pin dependency/lockfile. `npm test` chạy engine rồi test nền; Playwright chỉ nhận `*.spec.ts`, Vitest chỉ nhận `*.test.ts`. Engine không import module nào, không chứa mạng, timer hoặc storage; không sửa UI/Worker hiện có.

| Lệnh / kịch bản | Kết quả quan sát |
| --- | --- |
| `npm run check` | TypeScript frontend, shared/engine, Worker, config và test đạt |
| `npm run test:engine` | `92 passed (92)`, một test file, không server/Chrome; lần kiểm tra riêng 736 ms |
| `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` | Engine `92 passed` (767 ms), TypeScript/build đạt, Playwright `2 passed (8.3s)`, retries 0 |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir .amp/in/phase-1-dry-run` | Binding `GAME_ROOMS`/`ASSETS`, bundle 2.63 KiB; `--dry-run: exiting now.`, không upload; đã dọn thư mục bundle tạm |
| `curl` tới preview cổng 4173 | HTTP 200; giữ preview và dữ liệu thủ công |

**Điều kiện ra phase — đạt ở phạm vi engine:**

- Bộ 56 lá, 3/4/5 ghế, deck 29/23/16 và Gỡ Bom dư trộn trước khi chia được kiểm tra bằng số lượng độc lập từ PDF; nguồn random inject, có seed tái lập.
- Attack 2/4/6, sau rút/Skip/Gỡ Bom còn nợ một lượt chuyển 3, trả hết nợ reset, Skip một lượt, ghế bị loại và vòng ghế đều có expected cụ thể.
- Bom không/có Gỡ Bom, đầu/giữa/cuối và biên 0 khi chỉ còn bom; bỏ toàn bộ tay khi nổ; người cuối thắng; chọn vị trí/chủ lựa chọn sai bị từ chối.
- Favor do người cho chọn; tương lai đúng thứ tự tối đa 3 lá chỉ trả qua API cho chủ thao tác; Shuffle có permutation không đối xứng; cặp/bộ ba dùng action/Defuse/Nope bỏ tác dụng riêng, lấy đúng mục tiêu/loại hoặc không lấy gì. Mục tiêu tay rỗng không làm kẹt ván.
- Nope 0–5 lá chẵn/lẻ, chặn từng action/combo, kể cả combo Gỡ Bom; không chặn bom/Gỡ Bom hay action đã bắt đầu; bài đã dùng vẫn bị bỏ.
- Mỗi chuyển trạng thái hợp lệ kiểm tra không sửa đầu vào, mỗi ID ở đúng một nơi (kể cả bom đang xử lý), giữ nguyên inventory và các lá bị loại lúc chia. 36 ván 3/4/5 người rút/Gỡ Bom tới người thắng, kiểm tra đủ 56 ID sau từng bước.
- Reaction/favor/future/defuse có test JSON round-trip và tiếp tục cho kết quả tương đương. Đây là bằng chứng trạng thái thuần, **không phải** nghiệm thu persistence hoặc restart game ở Phase 3.

**Lỗi lần đầu:** TypeScript báo callback `test.each` nhận string thay vì mảng; Vitest `4 failed / 88 passed`. Hai ca ID dùng tuple sai cách; ca vòng ghế rút thiếu lá trong fixture; ca Attack kỳ vọng chuyển ghế sau một lần rút dù còn nợ một lượt. Sửa fixture/kỳ vọng theo luật, giữ nguyên logic engine; không skip/retry/nới assertion. Log đầu được giữ để đối chiếu.

**Bằng chứng local:** `.amp/in/artifacts/phase-1-full-test.log`, `phase-1-format.log`, `phase-1-dry-run.log`, `phase-1-initial-types.log`, `phase-1-initial-engine.log`; Playwright JSON/ảnh hồi quy ở thư mục artifacts hiện có. Artifacts được ignore, không phải file đã xuất bản GitHub. Không thay đổi diện mạo UI trong Phase 1.

**Giới hạn / bước tiếp theo:** engine lưu toàn bộ bài kín nên không được broadcast `GameState`; kiểm tra token/JSON, góc nhìn riêng, bỏ qua/deadline Nope, lệnh chống trùng và pause/storage còn ở Phase 2–3. Bước tiếp theo là Phase 2 — multiplayer; chưa triển khai trong phiên này. Chưa deploy hoặc nâng gói Cloudflare.

### Mẫu cho lần cập nhật tiếp theo

- **Ngày / phase / mục tiêu:**
- **Đã làm, môi trường và cách chạy:**
- **Kết quả thực tế / đường dẫn bằng chứng:**
- **Điều kiện ra phase: đạt / chưa đạt / chưa thử (nêu cụ thể):**
- **Lỗi, giới hạn và quyết định mới:**
- **Dịch vụ còn chạy / dữ liệu cần giữ:**
- **Một bước tiếp theo:**
