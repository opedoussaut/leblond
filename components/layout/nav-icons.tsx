/** Minimal stroke icons (original, no third-party assets). */
const common = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const HomeIcon = () => (
  <svg {...common}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
  </svg>
);
export const SessionIcon = () => (
  <svg {...common}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const ProgressIcon = () => (
  <svg {...common}>
    <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
  </svg>
);
export const PatrickIcon = () => (
  <svg {...common}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M9 10h6" />
  </svg>
);
export const ProfileIcon = () => (
  <svg {...common}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);
export const CalendarIcon = () => (
  <svg {...common}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M7 3v5m10-5v5M3 11h18M8 15h3m3 0h3" />
  </svg>
);
export const AtlasIcon = () => (
  <svg {...common}>
    <path d="M12 6C9 4 5 4 2 5v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-3-1-7-1-10 1zm0 0v14" />
  </svg>
);
export const PlusIcon = () => (
  <svg {...common} strokeWidth={2.6}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
