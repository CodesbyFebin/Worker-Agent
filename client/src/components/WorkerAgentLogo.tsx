/** WorkerAgent brand mark — stylized W from reference (purple→blue ribbons). */
export function WorkerAgentLogo({
  size = 28,
  className = "",
  showWordmark = true,
}: {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}) {
  const id = "wa-grad";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={id} x1="4" y1="6" x2="36" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a855f7" />
            <stop offset="0.45" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="40" height="40" rx="10" fill="#12081f" stroke={`url(#${id})`} strokeWidth="1.2" />
        {/* Overlapping ribbon W */}
        <path
          d="M8 11 L13 29 L20 15 L27 29 L32 11"
          stroke={`url(#${id})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#${id}-glow)`}
        />
        <path
          d="M10 12 L14.5 27 L20 16.5 L25.5 27 L30 12"
          stroke="#e9d5ff"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.55"
        />
      </svg>
      {showWordmark && (
        <span className="font-[var(--font-display)] text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Worker<span className="text-[var(--color-violet)]">Agent</span>
        </span>
      )}
    </div>
  );
}
