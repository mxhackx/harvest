export function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-[18px]" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function HomeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  );
}

export function UsersIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 14.3c2 .7 3.5 2.5 3.5 5.2" />
    </svg>
  );
}

export function ChevronIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="m7 9.5 5 5 5-5" />
    </svg>
  );
}

export function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function FilterIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

export function SortIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" />
    </svg>
  );
}

export function BoardIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="4" height="10" rx="1" /><rect x="16" y="4" width="5" height="13" rx="1" />
    </svg>
  );
}

export function TableIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" />
    </svg>
  );
}

export function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function PlusIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function PinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function UserIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function BriefcaseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </svg>
  );
}

export function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <circle cx="12" cy="12" r="9" /><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2M12 6.5V8m0 8v1.5" />
    </svg>
  );
}

export function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function TrashIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

export function DownloadIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
    </svg>
  );
}

export function PencilIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function CalendarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function ExpandIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

export function ShrinkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  );
}

export function UploadIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M12 16V5m0 0-4 4m4-4 4 4M5 20h14" />
    </svg>
  );
}

export function BookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M5 17a3 3 0 0 1 3-3h11" />
    </svg>
  );
}

export function MapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />
    </svg>
  );
}

export function FormIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <rect x="4" y="3" width="12" height="18" rx="2" /><path d="M8 8h4M8 12h4" /><path d="m14.5 17.5 5.5-5.5 2 2-5.5 5.5-2.5.5z" />
    </svg>
  );
}

export function FileUpIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M12 17v-6m0 0-2.5 2.5M12 11l2.5 2.5" />
    </svg>
  );
}

/** Punaise : épingler une page dans le menu (≠ PinIcon, le repère de carte). */
export function PushPinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
      <path d="M12 14v6" />
    </svg>
  );
}

export function SparkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3zM19 16v5M16.5 18.5h5" />
    </svg>
  );
}

export function PowerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M12 3v9M6.3 7a8 8 0 1 0 11.4 0" />
    </svg>
  );
}

export function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M6 11h12v9H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
    </svg>
  );
}

export function CopyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M9 9h11v11H9zM5 15H4V4h11v1" />
    </svg>
  );
}

export function UndoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" />
    </svg>
  );
}

export function RedoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h2" />
    </svg>
  );
}
