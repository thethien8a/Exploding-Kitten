# Tiến độ dự án Mèo Nổ

## Trạng thái hiện tại — 04/10/2026 (Asia/Bangkok)

- **Phase hiện tại:** 0 — hoàn thành điều kiện ra phase ở local; dừng tại đây theo yêu cầu, chưa triển khai Phase 1.
- **Đã có:** luật Original Edition 2022; scaffold React/TypeScript/Vite + Worker/GameRoom SQLite; dependency/lockfile; hai test trình duyệt đạt trên bản build, có kiểm chứng file SQLite và reconnect không reload trang; README tiếng Việt.
- **Giới hạn bằng chứng:** tài liệu chính thức xác nhận cấu hình hỗ trợ Workers Free; chưa xác minh tài khoản, thẻ, quota/CPU/hibernation production, quyền push hoặc deploy. Đây chưa phải game chơi được.
- **Bàn giao:** thay đổi mã nguồn ở local, chưa commit/push/deploy. Preview đang chạy tại `http://127.0.0.1:4173/?room=thu-nghiem`; dữ liệu thủ công ở `.wrangler/state/v3/` được giữ lại.

## Theo dõi phase

Trạng thái dùng: **chưa bắt đầu**, **đang thực hiện**, **chờ kiểm chứng**, **bị chặn**, **hoàn thành**. Chỉ dùng **hoàn thành** khi điều kiện ra phase đã được chứng minh bằng kết quả thực tế. Không coi việc tạo file hay chạy lệnh không lỗi là đã đạt.

| Phase | Trạng thái | Bằng chứng nghiệm thu | Trở ngại / bước tiếp theo |
| --- | --- | --- | --- |
| 0 — Nền tảng | Hoàn thành (local) | `2 passed (6.4s)`; SQLite trên đĩa `[3, 7]`; sau reconnect `[8, 8, 3]`; Free theo tài liệu; build/dry-run đạt | Quota và hibernation production chưa kiểm chứng; không chuyển phase trong buổi này |
| 1 — Game engine | Chưa bắt đầu | Chưa có | Chờ phase 0 |
| 2 — Multiplayer | Chưa bắt đầu | Chưa có | Chờ phase 1 |
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

### Mẫu cho lần cập nhật tiếp theo

- **Ngày / phase / mục tiêu:**
- **Đã làm, môi trường và cách chạy:**
- **Kết quả thực tế / đường dẫn bằng chứng:**
- **Điều kiện ra phase: đạt / chưa đạt / chưa thử (nêu cụ thể):**
- **Lỗi, giới hạn và quyết định mới:**
- **Dịch vụ còn chạy / dữ liệu cần giữ:**
- **Một bước tiếp theo:**
