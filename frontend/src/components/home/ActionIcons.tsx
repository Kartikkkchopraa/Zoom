/** Glyphs used inside the three big Home action buttons. */

export function VideoOffGlyph() {
  return (
    <svg viewBox="0 0 28 28" className="size-7" fill="white" aria-hidden>
      <path d="M4 9.5A2.5 2.5 0 0 1 6.5 7h10A2.5 2.5 0 0 1 19 9.5v9a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 4 18.5z" />
      <path d="m20.5 12.2 4.1-2.7c.6-.4 1.4 0 1.4.8v7.4c0 .8-.8 1.2-1.4.8l-4.1-2.7z" />
      <path
        d="M4.5 23.5 23 5"
        stroke="var(--color-zoom-orange)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M4.5 23.5 23 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function JoinGlyph() {
  return (
    <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
      <rect x="4" y="4" width="20" height="20" rx="5" fill="white" />
      <path
        d="M14 9v10M9 14h10"
        stroke="var(--color-zoom-blue)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ScheduleGlyph() {
  return (
    <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
      <rect x="4" y="5.5" width="20" height="19" rx="4" fill="white" />
      <path d="M9.5 3.5v4M18.5 3.5v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.5 5.5v2M18.5 5.5v2" stroke="var(--color-zoom-blue)" strokeWidth="1.2" strokeLinecap="round" />
      <text
        x="14"
        y="20.5"
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="var(--color-zoom-blue)"
        fontFamily="inherit"
      >
        19
      </text>
    </svg>
  );
}
