// Sending a link or a line to someone (the Share dialog's links, the win
// screen's challenge and daily line): on a phone or a tablet, the device's
// own share sheet (navigator.share), which puts it in a chat in one tap;
// elsewhere, and wherever the sheet is missing or refuses, the clipboard,
// as before. A picture of the board (the Share dialog's image) goes the
// same way as a file: the sheet on a phone or a tablet that shares files,
// else the player copies it or saves it as a download. Nothing goes to
// sudokui.app: the sheet hands it to the app the player picks. What the
// caller makes of the outcome is its own: the dialogs count a link or a
// picture that went as a share, by kind and way only
// (src/state/telemetry.ts, shared).

/** what became of the text or the picture */
export type Sent = 'shared' | 'copied' | 'saved' | 'cancelled' | 'failed';

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

/** a touch-first device whose share sheet takes this file */
export function canShareFile(file: File): boolean {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav || !touchFirst() || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Hands a file on: the share sheet on a touch device that shares files,
 * else a download. Called straight from a tap with the file already made:
 * the sheet opens only while the browser still counts the tap, so nothing
 * may be awaited before this. A closed sheet is the player's answer, and
 * nothing is saved behind their back; a sheet that refuses saves it.
 */
export async function sendFile(file: File): Promise<Sent> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && (e.name === 'AbortError' || e.name === 'InvalidStateError')) return 'cancelled';
    }
  }
  return saveFile(file);
}

/** saves the file where the browser puts downloads, under its own name */
export function saveFile(file: File): Sent {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return 'failed';
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // the download has its own copy once it starts
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}

/** the clipboard can take a picture: a browser with ClipboardItem and clipboard.write */
export function canCopyImage(): boolean {
  return typeof ClipboardItem === 'function' && typeof navigator !== 'undefined' && typeof navigator.clipboard?.write === 'function';
}

/** puts a PNG on the clipboard, for pasting into a post or a chat on a computer */
export async function copyImage(png: Blob): Promise<Sent> {
  if (!canCopyImage()) return 'failed';
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return 'copied';
  } catch {
    return 'failed';
  }
}
