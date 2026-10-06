# Tiến độ dự án Mèo Nổ

## Trạng thái hiện tại — 06/10/2026 (Asia/Bangkok)

- **Phase hiện tại:** Phase 2–3 hoàn thành nghiệm thu local; đã triển khai bàn oval B theo yêu cầu riêng thuộc Phase 4, chưa nghiệm thu toàn bộ Phase 4.
- **Đã có:** multiplayer, bài kín, lưu/khôi phục mọi giai đoạn, pause/resume, heartbeat/alarm, hủy/tái đấu, expiry và bàn chơi riêng; đã sửa giữ lựa chọn sau rút, tự Nope, thông báo/cảnh báo mục tiêu Xin Bài/combo và xác nhận trước khi cho Xin Bài. Giữ trạng thái bom công khai, cài ngẫu nhiên và UI rút gọn. Theo phản hồi chơi nhóm, tay bài gom cùng loại, combo 2/3 báo riêng tên lá cho hai bên và ván mới tăng bài theo số người thay cho thêm cố định 24 lá. 185 test Vitest (96 luật + 89 phòng) và 30 test Playwright đạt, retries 0; TypeScript/build và format các file thay đổi đạt. `npm run format:check` còn báo file `vite.config.ts` có thay đổi từ trước; không sửa file ngoài phạm vi.
- **Attack:** giữ nguyên trong đợt bàn giao này. Bản local đã kiểm chứng cộng dồn 2→4→6 và 5→7 sau restart; chưa tái hiện báo cáo bên ngoài. Người dùng đã chấp nhận bản hiện tại và yêu cầu push GitHub, không yêu cầu sửa thêm Attack.
- **Giới hạn bằng chứng:** runtime Cloudflare local và mobile Chrome mô phỏng; chưa deploy, kiểm thử điện thoại/Safari thật, quota/CPU/hibernation sau eviction production hoặc khôi phục qua deploy. Không dùng bản thử làm bản phát hành công khai.
- **Phạm vi bàn giao đợt này:** người dùng yêu cầu push `origin/main` các thay đổi gom tay bài, thông báo combo riêng tư và bộ bài theo số người, kèm test/tài liệu. Không đưa thay đổi `.gitignore`/`vite.config.ts` có sẵn hoặc dữ liệu/ảnh/log test vào commit. Chưa deploy hoặc xác minh bản đang expose dùng đầy đủ thay đổi mới; khi dùng preview cần frontend/Worker cùng phiên bản và bắt đầu ván mới để nhận bộ bài theo số người. Không tự khởi động lại preview/tunnel công khai; giữ `.wrangler/state/v3/`.
- **Bổ sung đã bàn giao:** theo yêu cầu tiếp theo, đã bỏ hai nút Trên cùng/Dưới cùng, giữ thứ tự ô số → Ngẫu nhiên → xác nhận. Cho nhập số để chuyển lại từ Ngẫu nhiên. Đã kiểm chứng local và commit/push lên `origin/main` theo yêu cầu trong [67e8898](https://github.com/thethien8a/Exploding-Kitten/commit/67e8898922708eeeebd6fab8348756b7a3baee58); HEAD GitHub khớp local. Chưa deploy.

## Theo dõi phase

Trạng thái dùng: **chưa bắt đầu**, **đang thực hiện**, **chờ kiểm chứng**, **bị chặn**, **hoàn thành**. Chỉ dùng **hoàn thành** khi điều kiện ra phase đã được chứng minh bằng kết quả thực tế. Không coi việc tạo file hay chạy lệnh không lỗi là đã đạt.

| Phase | Trạng thái | Bằng chứng nghiệm thu | Trở ngại / bước tiếp theo |
| --- | --- | --- | --- |
| 0 — Nền tảng | Hoàn thành (đã push) | Kiểm tra lại: `2 passed (9.6s)`; TypeScript/build/format đạt; push `main` thành công | Quota và hibernation production chưa kiểm chứng |
| 1 — Game engine | Hoàn thành | `92 passed`; 36 ván tới thắng; TypeScript/build/format đạt; hồi quy nền `2 passed (8.3s)` | Đã nối vào multiplayer ở Phase 2; không đổi luật/engine trong Phase 2–3 |
| 2 — Multiplayer | Hoàn thành (local, đã push) | `134 passed`; Playwright `7 passed (27.2s)`; 3/4/5 phiên độc lập, payload riêng, chống trùng, quyền, deadline và rate limit | Chưa deploy; recovery đã nghiệm thu tiếp ở Phase 3 |
| 3 — Khôi phục | Hoàn thành (local, đã push) | `153 passed`; Playwright `19 passed`, retries 0; restart 5 giai đoạn, mất ACK rút/xáo, rollback SQLite, heartbeat, pause, vòng đời, migration và TTL | Chưa deploy; điện thoại/hibernation production chưa thử; tiếp theo Phase 4 |
| 4 — Giao diện | Đang thực hiện (phần bàn B đạt local) | `185 passed`; Playwright `30 passed`; bàn 3/4/5 ghế, gom tay bài, kết quả combo riêng tư, mục tiêu/bom công khai, xác nhận cho bài, cài ngẫu nhiên, bài theo số người và recovery; đã inspect ảnh render | Chưa nghiệm thu toàn bộ UX/điện thoại thật |
| 5 — Kiểm thử nhóm | Đang thực hiện theo báo cáo người dùng | Người dùng đã expose bản thử và gửi bốn phản hồi; ba thay đổi đạt kiểm thử local | Thử lại với nhóm trên bản mới; báo cáo Attack bên ngoài chưa tái hiện, luật giữ nguyên; chưa nghiệm thu production |
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

### 04/10/2026 — Phase 2: multiplayer và nghiệm thu local

**Thực hiện và quyết định**

- Thay prototype bộ đếm bằng phòng chơi: tạo ID UUID khó đoán, chọn 3/4/5, phiên ẩn danh 256 bit, server chỉ lưu hash token; tên không phải bằng chứng sở hữu ghế. Link mời không chứa token; WebSocket gửi token qua subprotocol, chỉ trả protocol `meono`.
- `worker/room.ts` quản lý lobby, quyền/ghế/ready, phiên bản, engine, pass/deadline Nope và projection whitelist. `worker/index.ts` quản lý routing, token, kết nối, SQLite và giới hạn; engine Phase 1 không thay luật hoặc mã nguồn.
- Đủ ghế, ready và online mới bắt đầu. Chủ phòng kick trước ván; lobby rời giải phóng ghế và chuyển quyền cho ghế online đầu tiên. Mất kết nối giữ quyền; tab mới thay tab cũ bằng connection ID, đóng tab cũ không làm tab mới offline.
- Lệnh client chỉ có `id`, `version`, `action`, không có `playerId`, seed hoặc game state. Strict version: hai Nope cùng phiên bản chỉ lệnh đầu được áp dụng; lệnh sau không mất bài, phải đọc snapshot mới và dùng ID mới. Không tự retry một thao tác thay đổi luật dựa trên trạng thái cũ.
- Mỗi mutation và ACK được lưu transaction SQLite trước khi gửi. Core giữ cache 256 ACK/ghế; journal riêng `command_results` giữ kết quả còn lại, không cho cache eviction làm replay lệnh hoặc thay ACK. Snapshot/journal có từ Phase 2 để không chỉ giữ ván trong RAM khi dùng hibernation; **chưa coi đây là nghiệm thu recovery Phase 3**.
- Nope 5 giây dùng clock/timer phía server, all-pass chốt sớm, Nope reset deadline/pass. Timer hiện ở RAM; alarm, đóng băng deadline, heartbeat, room/schema recovery, cleanup journal/phòng vẫn thuộc Phase 3. Chưa có rời giữa ván/hủy/tái đấu.
- Chặn Origin sai, JSON/frame quá 2.048 byte, schema/actor/state giả mạo; 40 frame/10 giây/ghế, 20 create/join và 60 kết nối/phút/phòng. Durable Object chung giới hạn tạo 6 phòng/phút/IP và 60/phút toàn ứng dụng. GET/join phòng không tồn tại không tạo snapshot/lobby hoặc bảng dữ liệu phòng.
- UI giữ phong cách prototype, thêm thao tác đủ để thử multiplayer; không coi đây là hoàn thành UX Phase 4. Bài trên tay cuộn ngang có chủ đích, không yêu cầu mọi lá cùng hiện trong viewport.

**Lệnh và kết quả thực tế**

| Lệnh / kịch bản | Quan sát |
| --- | --- |
| `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` | Vitest `134 passed` (793 ms); TypeScript/build đạt; Playwright `7 passed (27.2s)`, retries 0 |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir .amp/in/phase-2-dry-run` | Worker 31.12 KiB / gzip 8.77 KiB; binding `GAME_ROOMS`/`ASSETS`; `--dry-run: exiting now.`, không upload/deploy; output bundle tạm đã dọn |
| `npm run dev` | Dev server Phase 2 khởi động cổng 5173; giữ chạy để thử |

**Điều kiện ra phase**

1. **Đạt — phòng và phiên độc lập:** 3/4/5 browser context không chia localStorage; tạo/join/ready/start qua UI. Mỗi tay 8 lá, draw pile 29/23/16; trùng tên vẫn khác ghế. Phòng riêng giữ nguyên khi phòng đang chơi thay đổi.
2. **Đạt — quyền và chống trùng:** sai host/version bị từ chối; cùng ID rút hai lần trả ACK như nhau, ID khác cùng version bị stale, draw pile chỉ giảm một. ID theo ghế, thay payload cùng ID bị chặn; tab thay thế, token bị kick không reconnect được, chủ rời lobby chuyển quyền.
3. **Đạt — riêng tư:** payload mạng không chứa tay người khác, deck, token/hash/receipts; GET chỉ có public view. Core test future trước/sau chốt và đúng người, Favor do mục tiêu chọn và không lộ lá cho người thứ ba, ACK không có bài/vị trí bom. Runtime rút/Gỡ Bom tới loại một người, spectator nhận tay/tương lai rỗng và không chứa bài người sống.
4. **Đạt — reaction/transport:** unit test parity, actor cũng phải pass, reset pass/deadline, hai Nope cạnh tranh, trước/đúng/sau hạn 5999/6000/6001 ms và expire chạy lại. Runtime thật chốt cửa sổ sau 5 giây; binary/JSON/size/actor giả và spam không đổi ván; tạo quá nhanh trả 429.
5. **Đạt — render tích hợp:** đã inspect ảnh home/lobby/game desktop/mobile, spectator và các trạng thái riêng. Fixture UI future/favor/defuse/Nope/combo kiểm tra render và lệnh gửi; **không** dùng làm bằng chứng engine hoặc mạng xử lý các trạng thái đó. Mobile là Chrome 390×844 mô phỏng, không phải Safari/điện thoại thật.

**Lỗi và giới hạn kiểm chứng**

- Lần đầu TypeScript báo `clearTimeout` Worker không nhận `undefined`, sau đó báo cast Window test; sửa guard timer và khai báo cast test, không nới cấu hình TypeScript.
- Lần đầu browser `4 passed / 2 failed`: helper chờ snapshot cho người đã rời ghế, và `read ECONNRESET` khi dùng HTTP GET giả header Upgrade để thử token. Sửa helper để xác nhận leave qua ACK rồi kiểm tra quyền ở người còn lại; đổi ca token sang handshake WebSocket thật trong browser. Hai ca tập trung `2 passed (6.6s)`; suite cuối `7 passed`. Bỏ `reader.cancel()` không giải quyết lỗi và đã khôi phục; không gọi body cancellation là nguyên nhân. Không sửa dependency hay bỏ ca thử token.
- Serena TypeScript đọc/sửa được nhưng một số truy vấn bị timeout sau file thay đổi; đã kiểm tra trạng thái trước khi retry, dùng textual edit của Serena và kiểm chứng bằng TypeScript/runtime. Cấu hình local Serena thử nghiệm được trả về ban đầu; không thêm metadata vào Git.
- Test bộ đếm/restart Phase 0 được thay bởi suite multiplayer vì không còn endpoint bộ đếm. Kết quả lịch sử Phase 0 không phải kiểm thử restart game mới; cần bộ test recovery riêng ở Phase 3.
- Không xác nhận quota, CPU, eviction/hibernation production, billing hoặc khôi phục sau deploy; chỉ dry-run và runtime local. Chưa commit, push, deploy hoặc nâng gói Cloudflare.

**Bằng chứng local:** `.amp/in/artifacts/phase-2-full-test.log`, `phase-2-format.log`, `phase-2-dry-run.log`, `playwright-results.json`; `multiplayer-evidence.json` và ảnh `phase-2-*` trong các thư mục `playwright/foundation-*`. Log lỗi ban đầu và các lần tập trung giữ ở `phase-2-initial-*.log`, `phase-2-transport-debug.log`, `phase-2-focused-*.log`. Artifacts được ignore, không phải file đã xuất bản GitHub; không đưa token test vào bằng chứng JSON bàn giao.

**Dịch vụ/dữ liệu:** giữ dev server mới cổng 5173 và `.wrangler/state/v3/`. Preview cũ 4173 trả `{ type: "snapshot", value: 7 }` từ Worker Phase 0 khi kiểm tra, nên không dùng để chơi Phase 2; không dừng dịch vụ cũ hoặc xóa dữ liệu thủ công. Runtime/dữ liệu test đã đóng/dọn.

**Một bước tiếp theo:** Phase 3 — pause/resume và khôi phục mọi giai đoạn sau restart, deadline/alarm bền vững, hủy/tái đấu và dọn phòng/journal.

### 04/10/2026 — Phase 3: nghiệm thu khôi phục và vòng đời local

**Triển khai và quyết định**

- Snapshot schema 1 / luật `original-2022` lưu ID ván, toàn bộ dữ liệu engine, phiên/ghế, chủ phòng, pause, pass, thời hạn và ACK. Migrate snapshot Phase 2 không phiên bản, cấp ID ván một lần và giữ bài/giai đoạn; schema/luật không hỗ trợ không bị ghi đè.
- Hàng đợi tuần tự hóa command, fetch mutation, close/error và alarm. Transaction SQLite lưu snapshot, journal ACK và lịch alarm trước khi xác nhận; rollback cả state RAM khi lưu lỗi. Không gửi ACK thành công khi transaction thất bại. Replay đọc journal trước khi thực hiện lại, giữ kết quả ngẫu nhiên của lần thành công đầu.
- Heartbeat 10 giây, phát hiện im lặng 25 giây; ping/pong auto-response và timestamp của Hibernation API không ghi snapshot mỗi heartbeat. Một alarm lấy hạn gần nhất giữa reaction, heartbeat và TTL; loại bỏ timer RAM server. Socket hibernation còn khỏe không làm pause; socket thật mất thì đóng băng thời gian Nope một lần và chờ đủ người sống.
- Rời chủ động trong ván giữ ghế/bài, chuyển chủ cho ghế online đầu tiên. Nếu tất cả offline, lưu cờ chuyển quyền dự phòng cho thành viên hợp lệ quay lại. Rớt mạng thụ động không đổi chủ; người đã bị loại rớt mạng không dừng ván. Chủ hủy về lobby; kết thúc giữ nhóm, xóa ready, cho đổi số chỗ và bắt đầu ván ID mới.
- TTL 7 ngày từ create/join/reconnect hợp lệ hoặc lệnh mới thành công; GET, heartbeat, alarm và replay ACK không gia hạn. `deleteAll()` xóa snapshot/journal/rate limit/alarm, tắt auto-response. Client báo hết hạn, xóa phiên phòng, giữ thông tin phiên cho các lỗi mạng tạm thời.
- Client nối mới khi tab trở lại hoặc pong quá hạn, không đợi close của socket cũ; bỏ sự kiện cũ và không đổi ID/payload lệnh đang chờ ACK. Rời ván chủ động ngừng reconnect, có nút Quay lại ghế. Countdown và action khóa khi pause, nhưng chủ online vẫn hủy được.
- API đối chiếu với [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Durable Object State](https://developers.cloudflare.com/durable-objects/api/state/) và [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/). Không đổi dependency, luật hoặc dịch vụ hạ tầng.

**Kiểm thử và kết quả quan sát**

| Lệnh / kịch bản | Kết quả thực tế |
| --- | --- |
| `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` | Vitest `153 passed`; TypeScript/build đạt; Playwright `19 passed (2.1m)`, một worker, retries 0, không skipped/flaky |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir .amp/in/phase-3-dry-run` | Worker 38.09 KiB / gzip 10.26 KiB; binding `GAME_ROOMS`/`ASSETS`; `--dry-run: exiting now.`, không upload/deploy; đã dọn bundle tạm |
| Dev server cổng 5173 | HTTP 200; giữ chạy cho người dùng xem bản mới |

1. **Restart — đạt local:** production preview đóng cả HTTP/Miniflare, mở lại cùng SQLite ở turn/favor/future/defuse và Nope. Giữ ID ván, từng tay bài, deck, lượt nợ 3, giai đoạn và phần riêng; `performance.timeOrigin` không đổi. Sau đó rút đúng lá, cho đúng lá, đóng tương lai hoặc cài bom kín vị trí 3; payload không lộ tay người khác/deck/bom/token.
2. **Pause/Nope — đạt:** người sống rời giữ ghế; pass và số ms còn lại giữ qua downtime 6.100 ms, không chốt khi còn thiếu người. Trở lại khôi phục deadline với phần thời gian còn lại; tab thay thế không pause/reset deadline nhầm. Alarm chốt một lần, nợ 3→2; pass sau chốt không trừ thêm lượt. Unit kiểm tra nhiều người rớt, host/người bị loại, giữ quyền và biên heartbeat 24.999/25.000/25.001 ms.
3. **Mất ACK/ghi lỗi — đạt:** chặn ACK tới UI sau khi server đã lưu rút hoặc chốt Xáo Bài; đọc journal SQLite có ACK gốc, restart/resend giữ ACK và toàn bộ game, không rút/xáo lần hai. Trigger SQLite từ chối ghi draw: UI thấy SAVE_FAILED, không ACK thành công, state và journal không đổi; bỏ trigger rồi cùng ID thử lại được.
4. **Heartbeat/return — đạt:** Chrome CDP tắt JavaScript của một tab; alarm thật phát hiện thiếu người sau 25 giây, hai người còn lại có pong/pause và không mất bài/lượt. Bật lại JS và phát sự kiện trở lại foreground: nhận snapshot mới, đủ người sống, giữ tay bài, không reload. Timestamp lưu của hai người chỉ heartbeat không bị cập nhật mỗi ping; reconnect của người quay lại là hoạt động mới hợp lệ.
5. **Vòng đời/expiry/migration — đạt:** host rời chuyển quyền, chủ mới hủy; cùng nhóm chơi tới kết thúc, về lobby, đổi 3→4, thêm người và chia 23 lá cho ván mới. Fixture lastActivity quá 7 ngày trả hết hạn, xóa cả bảng dữ liệu/journal và phiên browser, không reconnect vô hạn. Snapshot cũ đang xem tương lai migrate không chia lại; ID mới cấp lúc migrate giữ qua restart tiếp theo.
6. **Render — đạt:** đã inspect pause desktop/mobile, heartbeat-pause mobile, trạng thái future/defuse sau restart, kết thúc và expiry. Panel/nút đọc được, không chồng lấp; tay bài cuộn ngang có chủ đích. Ảnh minh họa render; assertion DOM và runtime mới kiểm chứng action khóa, quyền và dữ liệu.

**Phương pháp và giới hạn**

- Recovery dùng fixture engine hợp lệ, xác định trước (gồm lượt nợ 3), ghi SQLite chỉ khi runtime dừng; sau đó dùng Worker/SQL/alarm/WebSocket/browser thật. Không dùng UI mock để kết luận recovery. Node `node:sqlite` đọc dữ liệu lúc runtime đã đóng. TTL kiểm tra bằng fixture hoạt động đã cũ, không chờ 7 ngày thực tế.
- Mobile là Chrome viewport 390×844; desktop 1280×900. CDP ngừng JS + sự kiện foreground là mô phỏng vòng đời tab, không thay kiểm thử điện thoại/Safari thật. Unit dùng map timestamp để kiểm tra hibernation; local runtime không chứng minh eviction, billing, quota/CPU hoặc deploy production.
- Lần browser đầu `11 passed / 7 failed`: năm ca gửi lệnh trước snapshot mới sau restart, một ca đọc snapshot null và một ca đòi close event ngay sau pause. Trace xác nhận vấn đề snapshot cũ; sửa helper chờ socket OPEN, snapshot không null, phiên bản mới và đủ người online, không bỏ assertion dữ liệu.
- Lần sau `18 passed / 1 failed` và các ca heartbeat tập trung: server socket `1→2` sau `close(4000)`, nhưng Chrome vẫn OPEN/không có close event. Điều này phù hợp với [test workerd về close mất khi IoContext bị hủy](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/hibernation-manager-test.c++#L1889-L1935), chưa phải đo eviction production của ứng dụng. Không dùng sleep/dummy send để làm xanh: bổ sung client abandon/reconnect và thay ca raw-close bằng ngừng/quay lại tab thật, kiểm tra snapshot/bài/lượt được khôi phục. Xóa instrumentation tạm.
- Log `NOSENTRY SQLite alarm handler canceled with requestScheduledAlarm` vẫn có lúc reschedule. [Source workerd](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/actor-sqlite.c++#L1017-L1067) mô tả hủy lịch cũ khi lịch mới đã lưu; không dùng dòng này làm bằng chứng game lỗi hay tự nhận đó là nguyên nhân mất frame.
- Serena có truy vấn timeout; kiểm tra trạng thái trước retry, reset MCP và tiếp tục textual edit/TypeScript/runtime. Trả cấu hình local Serena về ban đầu. Không thay `.gitignore` ngoài thay đổi `.kilo/` có sẵn.
- Inspect ảnh expiry phát hiện dòng Đang kiểm tra lời mời còn hiện dù đã báo hết hạn; sửa trạng thái lỗi, thêm assertion DOM và inspect ảnh mới. Lần cuối thông báo lỗi và link tạo phòng đọc rõ, không còn trạng thái kiểm tra giả. Hai lần gọi phân tích ảnh bằng objective hết quota; dùng view_media trả ảnh trực tiếp để inspect, không coi lỗi công cụ là render đã đạt.

**Bằng chứng local:** `.amp/in/artifacts/phase-3-final-test.log`, `phase-3-format.log`, `phase-3-dry-run.log`, `playwright-results.json`; `recovery-evidence.json`, `pause-evidence.json` và ảnh `phase-3-*` trong `playwright/recovery-*`. Giữ log lỗi `phase-3-initial-e2e.log`, `phase-3-restart-pass-heartbeat-failure.log`, `phase-3-heartbeat-debug.log`, `phase-3-heartbeat-instrumentation.log` và các log tập trung. Không xuất token/bài kín trong JSON bàn giao; artifacts được ignore, không phải bằng chứng đã push lên GitHub.

**Bàn giao:** local edits, chưa commit/push/deploy, không nâng gói Cloudflare. Giữ dev 5173, preview cũ 4173 và `.wrangler/state/v3/`; runtime 8788, SQLite test và bundle tạm đã đóng/dọn.

**Một bước tiếp theo:** Phase 4 — hoàn thiện UX tiếng Việt trên desktop/điện thoại. Chưa tự bắt đầu Phase 4 ngoài yêu cầu Phase 2–3.

### 04/10/2026 — Bàn chơi riêng, phương án B được người dùng chọn

**Phạm vi và triển khai**

- Người dùng chọn B — Vòng bạn bè: chuyển cả phòng từ lobby sang màn bàn oval khi nhận ván, không reload/đổi URL phòng. `GameTable` sở hữu trình bày/chọn bài; `App` giữ phiên, transport và reconnect. Deck/bài bỏ ở giữa, 3/4/5 ghế quanh bàn; xoay theo viewer để ghế mình ở dưới nhưng giữ thứ tự vòng của phòng.
- `lastPlay` công khai gồm ID, người đánh và đúng các lá vừa vào discard qua `play`/`nope`; combo hiện đủ 2/3 lá. Lệnh lỗi/replay không cập nhật, hủy/start xóa metadata, schema 1 cũ thiếu trường vẫn phục hồi. Lưu cùng snapshot, không thêm journal diễn biến hay đổi engine. Bài cho nhau, bài rút, tương lai và vị trí bom không đi vào diễn biến công khai.
- Hiệu ứng đưa lá ra bàn chỉ khi có ID mới, không phát khi mount/reconnect/restart; tôn trọng reduced motion. Tên bài/biểu tượng và mô tả tiếng Việt, ghế/lượt/offline/bị loại, lựa chọn riêng và countdown giữ nguyên chức năng. Menu Phòng chứa link/rời/hủy/tái đấu; cài bom có nút đầu/cuối. Tay bài cuộn ngang riêng, không ép toàn bộ bài lên màn hình hẹp.
- Không tự hoàn thành toàn bộ Phase 4, thêm chat/tài khoản, đổi luật, push/deploy hay nâng gói Cloudflare.

**Kết quả thực tế**

| Lệnh / kịch bản | Kết quả |
| --- | --- |
| `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` | Vitest `157 passed`; TypeScript/build đạt; Playwright `20 passed (2.2m)`, retries 0, không skipped/flaky |
| Browser tập trung bàn/3–5 ghế/lựa chọn riêng | `5 passed (27.1s)` trước lần chạy toàn bộ cuối |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir .amp/in/table-dry-run` | Worker 38.44 KiB / gzip 10.34 KiB; `GAME_ROOMS`/`ASSETS`; `--dry-run: exiting now.`, không upload/deploy |

1. **Bàn và quyền xem:** mọi context 3/4/5 người tự chuyển khỏi lobby, đúng ghế mình dưới bàn, nhận tay riêng; assertion hình học ghế/deck ở 1280/390/320px và không tràn ngang trang. Tên bài dài nằm trong chính thẻ, cuộn thực đến lá cuối trên mobile. Tên ghế dài giới hạn hai dòng, giữ tên đầy đủ trong nội dung/title.
2. **Diễn biến thật:** fixture deck hợp lệ, chỉ ghi SQLite lúc runtime dừng; sau đó UI đánh combo 3 lá và Nope qua Worker/WebSocket thật. Mọi ghế nhận đủ lá, đúng actor và caption. Kiểm tra CSS animation khi ID mới và reduced motion; reload một ghế không phát lại. Unit kiểm tra combo 2/3 lá, Nope chỉ chứa lá mới, replay sau JSON/restart, projection clone, metadata cũ/default/reset và dữ liệu riêng không lộ.
3. **Hồi quy:** toàn bộ Phase 2–3 vẫn đạt với menu mới. Restart giữ cả `lastPlay`, không chia lại hoặc phát lại hiệu ứng; pause giữ metadata cùng pass/thời gian. Các lựa chọn future/favor/defuse/combo bằng UI fixture chỉ kiểm tra render/lệnh client; test recovery/runtime riêng kiểm chứng lưu/luật/riêng tư.
4. **Render:** inspect ảnh thật desktop combo, bàn 3/4/5 ghế, 320px, tên bài dài, Nope, tương lai, cài bom, pause/menu và kết thúc. Vùng cuộn tay bài cố ý lộ một phần lá kế bên, đã kiểm tra cuộn đến cuối. Menu bật là overlay có chủ đích; nút rút khóa sau kết thúc. Không dùng Painter concept hoặc ảnh làm bằng chứng hành vi mạng.

**Lỗi phát hiện và giới hạn**

- Ảnh đầu cho thấy tên bài dài tràn thẻ và ghế chồng deck ở 320px; bổ sung kiểm tra geometry phát hiện thêm ghế trên có marker lượt ở 3/4 người. Sửa chiều cao thẻ/bàn mobile, vị trí ghế, kích thước stack cho màn hẹp và font tên bài; render lại, assertion geometry/label và ảnh cuối đạt.
- Browser đầu `19 passed / 1 failed`: test mới đòi caption “Nope” thay vì tên đã có “Chặn — Nope”; sửa kỳ vọng đúng hợp đồng hiển thị, không đổi luật/tên để làm xanh. Lần tập trung `2 passed / 3 failed` bắt hai chồng lấp nói trên và helper kiểm tra viewport khi tay bài nằm dưới màn hình; sửa bố cục thật và cuộn dọc đến vùng tay trước khi kiểm tra cuộn ngang, không bỏ assertion. Lần tập trung cuối `5 passed`, full suite cuối `20 passed`.
- Serena bị timeout/gián đoạn khám phá tool; kiểm tra file trước retry, reload MCP khi cần, không sửa trùng. Cấu hình local Serena thử nghiệm trả về ban đầu, không đưa metadata vào Git.
- Mobile chỉ là Chrome viewport 390/320px, chưa phải Safari/Android/iPhone hoặc trải nghiệm nhiều người thật. Chưa nghiệm thu toàn bộ Phase 4, quota/CPU/eviction production hay deploy.

**Bằng chứng:** `.amp/in/artifacts/table-final-test.log`, `table-format.log`, `table-dry-run.log`, `table-focused-final.log`, `playwright-results.json`; ảnh `table-*`, `phase-2-ui-*`, `phase-3-*` trong `playwright/foundation-*` và `playwright/recovery-*`. Log lỗi giữ ở `table-initial-e2e.log`, `table-focused-e2e.log`. Artifacts được ignore, không chứa token trong ảnh bàn giao.

**Bàn giao:** local edits, chưa commit/push/deploy; giữ dev 5173, preview cũ 4173 và `.wrangler/state/v3/`. Runtime/SQLite test đã đóng/dọn; bundle dry-run tạm được dọn sau kiểm tra.

**Một bước tiếp theo:** nghiệm thu phần UX còn lại trên điện thoại thật nếu tiếp tục Phase 4; không tự chuyển sang kiểm thử nhóm/deploy.

### 05/10/2026 — Sửa bỏ chọn tay bài sau khi rút

- **Tái hiện:** effect cũ chỉ bỏ ID không còn trong tay; rút không lấy đi các lá đang chọn nên giữ viền chọn và panel mục tiêu. Hai test mới với lượt nợ và bom đều thất bại trước sửa (`expected 0, received 2`).
- **Sửa:** `GameTable` xóa lựa chọn khi `game.drawCount` trong snapshot server thay đổi, không xóa chỉ vì click/ACK. Rút thành công, kể cả vẫn tới lượt mình hoặc đang gỡ bom, bỏ chọn toàn bộ; lỗi lưu và reconnect không đổi snapshot giữ lựa chọn để thử lại.
- **Kiểm chứng:** test qua Worker/SQLite thật chọn hai lá không phải Gỡ Bom trước khi rút; assert `aria-pressed`, viền chọn, panel mục tiêu và chọn lại. Ca lỗi SQLite giữ lựa chọn qua restart, chỉ reset khi retry thành công. Tập trung `3 passed (14.6s)`; toàn bộ trước bản sửa Nope `157 passed` + `22 passed (2.2m)`; TypeScript/build/format đạt. Đã inspect ảnh trước/sau rút và khi gỡ bom.
- **Bằng chứng:** `.amp/in/artifacts/draw-selection-before-fix.log`, `draw-selection-final-test.log`, `draw-selection-format.log`; ảnh `draw-selected-before.png` / `draw-selected-after.png` trong `playwright/recovery-rút-bài-*`.

### 05/10/2026 — Chặn tự Nope, giữ phản Nope và recovery

- **Nguồn luật:** PDF Original Edition 2022 trang 2, phần Example Turn, lá Nope ghi “STOP THE ACTION OF ANOTHER PLAYER”; phần hướng dẫn cho phép Nope một Nope khác. Đã đối chiếu cả [PDF hiện tại từ trang luật chính thức](https://cdn.shopify.com/s/files/1/0345/9180/1483/files/ekoe-instructions-english.pdf?v=1743802429). Chặn lá của chính người vừa đánh, không cấm người đánh ban đầu phản Nope của người khác.
- **Tái hiện:** engine chỉ kiểm tra reaction/sở hữu/loại bài, chưa kiểm tra người vừa đánh. Bốn test mới thất bại trước sửa: tự Nope lá đơn/combo 2–3 lá và tự Nope liên tiếp.
- **Sửa:** reaction lưu `lastNopePlayerId`; engine từ chối `CANNOT_NOPE_YOURSELF` trước khi tiêu bài hoặc đổi parity. UI khóa nút và giải thích; A đánh → B Nope → A phản Nope vẫn hợp lệ. Từ chối không đổi bài, version, deadline, pass hoặc `lastPlay`.
- **Tương thích:** trường mới là optional để đọc snapshot cũ; `Room` phục hồi người Nope gần nhất từ `lastPlay` khi có. Snapshot rất cũ đã có Nope nhưng thiếu cả hai metadata không xác định được người vừa đánh: không đoán actor; từ Nope tiếp theo sẽ theo dõi đầy đủ. Bài ban đầu luôn xác định được từ `action.playerId`.
- **Kiểm chứng:** `npm run test:engine` đạt `163 passed`; browser tập trung `1 passed (10.0s)`. Toàn bộ `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` đạt `163 passed` + `23 passed (2.4m)`, retries 0; TypeScript/build/format đạt. Browser thật xác minh nút và lệnh trực tiếp, giữ lá sau từ chối, restart SQLite giữa chuỗi rồi phản Nope và chốt đúng lượt nợ. Sửa chuỗi test parity cũ để người chơi luân phiên, không dựa vào tự Nope.
- **Render/đóng gói:** đã inspect desktop/mobile 390px sau lá của mình và sau Nope/restart; hint đọc được, nút đúng trạng thái, không chồng lấp. `wrangler deploy --dry-run` đạt, Worker 39.01 KiB / gzip 10.52 KiB; không upload/deploy, đã dọn bundle tạm.
- **Bằng chứng:** `.amp/in/artifacts/nope-before-fix.log`, `nope-unit-test.log`, `nope-focused-test.log`, `nope-final-test.log`, `nope-format.log`, `nope-dry-run.log`; ảnh đã inspect `nope-own-action-desktop.png`, `nope-own-nope-mobile.png` tại artifacts.
- **Bàn giao:** thay đổi local, chưa commit/push/deploy; dev 5173 HTTP 200, giữ dữ liệu thủ công. Runtime 8788 và SQLite test đã đóng/dọn; cấu hình Serena tạm trả về `language_servers: []` và giữ CRLF. Giới hạn điện thoại/production không đổi.
- **Một bước tiếp theo:** người dùng thử lại hai thao tác trên ván local; chưa tự mở rộng Phase 4 hoặc deploy.

### 05/10/2026 — Push mã theo yêu cầu người dùng

- `git fetch origin` xác nhận nhánh local và remote không lệch; đã commit/push 16 file Phase 2–3, bàn B, sửa lựa chọn sau rút và tự Nope lên `origin/main`: [2323af4](https://github.com/thethien8a/Exploding-Kitten/commit/2323af4b2b4565088ebfd5ba986ae65664123b98).
- Bản mã được push đã đạt 163 test Vitest và 23 kịch bản Playwright cùng TypeScript/build/format/dry-run ở lần kiểm chứng trên. Không đưa dữ liệu SQLite, phiên, ảnh/log kiểm thử hoặc metadata Serena vào Git; giữ thay đổi `.gitignore` có sẵn ngoài commit.
- Chỉ push GitHub, không chạy deploy hoặc nâng gói Cloudflare. Giữ dev 5173 và `.wrangler/state/v3/`; nghiệm thu điện thoại/production chưa đổi. Bước tiếp theo, khi được yêu cầu, là kiểm thử UX còn lại trên thiết bị thật.

### 05/10/2026 — Thông báo rõ mục tiêu Xin Bài và combo

- **Tái hiện:** mục tiêu chỉ có trong panel chờ Nope; `lastPlay` và caption ở giữa bàn chỉ ghi người/lá đã đánh. Bốn assertion mới cho Xin Bài, combo 2/3 và restore thất bại vì thiếu `targetId` trước sửa.
- **Sửa:** metadata công khai lưu `targetId` optional từ action đã được engine xác nhận. Caption mọi ghế ghi “Thảo vừa đánh Xin Bài nhắm vào Minh” hoặc “Thảo vừa đánh combo 2/3 lá Mèo Taco nhắm vào Minh”. Không công bố lá được trao/lấy; Nope hoặc bài không nhắm mục tiêu không mang mục tiêu cũ/client tự khai. Không đổi engine, schema hoặc CSS; snapshot cũ thiếu mục tiêu vẫn render như trước.
- **Kiểm chứng:** unit đạt `164 passed`; browser tập trung `4 passed (23.1s)`. Toàn bộ `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` đạt `164 passed` + `24 passed (2.5m)`, retries 0; TypeScript/build/format đạt. Kiểm tra tất cả ghế và public view, restore/replay/clone/reset, giữ bí mật lá chuyển, target không bị gắn nhầm vào Skip/Nope. Browser thật kiểm tra cả combo 2/3 và Xin Bài sau restart; UI fixture cũ không có `targetId` giữ caption cũ.
- **Render:** đã inspect Xin Bài, combo 2/3 trên mobile 390px và combo desktop; actor/mục tiêu đầy đủ, caption xuống dòng đúng, không clipping/chồng ghế. Ảnh minh họa không thay bằng chứng DOM/Worker.
- **Đóng gói/log:** dry-run đạt, Worker 39.16 KiB / gzip 10.56 KiB, không upload/deploy; bundle tạm đã dọn. Log có `TypeError: fetch failed` trong ca mất ACK shuffle/restart; test vẫn khôi phục và đạt assertion, chưa xác định riêng nguyên nhân log.
- **Bằng chứng:** `.amp/in/artifacts/target-announcement-before-fix.log`, `target-announcement-unit.log`, `target-announcement-focused.log`, `target-announcement-final-test.log`, `target-announcement-format.log`, `target-announcement-dry-run.log`; ảnh đã inspect `target-favor-mobile.png`, `target-combo-2-mobile.png`, `target-combo-3-mobile.png`, `target-combo-desktop.png`.
- **Bàn giao:** đã commit/push bản sửa lên `origin/main`: [bdcba36](https://github.com/thethien8a/Exploding-Kitten/commit/bdcba366af36e00cc42f1a8d8f6965d8bfdc565c). Giữ dev 5173 và dữ liệu thủ công; runtime/SQLite test đã đóng/dọn, cấu hình Serena tạm trở về `language_servers: []` với CRLF. Không deploy; bước tiếp theo là người dùng tải lại tab và thử thao tác nhắm mục tiêu.

### 05/10/2026 — Cảnh báo bị nhắm tới và xác nhận trước khi cho Xin Bài

- **UI:** chấm than trên ghế mục tiêu cho mọi người; cảnh báo riêng nêu tên người xin/đánh combo cho đúng người bị nhắm. Lấy trạng thái từ phase đang xử lý, không dùng `lastPlay` cũ: Nope đang chặn hoặc hành động đã hoàn tất thì tắt cảnh báo; phản Nope làm hành động có hiệu lực thì hiện lại.
- **Xác nhận:** chạm vào lá chỉ chọn đúng một lá, có thể đổi/hủy. Panel hỏi rõ tên lá và người nhận; chỉ nút xác nhận mới gửi `give`. Bỏ lựa chọn cũ khi vào/ra yêu cầu Xin Bài, giữ lựa chọn qua restart của cùng yêu cầu; khóa nút trong lúc chờ ACK/mất kết nối/pause theo cơ chế sẵn có. Không đổi luật: combo 2/3 vẫn lấy bài theo luật, không thêm quyền đồng ý cho người bị lấy.
- **Kiểm chứng:** tập trung `4 passed (26.6s)`; toàn bộ `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` đạt `164 passed` + `24 passed (2.7m)`, retries 0; TypeScript/build/format đạt. UI fixture kiểm tra đổi/hủy, không kế thừa lựa chọn từ lượt trước, parity Nope và khóa chờ ACK. Worker/WebSocket/SQLite thật kiểm tra lựa chọn qua restart, chưa chuyển khi chạm, xác nhận chuyển đúng một lá, giữ bài trao kín và tắt cảnh báo dù caption cũ còn hiện.
- **Render:** đã inspect desktop 1280px, mobile 390/320px và cảnh báo combo 2/3. Chấm than, cảnh báo, câu hỏi và nút đọc rõ, không chồng lấp/tràn ngang. Phần lá kế bên lộ một phần là tay bài cuộn ngang có chủ đích, không phải clipping của cảnh báo/nút. Chưa thay kiểm thử điện thoại/Safari thật.
- **Bằng chứng:** `.amp/in/artifacts/favor-confirmation-build.log`, `favor-confirmation-focused.log`, `favor-confirmation-final-test.log`, `favor-confirmation-format.log`; ảnh `favor-confirmation-mobile.png`, `favor-confirmation-desktop.png`, `favor-confirmation-320.png`, `target-warning-combo-65d89.png` (combo 3), `target-warning-combo-6eaed.png` (combo 2).
- **Bàn giao:** thay đổi local, chưa commit/push/deploy; giữ dev 5173 và `.wrangler/state/v3/`. Runtime/SQLite test đã đóng/dọn, cấu hình Serena trở về `language_servers: []` với CRLF; dùng công cụ sửa file trực tiếp theo yêu cầu mới. Bước tiếp theo là người dùng tải lại tab và thử chạm/đổi/hủy/xác nhận cho Xin Bài.

### 05/10/2026 — Bom công khai, cài ngẫu nhiên và bộ bài dài

- **Phạm vi:** theo yêu cầu tiếp nối bàn B, cho cả bàn biết ai dính bom; thêm lựa chọn Ngẫu nhiên và nhiều bài trong chồng rút, không tăng tay khởi đầu. Dùng công cụ trực tiếp, không dùng Serena theo yêu cầu người dùng.
- **Bom:** banner và ghế thể hiện đang gỡ, đã gỡ an toàn hoặc đã nổ/bị loại, cả khi lần nổ chốt người thắng. Metadata `lastBomb` lưu cùng snapshot, giữ qua pause/reconnect/restart, không đổi khi lệnh lỗi/replay và xóa khi chơi tiếp/hủy/tái đấu. Không công bố ID lá bom/vị trí cài; ID bom trong bài bỏ công khai được thay bằng ID hiển thị.
- **Ngẫu nhiên:** chọn chế độ chưa gửi lệnh; xác nhận mới gửi `position: "random"`. Server chọn trong toàn bộ N+1 vị trí và giữ vị trí kín. Đầu/cuối/vị trí số vẫn dùng được; khóa điều khiển khi chờ ACK/pause/mất mạng. Test biên đầu/giữa/cuối, chồng rỗng, sai người và replay không chọn lại.
- **Ván dài:** `createDeck()` giữ bộ gốc 56 lá; `createGame()` thêm 24 lá thường sau khi chia, không thêm bom/Gỡ Bom. Tổng inventory 80 ID duy nhất; vẫn 8 lá/người và số bom bằng số người trừ một. Chồng rút 3/4/5 người thành **53/47/40** thay vì **29/23/16**. Ván mới ghi `original-2022-long`; ván cũ `original-2022` và snapshot legacy khôi phục nguyên trạng, không thêm bài hoặc xáo lại. Đây là biến thể theo yêu cầu, không phải bộ Original nguyên bản.
- **Kiểm chứng:** tập trung `5 passed (31.5s)`; toàn bộ `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` cuối đạt `175 passed` + `26 passed (2.8m)`, retries 0; TypeScript/build/format và `git diff --check` đạt. Lượt hồi quy đầu có 3 lỗi do kỳ vọng số lá sau rút còn dùng 28/22/15; đã đối chiếu kết quả đúng 52/46/39, sửa kỳ vọng và chạy lại toàn bộ. Worker/WebSocket/SQLite thật kiểm tra mọi ghế, spectator, gỡ/nổ/kết thúc, giữ trạng thái qua restart và replay cài ngẫu nhiên không đổi chồng rút.
- **Render:** đã inspect banner đang gỡ/đã gỡ/đã nổ, ghế bị loại, điều khiển cài số/ngẫu nhiên và nhãn trang đầu ở desktop 1280px và mobile 390/320px. Text/nút không chồng lấp hoặc tràn; tay bài vẫn cuộn ngang có chủ đích. Chưa thay kiểm thử điện thoại/Safari thật.
- **Bằng chứng:** `.amp/in/artifacts/bomb-deck-build.log`, `bomb-deck-focused.log`, `bomb-deck-initial-regression.log`, `bomb-deck-final-test.log`; ảnh `bomb-random-1280.png`, `bomb-controls-320-defuse.png`, `bomb-controls-320-defuse-random.png`, `bomb-defusing-observer-mobile.png`, `bomb-defused-observer-mobile.png`, `bomb-exploded-desktop.png`, `bomb-exploded-mobile-390.png`, `bomb-exploded-mobile-320.png`, `long-game-home-mobile.png`.
- **Bàn giao:** thay đổi local, chưa commit/push/deploy; giữ thay đổi cảnh báo/xác nhận cho bài có sẵn, dev 5173 và dữ liệu `.wrangler/state/v3/`. Test dùng SQLite riêng và dọn sau test. Bước tiếp theo là người dùng tải lại tab và bắt đầu ván mới để thử bộ bài dài, thông báo bom và cài Ngẫu nhiên.

### 05/10/2026 — Rút gọn chú thích UI

- **Phạm vi:** theo yêu cầu giảm chữ và rối mắt, giữ bố cục bàn B; không đổi luật, transport hay engine. Tiếp tục dùng công cụ trực tiếp, không dùng Serena.
- **Rút gọn:** trang tạo/vào phòng và phòng chờ chỉ giữ tiêu đề, form, trạng thái và thao tác; bỏ tagline, chú thích phiên/server, hướng dẫn lặp và footer kỹ thuật. Lá bài chỉ hiện biểu tượng/tên; không thông báo bàn trống, không nhắc lại tay bài riêng hoặc số lượt mặc định. Tác dụng bài chỉ hiện khi chọn bài để đánh, không lặp khi cho bài.
- **Giữ thông tin quan trọng:** lượt nợ, tên người bị nhắm/dính bom, trạng thái kết nối và người đang chờ reconnect, countdown/hành động Nope, lỗi và link khôi phục, giới hạn vị trí cài bom. Xác nhận Xin Bài vẫn hỏi rõ lá/người nhận; nút hiện ngắn “Xác nhận” nhưng tên truy cập vẫn đầy đủ. Không tự gửi khi chạm lá hoặc chọn Ngẫu nhiên.
- **Kiểm chứng:** tập trung trước sửa `2 passed (16.6s)` để giữ ảnh đối chiếu. Hồi quy đầu `175 passed` + `24 passed / 2 failed`: hai assertion còn đòi nhãn xác nhận dài và đoạn lỗi phụ đã bỏ. Đối chiếu DOM rồi sửa kỳ vọng, giữ kiểm tra câu hỏi/tên truy cập/chuyển đúng lá và lỗi chính/link tạo phòng mới. Toàn bộ lần cuối `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` đạt `175 passed` + `26 passed (3.0m)`, retries 0, không skipped/flaky; TypeScript/build, `npm run format:check` và `git diff --check` đạt. Kiểm tra thêm lượt nợ, giải thích khi chọn, pause khóa thao tác/giữ lựa chọn và cảnh báo ngắn.
- **Render:** inspect trang đầu, lobby, bàn mặc định, Xin Bài, Nope, tương lai, cài bom ngẫu nhiên, pause, gỡ/nổ/kết thúc và phòng hết hạn trên desktop 1280px và mobile 390/320px. Các nhãn/nút/cảnh báo quan trọng đọc được, không chồng lấp hoặc tràn ngang trang; tay bài/link dài cuộn có chủ đích. Ảnh chỉ minh họa render; kiểm tra DOM/runtime xác minh hành vi. Chưa kiểm thử điện thoại/Safari thật.
- **Bằng chứng:** `.amp/in/artifacts/minimal-ui-final-test.log`, `minimal-ui-final-results.json`, `minimal-ui-initial-regression.log`, `minimal-ui-initial-results.json`; ảnh `minimal-ui-before-*` / `minimal-ui-after-*`, gồm đối chiếu `phase-2-ui-favor.png`, `home-320.png`, `hand-actions-1280.png`, `bomb-finished-320.png` và `expired-mobile.png`. Artifacts được ignore, không xuất bản công khai.
- **Bàn giao:** thay đổi local, chưa commit/push/deploy; giữ nguyên các thay đổi bom/bộ bài/cảnh báo có sẵn. Dev 5173 trả HTTP 200 và tiếp tục chạy; giữ `.wrangler/state/v3/`. Runtime/SQLite test đã đóng/dọn. Bước tiếp theo là người dùng xem ảnh đối chiếu và thử bản local khi truy cập được máy chạy dự án.

### 05/10/2026 — Rút gọn điều khiển cài bom

- **Sửa theo yêu cầu:** bỏ nút Trên cùng/Dưới cùng, giữ chú thích 0..N và đặt xác nhận ngay cạnh ô số. Giữ Ngẫu nhiên sau nút xác nhận; cho bật/tắt để vẫn quay về nhập số sau khi bỏ hai nút tắt. Tắt Ngẫu nhiên đưa ô số về 0. Không thêm combo 5, đổi luật/engine/server hoặc các phần UI khác.
- **Kiểm chứng:** test mới thất bại trước sửa vì vẫn có hai nút đầu/cuối (`expected 0, received 2`). Sau sửa, TypeScript/build đạt; `npm run test:engine` đạt `175 passed`; browser tập trung `giao diện mobile|restart runtime giữ defuse` đạt `2 passed (18.9s)`, retries 0, không skipped/flaky. Kiểm tra nhập 0/N, bật/tắt Ngẫu nhiên, không gửi khi chọn, xác nhận gửi đúng số 3 hoặc `"random"`, khóa ô/nút khi chờ ACK và giữ chế độ qua restart/replay. Không chạy lại toàn bộ 26 ca browser trong đợt thay đổi cục bộ này. Format và `git diff --check` đạt.
- **Render:** assertion hình học kiểm tra ô số/xác nhận nằm sát nhau cùng hàng, căn giữa dọc và không tràn ngang tại 1280/390/320px cho cả hai chế độ. Đã inspect ảnh desktop nhập số và mobile nhập số/ngẫu nhiên; nhãn và nút đọc đầy đủ, không chồng lấp. Ngẫu nhiên có thể xuống hàng riêng ở màn hẹp; ô số và xác nhận không tách hàng. Chưa thay kiểm thử điện thoại/Safari thật.
- **Bằng chứng:** `.amp/in/artifacts/bomb-placement-before-change.log`, `bomb-placement-before-change-results.json`, `bomb-placement-focused.log`, `bomb-placement-focused-results.json`, `bomb-placement-unit.log`, `bomb-placement-format.log`; ảnh `bomb-placement-{1280,390,320}-{defuse,defuse-random}.png` và `bomb-placement-full-320.png`.
- **Bàn giao:** thay đổi local, chưa commit/push/deploy; dev 5173 tiếp tục chạy, giữ `.wrangler/state/v3/` và các thay đổi trước. Runtime/SQLite test đã đóng/dọn. Bước tiếp theo là tải lại tab bản local và thử nhập vị trí hoặc bật/tắt Ngẫu nhiên.

### 05/10/2026 — Khôi phục bố trí cài bom trước lần chỉnh gần nhất

- **Theo yêu cầu mới:** rollback toàn bộ cụm cài bom về trước lần rút gọn điều khiển: ô số → Trên cùng → Dưới cùng → Ngẫu nhiên → nút xác nhận. Ngẫu nhiên chỉ chọn chế độ, bấm lại không tắt; đầu/cuối đưa về vị trí số như trước. Bỏ căn giữa dọc mới thêm. Giữ trạng thái bom công khai, xác nhận cho bài, bộ bài dài và UI tối giản khác.
- **Kiểm chứng:** `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` đạt `175 passed` + `26 passed (2.6m)`, retries 0; TypeScript/build/format và `git diff --check` đạt. Test kiểm tra đúng thứ tự nút, bấm Ngẫu nhiên hai lần vẫn giữ chế độ, đầu/cuối về 0/N, không gửi trước xác nhận và khóa khi chờ ACK; toàn bộ recovery/multiplayer/bom vẫn đạt.
- **Render:** đã inspect desktop 1280px và mobile 320px ở chế độ nhập số/ngẫu nhiên; đủ nút, đúng thứ tự cũ, không clipping/chồng lấp. Browser cũng kiểm tra không tràn ngang tại 390px. Bundle frontend/CSS sau rollback trùng bản trước lần chỉnh điều khiển.
- **Bằng chứng:** `.amp/in/artifacts/bomb-placement-rollback-final-test.log`, `bomb-placement-rollback-format.log`, `bomb-placement-rollback-results.json`; ảnh `rollback-bomb-placement-{1280,390,320}-{defuse,defuse-random}.png`.
- **Bàn giao:** đã commit/push chương trình lên `origin/main` theo yêu cầu sau rollback: [abf9b8c](https://github.com/thethien8a/Exploding-Kitten/commit/abf9b8cb2e19ff361a15145b944715bde6b227b9). `git ls-remote origin refs/heads/main` khớp HEAD local sau push; không deploy. Chỉ bàn giao mã/tài liệu/test liên quan, không thêm thay đổi `.gitignore` có sẵn, dữ liệu SQLite, phiên, ảnh/log hoặc metadata agent. Giữ dev 5173 và `.wrangler/state/v3/`; runtime/SQLite test đã đóng/dọn. Bước tiếp theo là tải lại tab bản local để thử bố trí cài bom đã khôi phục.

### 05/10/2026 — Bỏ hai nút cài bom đầu/cuối, giữ thứ tự còn lại

- **Theo yêu cầu mới:** chỉ bỏ nút Trên cùng/Dưới cùng, giữ chú thích 0/N và thứ tự ô số → Ngẫu nhiên → xác nhận. Không di chuyển xác nhận lên trước Ngẫu nhiên, sửa CSS, luật hoặc server.
- **Thao tác:** ô số cho nhập cả khi Ngẫu nhiên đang được chọn, nhập số sẽ bỏ chọn Ngẫu nhiên. Như vậy vẫn chọn đầu/cuối bằng 0/N và quay lại vị trí số mà không cần hai nút đã bỏ. Ngẫu nhiên vẫn chỉ chọn chế độ, bấm lại không tắt; chỉ xác nhận mới gửi lệnh. Giữ khóa ô/nút khi chờ ACK/pause/mất mạng.
- **Kiểm chứng:** test cập nhật thất bại trước sửa vì còn hai nút thừa. Sau sửa, `npm run test:engine` đạt `175 passed`; build/TypeScript/format và `git diff --check` đạt. Browser tập trung `giao diện mobile|restart runtime giữ defuse` đạt `2 passed (15.5s)`, retries 0, không skipped/flaky. Kiểm tra nhập 0/7, chuyển Ngẫu nhiên về số, không gửi trước xác nhận, gửi đúng số 3 hoặc `"random"`, khóa chờ ACK và giữ lựa chọn qua restart/replay. Không chạy lại toàn bộ 26 ca browser cho thay đổi cục bộ này.
- **Render:** đã inspect desktop 1280px nhập số và mobile 320px ở cả hai chế độ. Không còn hai nút đầu/cuối; nhãn/nút đầy đủ, không clipping/chồng lấp. Mobile giữ ô số và Ngẫu nhiên ở hàng đầu, xác nhận xuống hàng sau. Browser kiểm tra không tràn ngang tại 1280/390/320px.
- **Bằng chứng:** `.amp/in/artifacts/remove-bomb-shortcuts-before.log`, `remove-bomb-shortcuts-before-results.json`, `remove-bomb-shortcuts-focused.log`, `remove-bomb-shortcuts-unit-format.log`, `remove-bomb-shortcuts-results.json`; ảnh `remove-bomb-shortcuts-{1280,390,320}-{defuse,defuse-random}.png`.
- **Bàn giao:** đã commit/push lên `origin/main` theo yêu cầu: [67e8898](https://github.com/thethien8a/Exploding-Kitten/commit/67e8898922708eeeebd6fab8348756b7a3baee58). `git ls-remote origin refs/heads/main` khớp HEAD local sau push; chưa deploy. Giữ dev 5173, dữ liệu `.wrangler/state/v3/` và thay đổi `.gitignore` có sẵn ngoài commit; runtime/SQLite test đã đóng/dọn. Bước tiếp theo là tải lại tab để dùng cụm cài bom đã rút gọn.

### 06/10/2026 — Gom tay bài, kết quả combo riêng tư và bộ bài theo nhóm

- **Theo phản hồi:** tự xếp các lá cùng loại cạnh nhau, vẫn chọn/đánh/cho theo ID lá; không đổi thứ tự tay bài trên server. Thông báo combo 2/3 chỉ cho người lấy và người bị lấy, ghi đúng tên lá thực sự chuyển sau pass/deadline hoặc không lấy được bài; Nope chặn không tạo kết quả chuyển lá. Có nút đóng, kết quả được lưu/khôi phục và không mở lại khi nhận cùng ID trong phiên đang mở.
- **Số bài:** bỏ 24 lá thêm cố định. 3 người dùng bộ gốc; mỗi người trên 3 thêm một lá mỗi loại thường (+11), sau khi chia, không thêm bom/Gỡ Bom. Tay khởi đầu vẫn 8 lá, chồng rút 3/4/5 người là 29/34/38. Inventory kể cả bài loại lúc thiết lập là 56/67/78; ván dài 80 lá cũ giữ nguyên qua restore, không cắt/xáo/chia lại.
- **Attack:** chưa đổi logic. Browser/Worker thật xác minh 2→4→6, trả một lượt còn 5 rồi restart và Attack chuyển 7 lượt. Chưa tái hiện được báo cáo hệ thống bên ngoài; câu “không được cộng dồn” còn cần xác nhận là lỗi đang gặp hay luật mong muốn.
- **Kiểm chứng:** `PLAYWRIGHT_CHANNEL=chrome WRANGLER_SEND_METRICS=false npm test` đạt 185 Vitest và 30 Playwright (`3.5m`), retries 0, không skipped/flaky; TypeScript/build đạt. Sau khi bổ sung fixture restore đủ 24 lá của ván dài cũ và ván scaled 4 người, chạy lại unit/check: 185 test đạt. Format các file code đã sửa và `git diff --check` đạt; format toàn repo chỉ báo `vite.config.ts` có thay đổi từ trước, giữ nguyên file đó.
- **Lỗi hồi quy đã xử lý:** kỳ vọng số lá sau rút còn theo bộ bài dài; cập nhật theo chính sách mới. Test Xin Bài dùng vị trí DOM để chọn lá nhưng so với thứ tự tay server, không còn đúng sau gom bài; chọn và xác minh theo ID cụ thể, giữ kiểm tra chuyển đúng lá, giữ lựa chọn qua restart và bảo mật. Lần full trước sửa đạt 29/30; lần cuối đạt toàn bộ 30.
- **Render:** đã inspect ảnh gom bài, thông báo nhận/mất/không lấy được bài và nhãn trang đầu ở desktop 1280px, mobile 390/320px. Tên lá/nút đóng đọc được, không tràn ngang hoặc chồng lấp; tay bài vẫn cuộn riêng. Chưa thay kiểm thử điện thoại/Safari thật.
- **Bằng chứng:** `.amp/in/artifacts/player-feedback/final-test.log`, `first-full-test.log`, `first-full-results.json`, `initial-results.json`; ảnh `transfer-desktop.png`, `transfer-mobile-320.png`, `sorted-hand.png`, `transfer-missed-320.png`, `home-320.png` trong cùng thư mục. Kết quả Playwright cuối ở `.amp/in/artifacts/playwright-results.json`.
- **Bàn giao:** local edits, chưa commit/push/deploy hoặc khởi động lại preview/tunnel công khai. Giữ dữ liệu thủ công và thay đổi `.gitignore`/`vite.config.ts` có sẵn; runtime/SQLite test đã đóng/dọn. Bước tiếp theo là xác nhận ý của mục Attack, sau đó thử lại với nhóm trên bản mới khi được cập nhật.
- **Yêu cầu tiếp theo:** người dùng chấp nhận bản hiện tại và yêu cầu push GitHub. Giữ Attack không đổi; chỉ bàn giao mã/test/tài liệu của ba thay đổi, không deploy hoặc khởi động lại hệ thống công khai.

### Mẫu cho lần cập nhật tiếp theo

- **Ngày / phase / mục tiêu:**
- **Đã làm, môi trường và cách chạy:**
- **Kết quả thực tế / đường dẫn bằng chứng:**
- **Điều kiện ra phase: đạt / chưa đạt / chưa thử (nêu cụ thể):**
- **Lỗi, giới hạn và quyết định mới:**
- **Dịch vụ còn chạy / dữ liệu cần giữ:**
- **Một bước tiếp theo:**
