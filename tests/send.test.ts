/**
 * Sending a link or a line to someone (src/ui/send.ts): a phone or tablet
 * gets its own share sheet, with the clipboard as the fallback when the
 * sheet is missing or refuses; a closed sheet is the player's answer and
 * copies nothing; a mouse-first screen copies as before; and what goes
 * into another tool is always copied.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sendText, copyText } from '../src/ui/send';

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
