// The report dialog: "Send feedback" from the footer and the Info dialog,
// and "Looks wrong?" from the hint panel, which brings the hint along.
// What it sends is in src/ui/report.ts and, word for word, on the privacy
// page (src/content/privacy.ts); the Worker e-mails it to the person who
// runs sudokUI and keeps no copy (worker/feedback.ts). When the route
// cannot take it, the same report can go as a letter from the player's
// own mail app, or as a GitHub issue.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './Dialogs';
import { useT, rich, langRoot } from '../content/i18n';
import { useGame } from '../state/gameStore';
import { useSettings } from '../state/settings';
import type { Step } from '../engine/steps';
import { PRIVACY_URL } from '../content/staticRoutes';
import {
  APP_VERSION,
  FEEDBACK_ADDRESS,
  MESSAGE_MAX,
  MIN_OPEN_MS,
  ReportKind,
  ReportBody,
  ReportOutcome,
  isReplyAddress,
  asciiAddress,
  reportBoard,
  reportHint,
  sendReport,
  mailtoOf
} from './report';

const ISSUES = 'https://github.com/AImenes/sudokUI/issues/new/choose';

/** what was written in a dialog closed before it was sent, and what it was about: a stray tap
 *  outside it loses nothing, and a comment on one hint never turns up under another */
let draft: { about: Step | null; message: string; reply: string } = { about: null, message: '', reply: '' };

export function ReportDialog({ kind: initial, hint, onClose }: { kind: ReportKind; hint?: Step | null; onClose: () => void }) {
  const t = useT();
  const opened = useRef(Date.now());
  const [kind, setKind] = useState<ReportKind>(initial);
  const [message, setMessageState] = useState(draft.about === (hint ?? null) ? draft.message : '');
  const [reply, setReplyState] = useState(draft.reply);
  const setMessage = (v: string) => {
    draft = { ...draft, about: hint ?? null, message: v };
    setMessageState(v);
  };
  const setReply = (v: string) => {
    draft = { ...draft, reply: v };
    setReplyState(v);
  };
  // a dialog closed while its report waits to go sends nothing
  const closed = useRef(false);
  useEffect(() => {
    // set again on every mount: development's StrictMode mounts twice
    closed.current = false;
    return () => {
      closed.current = true;
    };
  }, []);
  // the field people never see: only a robot fills it in
  const [website, setWebsite] = useState('');
  // the board goes with a problem or a hint, not with an idea, until the player says otherwise
  const [boardChoice, setWithBoard] = useState<boolean | null>(null);
  // the browser's user agent says more than its name (the system, at
  // times the device), so it goes only when asked for
  const [withBrowser, setWithBrowser] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | ReportOutcome>('idle');
  // what the report is about, as it stood when the dialog opened; a hint
  // with the settings it was found under
  const about = useMemo(() => {
    const g = useGame.getState();
    const found = g.hintWith ?? { useUniqueness: useSettings.getState().useUniqueness, markContract: g.markContract };
    return {
      board: reportBoard(g.info, g.cells, g.autoCandidates),
      hint: hint && g.info ? reportHint(hint, g.info.solution, found.useUniqueness, found.markContract) : undefined
    };
  }, [hint]);
  const isHint = kind === 'hint' && !!about.hint;
  const withBoard = boardChoice ?? kind !== 'idea';
  const address = asciiAddress(reply.trim());
  const replyOk = address === '' || isReplyAddress(address);
  const busy = state === 'sending';
  const enough = isHint || message.trim().length >= 3;

  const body = (): ReportBody => ({
    kind: isHint ? 'hint' : kind === 'hint' ? 'problem' : kind,
    message: message.trim(),
    ...(address ? { reply: address } : {}),
    version: APP_VERSION,
    lang: t.lang,
    openedMs: Date.now() - opened.current,
    ...(website ? { website } : {}),
    ...(isHint ? { hint: about.hint } : {}),
    ...(withBoard && about.board ? { board: about.board } : {}),
    ...(withBrowser && typeof navigator !== 'undefined' ? { browser: navigator.userAgent.slice(0, 400) } : {})
  });

  const send = async () => {
    if (!enough || !replyOk || state === 'sending') return;
    setState('sending');
    // the Worker takes a report sent within two seconds of the dialog
    // opening for a robot's; a person who is quick (a hint report needs
    // no words) waits out the rest here instead
    const wait = MIN_OPEN_MS + 100 - (Date.now() - opened.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (closed.current) return;
    const outcome = await sendReport(body());
    if (outcome === 'sent') draft = { about: null, message: '', reply: '' };
    if (!closed.current) setState(outcome);
  };

  // the same report as a letter, for when the route cannot take it
  const letter = () => {
    const b = body();
    const lines = [b.message, '', `sudokUI ${b.version} · ${b.lang}`];
    if (b.hint) lines.push(`${b.hint.tech}: ${b.hint.text}`);
    if (b.board) lines.push(`https://sudokui.app/p/${b.board.puzzle}#s=${b.board.position}`);
    return mailtoOf(`[sudokUI] ${isHint ? t('A hint looks wrong') : kind === 'idea' ? t('An idea') : t('Something is not working')}`, lines.join('\n'));
  };
  const elsewhere = {
    address: <a href={letter()}>{FEEDBACK_ADDRESS}</a>,
    github: (
      <a href={ISSUES} target="_blank" rel="noopener">
        GitHub
      </a>
    )
  };

  const privacy = (
    <a href={`${langRoot(t.lang)}${PRIVACY_URL.slice(1)}`} target="_blank" rel="noopener">
      {t('the privacy page')}
    </a>
  );

  // one live region, in the same place on both screens, whose text alone
  // changes: what a screen reader announces as the report goes
  const sentText = address ? t('Your report is on its way. An answer will come to the address you gave.') : t('Your report is on its way.');
  const status = (
    <p className="sr-only" role="status">
      {state === 'sending' ? t('Sending…') : state === 'sent' ? sentText : ''}
    </p>
  );

  if (state === 'sent') {
    return (
      <Modal title={t('Thank you')} onClose={onClose}>
        {status}
        {/* seen; the status above is what is heard */}
        <p className="dialog-note" aria-hidden="true">
          {sentText}
        </p>
        <div className="hint-actions">
          <button onClick={onClose} autoFocus>
            {t('Close')}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isHint ? t('Report a hint') : t('Send feedback')} onClose={onClose}>
      {status}
      <p className="dialog-note">
        {rich(t('It goes by e-mail to Anders Imenes, who makes sudokUI; the server keeps no copy. What is sent, exactly: {privacy}.'), {
          privacy
        })}
      </p>
      {isHint ? (
        <div className="report-hint">
          <strong>{t.tech(hint!.tech)}</strong>
          <code>{about.hint!.text}</code>
        </div>
      ) : (
        <div className="report-kinds" role="radiogroup" aria-label={t('What is it about?')}>
          {(['problem', 'idea'] as const).map((k) => (
            <label key={k} className="tick-row">
              <input type="radio" name="report-kind" checked={kind === k || (k === 'problem' && kind === 'hint')} onChange={() => setKind(k)} disabled={busy} />
              <span>{k === 'problem' ? t('Something is not working') : t('An idea')}</span>
            </label>
          ))}
        </div>
      )}
      <label className="report-field">
        <span>{isHint ? t('What looks wrong? (optional)') : t('What happened, or what would you like?')}</span>
        <textarea rows={4} maxLength={MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} disabled={busy} />
      </label>
      <label className="report-field">
        <span>{t('Your e-mail address, if you want an answer (optional)')}</span>
        <input type="email" autoComplete="email" maxLength={254} value={reply} onChange={(e) => setReply(e.target.value)} disabled={busy} />
      </label>
      {!replyOk && (
        <p className="dialog-error" role="alert">
          {t('That does not look like an e-mail address.')}
        </p>
      )}
      {about.board && (
        <label className="tick-row">
          <input type="checkbox" checked={withBoard} onChange={(e) => setWithBoard(e.target.checked)} disabled={busy} />
          <span className="setting-text">
            <span>{t('Include the board')}</span>
            <small>{t('As it stands, as a position link: it shows where the problem is.')}</small>
          </span>
        </label>
      )}
      <label className="tick-row">
        <input type="checkbox" checked={withBrowser} onChange={(e) => setWithBrowser(e.target.checked)} disabled={busy} />
        <span className="setting-text">
          <span>{t('Include my browser’s details')}</span>
          <small>{t('Its user agent: the browser and the system, sometimes the device model. The app’s version and language always go with a report.')}</small>
        </span>
      </label>
      <div className="hp" aria-hidden="true">
        <input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {busy && (
        <p className="dialog-note" aria-hidden="true">
          {t('Sending…')}
        </p>
      )}
      {state === 'refused' && (
        <p className="dialog-error" role="alert">
          {rich(t('The report could not be read. Please check what you wrote, or write to {address} or open an issue on {github}.'), elsewhere)}
        </p>
      )}
      {state === 'unavailable' && (
        <p className="dialog-error" role="alert">
          {rich(t('It could not be sent right now. Write to {address} instead, or open an issue on {github}.'), elsewhere)}
        </p>
      )}
      <div className="hint-actions">
        <button onClick={send} disabled={!enough || !replyOk || busy}>
          {t('Send||send a report')}
        </button>
        <button className="ghost" onClick={onClose}>
          {t('Cancel')}
        </button>
      </div>
    </Modal>
  );
}
