import { useEffect, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  ROOM_ID_PATTERN,
  HEARTBEAT_MS,
  CONNECTION_TIMEOUT_MS,
  HEARTBEAT_REQUEST,
  type Capacity,
  type ClientCommand,
  type RoomAction,
  type RoomMessage,
  type RoomSnapshot,
  type Session,
} from "../shared/protocol";
import { Brand, CatMark } from "./Brand";
import { CardFace } from "./CardFace";
import { GameTable } from "./GameTable";
import "./style.css";

type Connection = "connecting" | "connected" | "reconnecting" | "stopped";
function savedSession(room: string): Session | null {
  try {
    const session = JSON.parse(
      localStorage.getItem("meono:" + room) ?? "null",
    ) as Session | null;
    return session?.roomId === room &&
      typeof session.playerId === "string" &&
      /^[0-9a-f]{64}$/.test(session.token)
      ? session
      : null;
  } catch {
    return null;
  }
}
function App() {
  const [room, setRoom] = useState(
    new URLSearchParams(location.search).get("room") ?? "",
  );
  const [session, setSession] = useState<Session | null>(() =>
    savedSession(room),
  );
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState<Capacity>(3);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leftGame, setLeftGame] = useState(false);
  const [now, setNow] = useState(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<ClientCommand | null>(null);
  const validRoom = !room || ROOM_ID_PATTERN.test(room);
  useEffect(() => {
    if (!room || !validRoom || session) return;
    let stopped = false;
    fetch("/api/rooms/" + room)
      .then(async (response) => {
        const value = await response.json();
        if (stopped) return;
        if (!response.ok) {
          setError("Phòng không tồn tại hoặc đã hết hạn. Hãy tạo phòng mới.");
          return;
        }
        setSnapshot(value as RoomSnapshot);
      })
      .catch(() => {
        if (!stopped) setError("Chưa kết nối được với server.");
      });
    return () => {
      stopped = true;
    };
  }, [room, validRoom, session]);
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let retryDelay = 500;
    let retryTimer: ReturnType<typeof setTimeout>;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    setConnection("connecting");
    function connect() {
      const url = new URL(
        "/api/rooms/" + session!.roomId + "/ws",
        location.origin,
      );
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(url, ["meono", session!.token]);
      socketRef.current = socket;
      let lastPong = Date.now();
      socket.onopen = () => {
        if (stopped || socketRef.current !== socket) return;
        lastPong = Date.now();
        socket.send(HEARTBEAT_REQUEST);
        heartbeatTimer = setInterval(() => {
          if (stopped || socketRef.current !== socket) return;
          if (Date.now() - lastPong >= CONNECTION_TIMEOUT_MS) reconnect();
          else if (socket.readyState === WebSocket.OPEN)
            socket.send(HEARTBEAT_REQUEST);
        }, HEARTBEAT_MS);
        if (pendingRef.current) socket.send(JSON.stringify(pendingRef.current));
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        if (stopped || socketRef.current !== socket) return;
        const message = JSON.parse(event.data) as RoomMessage;
        if (message.type === "pong") {
          if (Date.now() - lastPong >= CONNECTION_TIMEOUT_MS) {
            reconnect();
            return;
          }
          lastPong = Date.now();
          return;
        }
        if (message.type === "snapshot") {
          setSnapshot(message);
          setConnection("connected");
          retryDelay = 500;
        } else if (message.type === "result") {
          if (message.id === pendingRef.current?.id) {
            pendingRef.current = null;
            setBusy(false);
          }
          if (!message.ok) setError(message.message ?? "Lệnh bị từ chối.");
        } else if (message.type === "replaced") {
          stopped = true;
          setConnection("stopped");
          setError(message.message);
          setBusy(false);
        } else {
          setError(message.message);
          pendingRef.current = null;
          setBusy(false);
          if (message.code === "ROOM_EXPIRED") {
            stopped = true;
            localStorage.removeItem("meono:" + session!.roomId);
            setSession(null);
            setSnapshot(null);
            setConnection("stopped");
            socket.close();
          }
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = async (event) => {
        if (stopped || socketRef.current !== socket) return;
        clearInterval(heartbeatTimer);
        if (event.code === 4002) {
          stopped = true;
          setConnection("stopped");
          setLeftGame(true);
          setBusy(false);
          setError(
            "Bạn đã rời ván. Ghế và bài được giữ; bấm Quay lại ghế để tiếp tục.",
          );
          return;
        }
        if (event.code === 4001 || event.code === 4003) {
          stopped = true;
          setConnection("stopped");
          setBusy(false);
          if (event.code === 4003) {
            localStorage.removeItem("meono:" + session!.roomId);
            setSession(null);
            setSnapshot(null);
            setError("Bạn đã rời phòng hoặc được chủ phòng mời ra.");
          } else setError("Phiên điều khiển đã chuyển sang tab khác.");
          return;
        }
        setConnection("reconnecting");
        try {
          const response = await fetch("/api/rooms/" + session!.roomId);
          if (stopped || socketRef.current !== socket) return;
          if (
            response.status === 404 ||
            response.status === 410 ||
            event.code === 4004
          ) {
            const failure = await response.json();
            stopped = true;
            localStorage.removeItem("meono:" + session!.roomId);
            pendingRef.current = null;
            setBusy(false);
            setSession(null);
            setSnapshot(null);
            setConnection("stopped");
            setError(failure.error ?? "Phòng đã hết hạn. Hãy tạo phòng mới.");
            return;
          }
        } catch {
          // Mất mạng không có nghĩa phiên đã hết hạn; giữ lệnh để gửi lại.
        }
        if (stopped || socketRef.current !== socket) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 3000);
      };
    }
    function reconnect() {
      if (stopped) return;
      clearTimeout(retryTimer);
      clearInterval(heartbeatTimer);
      const previous = socketRef.current;
      if (previous) {
        // Frame đóng có thể không tới client khi object nghỉ; không chờ close.
        previous.onopen =
          previous.onmessage =
          previous.onerror =
          previous.onclose =
            null;
        previous.close();
      }
      setConnection("reconnecting");
      connect();
    }
    function resume(event: Event) {
      if (
        document.visibilityState !== "visible" ||
        (event.type === "pageshow" &&
          !(event as PageTransitionEvent).persisted) ||
        socketRef.current?.readyState === WebSocket.CLOSED
      )
        return;
      reconnect();
    }
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    connect();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      clearTimeout(retryTimer);
      clearInterval(heartbeatTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [session]);
  useEffect(() => {
    if (!snapshot?.game?.reaction || snapshot.pause) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [snapshot?.game?.reaction?.deadline, snapshot?.pause?.since]);
  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        room ? "/api/rooms/" + room + "/join" : "/api/rooms",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(room ? { name } : { name, capacity }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const next = result as Session;
      localStorage.setItem("meono:" + next.roomId, JSON.stringify(next));
      history.replaceState(null, "", "/?room=" + next.roomId);
      setRoom(next.roomId);
      setSnapshot(null);
      setSession(next);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể vào phòng.");
    } finally {
      setBusy(false);
    }
  }
  function send(action: RoomAction) {
    if (
      !snapshot ||
      busy ||
      connection !== "connected" ||
      socketRef.current?.readyState !== WebSocket.OPEN
    )
      return;
    const command: ClientCommand = {
      type: "command",
      id: crypto.randomUUID(),
      version: snapshot.version,
      action,
    };
    pendingRef.current = command;
    setBusy(true);
    setError("");
    socketRef.current.send(JSON.stringify(command));
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.origin + "/?room=" + room);
      setCopied(true);
    } catch {
      setError("Hãy chọn và sao chép link bên dưới.");
    }
  }
  const me = snapshot?.members.find(
    (member) => member.id === session?.playerId,
  );
  const host = snapshot?.hostId === session?.playerId;
  const game = snapshot?.game;
  const phase = game?.phase;
  const controlsLocked = busy || connection !== "connected";
  const locked = controlsLocked || !!snapshot?.pause;
  const canStart =
    snapshot?.members.length === snapshot?.capacity &&
    snapshot?.members.every((member) => member.ready && member.connected);
  const status = {
    connecting: "Đang kết nối…",
    connected: "Đã kết nối",
    reconnecting: "Đang kết nối lại…",
    stopped: "Đã ngừng điều khiển",
  }[connection];
  if (session && snapshot && game)
    return (
      <main className="game-page">
        <header className="game-header">
          <Brand />
          <span className="game-caption">
            Bàn chơi · {snapshot.capacity} người
          </span>
          <span
            className={"status " + connection}
            role="status"
            aria-label="Trạng thái kết nối"
          >
            {status}
          </span>
          <details className="room-menu">
            <summary aria-label="Tùy chọn phòng">Phòng</summary>
            <div className="room-menu-panel">
              <label htmlFor="game-link">Link cùng phòng</label>
              <input
                id="game-link"
                value={location.origin + "/?room=" + room}
                readOnly
                onFocus={(event) => event.target.select()}
              />
              <button className="text-button" onClick={copyLink}>
                {copied ? "Đã sao chép link" : "Sao chép link"}
              </button>
              {host && (
                <button
                  className="secondary"
                  disabled={controlsLocked}
                  onClick={() => send({ type: "cancel_game" })}
                >
                  {phase?.kind === "finished"
                    ? "Về phòng chờ"
                    : "Hủy ván về phòng chờ"}
                </button>
              )}
              {!leftGame && (
                <button
                  className="text-button"
                  disabled={controlsLocked}
                  onClick={() => send({ type: "leave" })}
                >
                  {phase?.kind === "finished"
                    ? "Rời phòng"
                    : "Rời ván (giữ ghế)"}
                </button>
              )}
            </div>
          </details>
        </header>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {leftGame && (
          <button
            className="secondary return-seat"
            onClick={() => {
              setLeftGame(false);
              setError("");
              setSession({ ...session });
            }}
          >
            Quay lại ghế
          </button>
        )}
        <GameTable
          key={snapshot.gameId}
          snapshot={snapshot}
          session={session}
          locked={locked}
          send={send}
          now={now}
        />
      </main>
    );
  return (
    <main className="lab">
      <header className="masthead">
        <Brand />
        <span className="phase">VÁN DÀI · +24 LÁ</span>
      </header>
      {!validRoom && (
        <p className="error" role="alert">
          Link phòng không hợp lệ.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!session ? (
        <>
          <div className="entry-layout">
            <section className="intro">
              <span className="eyebrow">Một ván bài. Cả hội bạn.</span>
              <h1>
                {room ? "Hội bạn" : "Lá bài nhỏ."}
                <br />
                <span>{room ? "đang đợi." : "Cú nổ lớn."}</span>
              </h1>
              <p>
                {room
                  ? "Một lời mời, một chỗ ngồi. Vào bàn cùng những người bạn của mình."
                  : "Một chút chiến thuật, một chút may mắn. Rủ hội bạn vào bàn và xem ai là chú mèo sống sót cuối cùng."}
              </p>
              <div className="hero-meta">
                <span>3–5 người chơi</span>
                <span>Mời bạn bằng link</span>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-orbit" />
                <div className="hero-card hero-card-cat">
                  <span className="card-kind">Câu lạc bộ</span>
                  <CatMark />
                  <strong>Hội mèo</strong>
                </div>
                <div
                  className="hero-card hero-card-bomb"
                  data-type="exploding_kitten"
                >
                  <CardFace type="exploding_kitten" />
                </div>
                <div className="hero-card hero-card-defuse" data-type="defuse">
                  <CardFace type="defuse" />
                </div>
                <span className="art-sticker">Đừng để nổ!</span>
              </div>
            </section>
            <section className="entry-panel" aria-labelledby="entry-title">
              <span className="eyebrow">
                {room ? "Có hẹn với hội mèo" : "Bắt đầu cuộc vui"}
              </span>
              <h2 id="entry-title">{room ? "Vào phòng" : "Tạo phòng"}</h2>
              <p className="panel-description">
                {room
                  ? "Chọn tên để mọi người nhận ra bạn."
                  : "Bạn lập bàn. Cả hội nhập cuộc."}
              </p>
              <form onSubmit={enter}>
                <label htmlFor="name">Tên của bạn</label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={32}
                  required
                  autoComplete="nickname"
                  placeholder="VD: Thảo"
                />
                {!room && (
                  <>
                    <label htmlFor="capacity">Số người chơi</label>
                    <select
                      id="capacity"
                      value={capacity}
                      onChange={(event) =>
                        setCapacity(Number(event.target.value) as Capacity)
                      }
                    >
                      {[3, 4, 5].map((count) => (
                        <option key={count} value={count}>
                          {count} người
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {room && !error && (
                  <p className="invitation-state" role="status">
                    {snapshot?.game
                      ? "Ván đã bắt đầu. Hẹn bạn ở ván tiếp theo!"
                      : snapshot && snapshot.members.length >= snapshot.capacity
                        ? "Phòng đã đủ người. Hãy tạo một bàn mới nhé."
                        : snapshot
                          ? snapshot.members.length +
                            "/" +
                            snapshot.capacity +
                            " người trong phòng"
                          : "Đang kiểm tra lời mời…"}
                  </p>
                )}
                <button
                  className="increment"
                  disabled={
                    busy ||
                    !validRoom ||
                    (!!room &&
                      (!snapshot ||
                        !!snapshot.game ||
                        snapshot.members.length >= snapshot.capacity))
                  }
                >
                  {busy ? "Đang xử lý…" : room ? "Vào phòng" : "Tạo phòng"}
                  <span className="button-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
                {room ? (
                  <a className="text-button" href="/">
                    Tạo một phòng mới
                  </a>
                ) : (
                  <p className="form-hint">
                    Có link mời? Mở link để vào cùng phòng.
                  </p>
                )}
              </form>
            </section>
          </div>
          <ol className="entry-steps" aria-label="Bắt đầu cùng bạn bè">
            <li>
              <span>01</span>
              <div>
                <strong>Lập một bàn</strong>
                <small>Chọn tên và số người chơi.</small>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Rủ hội bạn</strong>
                <small>Gửi link phòng cho cả nhóm.</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Sẵn sàng, chơi thôi</strong>
                <small>Đủ người là bắt đầu cuộc vui.</small>
              </div>
            </li>
          </ol>
        </>
      ) : (
        <>
          <section className="lobby-intro">
            <div>
              <span className="eyebrow">Hẹn nhau ở đây</span>
              <h1>Phòng chờ</h1>
              <p>Rủ đủ hội bạn, sẵn sàng rồi vào bàn.</p>
            </div>
            <span className="lobby-room-code">
              PHÒNG / {room.slice(0, 8).toUpperCase()}
            </span>
          </section>
          <div className="workspace">
            <section className="counter-panel" aria-label="Phòng chờ">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Hội mèo hôm nay</span>
                  <h2>
                    {snapshot?.members.length ?? 1} /{" "}
                    {snapshot?.capacity ?? capacity} người
                  </h2>
                </div>
                <span
                  className={"status " + connection}
                  role="status"
                  aria-label="Trạng thái kết nối"
                >
                  {status}
                </span>
              </div>
              <ul className="members" aria-label="Người trong phòng">
                {snapshot?.members.map((member) => (
                  <li key={member.id} data-testid="member">
                    <span className="seat" aria-hidden="true">
                      {member.name.slice(0, 1).toLocaleUpperCase("vi")}
                    </span>
                    <div>
                      <strong>
                        {member.name}
                        {member.id === session.playerId ? " (bạn)" : ""}
                      </strong>
                      <small>
                        {member.id === snapshot.hostId ? "Chủ phòng · " : ""}
                        {!member.connected
                          ? "Mất kết nối"
                          : member.ready
                            ? "Sẵn sàng"
                            : "Chưa sẵn sàng"}
                      </small>
                    </div>
                    <span
                      className={
                        "member-indicator" +
                        (member.connected && member.ready ? " is-ready" : "")
                      }
                      aria-hidden="true"
                    />
                    {host && member.id !== session.playerId && (
                      <button
                        className="text-button"
                        disabled={locked}
                        onClick={() =>
                          send({ type: "kick", targetId: member.id })
                        }
                        aria-label={"Mời " + member.name + " ra"}
                      >
                        Mời ra
                      </button>
                    )}
                  </li>
                ))}
                {Array.from(
                  {
                    length:
                      (snapshot?.capacity ?? capacity) -
                      (snapshot?.members.length ?? 0),
                  },
                  (_, index) => (
                    <li className="empty-seat" key={"empty-" + index}>
                      <span className="seat" aria-hidden="true">
                        +
                      </span>
                      <span>Đợi một người bạn</span>
                    </li>
                  ),
                )}
              </ul>
              <div className="actions">
                <button
                  className="secondary"
                  aria-pressed={me?.ready ?? false}
                  disabled={locked}
                  onClick={() => send({ type: "ready", ready: !me?.ready })}
                >
                  {me?.ready ? "Hủy sẵn sàng" : "Sẵn sàng"}
                </button>
                {host && (
                  <button
                    className="increment"
                    disabled={locked || !canStart}
                    onClick={() => send({ type: "start" })}
                  >
                    Bắt đầu ván
                  </button>
                )}
                {!canStart && (
                  <p className="connection-note">Chờ đủ người sẵn sàng.</p>
                )}
              </div>
            </section>
            <aside className="controls">
              <span className="eyebrow">Cùng bàn, cùng vui</span>
              <h2>Mời hội bạn</h2>
              <p className="panel-description">
                Gửi link này để bạn bè vào đúng bàn của bạn.
              </p>
              <div className="invite">
                <label htmlFor="room-link">Link cùng phòng</label>
                <input
                  id="room-link"
                  value={location.origin + "/?room=" + room}
                  readOnly
                  onFocus={(event) => event.target.select()}
                />
                <button
                  className="secondary outline-button copy-button"
                  onClick={copyLink}
                >
                  {copied ? "Đã sao chép link" : "Sao chép link"}
                </button>
              </div>
              {host && (
                <div className="room-settings">
                  <label htmlFor="room-capacity">Số người trong ván</label>
                  <select
                    id="room-capacity"
                    value={snapshot?.capacity ?? capacity}
                    disabled={locked}
                    onChange={(event) =>
                      send({
                        type: "set_capacity",
                        capacity: Number(event.target.value) as Capacity,
                      })
                    }
                  >
                    {[3, 4, 5].map((count) => (
                      <option
                        key={count}
                        value={count}
                        disabled={count < (snapshot?.members.length ?? 0)}
                      >
                        {count} người
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="lobby-tip">
                <CatMark />
                <span>
                  Giữ Gỡ Bom bên mình.
                  <br />
                  <strong>Giữ bạn bè ở gần hơn.</strong>
                </span>
              </div>
              {leftGame ? (
                <button
                  className="secondary"
                  onClick={() => {
                    setLeftGame(false);
                    setError("");
                    setSession({ ...session });
                  }}
                >
                  Quay lại ghế
                </button>
              ) : (
                <button
                  className="text-button"
                  disabled={controlsLocked}
                  onClick={() => send({ type: "leave" })}
                >
                  Rời phòng
                </button>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
