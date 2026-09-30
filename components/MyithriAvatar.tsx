import { useId } from "react";

/**
 * Myithri, DMSA's AI volunteer: a lean young woman with brown skin, hair
 * pulled back from a side parting, thin rectangular glasses and small gold
 * earrings, in a teal kurta with a maroon, gold-bordered dupatta. Drawn as SVG
 * so it stays sharp at any size and costs nothing to load.
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
          <stop offset="0" stopColor="#7E4B2E" />
          <stop offset="1" stopColor="#6B3E25" />
        </linearGradient>
        <clipPath id={`cl${id}`}>
          <circle cx="100" cy="100" r="100" />
        </clipPath>
      </defs>
      <g clipPath={`url(#cl${id})`}>
        <rect width="200" height="200" fill={`url(#bg${id})`} />
        <g transform="translate(100 106) scale(1.14) translate(-100 -100)">
          {/* hair around the head, pulled back */}
          <path d="M73 96 C68 60 83 36 100 36 C117 36 132 60 127 96 C124 104 118 108 112 110 L88 110 C82 108 76 104 73 96 Z" fill="#141010" />
          {/* neck */}
          <path d="M91 124 L109 124 L111 154 L89 154 Z" fill="#5E3620" />
          {/* teal kurta */}
          <path d="M40 200 C42 172 62 156 88 151 L100 160 L112 151 C138 156 158 172 160 200 Z" fill="#1B7F86" />
          {/* maroon dupatta over both shoulders with a gold border */}
          <path d="M44 200 C46 176 60 160 84 152 C88 166 92 184 96 200 Z" fill="#6B1F3A" />
          <path d="M156 200 C154 176 140 160 116 152 C112 166 108 184 104 200 Z" fill="#6B1F3A" />
          <path d="M84 152 C88 166 92 184 96 200" stroke="#D9A441" strokeWidth="4" fill="none" />
          <path d="M116 152 C112 166 108 184 104 200" stroke="#D9A441" strokeWidth="4" fill="none" />
          <path d="M86.5 160 C89.5 172 92.5 186 95 200" stroke="#7A2A45" strokeWidth="1.2" fill="none" strokeDasharray="3 3" />
          <path d="M113.5 160 C110.5 172 107.5 186 105 200" stroke="#7A2A45" strokeWidth="1.2" fill="none" strokeDasharray="3 3" />
          {/* ears with small gold earrings */}
          <ellipse cx="76" cy="96" rx="5" ry="8" fill="#6B3E25" />
          <ellipse cx="124" cy="96" rx="5" ry="8" fill="#6B3E25" />
          <circle cx="76" cy="105.5" r="2.2" fill="#E9BD5C" />
          <circle cx="124" cy="105.5" r="2.2" fill="#E9BD5C" />
          {/* slim face, narrow chin */}
          <path d="M78 88 C78 61 88 48 100 48 C112 48 122 61 122 88 C122 112 112 133 100 136 C88 133 78 112 78 88 Z" fill={`url(#sk${id})`} />
          {/* hairline with a side parting */}
          <path d="M77 86 C74 58 86 42 100 42 C114 42 126 58 123 86 C120 70 114 60 104 56 C96 58 86 66 77 86 Z" fill="#141010" />
          <path d="M104 56 C102.5 51 101 47 100 43.5" stroke="#3A2E2A" strokeWidth="1" fill="none" opacity="0.8" />
          <path d="M79.5 80 C78.6 85 78.8 90 79.8 94" stroke="#141010" strokeWidth="1" fill="none" opacity="0.55" />
          {/* brows and eyes */}
          <path d="M83.5 79 Q89.5 76 95.5 78" stroke="#141010" strokeWidth="2.1" fill="none" strokeLinecap="round" />
          <path d="M104.5 78 Q110.5 76 116.5 79" stroke="#141010" strokeWidth="2.1" fill="none" strokeLinecap="round" />
          <ellipse cx="89.5" cy="89" rx="3.3" ry="2.3" fill="#141010" />
          <ellipse cx="110.5" cy="89" rx="3.3" ry="2.3" fill="#141010" />
          <circle cx="90.6" cy="88.3" r="0.8" fill="#fff" />
          <circle cx="111.6" cy="88.3" r="0.8" fill="#fff" />
          {/* thin rectangular glasses */}
          <rect x="80.5" y="83" width="18" height="11.5" rx="3" fill="#fff" fillOpacity="0.1" stroke="#1A1A20" strokeWidth="1.5" />
          <rect x="101.5" y="83" width="18" height="11.5" rx="3" fill="#fff" fillOpacity="0.1" stroke="#1A1A20" strokeWidth="1.5" />
          <path d="M98.5 87.5 Q100 86 101.5 87.5" stroke="#1A1A20" strokeWidth="1.5" fill="none" />
          <path d="M80.5 87 L76.5 86.5" stroke="#1A1A20" strokeWidth="1.5" />
          <path d="M119.5 87 L123.5 86.5" stroke="#1A1A20" strokeWidth="1.5" />
          {/* nose and a gentle closed-lip smile */}
          <path d="M100 97 Q98.4 103.5 100.8 105.5" stroke="#4E2B18" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.8" />
          <path d="M93 114.5 Q100 118.5 107 114.5" stroke="#4A1F1C" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
