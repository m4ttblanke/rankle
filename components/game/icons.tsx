/**
 * Minimal inline icon set for the ranking board. One consistent style
 * (1.5px stroke, rounded) — see docs/DESIGN.md sec 30.
 */
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ChevronUpIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 10l4-4 4 4" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11.5 5.5a1.75 1.75 0 1 0-1.657-2.363l-4.146 2.28a1.75 1.75 0 1 0 0 2.966l4.146 2.28A1.75 1.75 0 1 0 11.5 9.5c-.31 0-.6.079-.854.217l-4.146-2.28a1.767 1.767 0 0 0 0-.874l4.146-2.28c.254.138.543.217.854.217Z" />
    </svg>
  );
}
