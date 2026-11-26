/**
 * The query check, /admin?check (admin.ts, handleAdmin), added on 25
 * November 2026: every query the dashboard asks the Analytics Engine SQL
 * API, run once against the real dataset, each with whether the API
 * accepted it, how many rows came back, how many of them the page's own
 * reader keeps, the columns the answer had, its first row, and the
 * error's text if any. Most of the dashboard's queries were only ever run
 * against the tests' stand-in; this is where the owner sees them run on
 * real data (docs/online-goals.md, "The query check").
 *
 * Behind the same Access check as the page. The account id and the token
 * never reach the page: they are taken out of any text the API sends back.
 * The rows are the dashboard's own sums, which name no player.
 */

/** one query to check: its name on the page, its SQL, and how many of an answer's rows the page's reader keeps */
export interface QueryCheck {
  name: string;
  sql: string;
  /** what the page reads of the answer: the rows it keeps */
  kept: (answer: unknown) => number;
  /** a word on what window it runs over, when that differs from the page's */
  note?: string;
}

/** a database read the page makes, to check beside the queries: how many rows it gave, or why not */
export interface DatabaseCheck {
  name: string;
  run: () => Promise<{ ok: true; rows: number } | { ok: false; error: string }>;
}

export interface CheckResult {
  name: string;
  sql: string;
  note?: string;
  /** the API's HTTP status; 0 when it could not be reached */
  status: number;
  accepted: boolean;
  rows: number | null;
  kept: number | null;
  /** the answer's columns, name and type, as its meta says */
  columns: string[];
  /** the first row, as JSON, cut to 400 characters */
  first: string;
  error: string;
  ms: number;
}

export interface DatabaseResult {
  name: string;
  ok: boolean;
  rows: number | null;
  error: string;
}

/** the text with the secrets taken out, cut to `max` characters */
export function redact(text: string, secrets: (string | undefined)[], max = 600): string {
  let out = text;
  for (const s of secrets) if (s) out = out.split(s).join('[secret]');
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

/** the error the API gave: its errors' messages when it answers JSON, else its text */
function errorOf(text: string): string {
  try {
    const j = JSON.parse(text) as { errors?: { message?: unknown }[] };
    const messages = (j.errors ?? []).map((e) => (typeof e?.message === 'string' ? e.message : '')).filter(Boolean);
    if (messages.length) return messages.join('; ');
  } catch {
    // not JSON: the text itself
  }
  return text;
}

/** runs each query in turn, so one's time and error are its own */
export async function runChecks(
  checks: QueryCheck[],
  doFetch: typeof fetch,
  api: string,
  token: string,
  secrets: (string | undefined)[],
  clock: () => number = Date.now
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const c of checks) {
    const started = clock();
    const result: CheckResult = { name: c.name, sql: c.sql, note: c.note, status: 0, accepted: false, rows: null, kept: null, columns: [], first: '', error: '', ms: 0 };
    try {
      const res = await doFetch(api, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'text/plain; charset=utf-8' },
        body: c.sql
      });
      result.status = res.status;
      const text = await res.text();
      if (!res.ok) result.error = redact(errorOf(text), secrets);
      else {
        let answer: unknown;
        try {
          answer = JSON.parse(text);
        } catch {
          result.error = redact(`The answer is not JSON: ${text}`, secrets);
        }
        const data = (answer as { data?: unknown })?.data;
        if (answer !== undefined && !Array.isArray(data)) result.error = redact(`The answer has no data: ${text}`, secrets);
        else if (Array.isArray(data)) {
          result.accepted = true;
          result.rows = data.length;
          result.kept = c.kept(answer);
          const meta = (answer as { meta?: unknown }).meta;
          if (Array.isArray(meta)) result.columns = meta.map((m) => `${String((m as { name?: unknown })?.name ?? '?')} ${String((m as { type?: unknown })?.type ?? '')}`.trim());
          if (data.length) result.first = redact(JSON.stringify(data[0]), secrets, 400);
        }
      }
    } catch (err) {
      result.error = redact(`The API could not be reached: ${String(err)}`, secrets);
    }
    result.ms = Math.max(0, clock() - started);
    results.push(result);
  }
  return results;
}

/** runs each database read */
export async function runDatabaseChecks(checks: DatabaseCheck[]): Promise<DatabaseResult[]> {
  const out: DatabaseResult[] = [];
  for (const c of checks) {
    try {
      const r = await c.run();
      out.push(r.ok ? { name: c.name, ok: true, rows: r.rows, error: '' } : { name: c.name, ok: false, rows: null, error: r.error });
    } catch (err) {
      out.push({ name: c.name, ok: false, rows: null, error: String(err).slice(0, 300) });
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** the check's page */
export function renderCheck(results: CheckResult[], database: DatabaseResult[] | null, generatedAt: string, style: string): string {
  const accepted = results.filter((r) => r.accepted).length;
  const short = results.filter((r) => r.accepted && r.kept !== r.rows).length;
  const verdict = (r: CheckResult) => (!r.accepted ? 'Refused' : r.kept !== r.rows ? 'Accepted, rows not all read' : 'Accepted');
  const rows = results
    .map(
      (r) =>
        `      <tr><td>${esc(r.name)}</td><td>${esc(verdict(r))}</td><td>${r.status || '—'}</td><td>${r.rows ?? '—'}</td><td>${r.kept ?? '—'}</td><td>${r.ms} ms</td></tr>`
    )
    .join('\n');
  const details = results
    .map(
      (r) => `    <h3>${esc(r.name)}: ${esc(verdict(r))}</h3>
    ${r.note ? `<p class="meta">${esc(r.note)}</p>` : ''}
    <pre>${esc(r.sql)}</pre>
    ${r.error ? `<p>Error: <code>${esc(r.error)}</code></p>` : ''}
    ${r.columns.length ? `<p class="meta">Columns: ${esc(r.columns.join(', '))}</p>` : ''}
    ${r.first ? `<p class="meta">First row: <code>${esc(r.first)}</code></p>` : r.accepted ? '<p class="meta">No rows: the query is accepted, and nothing in its window matched.</p>' : ''}`
    )
    .join('\n');
  const db =
    database === null
      ? '<p class="meta">No database is bound: its reads were not checked.</p>'
      : `<div class="wide"><table>
      <thead><tr><th>Database read</th><th>Answer</th><th>Rows</th><th>Error</th></tr></thead>
      <tbody>
${database.map((d) => `      <tr><td>${esc(d.name)}</td><td>${d.ok ? 'Read' : 'Failed'}</td><td>${d.rows ?? '—'}</td><td>${esc(d.error)}</td></tr>`).join('\n')}
      </tbody>
    </table></div>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>sudokUI admin: query check</title>
    <style>${style}
pre{white-space:pre-wrap;word-break:break-word;background:#1a1d29;border:1px solid #2a2e3f;border-radius:8px;padding:8px 10px;font-size:12px}
code{word-break:break-word}h3{font-size:15px;margin:22px 0 6px}</style>
  </head>
  <body>
    <h1>sudokUI admin: query check</h1>
    <p class="meta">Every query the dashboard asks the Analytics Engine SQL API, run once now against the real dataset. Generated ${esc(generatedAt)}. <a href="/admin">Back to the dashboard</a>.</p>
    <p>${accepted} of ${results.length} accepted${short ? `; ${short} with rows the page's reader leaves out` : ''}.</p>
    <div class="wide"><table>
      <thead><tr><th>Query</th><th>Answer</th><th>Status</th><th>Rows</th><th>Read by the page</th><th>Time</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table></div>
    <p class="meta">Accepted: the API answered 200 with rows of data, perhaps none. Rows: how many came back. Read by the page: how many of them the dashboard's own reader keeps; fewer means a column it reads is missing or of another type, and that table would show less than the data holds. Refused: the API's error is below, with the query.</p>
    <h2>The database</h2>
    ${db}
    <h2>Each query</h2>
${details}
  </body>
</html>
`;
}
