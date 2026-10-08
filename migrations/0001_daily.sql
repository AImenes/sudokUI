-- The shared daily's results (docs/online-goals.md, phase 2). Applied with
--   npx wrangler d1 migrations apply sudokui-db --remote
-- (and --local for wrangler dev). D1 holds results only: no identifier, no
-- IP, no cookie. Every query the Worker runs is on a primary key.

-- One row per submitted result. token is a random value the client makes
-- for the day and keeps next to its own local result, so a resubmit (an
-- offline retry, a second tap) is a no-op.
CREATE TABLE IF NOT EXISTS daily_result (
  puzzle_no    INTEGER NOT NULL,
  token        TEXT    NOT NULL,
  seconds      INTEGER NOT NULL,
  unassisted   INTEGER NOT NULL DEFAULT 0,
  hints        INTEGER NOT NULL DEFAULT 0,
  source       TEXT,              -- 'pwa' | 'tab'
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (puzzle_no, token)
) WITHOUT ROWID;

-- The histogram the statistics are read from: 15-second buckets, capped
-- at two hours (bucket 480), so a day is at most 481 rows however many
-- people play. Kept up to date on every accepted result.
CREATE TABLE IF NOT EXISTS daily_hist (
  puzzle_no    INTEGER NOT NULL,
  bucket       INTEGER NOT NULL,  -- min(floor(seconds / 15), 480)
  n            INTEGER NOT NULL,
  n_unassisted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (puzzle_no, bucket)
) WITHOUT ROWID;
