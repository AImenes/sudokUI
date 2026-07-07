/**
 * Nutella, the resident black poodle — an optional companion sitting beneath
 * the board (Settings → Appearance). Purely decorative, hidden from screen
 * readers. The artwork lives in public/poodle.png.
 */
export function Poodle() {
  return <img className="poodle" src="/poodle.png" width="88" alt="" aria-hidden="true" />;
}
