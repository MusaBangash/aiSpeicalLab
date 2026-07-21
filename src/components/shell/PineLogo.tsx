/** The Ananas pineapple mark, ported verbatim from the design mockups. */
export function PineLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48">
      <path
        d="M24 13c-2-4 1-8 5-9-1 4 0 6 2 7 2-4 6-4 9-2-3 1-5 3-5 6-3-2-8-3-11-2z"
        fill="#1B4D3E"
      />
      <path
        d="M24 13c2-4-1-8-5-9 1 4 0 6-2 7-2-4-6-4-9-2 3 1 5 3 5 6 3-2 8-3 11-2z"
        fill="#2E7D5B"
      />
      <ellipse cx="24" cy="30" rx="12.5" ry="15" fill="#E8A317" />
      <g stroke="#B97B0C" strokeWidth="1.6" opacity={0.75}>
        <path
          d="M13 24l22 12M13 30l20 11M13 36l14 8M15 19l22 12M20 16l17 10M28 16l7 4"
          fill="none"
        />
        <path
          d="M35 24l-22 12M35 30l-20 11M35 36l-14 8M33 19l-22 12M28 16l-17 10M20 16l-7 4"
          fill="none"
        />
      </g>
    </svg>
  );
}
