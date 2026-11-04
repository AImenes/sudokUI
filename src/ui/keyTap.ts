/**
 * A button pressed by a pointer, told apart from the click the browser
 * sends after the press (Controls.tsx: the number keys and Swap). A press
 * is handled by the pointer's own events, so that a hold can do something
 * other than a tap; the click that follows it is the same press again and
 * must not act twice. A click with no pointer press before it is a press
 * of its own: the keyboard's Enter or Space, or assistive technology.
 *
 * Browsers do not agree on what a tap sends. Chromium sends pointerdown,
 * pointerup, pointerout and pointerleave, then a click whose detail counts
 * the taps. iOS Safari sends the same pointer events, but its click may
 * come late (after the wait for a double tap), not at all (after a long
 * press, or when the page changed under the finger), or with a detail of
 * 0, as a keyboard's click has, and a pointerleave may come before the
 * pointerup. So the click is matched to the press it follows by time, not
 * by its detail, and whichever of the lift and the click says first that
 * the press was a tap makes it one: a tap counts once, never twice and
 * never not at all.
 */
export class TapGate<K> {
  /** the press under way: its key, and whether it has acted (a tap, or a hold that did its own thing) */
  private live: { key: K; acted: boolean } | null = null;
  /** the press that just ended, waiting for the click the browser may send after it */
  private ended: { key: K; at: number; acted: boolean } | null = null;

  /** how long after a press ends its click may still come, in ms (a double-tap wait is about 300) */
  constructor(private readonly windowMs = 1000) {}

  /** a pointer lands on the key */
  down(key: K): void {
    this.live = { key, acted: false };
    this.ended = null;
  }

  /** the key a pointer is pressing, if any */
  get pressing(): K | null {
    return this.live ? this.live.key : null;
  }

  /** the press did its own thing (a hold): neither its lift nor its click is a tap */
  spend(): void {
    if (this.live) this.live.acted = true;
  }

  /**
   * The press ends: the pointer lifts (on: over the key it landed on) or
   * leaves the key, or the browser takes the gesture. True when this lift
   * is the tap. An end for another key than the one pressed is not this
   * press's (a second finger's), and changes nothing.
   */
  up(key: K, on: boolean, at: number): boolean {
    const p = this.live;
    if (!p || p.key !== key) return false;
    this.live = null;
    const tap = on && !p.acted;
    this.ended = { key, at, acted: p.acted || tap };
    return tap;
  }

  /**
   * The browser's click on the key. True when it is a tap the pointer's
   * events did not count: a click with no press before it, or one after a
   * press that ended without acting (its pointerleave came first). The
   * click of a press that has acted is that press again, and false.
   */
  click(key: K, at: number): boolean {
    const p = this.live;
    if (p && p.key === key) {
      // the click before the lift: the click is the tap, and the lift is not
      const tap = !p.acted;
      p.acted = true;
      return tap;
    }
    const e = this.ended;
    // one click for each press: a second is a press of its own
    this.ended = null;
    if (e && e.key === key && at - e.at <= this.windowMs) return !e.acted;
    return true;
  }
}
