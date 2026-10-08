/** The lowercase "zoom" wordmark, drawn with strokes so it scales crisply. */
export function ZoomLogo({ className = "h-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 74 24" className={className} role="img" aria-label="Zoom">
      <g fill="none" stroke="var(--color-zoom-blue)" strokeWidth="3.6">
        <path d="M2 6.2h11.6L2 17.8h11.6" strokeLinejoin="miter" />
        <circle cx="25.6" cy="12" r="5.8" />
        <circle cx="41.2" cy="12" r="5.8" />
        <path d="M51 19.6V11.6a4.9 4.9 0 0 1 9.8 0v8M60.8 11.6a4.9 4.9 0 0 1 9.8 0v8" />
      </g>
    </svg>
  );
}
