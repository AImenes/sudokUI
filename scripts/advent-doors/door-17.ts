/** Door 17: a horse sleigh, seen from the side: a high curled back, a curled dash and runners that curl up in front. */
import { type Felt, cord, piece, roseCut, sewn } from './felt';

export default function sleigh(k: Felt): string {
  // the body: one piece, from the scroll at the top of the back, down into the seat, up into the dash and round underneath
  const body =
    'M-126,-150C-100,-148 -90,-120 -86,-88C-82,-46 -64,-20 -32,-18H38C68,-18 90,-42 98,-78C104,-104 126,-114 142,-102C160,-88 154,-60 144,-34C130,20 110,78 66,98' +
    'H-84C-124,98 -146,62 -146,10C-146,-40 -152,-74 -162,-104C-170,-130 -152,-152 -126,-150Z';
  // a runner: long on the snow, a short turn up behind, a tall curl in front
  const runner = 'M-150,170Q-150,184 -136,184H54C116,184 158,150 156,98C154,56 108,48 100,84C96,106 122,116 132,98';
  const strut = (x: number, lean: number) => `M${x},92C${x + lean},122 ${x + lean},154 ${x},182`;
  return `<g transform="translate(2,-20)">
    <g transform="translate(-10,-11)">${cord(runner, k.goldDeep, 11)}</g>
    ${piece('M-98,-96Q-62,-110 -24,-92V10H-98Z', k.accent)}
    ${cord(strut(-92, -14), k.gold, 11)}${cord(strut(34, 14), k.gold, 11)}
    ${cord('M-104,138H46', k.gold, 9)}
    ${sewn(`${k.id}-b`, body, k.snow, k.thread)}
    ${piece('M-140,58C-128,84 -110,98 -84,98H66C92,86 108,66 120,42C80,62 -80,70 -140,58Z', k.gold)}
    ${piece(roseCut(-16, 18, 15), k.accent)}
    ${cord('M-112,-104C-112,-124 -142,-126 -142,-106C-142,-96 -130,-94 -128,-104', k.gold, 7)}
    ${cord('M112,-72C112,-90 138,-90 138,-72C138,-64 128,-62 126,-70', k.gold, 7)}
    ${cord(runner, k.gold, 13)}
    </g>`;
}
