/** Écusson stylisé du LSPD — SVG inline, aucune dépendance externe. */
export function LspdShield({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 76" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lspd-shield-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1565d8" />
          <stop offset="100%" stopColor="#0b3f86" />
        </linearGradient>
        <linearGradient id="lspd-shield-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0c076" />
          <stop offset="100%" stopColor="#a8842f" />
        </linearGradient>
      </defs>
      <path
        d="M32 2 60 11v27c0 16-11.7 29.3-28 36C15.7 67.3 4 54 4 38V11L32 2Z"
        fill="url(#lspd-shield-body)"
        stroke="#e0c076"
        strokeWidth="2.5"
      />
      <path
        d="M32 20.5 35.6 30h9.9l-8 6.1 3 9.7-8.5-5.9-8.5 5.9 3-9.7-8-6.1h9.9L32 20.5Z"
        fill="url(#lspd-shield-star)"
      />
      <text
        x="32"
        y="60"
        textAnchor="middle"
        fill="#e0c076"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="1.6"
        fontFamily="system-ui, sans-serif"
      >
        LSPD
      </text>
    </svg>
  );
}

/** Logo Discord officiel (marque déposée Discord Inc.). */
export function DiscordLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 127.14 96.36" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"
      />
    </svg>
  );
}
