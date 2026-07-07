/**
 * Nutella, the resident black poodle — an optional companion drawn beneath
 * the board (Settings → Appearance). Pure decorative SVG, hidden from
 * screen readers.
 */
export function Poodle() {
  return (
    <svg
      className="poodle"
      viewBox="0 0 120 70"
      width="96"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="var(--poodle, #23262f)">
        {/* body pom */}
        <circle cx="62" cy="42" r="16" />
        {/* chest fluff */}
        <circle cx="47" cy="38" r="11" />
        {/* rear pom */}
        <circle cx="78" cy="46" r="11" />
        {/* head */}
        <circle cx="38" cy="24" r="9" />
        {/* topknot */}
        <circle cx="34" cy="14" r="6" />
        <circle cx="42" cy="13" r="5" />
        {/* ear pom */}
        <circle cx="46" cy="27" r="5.5" />
        {/* muzzle */}
        <ellipse cx="29" cy="27" rx="6" ry="4.5" />
        {/* legs with ankle poms */}
        <rect x="50" y="50" width="4" height="12" rx="2" />
        <rect x="66" y="52" width="4" height="10" rx="2" />
        <circle cx="52" cy="63" r="4" />
        <circle cx="68" cy="63" r="4" />
        {/* tail with pom */}
        <rect x="86" y="30" width="3.5" height="12" rx="1.75" transform="rotate(24 88 36)" />
        <circle cx="92" cy="27" r="5.5" />
      </g>
      {/* nose + eye, slightly lighter so they read on the black coat */}
      <circle cx="24.5" cy="26" r="2" fill="var(--poodle-detail, #5b6170)" />
      <circle cx="36" cy="22" r="1.6" fill="var(--poodle-detail, #5b6170)" />
      {/* collar tag */}
      <circle cx="44" cy="32.5" r="2.2" fill="#c98a4b" />
    </svg>
  );
}
