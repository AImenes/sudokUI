-- A result row keeps no more than the privacy page says
-- (src/content/privacy.ts): the time in its 15-second step, capped at two
-- hours like the histogram, and the day it arrived, not the second; and
-- not where the app ran. The Worker writes rows that way from 21 October
-- 2026 (worker/daily.ts, checkResult); this rounds the rows written
-- before. Applied with
--   npx wrangler d1 migrations apply sudokui-db --remote
-- Running it twice changes nothing.
UPDATE daily_result
SET seconds = MIN(seconds / 15, 480) * 15,
    created_at = (created_at / 86400) * 86400,
    source = NULL;
