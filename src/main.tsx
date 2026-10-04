import { useEffect, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { ROOM_ID_PATTERN, type RoomMessage } from "../shared/protocol";
import "./style.css";

type Connection = "connecting" | "connected" | "reconnecting";

function App() {
  const room =
    new URLSearchParams(window.location.search).get("room") ?? "thu-nghiem";
  const [roomInput, setRoomInput] = useState(room);
  const [value, setValue] = useState<number | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const validRoom = ROOM_ID_PATTERN.test(room);
  const roomLink = `${window.location.origin}/?room=${encodeURIComponent(room)}`;

  useEffect(() => {
    if (!validRoom) return;
    let stopped = false;
    let retryDelay = 500;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const url = new URL(`/api/rooms/${room}/ws`, window.location.origin);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onmessage = (event: MessageEvent<string>) => {
        if (stopped) return;
        const message = JSON.parse(event.data) as RoomMessage;
        if (message.type === "snapshot") {
          setValue(message.value);
          setConnection("connected");
          setError("");
          retryDelay = 500;
        } else {
          setError(message.message);
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (stopped) return;
        setConnection("reconnecting");
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 3000);
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [room, validRoom]);

  function openRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRoom = roomInput.trim().toLowerCase();
    if (!ROOM_ID_PATTERN.test(nextRoom)) {
      setError("Mã phòng cần 1–48 ký tự: a–z, 0–9 hoặc dấu gạch ngang.");
      return;
    }
    window.location.assign(`/?room=${encodeURIComponent(nextRoom)}`);
  }

  function increment() {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "increment" }));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
    } catch {
      setError(
        "Chưa sao chép được. Bạn có thể chọn và sao chép link bên dưới.",
      );
    }
  }

  const status = !validRoom
    ? "Mã phòng không hợp lệ"
    : {
        connecting: "Đang kết nối…",
        connected: "Đã kết nối",
        reconnecting: "Đang kết nối lại…",
      }[connection];

  return (
    <main className="lab">
      <header className="masthead">
        <a className="brand" href="/">
          Mèo Nổ<span> / phòng thí nghiệm</span>
        </a>
        <span className="phase">PHASE 0</span>
      </header>

      <section className="intro">
        <p className="eyebrow">BẢN THỬ NỀN TẢNG · CHƯA PHẢI GAME</p>
        <h1>
          Cùng phòng.
          <br />
          Cùng một giá trị.
        </h1>
        <p>
          Một phép thử nhỏ cho kết nối thời gian thực và dữ liệu bền vững, trước
          khi bắt đầu xây game.
        </p>
      </section>

      <div className="workspace">
        <section className="counter-panel" aria-label="Bộ đếm thử nghiệm">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PHÒNG HIỆN TẠI</p>
              <h2>{room}</h2>
            </div>
            <span
              className={`status ${connection}`}
              role="status"
              aria-label="Trạng thái kết nối"
            >
              {status}
            </span>
          </div>
          <div className="counter-display">
            <p className="eyebrow">GIÁ TRỊ TRONG SQLITE</p>
            <output
              data-testid="room-value"
              aria-label="Giá trị trong phòng"
              aria-live="polite"
            >
              {value ?? "—"}
            </output>
            <p>Server lưu trước, mọi trình duyệt nhận sau.</p>
          </div>
          <button
            className="increment"
            onClick={increment}
            disabled={!validRoom || connection !== "connected"}
          >
            Tăng giá trị +1
          </button>
          <p className="connection-note">
            {connection === "reconnecting"
              ? "Giữ nguyên trang này. Khi server trở lại, kết nối sẽ tự phục hồi."
              : "Mở cùng link ở một cửa sổ khác để xem giá trị đồng bộ."}
          </p>
        </section>

        <aside className="controls">
          <form onSubmit={openRoom}>
            <label htmlFor="room">Mở một phòng thử</label>
            <p>Mã riêng giúp kiểm tra các phòng không trộn dữ liệu.</p>
            <div className="input-row">
              <input
                id="room"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                maxLength={48}
                required
                autoCapitalize="none"
                spellCheck={false}
              />
              <button className="secondary" type="submit">
                Mở phòng
              </button>
            </div>
            <small>1–48 ký tự: a–z, 0–9, dấu gạch ngang.</small>
          </form>

          <div className="invite">
            <label htmlFor="room-link">Link cùng phòng</label>
            <input
              id="room-link"
              value={roomLink}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <button className="text-button" onClick={copyLink}>
              {copied ? "Đã sao chép link" : "Sao chép link"}
            </button>
          </div>

          <div className="restart-note">
            <span className="step">01 / KIỂM TRA KHÔI PHỤC</span>
            <p>
              Tăng giá trị, dừng rồi chạy lại server với cùng thư mục dữ liệu.
              Bộ đếm phải giữ nguyên, không quay về 0.
            </p>
          </div>
        </aside>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <span>SQLite Durable Object</span>
        <span>WebSocket Hibernation API</span>
        <span>Chạy local · chưa deploy</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
