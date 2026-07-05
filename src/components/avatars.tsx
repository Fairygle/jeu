import { ReactNode } from 'react';

const S = { fill: 'none', stroke: '#16120c', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const AVATAR_KEYS = ['revolver', 'key', 'magnifier', 'tophat', 'mask', 'card', 'candle', 'skull'] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];

const PATHS: Record<AvatarKey, ReactNode> = {
  revolver: (
    <g {...S}>
      <path d="M6 20 H26 L25 24 H16 L14 28 H9 L11 24 H7 Z" fill="#16120c" stroke="none" />
      <path d="M26 20 V17 H30" />
      <circle cx="12" cy="30" r="2.6" />
    </g>
  ),
  key: (
    <g {...S}>
      <circle cx="11" cy="12" r="6" />
      <path d="M15 16 L28 29 M24 25 L27.5 21.5 M19 20 L22.5 16.5" />
    </g>
  ),
  magnifier: (
    <g {...S}>
      <circle cx="14" cy="14" r="9" />
      <line x1="20.5" y1="20.5" x2="30" y2="30" strokeWidth="3" />
    </g>
  ),
  tophat: (
    <g {...S}>
      <ellipse cx="16" cy="27" rx="13" ry="3" />
      <path d="M8 27 V13 H24 V27" fill="#16120c" stroke="none" />
      <path d="M6 13 H26 V16 H6 Z" />
    </g>
  ),
  mask: (
    <g {...S}>
      <path d="M4 14 C4 10 8 8 12 9 C14 9.6 15 11 16 11 C17 11 18 9.6 20 9 C24 8 28 10 28 14 C28 19 24 21 20 19 C18.5 18.2 17.5 17 16 17 C14.5 17 13.5 18.2 12 19 C8 21 4 19 4 14 Z" />
      <circle cx="11" cy="14" r="1.6" fill="#16120c" stroke="none" />
      <circle cx="21" cy="14" r="1.6" fill="#16120c" stroke="none" />
    </g>
  ),
  card: (
    <g {...S}>
      <rect x="8" y="4" width="16" height="24" rx="2" />
      <path d="M16 10 L18.3 14.8 L23.5 15.4 L19.7 19 L20.7 24.2 L16 21.6 L11.3 24.2 L12.3 19 L8.5 15.4 L13.7 14.8 Z" fill="#16120c" stroke="none" />
    </g>
  ),
  candle: (
    <g {...S}>
      <path d="M12 30 V16 H20 V30" />
      <path d="M16 16 V8" />
      <path d="M16 8 C16 5 14 4 15 1 C17 3 18 5 16 8 Z" fill="#16120c" stroke="none" />
    </g>
  ),
  skull: (
    <g {...S}>
      <path d="M16 5 C9 5 6 10 6 15 C6 19 8 21 8 24 H24 C24 21 26 19 26 15 C26 10 23 5 16 5 Z" />
      <circle cx="12" cy="15" r="2.4" fill="#16120c" stroke="none" />
      <circle cx="20" cy="15" r="2.4" fill="#16120c" stroke="none" />
      <path d="M15 18 L16 21 L17 18" />
      <path d="M11 24 V27 M15 24 V28 M20 24 V27" />
    </g>
  ),
};

export function AvatarIcon({ avatar, size = 22 }: { avatar?: string | null; size?: number }) {
  const key = avatar as AvatarKey;
  if (!key || !PATHS[key]) return null;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      {PATHS[key]}
    </svg>
  );
}
