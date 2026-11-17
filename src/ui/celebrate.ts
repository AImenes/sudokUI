/**
 * The win screen's show (src/ui/Fireworks.tsx, over the victory dialog):
 * confetti shot from both lower corners in three volleys, confetti raining
 * from the top, and nine rockets that rise and burst. The owner's asking
 * of 17 November 2026: "when one finishes a puzzle, can you make the
 * celebration more crazy?", with a setting to switch it off (settings.ts,
 * celebrate).
 *
 * One canvas, drawn by hand: no library, nothing fetched, nothing stored.
 * It ends by itself about six seconds in, clears the canvas and asks for
 * no more frames. It never runs under prefers-reduced-motion (Fireworks.tsx
 * does not start it and the stylesheet hides the canvas).
 */

/** how long new pieces are made, in seconds; the last ones fall for a little after */
export const SHOW_SECONDS = 4;
/** when the corners fire and when a rocket leaves, in seconds from the start */
export const VOLLEYS_AT = [0, 0.9, 2.2];
export const ROCKETS_AT = [0.15, 0.6, 1.05, 1.5, 2.0, 2.5, 3.0, 3.5, 3.9];
/** no piece lives longer than this, so the show always ends */
export const BIT_SECONDS = 6;

/** the pieces' colours for a look: snow, candle gold, berries and spruce at Christmas, a rainbow otherwise */
export function paletteOf(theme: string | undefined): string[] {
  if (theme === 'christmas') return ['#e6eeea', '#f2c75c', '#d4455f', '#4fa37d'];
  return ['#ff5d6c', '#ffb02e', '#ffe14d', '#4fd08a', '#3fb6ff', '#8f7bff', '#ff7ad9'];
}

const CONFETTI = 0;
const SPARK = 1;
const ROCKET = 2;

interface Bit {
  kind: number;
  x: number;
  y: number;
  /** where it was a frame ago: a spark and a rocket draw a line from there */
  px: number;
  py: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  /** a confetti piece's flip, and how fast it turns */
  spin: number;
  turn: number;
}

export interface Show {
  /** ends it now and clears the canvas */
  stop(): void;
  /** whether it is still asking for frames */
  running(): boolean;
}

const ended: Show = { stop() {}, running: () => false };

/** starts the show on a canvas that fills what it should cover; `random` is Math.random unless a test says otherwise */
export function startShow(canvas: HTMLCanvasElement, palette: string[], random: () => number = Math.random): Show {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx || typeof requestAnimationFrame !== 'function' || !palette.length) return ended;
  const g = ctx;

  let w = 0;
  let h = 0;
  const fit = () => {
    const ratio = Math.min((typeof devicePixelRatio === 'number' && devicePixelRatio) || 1, 2);
    w = canvas.clientWidth || 0;
    h = canvas.clientHeight || 0;
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  fit();
  if (w < 2 || h < 2) return ended;
  const onResize = () => fit();
  if (typeof addEventListener === 'function') addEventListener('resize', onResize);

  const between = (a: number, b: number) => a + (b - a) * random();
  const pick = () => palette[Math.floor(random() * palette.length) % palette.length];
  // fewer pieces on a phone than on a wide screen
  const crowd = Math.min(1, Math.max(0.45, (w * h) / (900 * 700)));
  // how hard things are thrown, by the height they have to cross
  const reach = Math.sqrt(h / 700);
  const bits: Bit[] = [];
  const bit = (kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): Bit => ({
    kind,
    x,
    y,
    px: x,
    py: y,
    vx,
    vy,
    age: 0,
    life,
    size,
    color,
    spin: between(0, Math.PI * 2),
    turn: between(-12, 12)
  });

  /** both lower corners fire up and inwards */
  const volley = () => {
    const n = Math.round(70 * crowd);
    for (const side of [0, 1]) {
      for (let i = 0; i < n; i++) {
        const angle = between(0.87, 1.4); // 50 to 80 degrees up from the floor
        const speed = between(600, 1150) * reach;
        const vx = Math.cos(angle) * speed * (side ? -1 : 1);
        bits.push(bit(CONFETTI, side ? w : 0, h, vx, -Math.sin(angle) * speed, BIT_SECONDS, between(6, 11), pick()));
      }
    }
  };

  /** a rocket from the floor to a peak in the upper half */
  const rocket = () => {
    const peak = between(0.14, 0.45) * h;
    const vy = -Math.sqrt(2 * 600 * (h - peak));
    bits.push(bit(ROCKET, between(0.15, 0.85) * w, h, between(-30, 30), vy, -vy / 600, 3, pick()));
  };

  /** a rocket's burst: sparks of one colour, with a few of a second */
  const burst = (x: number, y: number, color: string) => {
    const other = pick();
    const n = Math.round(72 * crowd);
    for (let i = 0; i < n; i++) {
      const angle = between(0, Math.PI * 2);
      const speed = between(110, 430) * Math.max(0.75, reach);
      bits.push(bit(SPARK, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, between(0.9, 1.5), between(2.2, 3.6), i % 5 === 0 ? other : color));
    }
  };

  let volleys = 0;
  let rockets = 0;
  let rain = 0;
  let t = 0;
  let last: number | null = null;
  let frame = 0;
  let live = true;

  const stop = () => {
    if (!live) return;
    live = false;
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    frame = 0;
    if (typeof removeEventListener === 'function') removeEventListener('resize', onResize);
    g.clearRect(0, 0, w, h);
  };

  const tick = (now: number) => {
    if (!live) return;
    // a tab left and come back to plays on from where it was, a frame at a time
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    t += dt;

    while (volleys < VOLLEYS_AT.length && t >= VOLLEYS_AT[volleys]) {
      volley();
      volleys++;
    }
    while (rockets < ROCKETS_AT.length && t >= ROCKETS_AT[rockets]) {
      rocket();
      rockets++;
    }
    if (t < SHOW_SECONDS) {
      rain += 60 * crowd * dt;
      while (rain >= 1) {
        rain--;
        bits.push(bit(CONFETTI, between(0, w), -12, between(-40, 40), between(80, 220), BIT_SECONDS, between(6, 10), pick()));
      }
    }

    g.clearRect(0, 0, w, h);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.age += dt;
      b.px = b.x;
      b.py = b.y;
      if (b.kind === CONFETTI) {
        b.vy += 900 * dt;
        b.vx *= 1 - Math.min(1, 1.2 * dt);
        b.vy *= 1 - Math.min(1, 0.6 * dt);
        b.spin += b.turn * dt;
      } else if (b.kind === SPARK) {
        b.vy += 260 * dt;
        b.vx *= 1 - Math.min(1, 1.6 * dt);
        b.vy *= 1 - Math.min(1, 1.6 * dt);
      } else {
        b.vy += 600 * dt;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const spent = b.age >= b.life || b.y > h + 24 || b.x < -40 || b.x > w + 40 || (b.kind === ROCKET && b.vy >= 0);
      if (spent) {
        bits.splice(i, 1);
        if (b.kind === ROCKET) burst(b.x, b.y, b.color);
        continue;
      }
      if (b.kind === CONFETTI) {
        // a flat piece turning: its width comes and goes
        const flat = Math.max(0.15, Math.abs(Math.cos(b.spin)));
        g.globalAlpha = 1;
        g.fillStyle = b.color;
        g.fillRect(b.x - (b.size * flat) / 2, b.y - b.size * 0.3, b.size * flat, b.size * 0.6);
      } else {
        g.globalAlpha = b.kind === SPARK ? Math.max(0, 1 - b.age / b.life) : 1;
        g.strokeStyle = b.color;
        g.lineWidth = b.size;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(b.px, b.py);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
    }
    g.globalAlpha = 1;

    if (t >= SHOW_SECONDS && rockets >= ROCKETS_AT.length && bits.length === 0) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return { stop, running: () => live };
}
