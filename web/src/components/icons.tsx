// Ikon garis daripada reka bentuk (design/*.dc.html). Semua aria-hidden.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  </Svg>
);
export const IconPlusCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);
export const IconCheckSquare = (p: P) => (
  <Svg {...p}>
    <path d="M9 11l3 3 8-8" />
    <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
  </Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);
export const IconReceipt = (p: P) => (
  <Svg {...p}>
    <path d="M4 2h16v20l-3-2-3 2-2-2-2 2-3-2-3 2z" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconDocument = (p: P) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </Svg>
);
export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
  </Svg>
);
export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M5 12l5 5 9-10" />
  </Svg>
);
export const IconWallet = (p: P) => (
  <Svg {...p}>
    <rect x="2" y="6" width="20" height="13" rx="2" />
    <circle cx="12" cy="12.5" r="2.5" />
  </Svg>
);
export const IconCake = (p: P) => (
  <Svg {...p}>
    <path d="M4 21h16v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" />
    <path d="M4 16c2 1 3 1 4 0s3-1 4 0 3 1 4 0 3-1 4 0" />
    <path d="M12 11V7" />
  </Svg>
);
export const IconChart = (p: P) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.4 2.6 4 5.5" />
  </Svg>
);
export const IconCard = (p: P) => (
  <Svg {...p}>
    <rect x="2" y="6" width="20" height="13" rx="2" />
    <path d="M2 10h20" />
  </Svg>
);
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);
export const IconOrg = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="5" rx="1" />
    <rect x="3" y="16" width="6" height="5" rx="1" />
    <rect x="15" y="16" width="6" height="5" rx="1" />
    <path d="M12 8v4M6 16v-2h12v2" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Svg>
);
