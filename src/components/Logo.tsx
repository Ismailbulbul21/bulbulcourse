/**
 * BulbulCourses logo — a bulbul songbird (crest, beak, tail) whose wing is a
 * play button. Matches /public/favicon.svg.
 */
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="bulbul-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5f5bf1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#bulbul-g)" />
      <polygon points="41,17 45.5,9.5 47.5,17" fill="#fff" />
      <path d="M18 34 L7 25.5 L11.5 39.5 Z" fill="#fff" />
      <ellipse cx="31" cy="36" rx="14.5" ry="11.5" fill="#fff" />
      <circle cx="43" cy="24" r="8.5" fill="#fff" />
      <polygon points="50.5,21.5 58.5,25 50.5,28.5" fill="#fff" />
      <circle cx="45.5" cy="22.5" r="2" fill="#4338ca" />
      <polygon points="27,30.5 27,42 37.5,36.25" fill="url(#bulbul-g)" />
    </svg>
  );
}
