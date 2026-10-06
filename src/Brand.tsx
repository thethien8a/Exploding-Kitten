export function CatMark() {
  return (
    <svg
      className="cat-mark"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 31 9 10l16 10h14l16-10-1 21c5 17-7 25-22 25S5 48 10 31Z"
        fill="currentColor"
      />
      <path
        d="M20 35c0-4 6-4 6 0m12 0c0-4 6-4 6 0M29 42l3 3 3-3m-3 3v3m0 0c-5 4-8-1-8-1m8 1c5 4 8-1 8-1"
        stroke="var(--cat-detail, #fffdf7)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Mèo Nổ — Trang chủ">
      <span className="brand-mark">
        <CatMark />
      </span>
      <span>
        Mèo Nổ<span className="brand-dot">.</span>
      </span>
    </a>
  );
}
