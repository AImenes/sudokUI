// The Share dialog's picture of the board (docs/reach-plan-2026-11.md,
// build item 3): a live preview, three ticks (the candidates, the player's
// colours, the line naming the site) and the buttons that hand the PNG on.
// The picture is drawn on the device (src/content/boardImage.ts), always
// light, and made into a PNG as soon as the dialog opens or a tick
// changes (src/ui/boardPng.ts), so a tap hands it to the share sheet
// before anything is awaited (src/ui/send.ts). On a phone or a tablet
// that shares files, one button opens the sheet; elsewhere the picture is
// copied or saved as a file. The picture itself never goes to sudokui.app;
// the caller counts that one went, by kind and way only.
import React, { useEffect, useMemo, useState } from 'react';
import type { Step } from '../engine/steps';
import type { Frame } from '../engine/hintFrames';
import type { MarkContract } from '../state/gameStore';
import { positionSvg } from '../content/boardImage';
import type { PictureCell } from '../content/boardImage';
import { svgToPng } from './boardPng';
import { sendFile, saveFile, copyImage, canShareFile, canCopyImage } from './send';
import type { Sent } from './send';
import { useT } from '../content/i18n';

/** where the ticks are remembered, on this device only */
export const IMAGE_KEY = 'sudokui-image-v1';

/** what the picture shows: each on until the player turns it off */
export interface ImageChoice {
  candidates: boolean;
  colours: boolean;
  footer: boolean;
}

/** the ticks as last left on this device; storage that cannot be read leaves them all on */
export function readChoice(): ImageChoice {
  try {
    const kept = JSON.parse(localStorage.getItem(IMAGE_KEY) ?? '{}') as Partial<ImageChoice> | null;
    return { candidates: kept?.candidates !== false, colours: kept?.colours !== false, footer: kept?.footer !== false };
  } catch {
    return { candidates: true, colours: true, footer: true };
  }
}

function keepChoice(choice: ImageChoice): void {
  try {
    localStorage.setItem(IMAGE_KEY, JSON.stringify(choice));
  } catch {
    // private browsing or full storage: the choice holds for this dialog only
  }
}

/** a PNG of nothing, to ask the device whether its share sheet takes pictures before the real one is made */
const PROBE = typeof File === 'function' ? new File([new Uint8Array(0)], 'sudokui.png', { type: 'image/png' }) : null;

export function ShareImage({
  cells,
  autoCandidates,
  markContract,
  step,
  frame,
  footer,
  name,
  onSent
}: {
  cells: readonly PictureCell[];
  autoCandidates: boolean;
  markContract: MarkContract;
  /** a hint drawn on the board, at the walk's frame shown or in full */
  step?: Step | null;
  frame?: Frame | null;
  /** the line under the board when the tick is on */
  footer: string;
  /** the file's name, without the technique's: 'sudokui-hint.png' */
  name: string;
  /** a picture went: shared, copied or saved */
  onSent: (outcome: Sent) => void;
}) {
  const t = useT();
  const [choice, setChoice] = useState(readChoice);
  const coloured = cells.some((c) => c.colors.length > 0);
  const svg = useMemo(
    () =>
      positionSvg({
        cells,
        autoCandidates,
        markContract,
        candidates: choice.candidates,
        colours: coloured && choice.colours,
        step,
        frame,
        footer: choice.footer ? footer : undefined,
        title: t('Picture of a sudoku board')
      }),
    [cells, autoCandidates, markContract, choice, coloured, step, frame, footer, t]
  );
  const preview = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, [svg]);
  // the PNG, made as soon as the picture changes, so a tap has it at hand
  const [file, setFile] = useState<File | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    let live = true;
    setFile(null);
    svgToPng(svg)
      .then((png) => live && setFile(new File([png], name, { type: 'image/png' })))
      .catch(() => live && setBroken(true));
    return () => {
      live = false;
    };
  }, [svg, name]);
  const [done, setDone] = useState<'' | 'copied' | 'saved'>('');
  const sheet = useMemo(() => !!PROBE && canShareFile(PROBE), []);
  const copyable = useMemo(() => canCopyImage(), []);

  const tick = (key: keyof ImageChoice) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...choice, [key]: e.target.checked };
    setChoice(next);
    keepChoice(next);
  };
  const after = (outcome: Sent) => {
    onSent(outcome);
    if (outcome !== 'copied' && outcome !== 'saved') return;
    setDone(outcome);
    setTimeout(() => setDone(''), 2000);
  };
  // straight from the tap: the file is made, so nothing is awaited before the sheet opens
  const share = () => file && void sendFile(file).then(after);
  const copy = () => file && void copyImage(file).then(after);
  const save = () => file && after(saveFile(file));

  return (
    <div className="share-image">
      <img className="share-image-preview" src={preview} alt={t('The picture as it will be shared')} />
      <div className="share-image-side">
        <label className="tick-row">
          <input type="checkbox" checked={choice.candidates} onChange={tick('candidates')} />
          <span className="setting-text">
            <span>{t('Candidates')}</span>
          </span>
        </label>
        {coloured && (
          <label className="tick-row">
            <input type="checkbox" checked={choice.colours} onChange={tick('colours')} />
            <span className="setting-text">
              <span>{t('Your colours')}</span>
            </span>
          </label>
        )}
        <label className="tick-row">
          <input type="checkbox" checked={choice.footer} onChange={tick('footer')} />
          <span className="setting-text">
            <span>{t('Footer')}</span>
            <small>{footer}</small>
          </span>
        </label>
        {broken ? (
          <p className="dialog-error">{t('This browser could not make the picture.')}</p>
        ) : (
          <div className="hint-actions">
            {sheet ? (
              <button onClick={share} disabled={!file}>
                🖼️ {t('Share image')}
              </button>
            ) : (
              <>
                {copyable && (
                  <button onClick={copy} disabled={!file}>
                    {done === 'copied' ? `✓ ${t('Copied')}` : `🖼️ ${t('Copy image')}`}
                  </button>
                )}
                <button className={copyable ? 'ghost' : undefined} onClick={save} disabled={!file}>
                  {done === 'saved' ? `✓ ${t('Saved')}` : t('Save image')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
