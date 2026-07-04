import { ReactNode } from 'react';
import { RoomId } from '../game/board';

/** Décors en coupe, silhouettes d'encre — purement visuels. */
export const ROOM_DECOR: Partial<Record<RoomId, ReactNode>> = {
  // Foyer — cheminée avec flamme + fauteuils
  1: (
    <svg width="76" height="50" viewBox="0 0 76 50" fill="none" stroke="#16120c" strokeWidth="2" strokeLinecap="round">
      <path d="M4 48 V16 H34 V48 M8 48 V22 H30 V48" />
      <path d="M15 42 C13 37 19 36 17 31 C22 33 21 38 23 42 Z" fill="#a3231d" stroke="none" opacity=".85" />
      <path d="M46 48 V34 C46 28 52 28 52 34 M70 48 V34 C70 28 64 28 64 34 M46 40 H70 M50 28 H66" />
    </svg>
  ),
  // Salle à manger — table et chaises
  2: (
    <svg width="80" height="44" viewBox="0 0 80 44" fill="none" stroke="#16120c" strokeWidth="2" strokeLinecap="round">
      <path d="M16 20 H64 M20 20 V42 M60 20 V42" />
      <path d="M6 42 V14 M6 26 H14 V42 M74 42 V14 M74 26 H66 V42" />
      <ellipse cx="40" cy="16" rx="7" ry="2.6" />
    </svg>
  ),
  // Hall — portemanteau et console
  3: (
    <svg width="62" height="50" viewBox="0 0 62 50" fill="none" stroke="#16120c" strokeWidth="2" strokeLinecap="round">
      <path d="M12 48 V8 M4 14 L12 8 L20 14 M6 22 L12 17 L18 22" />
      <path d="M8 13 C8 19 5 20 6 24" strokeWidth="1.6" opacity=".7" />
      <path d="M34 48 V30 H58 V48 M38 30 V26 H54 V30 M46 34 V40" />
    </svg>
  ),
  // Cuisine — fourneau + casseroles
  4: (
    <svg width="80" height="50" viewBox="0 0 80 50" fill="none" stroke="#16120c" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="18" width="34" height="30" />
      <circle cx="13" cy="24" r="3" />
      <circle cx="27" cy="24" r="3" />
      <rect x="10" y="33" width="22" height="10" />
      <path d="M48 48 V30 H74 M52 30 C52 24 58 24 58 30 M64 30 C64 22 74 24 72 30" />
      <path d="M55 14 C55 11 57 11 57 8 M62 14 C62 11 64 11 64 8" opacity=".6" strokeWidth="1.6" />
    </svg>
  ),
  // Bibliothèque — étagère garnie
  5: (
    <svg width="70" height="52" viewBox="0 0 70 52" fill="none" stroke="#16120c" strokeWidth="2">
      <rect x="4" y="4" width="62" height="46" />
      <line x1="4" y1="19" x2="66" y2="19" />
      <line x1="4" y1="34" x2="66" y2="34" />
      <g fill="#16120c" stroke="none">
        <rect x="8" y="8" width="4" height="11" /><rect x="14" y="10" width="4" height="9" />
        <rect x="20" y="7" width="5" height="12" /><rect x="34" y="9" width="4" height="10" />
        <rect x="40" y="8" width="4" height="11" /><rect x="10" y="23" width="4" height="11" />
        <rect x="16" y="25" width="5" height="9" /><rect x="30" y="24" width="4" height="10" />
        <rect x="48" y="22" width="5" height="12" /><rect x="55" y="25" width="4" height="9" />
        <rect x="8" y="39" width="5" height="11" /><rect x="26" y="40" width="4" height="10" />
        <rect x="33" y="38" width="4" height="12" />
      </g>
    </svg>
  ),
  // Chambre — lit
  6: (
    <svg width="86" height="46" viewBox="0 0 86 46" fill="none" stroke="#16120c" strokeWidth="2" strokeLinecap="round">
      <path d="M4 44 V16 M4 24 H82 M82 44 V24" />
      <rect x="8" y="17" width="16" height="7" rx="3" fill="#16120c" stroke="none" opacity=".8" />
      <path d="M4 32 H82" opacity=".5" />
    </svg>
  ),
  // Balcon — balustres
  7: (
    <svg width="90" height="40" viewBox="0 0 90 40" fill="none" stroke="#16120c" strokeWidth="2" strokeLinecap="round">
      <line x1="2" y1="10" x2="88" y2="10" />
      <line x1="2" y1="38" x2="88" y2="38" />
      <path d="M10 10 C7 18 13 22 10 30 C13 34 10 36 10 38 M28 10 C25 18 31 22 28 30 C31 34 28 36 28 38 M46 10 C43 18 49 22 46 30 C49 34 46 36 46 38 M64 10 C61 18 67 22 64 30 C67 34 64 36 64 38 M80 10 C77 18 83 22 80 30 C83 34 80 36 80 38" strokeWidth="1.7" />
    </svg>
  ),
  // Sous-sol — tonneau et caisses
  8: (
    <svg width="84" height="48" viewBox="0 0 84 48" fill="none" stroke="#16120c" strokeWidth="2">
      <ellipse cx="18" cy="10" rx="12" ry="4" />
      <path d="M6 10 V38 A12 5 0 0 0 30 38 V10" />
      <line x1="6" y1="20" x2="30" y2="21.5" />
      <line x1="6" y1="30" x2="30" y2="31" />
      <rect x="42" y="20" width="24" height="24" />
      <line x1="42" y1="20" x2="66" y2="44" opacity=".5" />
      <line x1="66" y1="20" x2="42" y2="44" opacity=".5" />
      <rect x="50" y="4" width="20" height="14" transform="rotate(-6 60 11)" />
    </svg>
  ),
};
