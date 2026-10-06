import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  CARD_NAMES,
  type RoomAction,
  type RoomSnapshot,
  type Session,
} from "../shared/protocol";
import type { CardType } from "../shared/engine";

const CARD_COPY: Record<CardType, string> = {
  exploding_kitten: "Cần Gỡ Bom để sống sót.",
  defuse: "Giữ lại để gỡ Mèo Nổ khi rút trúng.",
  attack: "Chuyển lượt và cộng 2 lượt cho người kế tiếp.",
  skip: "Kết thúc một lượt mà không rút bài.",
  favor: "Chọn một người để họ cho bạn một lá.",
  shuffle: "Xáo chồng rút mà không xem bài.",
  see_future: "Xem kín tối đa 3 lá trên cùng.",
  nope: "Chặn hành động đang chờ, kể cả Nope.",
  tacocat: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
  cattermelon: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
  hairy_potato_cat: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
  beard_cat: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
  rainbow_ralphing_cat: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
};
const CARD_PATHS: Partial<Record<CardType, string>> = {
  defuse: "M24 5 39 11V23c0 10-15 19-15 19S9 33 9 23V11Z M17 23l5 5 10-12",
  attack: "M9 38 24 9M23 38 38 9M16 10l8-1 3 8M30 10l8-1 3 8",
  skip: "M24 5a19 19 0 1 0 0 38 19 19 0 1 0 0-38M11 11l26 26",
  favor: "M5 24h18l-6-6M23 24l-6 6M43 12H25l6-6M25 12l6 6",
  shuffle:
    "M5 12h7c9 0 15 24 24 24h7M36 29l7 7-7 7M5 36h7c9 0 15-24 24-24h7M36 5l7 7-7 7",
  see_future:
    "M3 24s8-14 21-14 21 14 21 14-8 14-21 14S3 24 3 24ZM24 16a8 8 0 1 0 0 16 8 8 0 1 0 0-16",
  nope: "M13 28V14a3 3 0 0 1 6 0v10V8a3 3 0 0 1 6 0v16V10a3 3 0 0 1 6 0v14V15a3 3 0 0 1 6 0v17c0 9-6 12-13 12-8 0-12-7-17-14a3 3 0 0 1 5-4l7 8",
  exploding_kitten:
    "M24 13a14 14 0 1 0 0 28 14 14 0 1 0 0-28M24 13V6h8M32 6l4-4M37 9l5 2",
};
function CardFace({ type }: { type: CardType }) {
  return (
    <>
      <svg
        className="card-symbol"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d={
            CARD_PATHS[type] ??
            "M10 22V8l10 7h8l10-7v14c0 12-7 18-14 18s-14-6-14-18ZM17 24h1M30 24h1M21 31h6"
          }
        />
      </svg>
      <strong>{CARD_NAMES[type]}</strong>
    </>
  );
}
const TABLE_SEATS = {
  3: [
    [50, 86],
    [22, 14],
    [78, 14],
  ],
  4: [
    [50, 86],
    [10, 50],
    [50, 13],
    [90, 50],
  ],
  5: [
    [50, 86],
    [10, 60],
    [28, 12],
    [72, 12],
    [90, 60],
  ],
} as const;
export function GameTable({
  snapshot,
  session,
  locked,
  send,
  now,
}: {
  snapshot: RoomSnapshot;
  session: Session;
  locked: boolean;
  send: (action: RoomAction) => void;
  now: number;
}) {
  const game = snapshot.game!;
  const phase = game.phase;
  const me = snapshot.members.find((member) => member.id === session.playerId)!;
  const giving = phase.kind === "favor" && phase.targetId === me.id;
  const targetedAction =
    phase.kind === "favor"
      ? {
          type: "favor" as const,
          playerId: phase.playerId,
          targetId: phase.targetId,
        }
      : phase.kind === "reaction" &&
          phase.nopeCount % 2 === 0 &&
          "targetId" in phase.action
        ? phase.action
        : null;
  const requesterName = snapshot.members.find(
    (member) => member.id === targetedAction?.playerId,
  )?.name;
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [requestedType, setRequestedType] = useState<CardType>("defuse");
  const [position, setPosition] = useState<number | "random">(0);
  const [animatedPlay, setAnimatedPlay] = useState<number | null>(null);
  const previousPlay = useRef(snapshot.lastPlay?.id);
  useEffect(() => {
    setSelected((current) => {
      const kept = current.filter((id) =>
        game.hand.some((card) => card.id === id),
      );
      return kept.length === current.length ? current : kept;
    });
  }, [game.hand]);
  useEffect(() => {
    setSelected([]);
  }, [game.drawCount]);
  useEffect(() => {
    setSelected([]);
  }, [
    phase.kind === "favor" ? phase.playerId : null,
    phase.kind === "favor" ? phase.targetId : null,
  ]);
  useEffect(() => {
    const id = snapshot.lastPlay?.id;
    if (id === previousPlay.current) return;
    previousPlay.current = id;
    if (id === undefined) return;
    setAnimatedPlay(id);
    const timer = setTimeout(() => setAnimatedPlay(null), 850);
    return () => clearTimeout(timer);
  }, [snapshot.lastPlay?.id]);
  const myTurn =
    game.turn.playerId === me.id && phase.kind === "turn" && me.alive;
  const lastReactionPlayerId =
    phase.kind === "reaction"
      ? phase.nopeCount === 0
        ? phase.action.playerId
        : phase.lastNopePlayerId
      : undefined;
  const currentName = snapshot.members.find(
    (member) => member.id === game.turn.playerId,
  )?.name;
  const bomb =
    phase.kind === "defuse"
      ? { playerId: phase.playerId, outcome: "defusing" as const }
      : snapshot.lastBomb;
  const bombName = snapshot.members.find(
    (member) => member.id === bomb?.playerId,
  )?.name;
  const ownIndex = snapshot.members.findIndex((member) => member.id === me.id);
  const members = [
    ...snapshot.members.slice(ownIndex),
    ...snapshot.members.slice(0, ownIndex),
  ];
  const positions = TABLE_SEATS[snapshot.capacity];
  const lastCard = game.discardPile.at(-1);
  const play = snapshot.lastPlay;
  const latestIsPlay = !!play && play.cards.at(-1)?.id === lastCard?.id;
  const shownCards = latestIsPlay ? play.cards : lastCard ? [lastCard] : [];
  const playIndex = members.findIndex((member) => member.id === play?.playerId);
  const origin = positions[playIndex] ?? [50, 50];
  const announcement = latestIsPlay
    ? snapshot.members.find((member) => member.id === play.playerId)?.name +
      " vừa đánh " +
      (play.cards.length > 1 ? "combo " + play.cards.length + " lá " : "") +
      CARD_NAMES[play.cards[0].type] +
      (play.targetId
        ? " nhắm vào " +
          snapshot.members.find((member) => member.id === play.targetId)?.name
        : "")
    : lastCard
      ? "Lá bỏ mới nhất · " + CARD_NAMES[lastCard.type]
      : "";
  const needsTarget =
    selected.length > 1 ||
    (selected.length === 1 &&
      game.hand.find((card) => card.id === selected[0])?.type === "favor");
  const selectedCard = game.hand.find((card) => card.id === selected.at(-1));
  return (
    <>
      <h1 className="sr-only">Bàn chơi Mèo Nổ</h1>
      <div className="table-turn" role="status">
        <strong>
          {phase.kind === "finished"
            ? "Người thắng: " +
              snapshot.members.find((member) => member.id === phase.winnerId)
                ?.name
            : phase.kind === "defuse"
              ? bombName + " đang gỡ bom"
              : "Lượt của " +
                currentName +
                (game.turn.remaining > 1
                  ? " · " + game.turn.remaining + " lượt"
                  : "")}
        </strong>
      </div>
      {snapshot.pause && (
        <section className="pause-banner" aria-label="Ván tạm dừng">
          <strong>Ván tạm dừng</strong>
          <p>
            Chờ{" "}
            {snapshot.pause.missingIds
              .map(
                (id) =>
                  snapshot.members.find((member) => member.id === id)?.name,
              )
              .join(", ")}{" "}
            kết nối lại.
          </p>
        </section>
      )}
      {bomb && (
        <section
          className="bomb-warning"
          data-outcome={bomb.outcome}
          role="alert"
          aria-label="Trạng thái Mèo Nổ"
        >
          <svg
            className="bomb-symbol"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={CARD_PATHS.exploding_kitten} />
          </svg>
          <strong>
            {bombName +
              (bomb.outcome === "defusing"
                ? " rút trúng Mèo Nổ!"
                : bomb.outcome === "exploded"
                  ? " đã nổ và bị loại!"
                  : " đã gỡ bom an toàn")}
          </strong>
        </section>
      )}
      {targetedAction?.targetId === me.id && (
        <section
          className="target-warning"
          role="alert"
          aria-label="Bạn đang bị nhắm tới"
        >
          <span className="target-warning-icon" aria-hidden="true">
            !
          </span>
          <strong>
            {requesterName}
            {targetedAction.type === "favor"
              ? " đang xin bạn một lá bài"
              : " đang nhắm vào bạn bằng combo " +
                (targetedAction.type === "pair" ? "2" : "3") +
                " lá"}
          </strong>
        </section>
      )}
      <section
        className="oval-table"
        aria-label="Bàn chơi"
        data-capacity={snapshot.capacity}
      >
        <div className="table-felt" aria-hidden="true" />
        <ul className="table-seats" aria-label="Người quanh bàn">
          {members.map((member, index) => (
            <li
              key={member.id}
              data-testid="member"
              data-player-id={member.id}
              className={
                "player-seat" +
                (member.id === game.turn.playerId && phase.kind !== "finished"
                  ? " is-turn"
                  : "") +
                (member.id === targetedAction?.targetId ? " is-targeted" : "") +
                (phase.kind === "defuse" && member.id === phase.playerId
                  ? " is-defusing"
                  : "") +
                (!member.connected ? " is-offline" : "") +
                (!member.alive ? " is-eliminated" : "")
              }
              style={{
                left: positions[index][0] + "%",
                top: positions[index][1] + "%",
              }}
            >
              {member.id === targetedAction?.targetId && (
                <span
                  className="target-marker"
                  role="img"
                  aria-label="Đang bị nhắm tới"
                  title="Đang bị nhắm tới"
                >
                  !
                </span>
              )}
              <span className="player-avatar" aria-hidden="true">
                {member.name.slice(0, 1).toLocaleUpperCase("vi")}
              </span>
              <div>
                <strong title={member.name}>
                  {member.name}
                  {member.id === me.id ? " · Bạn" : ""}
                </strong>
                <small>
                  {member.id === snapshot.hostId ? "Chủ phòng · " : ""}
                  {!member.connected
                    ? "Mất kết nối"
                    : !member.alive
                      ? "Đã nổ · Bị loại"
                      : member.cardCount + " lá"}
                </small>
                {member.id === game.turn.playerId &&
                  phase.kind !== "finished" && (
                    <span className="turn-tag">
                      {phase.kind === "defuse" ? "Đang gỡ bom" : "Đến lượt"}
                    </span>
                  )}
              </div>
            </li>
          ))}
        </ul>
        <div
          className="table-center"
          style={
            {
              "--play-x": origin[0] - 50,
              "--play-y": origin[1] - 50,
            } as CSSProperties
          }
        >
          <div className="table-piles">
            <div className="pile">
              <div className="deck-back" aria-hidden="true">
                <span>
                  Mèo
                  <br />
                  Nổ
                </span>
              </div>
              <span>
                Chồng rút ·{" "}
                <strong data-testid="draw-count">{game.drawCount}</strong> lá
              </span>
            </div>
            <div className="pile">
              <div
                className="discard-stack"
                data-testid="public-cards"
                key={play?.id ?? lastCard?.id ?? "empty"}
              >
                {shownCards.length ? (
                  shownCards.map((card) => (
                    <div
                      key={card.id}
                      className={
                        "table-card" +
                        (animatedPlay === play?.id && latestIsPlay
                          ? " card-arriving"
                          : "")
                      }
                      data-type={card.type}
                    >
                      <CardFace type={card.type} />
                    </div>
                  ))
                ) : (
                  <div className="empty-discard">Trống</div>
                )}
              </div>
              <span>Bài bỏ · {game.discardPile.length} lá</span>
            </div>
          </div>
          {announcement && (
            <p
              className="play-announcement"
              role="status"
              aria-live="polite"
              data-testid="last-play"
            >
              {announcement}
            </p>
          )}
        </div>
      </section>
      {game.reaction && (
        <section className="reaction table-reaction" aria-label="Phản ứng Nope">
          <div>
            <strong>
              {snapshot.pause ? "Nope tạm dừng" : "Chờ Nope"} ·{" "}
              {Math.max(
                0,
                Math.ceil(
                  (snapshot.pause?.remainingNopeMs ??
                    game.reaction.deadline - now) / 1000,
                ),
              )}{" "}
              giây
            </strong>
            <p>
              {phase.kind === "reaction" &&
                (snapshot.members.find(
                  (member) => member.id === phase.action.playerId,
                )?.name ?? "Người chơi") +
                  ": " +
                  (phase.action.type === "pair"
                    ? "Combo 2 lá"
                    : phase.action.type === "triple"
                      ? "Combo 3 lá"
                      : CARD_NAMES[phase.action.type]) +
                  ("targetId" in phase.action
                    ? " → " +
                      snapshot.members.find(
                        (member) =>
                          "targetId" in phase.action &&
                          member.id === phase.action.targetId,
                      )?.name
                    : "") +
                  " · " +
                  phase.nopeCount +
                  " Nope"}
            </p>
            {lastReactionPlayerId === me.id && (
              <p>Không thể Nope bài vừa đánh.</p>
            )}
          </div>
          <div className="actions">
            <button
              className="secondary"
              disabled={
                locked ||
                !me.alive ||
                lastReactionPlayerId === me.id ||
                !game.hand.some((card) => card.type === "nope")
              }
              onClick={() =>
                send({
                  type: "nope",
                  cardId: game.hand.find((card) => card.type === "nope")!.id,
                })
              }
            >
              Nope
            </button>
            <button
              className="secondary outline-button"
              disabled={
                locked || !me.alive || game.reaction.passedIds.includes(me.id)
              }
              onClick={() => send({ type: "pass" })}
            >
              Bỏ qua
            </button>
          </div>
        </section>
      )}
      {phase.kind === "future" && phase.playerId === me.id && (
        <section className="private-choice" aria-label="Xem tương lai">
          <strong>Ba lá trên cùng — chỉ bạn thấy</strong>
          <ol className="future-cards">
            {game.futureCards.map((card) => (
              <li key={card.id} className="table-card" data-type={card.type}>
                <CardFace type={card.type} />
              </li>
            ))}
          </ol>
          <button
            className="secondary"
            disabled={locked}
            onClick={() => send({ type: "close_future" })}
          >
            Đóng tương lai
          </button>
        </section>
      )}
      {phase.kind === "defuse" && phase.playerId === me.id && (
        <section className="private-choice" aria-label="Cài bom kín">
          <label htmlFor="position">
            Cài Mèo Nổ (0 = trên cùng, {game.drawCount} = dưới cùng)
          </label>
          <div className="bomb-controls">
            <input
              id="position"
              type="number"
              min={0}
              max={game.drawCount}
              value={position === "random" ? "" : position}
              disabled={locked}
              onChange={(event) => setPosition(Number(event.target.value))}
            />
            <button
              className="secondary outline-button"
              aria-pressed={position === "random"}
              disabled={locked}
              onClick={() => setPosition("random")}
            >
              Ngẫu nhiên
            </button>
            <button
              className="secondary"
              disabled={
                locked ||
                (position !== "random" &&
                  (!Number.isInteger(position) ||
                    position < 0 ||
                    position > game.drawCount))
              }
              onClick={() => send({ type: "insert_bomb", position })}
            >
              {position === "random"
                ? "Cài bom ngẫu nhiên"
                : "Cài kín vị trí này"}
            </button>
          </div>
        </section>
      )}
      <section className="hand-panel table-hand" aria-label="Tay bài của bạn">
        <div className="panel-heading">
          <h2>Tay bài của bạn</h2>
          <span>{game.hand.length} lá</span>
        </div>
        {!me.alive && <p className="connection-note">Bạn đã bị loại.</p>}
        {phase.kind === "finished" && (
          <p className="connection-note">
            {snapshot.hostId === me.id
              ? "Chơi lại từ menu Phòng."
              : "Chờ chủ phòng mở ván mới."}
          </p>
        )}
        <div className="hand">
          {game.hand.map((card) => (
            <button
              key={card.id}
              className={
                "card" + (selected.includes(card.id) ? " selected" : "")
              }
              data-type={card.type}
              aria-label={
                (card.type === "defuse"
                  ? "BẢO VỆ"
                  : card.type === "nope"
                    ? "PHẢN ỨNG"
                    : "LÁ BÀI") +
                " " +
                CARD_NAMES[card.type]
              }
              aria-pressed={selected.includes(card.id)}
              disabled={locked || !(myTurn || giving)}
              onClick={() =>
                giving
                  ? setSelected((current) =>
                      current.includes(card.id) ? [] : [card.id],
                    )
                  : setSelected((current) =>
                      current.includes(card.id)
                        ? current.filter((id) => id !== card.id)
                        : current.length < 3
                          ? [...current, card.id]
                          : current,
                    )
              }
            >
              <CardFace type={card.type} />
            </button>
          ))}
        </div>
        {selectedCard && myTurn && (
          <p className="card-help">
            {CARD_NAMES[selectedCard.type]} — {CARD_COPY[selectedCard.type]}
          </p>
        )}
        {giving && (
          <section className="favor-confirmation" aria-label="Xác nhận cho bài">
            <p>
              {selectedCard ? (
                <>
                  Bạn muốn đưa <strong>{CARD_NAMES[selectedCard.type]}</strong>{" "}
                  cho <strong>{requesterName}</strong>?
                </>
              ) : (
                "Chọn một lá để đưa cho " + requesterName + "."
              )}
            </p>
            <div className="actions">
              <button
                className="secondary outline-button"
                disabled={locked || !selectedCard}
                onClick={() => setSelected([])}
              >
                Hủy chọn
              </button>
              <button
                className="secondary"
                disabled={locked || selected.length !== 1 || !selectedCard}
                aria-label={
                  selectedCard
                    ? "Xác nhận đưa " +
                      CARD_NAMES[selectedCard.type] +
                      " cho " +
                      requesterName
                    : "Xác nhận cho bài"
                }
                onClick={() => {
                  if (selectedCard)
                    send({ type: "give", cardId: selectedCard.id });
                }}
              >
                Xác nhận
              </button>
            </div>
          </section>
        )}
        {myTurn && needsTarget && (
          <div className="target-controls">
            <label htmlFor="target">Mục tiêu (Xin Bài / combo)</label>
            <select
              id="target"
              disabled={locked}
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <option value="">Chọn người chơi</option>
              {snapshot.members
                .filter((member) => member.alive && member.id !== me.id)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
            {selected.length === 3 && (
              <>
                <label htmlFor="requested">Loại bài gọi tên</label>
                <select
                  id="requested"
                  disabled={locked}
                  value={requestedType}
                  onChange={(event) =>
                    setRequestedType(event.target.value as CardType)
                  }
                >
                  {Object.entries(CARD_NAMES).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
        <div className="hand-actions">
          <div className="actions">
            {myTurn && (
              <button
                className="increment"
                disabled={
                  locked || !selected.length || (needsTarget && !targetId)
                }
                onClick={() =>
                  send({
                    type: "play",
                    cardIds: selected,
                    ...(needsTarget && targetId ? { targetId } : {}),
                    ...(selected.length === 3 ? { requestedType } : {}),
                  })
                }
              >
                Đánh {selected.length} lá đã chọn
              </button>
            )}
            <button
              className="increment"
              disabled={locked || !myTurn}
              onClick={() => send({ type: "draw" })}
            >
              Rút bài
            </button>
          </div>
        </div>
        <details className="public-discard">
          <summary>Bài bỏ công khai ({game.discardPile.length})</summary>
          <p>
            {game.discardPile
              .map((card) => CARD_NAMES[card.type])
              .join(" · ") || "Chưa có bài bỏ."}
          </p>
        </details>
      </section>
    </>
  );
}
