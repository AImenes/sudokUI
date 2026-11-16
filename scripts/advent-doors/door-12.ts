/** Door 12: a reindeer. */
import { type Felt, cord, roseCut, sewn } from './felt';

export default function reindeer(k: Felt): string {
  // an antler: the beam sweeps back over the neck and comes forward at the top, two tines behind it
  const beam = 'M72,-84C52,-100 28,-124 26,-156C25,-178 36,-194 56,-200M30,-132C16,-138 4,-152 0,-170M26,-160C14,-170 10,-184 12,-198';
  // the near antler's brow tine, the shovel over the face, with its small fork
  const brow = 'M76,-88C90,-104 108,-112 128,-108M104,-109C108,-118 116,-124 126,-124';
  const hoof = (x: number) => `<path d="M${x},178h22l2,17h-26z" fill="${k.gold}"/>`;
  // one piece: rump, back, the heavy neck, the head with its blunt muzzle, the ruff down the chest, a front and a hind leg
  const body =
    'M-128,22C-124,0 -102,-10 -72,-8C-44,-6 -14,-2 10,-12C28,-20 40,-40 50,-60C56,-72 66,-82 80,-84C100,-86 124,-72 146,-62C160,-56 168,-34 153,-26C140,-20 120,-23 106,-32' +
    'Q112,-14 100,-4Q112,12 96,24Q106,42 88,52Q94,68 78,76L76,180H54L52,103C20,113 -30,113 -62,101C-66,122 -78,138 -76,180H-98C-100,150 -94,134 -106,112C-124,92 -134,56 -128,22Z';
  return `<g transform="translate(-12,0)">
    <g fill="${k.shade}">
      <path d="M30,100L26,180H46L52,100Z"/>
      <path d="M-44,102C-48,126 -58,140 -56,180H-38C-38,150 -32,130 -28,102Z"/>
    </g>
    ${hoof(25)}${hoof(-58)}
    <g transform="rotate(28 74 -84)">${cord(beam, k.goldDeep)}</g>
    ${sewn(`${k.id}-b`, body, k.snow, k.thread, [-140, -100, 320, 208])}
    <path d="M62,-78C52,-88 42,-92 30,-90C36,-80 46,-72 58,-68Z" fill="${k.snow}"/>
    <path d="M-126,24C-138,18 -144,6 -142,-6C-132,-2 -126,8 -122,18Z" fill="${k.snow}"/>
    ${hoof(53)}${hoof(-99)}
    ${cord(beam + brow, k.gold)}
    ${cord('M40,-44C58,-30 80,-20 103,-18', k.accent, 11)}
    <circle cx="96" cy="-2" r="9" fill="${k.gold}"/>
    <path d="${roseCut(-40, 46, 15)}" fill="${k.ground}"/>
    <circle cx="112" cy="-62" r="3.5" fill="${k.deep}"/>
    </g>`;
}
