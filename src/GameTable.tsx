import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CARD_NAMES,
  NOPE_WINDOW_MS,
  type RoomAction,
  type RoomSnapshot,
  type Session,
} from "../shared/protocol";
import type { CardType } from "../shared/engine";
import { CatMark } from "./Brand";
import { CardFace, CARD_PATHS } from "./CardFace";

const CARD_COPY: Record<CardType, string> = {
  exploding_kitten: `Cần ${CARD_NAMES.defuse} để sống sót.`,
  defuse: `Giữ lại để gỡ ${CARD_NAMES.exploding_kitten} khi rút trúng.`,
  attack:
    "Kết thúc mọi lượt của bạn, người kế tiếp chơi 2 lượt. Không cộng dồn.",
  skip: "Kết thúc một lượt mà không rút bài.",
  favor: "Chọn một người để họ cho bạn một lá.",
  shuffle: "Xáo chồng rút mà không xem bài.",
  see_future: "Xem kín tối đa 3 lá trên cùng.",
  alter_future: "Xem kín và sắp lại tối đa 3 lá trên cùng, rồi tiếp tục lượt.",
  reverse: "Đảo chiều chơi và kết thúc một lượt, không rút bài.",
  draw_bottom: `Rút lá dưới cùng để kết thúc một lượt. Vẫn có thể gặp ${CARD_NAMES.exploding_kitten}.`,
  nope: "Chặn hành động đang chờ, kể cả Nope.",
  tacocat: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
  cattermelon: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
  hairy_potato_cat: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
  beard_cat: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
  rainbow_ralphing_cat: "Ghép 2 hoặc 3 lá cùng tên để lấy bài.",
};
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

function Countdown({
  deadline,
  children,
}: {
  deadline: number;
  children: (remainingMs: number) => ReactNode;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [deadline]);
  return children(Math.max(0, deadline - now));
}

export function GameTable({
  snapshot,
  session,
  locked,
  send,
}: {
  snapshot: RoomSnapshot;
  session: Session;
  locked: boolean;
  send: (action: RoomAction) => void;
}) {
  const game = snapshot.game!;
  const { phase, idle, reaction } = game;
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
  const [discardChoice, setDiscardChoice] = useState({ id: "", pile: "" });
  const [position, setPosition] = useState<number | "random">(0);
  const [futureOrder, setFutureOrder] = useState<string[]>([]);
  const [animatedPlay, setAnimatedPlay] = useState<number | null>(null);
  const [dismissedTransfer, setDismissedTransfer] = useState<number | null>(
    null,
  );
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
    setFutureOrder([]);
  }, [phase.kind, snapshot.lastPlay?.id]);
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
      (play.cards.length === 5
        ? "combo 5 lá khác loại"
        : (play.cards.length > 1 ? "combo " + play.cards.length + " lá " : "") +
          CARD_NAMES[play.cards[0].type]) +
      (play.targetId
        ? " nhắm vào " +
          snapshot.members.find((member) => member.id === play.targetId)?.name
        : "")
    : lastCard
      ? "Lá bỏ mới nhất · " + CARD_NAMES[lastCard.type]
      : "";
  const hand = Object.keys(CARD_NAMES).flatMap((type) =>
    game.hand.filter((card) => card.type === type),
  );
  const transfer = snapshot.lastTransfer;
  const receiving = transfer?.toId === me.id;
  const partnerName = snapshot.members.find(
    (member) => member.id === (receiving ? transfer?.fromId : transfer?.toId),
  )?.name;
  const needsTarget =
    selected.length === 2 ||
    selected.length === 3 ||
    (selected.length === 1 &&
      game.hand.find((card) => card.id === selected[0])?.type === "favor");
  const reclaiming = selected.length === 5;
  const selectedTypes = new Set(
    game.hand
      .filter((card) => selected.includes(card.id))
      .map((card) => card.type),
  );
  const validSelection =
    selected.length === 1 ||
    ([2, 3].includes(selected.length) && selectedTypes.size === 1) ||
    (reclaiming && selectedTypes.size === 5);
  const discardKey = JSON.stringify(game.discardPile);
  const discardIndex =
    discardChoice.pile === discardKey
      ? game.discardPile.findIndex((card) => card.id === discardChoice.id)
      : -1;
  const selectedCard = game.hand.find((card) => card.id === selected.at(-1));
  const offlineMembers = snapshot.members.filter(
    (member) => member.alive && !member.connected,
  );
  const idleName = snapshot.members.find(
    (member) => member.id === idle?.playerId,
  )?.name;
  const direction = game.direction ?? 1;
  const turnSeat = snapshot.members.findIndex(
    (member) => member.id === game.turn.playerId,
  );
  const nextMember = Array.from(
    { length: snapshot.members.length - 1 },
    (_, index) =>
      snapshot.members[
        (turnSeat + (index + 1) * direction + snapshot.members.length) %
          snapshot.members.length
      ],
  ).find((member) => member.alive);
  const orderedFuture =
    futureOrder.length === game.futureCards.length &&
    futureOrder.every((id) => game.futureCards.some((card) => card.id === id))
      ? futureOrder.map((id) =>
          game.futureCards.find((card) => card.id === id)!,
        )
      : game.futureCards;
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
      {phase.kind !== "finished" && (
        <div className="turn-details">
          <span>
            {direction === 1 ? "Chiều thuận" : "Chiều đảo"} · Tiếp theo:{" "}
            {nextMember?.name}
          </span>
          {idle && (
            <Countdown deadline={idle.deadline}>
              {(idleMs) => (
                <span role="timer" aria-label="Thời gian không hoạt động">
                  {idle.playerId !== game.turn.playerId && idleName + " · "}
                  {Math.ceil(idleMs / 1000)}s ·{" "}
                  {phase.kind === "favor"
                    ? "Tự cho 1 lá"
                    : phase.kind === "defuse"
                      ? "Tự cài bom ngẫu nhiên"
                      : "Tự rút bài"}
                </span>
              )}
            </Countdown>
          )}
        </div>
      )}
      {transfer && transfer.id !== dismissedTransfer && (
        <section
          className="transfer-notice"
          data-outcome={
            transfer.cardType ? (receiving ? "received" : "lost") : "missed"
          }
          role="status"
          aria-label="Kết quả lấy bài"
        >
          <svg
            className="transfer-symbol"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              d={CARD_PATHS[transfer.cardType ?? "favor"] ?? CARD_PATHS.favor}
            />
          </svg>
          <div>
            <small>Chỉ bạn và {partnerName} thấy</small>
            <p>
              {transfer.cardType ? (
                receiving ? (
                  <>
                    Bạn vừa lấy <strong>{CARD_NAMES[transfer.cardType]}</strong>{" "}
                    từ {partnerName}.
                  </>
                ) : (
                  <>
                    {partnerName} vừa lấy{" "}
                    <strong>{CARD_NAMES[transfer.cardType]}</strong> của bạn.
                  </>
                )
              ) : receiving ? (
                <>Bạn không lấy được lá nào từ {partnerName}.</>
              ) : (
                <>{partnerName} không lấy được lá nào của bạn.</>
              )}
            </p>
          </div>
          <button
            className="text-button"
            aria-label="Đóng thông báo lấy bài"
            onClick={() => setDismissedTransfer(transfer.id)}
          >
            ×
          </button>
        </section>
      )}
      {phase.kind !== "finished" && offlineMembers.length > 0 && (
        <section
          className="connection-notice"
          aria-label="Người chơi mất kết nối"
        >
          <strong>Ván vẫn tiếp tục</strong>
          <p>
            {offlineMembers.map((member) => member.name).join(", ")} đang mất
            kết nối.
          </p>
        </section>
      )}
      {bomb && (
        <section
          className="bomb-warning"
          data-outcome={bomb.outcome}
          role="alert"
          aria-label={"Trạng thái " + CARD_NAMES.exploding_kitten}
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
                ? " rút trúng " + CARD_NAMES.exploding_kitten + "!"
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
                (member.id === me.id ? " is-self" : "") +
                (phase.kind === "finished" && member.id === phase.winnerId
                  ? " is-winner"
                  : "") +
                (member.id === game.turn.playerId && phase.kind !== "finished"
                  ? " is-turn"
                  : "") +
                (member.id === targetedAction?.targetId ? " is-targeted" : "") +
                (phase.kind === "defuse" && member.id === phase.playerId
                  ? " is-defusing"
                  : "") +
                (member.alive && !member.connected ? " is-offline" : "") +
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
                  {!member.alive
                    ? "Bị loại"
                    : !member.connected
                      ? "Mất kết nối"
                      : member.cardCount + " lá"}
                </small>
                {phase.kind === "finished" && member.id === phase.winnerId && (
                  <span className="winner-tag">
                    <svg
                      className="winner-crown"
                      viewBox="0 0 32 32"
                      role="img"
                      aria-label="Vương miện người thắng"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m4 9 6 5 6-9 6 9 6-5-3 15H7ZM8 28h16" />
                    </svg>
                    Người thắng
                  </span>
                )}
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
                <CatMark />
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
                data-count={shownCards.length}
                key={play?.id ?? lastCard?.id ?? "empty"}
              >
                {shownCards.length ? (
                  shownCards.map((card, index) => (
                    <div
                      key={card.id}
                      className={
                        "table-card" +
                        (animatedPlay === play?.id && latestIsPlay
                          ? " card-arriving"
                          : "")
                      }
                      data-type={card.type}
                      style={{ "--card-index": index } as CSSProperties}
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
      {reaction && (
        <Countdown deadline={reaction.deadline}>
          {(reactionMs) => (
            <section
              className="reaction table-reaction"
              aria-label="Phản ứng Nope"
            >
              <div>
                <strong>Chờ Nope · {Math.ceil(reactionMs / 1000)}s</strong>
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
                      cardId: game.hand.find((card) => card.type === "nope")!
                        .id,
                    })
                  }
                >
                  Nope
                </button>
                <button
                  className="secondary outline-button"
                  disabled={
                    locked || !me.alive || reaction.passedIds.includes(me.id)
                  }
                  onClick={() => send({ type: "pass" })}
                >
                  Bỏ qua
                </button>
              </div>
              <div
                className="reaction-timer"
                role="progressbar"
                aria-label="Thời gian phản ứng Nope"
                aria-valuemin={0}
                aria-valuemax={NOPE_WINDOW_MS / 1000}
                aria-valuenow={Math.min(
                  NOPE_WINDOW_MS / 1000,
                  Math.ceil(reactionMs / 1000),
                )}
              >
                <span
                  style={{
                    width: Math.min(1, reactionMs / NOPE_WINDOW_MS) * 100 + "%",
                  }}
                />
              </div>
            </section>
          )}
        </Countdown>
      )}
      {(phase.kind === "future" || phase.kind === "alter_future") &&
        phase.playerId === me.id && (
          <section
            className="private-choice"
            aria-label={
              phase.kind === "alter_future" ? "Sắp tương lai" : "Xem tương lai"
            }
          >
            <strong>
              {phase.kind === "alter_future" ? "Sắp lại " : "Xem "}
              {game.futureCards.length} lá đầu · Chỉ bạn thấy
            </strong>
            {phase.kind === "alter_future" && <p>Lá 1 được rút trước.</p>}
            <ol className="future-cards">
              {orderedFuture.map((card, index) => (
                <li key={card.id}>
                  <div className="table-card" data-type={card.type}>
                    <CardFace type={card.type} />
                  </div>
                  {phase.kind === "alter_future" && (
                    <div className="future-controls">
                      {[-1, 1].map((offset) => (
                        <button
                          key={offset}
                          className="secondary outline-button"
                          aria-label={
                            (offset === -1 ? "Đưa " : "Dời ") +
                            CARD_NAMES[card.type] +
                            (offset === -1 ? " lên trước" : " ra sau")
                          }
                          disabled={
                            locked ||
                            index + offset < 0 ||
                            index + offset >= orderedFuture.length
                          }
                          onClick={() => {
                            const order = orderedFuture.map((item) => item.id);
                            [order[index], order[index + offset]] = [
                              order[index + offset],
                              order[index],
                            ];
                            setFutureOrder(order);
                          }}
                        >
                          {offset === -1 ? "Trước" : "Sau"}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <button
              className="secondary"
              disabled={locked}
              onClick={() =>
                send(
                  phase.kind === "alter_future"
                    ? {
                        type: "reorder_future",
                        order: orderedFuture.map((card) =>
                          game.futureCards.findIndex(
                            (original) => original.id === card.id,
                          ),
                        ),
                      }
                    : { type: "close_future" },
                )
              }
            >
              {phase.kind === "alter_future" ? "Xác nhận thứ tự" : "Đóng"}
            </button>
          </section>
        )}
      {phase.kind === "defuse" && phase.playerId === me.id && (
        <section className="private-choice" aria-label="Cài bom kín">
          <label htmlFor="position">
            Cài {CARD_NAMES.exploding_kitten} (0 = trên cùng, {game.drawCount} =
            dưới cùng)
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
          <h2>Bài của bạn</h2>
          <span>{game.hand.length} lá · Chỉ bạn thấy</span>
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
          {hand.map((card) => (
            <button
              key={card.id}
              className={
                "card" + (selected.includes(card.id) ? " selected" : "")
              }
              data-type={card.type}
              data-card-id={card.id}
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
              onClick={() => {
                if (
                  !giving &&
                  selected.length === 5 &&
                  !selected.includes(card.id)
                )
                  return;
                setDiscardChoice({ id: "", pile: "" });
                setSelected((current) =>
                  giving
                    ? current.includes(card.id)
                      ? []
                      : [card.id]
                    : current.includes(card.id)
                      ? current.filter((id) => id !== card.id)
                      : current.length < 5
                        ? [...current, card.id]
                        : current,
                );
              }}
            >
              <CardFace type={card.type} />
            </button>
          ))}
        </div>
        {selectedCard && myTurn && (
          <p className="card-help">
            {selected.length >= 4
              ? reclaiming && selectedTypes.size !== 5
                ? "Combo 5 cần 5 lá khác loại. Hãy bỏ chọn lá trùng loại."
                : "Combo 5 lá khác loại — Chọn 1 lá trong bài bỏ chung để lấy về tay. Không thể Nope; không kết thúc lượt."
              : CARD_NAMES[selectedCard.type] +
                " — " +
                CARD_COPY[selectedCard.type]}
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
            <label htmlFor="target">Mục tiêu</label>
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
        {myTurn && reclaiming && (
          <div className="target-controls">
            <label htmlFor="discard">Lá bài bỏ muốn lấy</label>
            <select
              id="discard"
              disabled={locked || !validSelection}
              value={discardIndex < 0 ? "" : discardChoice.id}
              onChange={(event) =>
                setDiscardChoice({ id: event.target.value, pile: discardKey })
              }
            >
              <option value="">Chọn một lá bài bỏ</option>
              {game.discardPile.map((card, index) => (
                <option key={card.id} value={card.id}>
                  {CARD_NAMES[card.type]} · lá {index + 1}
                </option>
              ))}
            </select>
            {!game.discardPile.length && (
              <p className="connection-note">Chồng bài bỏ đang trống.</p>
            )}
          </div>
        )}
        <div className="hand-actions">
          <div className="actions">
            <button
              className="increment"
              disabled={locked || !myTurn}
              onClick={() => send({ type: "draw" })}
            >
              Rút bài
            </button>
            {myTurn && (
              <button
                className="increment"
                disabled={
                  locked ||
                  !validSelection ||
                  (needsTarget && !targetId) ||
                  (reclaiming && discardIndex < 0)
                }
                onClick={() =>
                  send({
                    type: "play",
                    cardIds: selected,
                    ...(needsTarget && targetId ? { targetId } : {}),
                    ...(selected.length === 3 ? { requestedType } : {}),
                    ...(reclaiming ? { discardIndex } : {}),
                  })
                }
              >
                {selected.length
                  ? "Đánh " + selected.length + " lá"
                  : "Đánh bài"}
              </button>
            )}
          </div>
        </div>
        <details className="public-discard">
          <summary>Xem bài bỏ ({game.discardPile.length})</summary>
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
