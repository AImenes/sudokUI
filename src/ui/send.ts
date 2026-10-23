// Sending a link or a line to someone (the Share dialog's links, the win
// screen's challenge and daily line): on a phone or a tablet, the device's
// own share sheet (navigator.share), which puts it in a chat in one tap;
// elsewhere, and wherever the sheet is missing or refuses, the clipboard,
// as before. The text never goes to sudokui.app: the sheet hands it to the
// app the player picks. What the caller makes of the outcome is its own:
// the dialogs count a link that went as a share, by kind and way only
// (src/state/telemetry.ts, shared).

/** what became of the text */
export type Sent = 'shared' | 'copied' | 'cancelled' | 'failed';

/** a touch screen is the main way in: a phone or a tablet, not a laptop with a touch screen */
function touchFirst(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/**
 * Hands the text on. Called straight from a tap: the share sheet opens only
 * while the browser still counts the tap, so nothing may be awaited before
 * this. A line with its link inside (a challenge, the daily's line) goes as
 * text, so a chat previews the link; a bare link goes as a link, which an
 * iPhone hands on as one (AirDrop opens it, the sheet shows its page).
 */
export async function sendText(text: string, as: 'text' | 'url' = 'text'): Promise<Sent> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && touchFirst() && typeof nav.share === 'function') {
    const data: ShareData = as === 'url' ? { url: text } : { text };
    if (typeof nav.canShare !== 'function' || nav.canShare(data)) {
      try {
        await nav.share(data);
        return 'shared';
      } catch (e) {
        // the player closed the sheet, or tapped again while it opened:
        // nothing more to do, and nothing copied behind their back
        if (e instanceof Error && (e.name === 'AbortError' || e.name === 'InvalidStateError')) return 'cancelled';
        // the sheet refused (not allowed here): the clipboard
      }
    }
  }
  return copyText(text);
}

/** puts the text on the clipboard: for what a person pastes into another tool, never a sheet */
export async function copyText(text: string): Promise<Sent> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clipboard) return 'failed';
  try {
    await clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
