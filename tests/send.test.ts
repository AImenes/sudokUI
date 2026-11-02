/**
 * Sending a link or a line to someone (src/ui/send.ts): a phone or tablet
 * gets its own share sheet, with the clipboard as the fallback when the
 * sheet is missing or refuses; a closed sheet is the player's answer and
 * copies nothing; a mouse-first screen copies as before; and what goes
 * into another tool is always copied. A picture of the board goes as a
 * file: the sheet on a phone that shares files, asked for in the same
 * moment as the tap; else a download; or the clipboard, as a PNG.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sendText, copyText, sendFile, copyImage, canShareFile } from '../src/ui/send';

const originalNavigator = globalThis.navigator;
let shared: ShareData[] = [];
let copied: string[] = [];

/** the device as the helper sees it */
function device(opts: { touch: boolean; share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean; clipboard?: boolean | 'refuses' }) {
  (globalThis as any).matchMedia = (q: string) => ({ matches: q === '(pointer: coarse)' && opts.touch });
  const nav: Record<string, unknown> = {};
  if (opts.share) nav.share = (d: ShareData) => (shared.push(d), opts.share!(d));
  if (opts.canShare) nav.canShare = opts.canShare;
  if (opts.clipboard !== false) {
    nav.clipboard = {
      writeText: (s: string) => (opts.clipboard === 'refuses' ? Promise.reject(new Error('not allowed')) : (copied.push(s), Promise.resolve()))
    };
  }
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
}
const abort = () => Promise.reject(Object.assign(new Error('closed'), { name: 'AbortError' }));
const refuse = () => Promise.reject(Object.assign(new Error('no activation'), { name: 'NotAllowedError' }));
const TEXT = 'sudokUI Daily #15 · Hard (1520) · 9:41 · https://sudokui.app/daily/2026-10-21';

beforeEach(() => {
  shared = [];
  copied = [];
});
afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
  delete (globalThis as any).matchMedia;
  delete (globalThis as any).document;
  delete (globalThis as any).ClipboardItem;
});

describe('sending to someone', () => {
  it('opens the share sheet on a phone, with the text and its link, and copies nothing', async () => {
    device({ touch: true, share: () => Promise.resolve() });
    const sending = sendText(TEXT);
    // the sheet is asked for in the same moment as the tap, before anything
    // is awaited: a browser opens it only while the tap still counts
    expect(shared).toEqual([{ text: TEXT }]);
    expect(await sending).toBe('shared');
    expect(copied).toEqual([]);
  });

  it('hands a bare link over as a link', async () => {
    device({ touch: true, share: () => Promise.resolve() });
    const link = 'https://sudokui.app/p/..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
    expect(await sendText(link, 'url')).toBe('shared');
    expect(shared).toEqual([{ url: link }]);
  });

  it('takes a closed sheet as the answer: nothing copied', async () => {
    device({ touch: true, share: abort });
    expect(await sendText(TEXT)).toBe('cancelled');
    expect(copied).toEqual([]);
  });

  it('copies nothing on a second tap while the sheet is opening', async () => {
    device({ touch: true, share: () => Promise.reject(Object.assign(new Error('a share is already in progress'), { name: 'InvalidStateError' })) });
    expect(await sendText(TEXT)).toBe('cancelled');
    expect(copied).toEqual([]);
  });

  it('copies when the sheet refuses, or says it cannot take the text', async () => {
    device({ touch: true, share: refuse });
    expect(await sendText(TEXT)).toBe('copied');
    expect(copied).toEqual([TEXT]);
    copied = [];
    shared = [];
    device({ touch: true, share: () => Promise.resolve(), canShare: () => false });
    expect(await sendText(TEXT)).toBe('copied');
    expect(shared).toEqual([]);
    expect(copied).toEqual([TEXT]);
  });

  it('copies on a screen whose main pointer is a mouse, even where a share sheet exists', async () => {
    device({ touch: false, share: () => Promise.resolve() });
    expect(await sendText(TEXT)).toBe('copied');
    expect(shared).toEqual([]);
    expect(copied).toEqual([TEXT]);
  });

  it('copies on a phone without a share sheet', async () => {
    device({ touch: true });
    expect(await sendText(TEXT)).toBe('copied');
    expect(copied).toEqual([TEXT]);
  });

  it('says so when neither the sheet nor the clipboard took it', async () => {
    device({ touch: true, share: refuse, clipboard: false });
    expect(await sendText(TEXT)).toBe('failed');
    device({ touch: false, clipboard: 'refuses' });
    expect(await sendText(TEXT)).toBe('failed');
  });
});

describe('copying for another tool', () => {
  it('copies, never a sheet, even on a phone', async () => {
    device({ touch: true, share: () => Promise.resolve() });
    expect(await copyText('..3.2.6..')).toBe('copied');
    expect(shared).toEqual([]);
    expect(copied).toEqual(['..3.2.6..']);
  });
});

describe('sending a picture of the board', () => {
  const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'sudokui-board.png', { type: 'image/png' });
  let saved: string[] = [];
  /** a page that records the downloads it starts: an <a download> clicked */
  function page() {
    saved = [];
    (globalThis as any).document = {
      createElement: () => {
        const a: Record<string, unknown> = { style: {} };
        a.click = () => saved.push(a.download as string);
        a.remove = () => undefined;
        return a;
      },
      body: { appendChild: () => undefined }
    };
  }
  const takesFiles = (d: ShareData) => !!d.files?.length;
  beforeEach(page);

  it('opens the share sheet on a phone that shares files, in the same moment as the tap', async () => {
    device({ touch: true, share: () => Promise.resolve(), canShare: takesFiles });
    expect(canShareFile(PNG)).toBe(true);
    const sending = sendFile(PNG);
    // asked for before anything is awaited: the file was made when the dialog opened
    expect(shared).toEqual([{ files: [PNG] }]);
    expect(await sending).toBe('shared');
    expect(saved).toEqual([]);
  });

  it('takes a closed sheet as the answer: nothing saved', async () => {
    device({ touch: true, share: abort, canShare: takesFiles });
    expect(await sendFile(PNG)).toBe('cancelled');
    expect(saved).toEqual([]);
  });

  it('saves it as a download where the sheet takes no files, refuses, or is not the way in', async () => {
    // a sheet for text and links only
    device({ touch: true, share: () => Promise.resolve(), canShare: (d) => !d.files });
    expect(canShareFile(PNG)).toBe(false);
    expect(await sendFile(PNG)).toBe('saved');
    expect(shared).toEqual([]);
    expect(saved).toEqual(['sudokui-board.png']);
    // no canShare at all: a sheet that cannot say whether it takes files is not asked
    page();
    device({ touch: true, share: () => Promise.resolve() });
    expect(await sendFile(PNG)).toBe('saved');
    expect(shared).toEqual([]);
    // the sheet refuses
    page();
    device({ touch: true, share: refuse, canShare: takesFiles });
    expect(await sendFile(PNG)).toBe('saved');
    expect(saved).toEqual(['sudokui-board.png']);
    // a mouse-first screen, though its browser could share the file
    page();
    shared = [];
    device({ touch: false, share: () => Promise.resolve(), canShare: takesFiles });
    expect(await sendFile(PNG)).toBe('saved');
    expect(shared).toEqual([]);
    expect(saved).toEqual(['sudokui-board.png']);
  });

  it('copies it as a PNG where the clipboard takes pictures, and says so where it does not', async () => {
    const written: unknown[] = [];
    (globalThis as any).ClipboardItem = class {
      constructor(public items: Record<string, Blob>) {}
    };
    device({ touch: false });
    (navigator as any).clipboard.write = (items: unknown[]) => (written.push(...items), Promise.resolve());
    expect(await copyImage(PNG)).toBe('copied');
    expect(written).toHaveLength(1);
    expect((written[0] as { items: Record<string, Blob> }).items).toEqual({ 'image/png': PNG });
    // the clipboard refuses
    (navigator as any).clipboard.write = () => Promise.reject(new Error('not allowed'));
    expect(await copyImage(PNG)).toBe('failed');
    // a browser with no ClipboardItem
    delete (globalThis as any).ClipboardItem;
    expect(await copyImage(PNG)).toBe('failed');
  });
});
