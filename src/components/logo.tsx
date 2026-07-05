const REVOLVER_PATH =
  'M481.14 125.357c-18.78 5.476-34.912 14.487-46.952 32.973h46.953v-32.973zm-188.915 50.01l-13.125.002-.116 35.74H491.47l-.343-35.74H292.225v-.003zm-29.125.002l-33.07.003-97.298.008c-16.018 27.973-16.89 57.78 1.04 94.07H262.8l.063-20.22H168.09a8 8 0 1 1 0-16h94.8v-22.68h-95.15a8 8 0 1 1 0-16h95.3l.06-19.18zm-161.377.01c-7.834 28.723-12.348 45.61-18.73 58.69-6.78 13.893-15.75 23.88-32.3 41.7C11.077 351.204 17.48 389.416 20.46 432.083c12.07 14.128 29.67 21.282 48.724 23.54 17.703 2.097 36.135-.286 50.816-4.597-.272-47.016 8.213-93.296 40.84-139.84l5.264-7.507 6.724 6.23c18.24 16.9 40.922 21.272 63.205 17.717 22.283-3.555 43.756-15.464 57.254-30.285 9.92-10.894 12.492-23.074 11.66-37.932h-26.115l-.084 26.04h-.695c-9.56 10.992-33.904 24.083-47.803 24.146-13.556.06-35.84-13.197-47.896-24.145H123.88l-2.253-4.266c-20.284-38.435-21.828-74.208-7.06-105.803h-12.844zm-74.88 2.47c7.33 23.547 19.127 43.547 34.825 60.796 2.733-3.822 4.952-7.508 6.945-11.593 2.33-4.772 4.44-10.37 6.715-17.44-.225-.142-.403-.248-.635-.394-7.68-4.854-17.46-11.227-27.117-17.58-10.508-6.916-13.477-8.943-20.734-13.79zm252.09 49.26l-.042 13.66v2.638h82.72V227.11h-82.676zM88.642 293.9c16.474 0 30 13.525 30 29.998 0 16.474-13.526 30-30 30-16.473 0-30-13.526-30-30 0-16.473 13.527-29.998 30-29.998zm0 15.998c-7.826 0-14 6.174-14 14 0 7.827 6.174 14 14 14 7.827 0 14-6.173 14-14 0-7.826-6.173-14-14-14zm-18.025 67.676a13 13 0 0 1 12.625 12.998 13 13 0 1 1-26 0 13 13 0 0 1 13.375-12.998z';

/** Logo de l'accueil : un revolver posé sur une table, encre en couches sur papier. */
export default function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Revolver Noir">
      <defs>
        <radialGradient id="logoPaper" cx="42%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#fbf8ef" />
          <stop offset="70%" stopColor="#ece3cd" />
          <stop offset="100%" stopColor="#d9cdae" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="60" r="59" fill="url(#logoPaper)" />
      <circle cx="60" cy="60" r="59" fill="none" stroke="#16120c" strokeWidth="1.4" opacity="0.5" />

      {/* Vignette façon film noir */}
      <circle cx="60" cy="60" r="59" fill="none" stroke="#16120c" strokeWidth="14" opacity="0.06" />

      {/* Table vue en perspective */}
      <path d="M2 84 L118 84 L108 116 L12 116 Z" fill="#16120c" opacity="0.16" />
      <path d="M2 84 L118 84 L114 92 L6 92 Z" fill="#16120c" opacity="0.28" />
      <path d="M14 96 L106 96 M18 104 L102 104" stroke="#16120c" strokeWidth="1" opacity="0.18" strokeLinecap="round" />
      <line x1="2" y1="84" x2="118" y2="84" stroke="#16120c" strokeWidth="1.6" opacity="0.4" />

      {/* Ombre portée du revolver sur la table */}
      <ellipse cx="63" cy="85" rx="34" ry="7" fill="#16120c" opacity="0.18" />

      {/* Volute de fumée */}
      <path
        d="M97 40 C101 34 98 29 101 24 C104 19 101 14 104 9"
        fill="none"
        stroke="#16120c"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.22"
      />

      {/* Douille éjectée */}
      <rect x="86" y="70" width="4" height="9" rx="1.5" fill="#16120c" opacity="0.5" transform="rotate(20 88 74)" />

      {/* Le revolver, posé en diagonale */}
      <g transform="translate(60,58) rotate(-16) scale(0.145) translate(-256,-256)" fill="#16120c">
        <path d={REVOLVER_PATH} />
      </g>
    </svg>
  );
}
