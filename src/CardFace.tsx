import { CARD_NAMES } from "../shared/protocol";
import type { CardType } from "../shared/engine";

export const CARD_PATHS: Partial<Record<CardType, string>> = {
  defuse: "M24 5 39 11V23c0 10-15 19-15 19S9 33 9 23V11Z M17 23l5 5 10-12",
  attack: "M9 38 24 9M23 38 38 9M16 10l8-1 3 8M30 10l8-1 3 8",
  skip: "M24 5a19 19 0 1 0 0 38 19 19 0 1 0 0-38M11 11l26 26",
  favor: "M5 24h18l-6-6M23 24l-6 6M43 12H25l6-6M25 12l6 6",
  shuffle:
    "M5 12h7c9 0 15 24 24 24h7M36 29l7 7-7 7M5 36h7c9 0 15-24 24-24h7M36 5l7 7-7 7",
  see_future:
    "M3 24s8-14 21-14 21 14 21 14-8 14-21 14S3 24 3 24ZM24 16a8 8 0 1 0 0 16 8 8 0 1 0 0-16",
  alter_future:
    "M8 7h10v15H8ZM29 26h10v15H29ZM25 8h14l-5-5M39 8l-5 5M23 40H9l5-5M9 40l5 5",
  reverse: "M8 16h30l-9-9M38 16l-9 9M40 32H10l9-9M10 32l9 9",
  draw_bottom: "M8 6h24v26H8ZM8 38h24M38 18v24l-6-6M38 42l6-6",
  nope: "M13 28V14a3 3 0 0 1 6 0v10V8a3 3 0 0 1 6 0v16V10a3 3 0 0 1 6 0v14V15a3 3 0 0 1 6 0v17c0 9-6 12-13 12-8 0-12-7-17-14a3 3 0 0 1 5-4l7 8",
  exploding_kitten:
    "M24 13a14 14 0 1 0 0 28 14 14 0 1 0 0-28M24 13V6h8M32 6l4-4M37 9l5 2",
};

export function CardFace({ type }: { type: CardType }) {
  return (
    <>
      <span className="card-kind" aria-hidden="true">
        {type === "defuse"
          ? "Bảo vệ"
          : type === "nope"
            ? "Phản ứng"
            : type === "exploding_kitten"
              ? "Nguy hiểm"
              : CARD_PATHS[type]
                ? "Tác dụng"
                : "Mèo thường"}
      </span>
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
