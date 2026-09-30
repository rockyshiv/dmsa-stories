import { useId } from "react";

/**
 * Myithri, DMSA's AI volunteer: a lean young woman with brown skin, glasses
 * and long dark hair, in a navy kurta with DMSA gold and teal. Drawn as SVG so
 * it stays sharp at any size and costs nothing to load.
 */
export default function MyithriAvatar({ className, title = "Myithri" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3CCDCD" />
          <stop offset="1" stopColor="#1F4F9E" />
        </linearGradient>
        <linearGradient id={`sk${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9A6443" />
          <stop offset="1" stopColor="#85543A" />
        </linearGradient>
        <clipPath id={`cl${id}`}>
          <circle cx="100" cy="100" r="100" />
        </clipPath>
      </defs>
      <g clipPath={`url(#cl${id})`}>
        <rect width="200" height="200" fill={`url(#bg${id})`} />
        {/* long hair behind */}
        <path d="M62 88 C58 50 80 28 102 28 C128 28 144 50 140 90 C138 118 146 150 142 176 L60 176 C54 150 64 118 62 88 Z" fill="#1B1210" />
        {/* neck and lean shoulders */}
        <path d="M90 124 L110 124 L112 156 L88 156 Z" fill="#7A4B32" />
        <path d="M40 200 C42 170 62 154 86 150 L100 162 L114 150 C138 154 158 170 160 200 Z" fill="#16336B" />
        <path d="M86 150 L100 172 L114 150 L110 149 L100 164 L90 149 Z" fill="#D9A441" />
        <path d="M114 150 C132 154 150 166 156 200 L138 200 C134 178 126 164 110 156 Z" fill="#3CCDCD" opacity="0.9" />
        {/* ears with gold studs */}
        <ellipse cx="74" cy="96" rx="5.5" ry="8.5" fill="#85543A" />
        <ellipse cx="126" cy="96" rx="5.5" ry="8.5" fill="#85543A" />
        <circle cx="74" cy="106" r="2.4" fill="#E9BD5C" />
        <circle cx="126" cy="106" r="2.4" fill="#E9BD5C" />
        {/* face */}
        <path d="M76 88 C76 60 87 47 100 47 C113 47 124 60 124 88 C124 114 113 133 100 133 C87 133 76 114 76 88 Z" fill={`url(#sk${id})`} />
        {/* side-swept hair */}
        <path d="M73 84 C68 52 85 37 104 37 C123 37 135 52 128 78 C123 64 113 56 98 56 C91 63 83 72 73 84 Z" fill="#1B1210" />
        <path d="M98 56 C104 48 114 45 123 49" stroke="#3A2A24" strokeWidth="1.4" fill="none" opacity="0.6" />
        {/* brows and eyes */}
        <path d="M82 77 Q89 73.5 95.5 76" stroke="#1B1210" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M104.5 76 Q111 73.5 118 77" stroke="#1B1210" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <ellipse cx="88" cy="90" rx="3.6" ry="2.6" fill="#1B1210" />
        <ellipse cx="112" cy="90" rx="3.6" ry="2.6" fill="#1B1210" />
        <circle cx="89.2" cy="89.2" r="0.9" fill="#fff" />
        <circle cx="113.2" cy="89.2" r="0.9" fill="#fff" />
        {/* glasses */}
        <rect x="78.5" y="82" width="19.5" height="15" rx="5.5" fill="#fff" fillOpacity="0.12" stroke="#1E1E24" strokeWidth="2.2" />
        <rect x="102" y="82" width="19.5" height="15" rx="5.5" fill="#fff" fillOpacity="0.12" stroke="#1E1E24" strokeWidth="2.2" />
        <path d="M98 88 Q100 86 102 88" stroke="#1E1E24" strokeWidth="2" fill="none" />
        <path d="M78.5 87 L74.5 86" stroke="#1E1E24" strokeWidth="2" />
        <path d="M121.5 87 L125.5 86" stroke="#1E1E24" strokeWidth="2" />
        {/* nose, cheeks, smile */}
        <path d="M100 99 Q98.6 104 100.6 106" stroke="#6E4230" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8" />
        <ellipse cx="85" cy="106" rx="4.5" ry="2.8" fill="#C0705A" opacity="0.35" />
        <ellipse cx="115" cy="106" rx="4.5" ry="2.8" fill="#C0705A" opacity="0.35" />
        <path d="M91 114 Q100 121 109 114" stroke="#5E2622" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
