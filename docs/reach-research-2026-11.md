# Reach research, November 2026 (raw)

_The four researchers of the reach workflow (wf_edd82915-e2c), 2 November 2026, kept as they reported so nothing is lost between sessions. The decisions drawn from them go in [online-goals.md](online-goals.md) (section "Reach, November 2026"); this file is the evidence. Claims about rules and policies were checked by a critic before the plan used them; re-check dates and rules before acting._

## What a player can share today, and a share kit

Today a player can share links and text from sudokui.app, but no images. For Reddit, where help posts are screenshots, that is the main gap. I could not GET the live site: the egress proxy refused sudokui.app (403 on CONNECT, DNS refused for WebFetch), and reddit.com was blocked too. Instead I ran the Worker's own handleRequest (worker/index.ts) against the built dist/share.tpl, which is the code path the live site runs. Script: /home/user/sudokUI/.vite/reach/render.test.ts. Output: /home/user/sudokUI/.vite/reach/live/{p,pvs,pbare,daily,dailyvs}.html.

**What Reddit shows for a link post to a share link.** A /p/ link has og:title "Can you solve this Hard sudoku?" and og:image /og/hard.png (1200x630). That card is a fixed Hard board, not the shared puzzle. A position link (#s=) previews identically, because the fragment never reaches the server: same wrong board, no candidates, no progress. A daily link has og:title "sudokUI Daily #27, 2026-11-02: can you solve it?" with the same band card. Its description names "XY-Wing, Skyscraper and BUG+1", a spoiler that contradicts the 14 October spoiler-free decision. Reddit does not show the description, but chat unfurls do.

**Coverage of the three common post types:**
- **(a) Help post:** half covered. There is a position link (330 to 550 characters) and a pencil-mark grid, but the grid is not Reddit-ready, and there is no board image.
- **(b) Technique or hint post:** barely covered. The only tool is "Copy step", a bare line of notation with no image, no explanation, no spoiler tags and no link.
- **(c) Daily post:** mostly covered by the share line. It reads "faster than 0% today" when there are few solvers, it cannot be re-shared after the win dialog closes, and the ?vs preview drops the daily number.

**Proposed share kit.** It stays inside the principles: made on the device, nothing uploaded, no account, the same closed telemetry list.
1. Board and hint image export. A prototype from the existing boardSvg via a canvas works offline with system fonts: /home/user/sudokUI/.vite/reach/proto/*.png.
2. "Copy for Reddit / Discord / forum": a title, plus a body with a markdown position link, the 81 characters in backticks, the grid as a 4-space code block, and the hint behind spoiler tags, one span per paragraph.
3. A "Share this hint" button in the hint panel.
4. Generic posting tips.

Small fixes come first: drop the techniques from the daily preview, add a trailing slash to share links with no query, and use rank wording when few have solved.

**Main risk.** The owner is banned from r/sudoku, and its AutoModerator may filter the domain. So the kit should help players post their own content (an image, with sudokui.app in a small footer and a link that is useful to readers). It must never ask players to promote the app or name r/sudoku in the app. "Answer a help post with a drawn hint" is the most welcome form of presence there.

The same kit serves Discord and enjoysudoku, so it does not depend on Reddit.

### What a crawler (Reddit, chat apps) sees today for /p/, position and daily links

I rendered each link through worker/index.ts handleRequest with the user agent redditbot/1.0, using the built dist/share.tpl.

1. /p/<puzzle>?b=hard&s=1288
   - title: 'Hard sudoku, HoDoKu rating 1288 | sudokUI'
   - og:title: 'Can you solve this Hard sudoku?'
   - og:description: 'A Hard sudoku with a HoDoKu rating of 1288. Play it free on sudokUI, with hints that explain every step.'
   - og:image: https://sudokui.app/og/hard.png, 1200x630, with og:image:width, og:image:height and og:image:alt set; twitter:card summary_large_image
   - robots noindex plus x-robots-tag noindex; cache-control max-age=0
2. The same link with ?vs=552: og:title becomes 'Solved in 9:12. Can you beat it?'
3. A /p/ link with no query: og:title 'Can you solve this sudoku?', and the image falls back to og-card.png (the home card with an X-Wing).
4. /daily/2026-11-02: og:title 'sudokUI Daily #27, 2026-11-02: can you solve it?', image og/hard.png. The description includes 'needing XY-Wing, Skyscraper and BUG+1' (next finding).
5. /daily/...?vs=612: og:title 'Solved in 10:12. Can you beat it?', so the daily number drops out of the headline.

What Reddit does with these:
- In a link post, the submitter writes the title. og:title or <title> may only be offered as a suggestion (not verified).
- og:image becomes the thumbnail or preview card, with the domain sudokui.app.
- Reddit's feed does not show og:description; Discord, WhatsApp, Slack, Telegram and X do.
- The band card shows a fixed real board of that band, not the shared puzzle (docs/online-goals.md: 'never the shared puzzle'). So a Reddit link post of a puzzle shows a different board in its thumbnail.
- A position link previews exactly like the puzzle link: wrong board, no candidates, no progress, framed as 'Can you solve this…'. That is the opposite of a help post.
- Reddit's square thumbnail crop of a 1200x630 card (text on the left, board on the right) probably shows a slice of each (not verified).

Conclusion: a link post is the wrong form for help and hint posts. Use an image post, with the link in the body or a comment. Link posts suit the daily and challenges.

_effort: hours, impact: high_

Risk: These are the tags from the built dist/ through the Worker code. The deployed build may differ. Reddit's thumbnail crop, title autofill and fragment handling come from general knowledge, not checks against Reddit. Verify with one post to the owner's own Reddit profile.

Evidence: /home/user/sudokUI/.vite/reach/render.test.ts → /home/user/sudokUI/.vite/reach/live/p.html, pvs.html, pbare.html, daily.html, dailyvs.html; src/content/share.ts:276-333 (shareCopy, renderSharePage); index.html head; public/og/hard.png (1200x630, fixed Hard board); docs/online-goals.md:194-196. The live site was not reachable: proxy 403 on CONNECT to sudokui.app, WebFetch ENOTFOUND. Owner to confirm with: curl -sA 'redditbot/1.0' 'https://sudokui.app/p/...76...5.1....67...2.1.3....925...1...9.1...6...478....6.7.9...87....2.3...29...?b=hard&s=1288' | grep -E 'og:|<title'

### The daily's link preview names its techniques (a spoiler), against the 14 October decision

shareParamsOf() gives a daily's page techs: daily.techs, taken from dailies.json. The daily's preview therefore reads 'needing XY-Wing, Skyscraper and BUG+1' in every chat unfurl, including when the win screen's 'Challenge a friend' line or the Share dialog sends it. docs/online-goals.md says the app's links are spoiler-free by default, and that the daily's share line was made spoiler-free for exactly this reason. The Share dialog's comment says a daily's link 'names no techniques whatever the box says', but the server adds them back. BUG+1 in particular gives away the endgame.

Fix: drop techs from the daily branch of shareParamsOf. They can stay for the phase-4 archive pages behind a spoiler. Change the test that pins techs: d.techs to expect none, and add an assertion that no technique name (in any language) appears in the daily page's description.

_effort: hours, impact: medium_

Risk: None for play. Previews that chat apps have already cached keep the old text.

Evidence: src/content/share.ts:101 (`techs: daily.techs` in shareParamsOf); src/content/share.ts:186-187 (descriptionDaily uses {techs}); tests/sharePage.test.ts:388 pins `techs: d.techs`; src/ui/Dialogs.tsx:983-984 (comment says a daily link names no techniques); /home/user/sudokUI/.vite/reach/live/daily.html; docs/online-goals.md:198-206

### Help posts ('I'm stuck here'): the pieces exist, but there is no board image, and the text is not Reddit-ready

What the Share dialog gives today:
- 'Position link': /p/<puzzle>?b=&s=#s=<encodePosition>, with the entries, the corner, centre and excluded marks, and the colours. At 41 bits per open cell it is 330 to 550 characters (549 at the start of today's daily, 400 with 20 cells open).
- 'Puzzle string'.
- 'Position as text': the pencil-mark grid that HoDoKu and the forums read.

What a Reddit help post made from these looks like today:
- Image: a phone screenshot with the app's chrome around it, often the dark theme, with small candidates. This is how r/sudoku help posts are usually made.
- The pencil-mark grid pasted into the body collapses into one paragraph, because Reddit markdown has no single-newline breaks and needs a 4-space indent to make a code block. Triple backticks do not render on old.reddit.
- A bare 550-character position link is ugly. If it ends in '_' (one of the 64 base64url characters), GFM-style autolinkers strip it. decodePosition then reads the missing bits as 0 and quietly changes the last cell; it does not refuse.
- A link post to the position link shows the wrong board (finding 1).

What is missing:
1. A PNG of the board as drawn: always light, with candidates, givens apart from entries, optionally the player's cell colours, and a small footer 'sudokui.app · Hard 1288'.
2. A Reddit-formatted body: the link as [Open this exact position](url), the 81 characters in backticks, and the grid indented 4 spaces.
3. A prompt to say what you have tried.

With those, the readers who open the link get the exact position with candidates and can ask for a hint there. That is the reach loop.

_effort: days, impact: high_

Risk: An image is the player's own content, which Reddit welcomes. A link to sudokui.app in r/sudoku may be removed by AutoModerator if the domain is filtered after the owner's ban (not verified). The image footer carries attribution even if the link is removed.

Evidence: src/ui/Dialogs.tsx:960-1080 (ShareDialog: link, position, string, text); src/state/gameStore.ts:1929-1984 (B64URL, encodePosition 14/41 bits per cell); src/content/textGrid.ts:63-77 (formatPencilGrid lines start with '.', '|', ':'); no image export anywhere in src/ (the only canvas.toBlob is in src/scan/scanner.ts:155); length calculation in this session (549/490/400/333 characters for 53/40/20/5 open cells)

### Technique or hint posts: only 'Copy step', with no image, explanation, spoiler or link

HintPanel's 'Copy step' copies one line of notation and nothing else, for example 'Skyscraper: (1)r2c7 = (1)r2c3 - (1)r9c3 = (1)r9c9 => r1c9<>1, r8c7<>1'. The drawn hint (arrows, discs, legend), which is the app's selling point, can only leave the app as a screenshot of the whole screen.

Missing:
1. An image of the hint as drawn. boardSvg already renders a step's full drawing in the app's hint palette, always light and pure string. Rendering the current walk-through frame needs frameMarks(step, frame), which boardSvg currently calls with null.
2. The explanation: describe(hint) from engine/hintFrames, already localised.
3. Spoiler wrapping: on Reddit, >!…!< with one span per paragraph and no newline inside. For an image post, a reminder to tick Reddit's Spoiler flag, which blurs the image.
4. A link to /learn/<slug>/: a static, indexable page that costs no Worker invocation, the best target for a link.
5. Optionally a 'hint link' that opens the position with the same hint showing, e.g. #s=…&hint=1. Hints are deterministic from the position, so the reader's app recomputes it.

Learn pages preview with the generic og-card.png. Their diagrams are SVG (/learn/img/x-wing.svg), which Reddit and the chat apps do not accept as og:image. So a link to /learn/skyscraper/ does not show the Skyscraper. PNG cards per technique, made by the same headless-Chrome pipeline as scripts/og-share-cards.ts, would fix that.

_effort: days, impact: high_

Risk: The image and the technique name are themselves spoilers. Default to the name behind spoiler tags, and advise ticking the Spoiler flag for image posts.

Evidence: src/ui/HintPanel.tsx:269-279 (copyStep → copyText(stepText(hint))), 381 (describe(hint)), 509-516; src/content/eureka.ts:331-334; src/content/boardSvg.ts:132-450 (boardSvg; system fonts only; frameMarks(step, null, …)); dist/learn/x-wing/index.html (og:image = og-card.png, diagram is /learn/img/x-wing.svg); prototype /home/user/sudokUI/.vite/reach/proto/XY_CHAIN-hint.png

### Daily or time posts: the share line works, but it has three rough edges

Today the win screen's 'Challenge a friend' button builds, for example, 'sudokUI Daily #27 · Hard (1288) · 9:12 · unassisted · faster than 71% today · https://sudokui.app/daily/2026-11-02?vs=552'. It goes through the share sheet on a phone and the clipboard elsewhere, is counted as shared/daily, and renders fine in a Reddit comment. The link ends in digits, so autolinking keeps it whole.

Rough edges:
1. **Few solvers.** crowdPct is shown once stats.count > 1, and fasterThan splits ties by half. With two or three solvers the line can read 'faster than 0% today' or '100%'. Matt, who is usually the only one on the daily's times, gets lines that undersell or oversell. Below about 20 solvers, use rank wording ('2nd of 3 so far today') or no comparison.
2. **Lost after closing.** 'Admire the grid' sets victoryDismissed. The line can then only be had again by reloading, and the Share dialog offers only puzzle and position links. A position link of a solved board shares the whole solution.
3. **Preview.** The ?vs headline 'Solved in 10:12. Can you beat it?' drops 'Daily #27'. The card shows the Hard band board, not the daily's.

Options for the preview: an ogTitleDailyVs string; and, since the dailies are published in advance, static cards per day (451 PNGs, language-neutral, about 30 MB) made at build time. That fits 'static assets are free and unlimited' and does not break the 'no per-puzzle rendering' rule, which was about generated puzzles. A text post or a comment in a daily thread is the right Reddit form. Posting the daily line to r/sudoku itself reads as self-promotion.

_effort: hours, impact: medium_

Risk: Changing the share-line templates touches all three languages and the i18n catalogue.

Evidence: src/ui/Dialogs.tsx:1233-1283 (shareResult texts), 1210-1211 (crowdPct requires count > 1), 1397; src/content/dailies.ts:197-208 (fasterThan); src/ui/App.tsx:421 and 1154 (victoryDismissed, in memory only); src/content/share.ts:180,289-293 (ogTitleVs replaces the daily headline); /home/user/sudokUI/.vite/reach/live/dailyvs.html

### Share links without a query break when autolinked: about 65% of puzzles end in '.'

Reddit's markdown autolinker (snudown, from sundown's autolink_delim), GFM-style renderers, and most chat apps strip trailing '?!.,' from bare URLs. A /p/<81> link with no query that ends in '.' loses those dots. The 80-character path then fails SHARE_PATH ([0-9.]{81}), and the Worker passes the request to the assets, which answer 404.

Measured: 66% of seeds.json puzzles and 65% of dailies.json puzzles end in '.'. Bare links come from:
- the address bar while 'hide rating' is on and the game is in play;
- the Share dialog when the board is not the known game;
- anyone trimming the query by hand.

Links with ?b=&s= end in a digit, and daily links end in the date, so both are safe.

Fix: have sharePath emit '/p/<81>/' (a trailing slash) when there is no query. SHARE_PATH already accepts it, and the service worker's APP_NAVIGATION would need the same check. The kit's Reddit and Discord text should always use [text](url) and never a bare URL.

_effort: hours, impact: medium_

Risk: Low. Old links without the slash keep working. Check that APP_NAVIGATION in src/content/home.ts and the Workbox navigation allowlist match the slash form.

Evidence: src/content/share.ts:51 (SHARE_PATH with optional trailing slash), 104-116 (sharePath has no trailing slash when the query is empty); src/ui/App.tsx:471-480 (address bar drops b and s while the rating is hidden); worker/index.ts:110-111; measurement in this session (seeds 66%, dailies 65% end with '.')

### Share kit, part 1: board and hint image export (PNG made on the device, no server)

Prototype built in this session. boardSvg(example) was fed a stored example's position, once with a step that marks nothing (the help image) and once with the real step (the hint image). The SVG was rasterised exactly as the app would: Blob → <img> → <canvas> → toBlob('image/png') in Chromium. Result: crisp 1140x1140 PNGs of 135-170 KB, light background, candidates in keypad layout, givens dark and entries blue. Nothing is fetched, because boardSvg uses only system fonts and has no external references, so the canvas is never tainted and it works offline.

Implementation by file:
1. src/content/boardSvg.ts: let boardSvg take an optional step (no marks when absent), an optional frame (pass it through to frameMarks), optional player colours (Grid.tsx PALETTE fills under the candidates), and an optional footer strip of about 40 px ('sudokui.app · Hard 1288').
2. New src/content/boardImage.ts (pure): positionSvg({cells, puzzle, autoCandidates, markContract, step?, frame?, footer?}), built from shownCandidates the way formatPencilGrid is.
3. New src/ui/boardPng.ts: svgToPng(svg, scale = 2): Promise<Blob>.
4. src/ui/send.ts: sendFile(file, text?) returning Sent | 'saved'.
   - Touch-first devices with navigator.canShare({files}) → navigator.share({files: [file]}). The Reddit app is a share target for images and starts an image post.
   - Otherwise: 'Copy image' through navigator.clipboard.write([new ClipboardItem({'image/png': blob})]), and 'Save image' through an <a download> of an object URL.
   - Build the PNG when the dialog opens or an option changes, not on the tap. navigator.share must be called before any await (send.ts already documents this), and Safari is strict about it.
5. src/ui/Dialogs.tsx ShareDialog: a new 'Image' row with Share or Save and Copy image, and ticks for 'Candidates' (on when the board shows any) and 'sudokui.app footer' (on).
6. src/ui/HintPanel.tsx: a 'Share this hint' button next to 'Copy step' that opens the same dialog with the hint, or the current walk-through frame, drawn.
7. Telemetry: add 'image' (and 'post', part 2) to ShareKind in src/state/telemetry.ts and SHARE_KINDS in worker/telemetry.ts, and 'save' to ShareVia; then the admin SHARE_LABELS and the privacy text in three languages (src/content/privacy.ts:75 lists the kinds). Never the image.

_effort: days, impact: high_

Risk: Web Share with files is missing on Firefox desktop and possibly Firefox Android; fall back to Save or Copy image. ClipboardItem with image/png needs Firefox 127 or later. The privacy page must be updated in the same change, or it is no longer accurate.

Evidence: /home/user/sudokUI/.vite/reach/proto.test.ts and /home/user/sudokUI/.vite/reach/raster.cjs → /home/user/sudokUI/.vite/reach/proto/{X_WING,SKYSCRAPER,XY_CHAIN}-{board,hint}.png; src/content/boardSvg.ts:132,444 (system-font style, 'always drawn light'); src/ui/send.ts:18-42; src/state/telemetry.ts:58; worker/telemetry.ts:63; src/content/privacy.ts:75

### Share kit, part 2: 'Copy for Reddit / Discord / forum' (title plus body, spoilers done right)

Add a pure module src/content/postKit.ts: postText(target, kind, parts, lang) returns {title, body}.

Targets:
- reddit: spoilers as >!…!<, one span per paragraph; code blocks by 4-space indent (old and new Reddit).
- discord: spoilers as ||…||; code in ``` fences.
- forum: [code]…[/code] for enjoysudoku (phpBB). Leave spoilers out unless the forum's tag is confirmed.

Kinds:
- **help.** Title from t(): 'Stuck on this {level} ({score}): what is the next step?'. Body:
  - [Open this exact position in sudokUI](positionLink)
  - Puzzle: `<81 chars>`
  - the pencil-mark grid, indented 4 spaces
  - 'What I have tried: …' as a placeholder
  - optionally the next hint, behind spoiler tags and only when the player asks.
- **hint.** Title: 'A {technique} in a {level} puzzle'. Body:
  - the hint image link or position link
  - >!{name}!< and >!{stepText}!< and >!{describe(hint)}!<
  - [What is a {technique}?](/learn/<slug>/)
- **daily.** The existing spoiler-free share line, unchanged, with no grid and no techniques.

A Reddit escaper must handle *, _, ~, ^ (Reddit superscript), [, ], \, a leading # > - or '1.', and any '!<' inside spoiler text. Today's notation uses '=>' and '<>', which are safe, but ALS and Death Blossom lines need checking across all examples. Limits: title ≤ 300 characters, body ≤ 40,000.

On a phone the order matters: copy the body first (clipboard.writeText, not awaited), then share the image in the same tap, so the clipboard holds the text when the Reddit composer opens.

A draft made from a stored example renders as intended: /home/user/sudokUI/.vite/reach/proto/SKYSCRAPER-reddit.md.

_effort: days, impact: high_

Risk: Spoiler and code syntax differ between Reddit clients; test on old.reddit, new Reddit and the apps. Writing to the clipboard and then sharing in the same tap is not verified on iOS Safari.

Evidence: /home/user/sudokUI/.vite/reach/proto/SKYSCRAPER-reddit.md, XY_CHAIN-reddit.md, X_WING-reddit.md; src/content/eureka.ts:283-334 (hodokuLine, stepText); src/engine/hintFrames (describe); src/content/slugs.ts (techSlug for /learn/ links); src/content/textGrid.ts:63

### Etiquette and Reddit risk: help players post their own content, never promote the app

Facts that shape the design:
- The owner is banned from r/sudoku.
- Reddit treats coordinated promotion or ban evasion through other accounts as a sitewide violation.
- A moderator who banned the owner for self-promotion may also have filtered the sudokui.app domain in AutoModerator (not verified). Links may then be removed silently, whoever posts them.

So:
1. The kit must not name a subreddit, ask players to post, or write promotional titles. Titles are about the player's position, hint or time.
2. The reach comes from the image's small 'sudokui.app' footer, which can be turned off, and from a link that is useful to readers ('open this exact position').
3. Keep the tips in the app generic and short, translated, in a collapsible 'Posting tips':
   - help: 'Show your candidates. Say what you have tried. Ask for a hint, not the answer. Read the community's rules first.'
   - hint: 'Put the technique's name and the step behind spoiler tags; mark an image post as a spoiler.'
   - daily: 'Post your time where people share daily times; never post the solved grid.'
   Notes per subreddit, such as r/puzzles' AutoModerator asking for spoiler tags or r/sudoku's 'Request Puzzle Help' posts, belong in docs/, not in the app, because they change.
4. The best-received form on r/sudoku is answering other people's help posts. The app already has Scan a photo, which reads a screenshot's digits offline, plus hints and 'Copy step'. Adding 'Copy answer for Reddit' (the hint image plus spoiler-tagged steps) turns any player into a welcome helper, and the image carries the attribution.
5. Not relying on Reddit: the same kit serves Discord (||spoiler||) and enjoysudoku ([code] grid plus Eureka). The landing count already distinguishes reddit, enjoysudoku and discord, so the dashboard can show which works.

Ask Matt to check whether a comment of his with a sudokui.app link stays visible when logged out. That shows whether the domain is filtered.

_effort: hours, impact: high_

Risk: Reddit's rules and each subreddit's rules could not be fetched here (reddit.com blocked). The owner should read r/sudoku's current sidebar before the kit names any flair or norm.

Evidence: worker/telemetry.ts:279,320,359 (landingFrom includes reddit and com.reddit.frontpage), :230 (redditbot is treated as a bot, so a preview fetch is not a landing); docs/scan.md:1-6 (scan reads a screen); r/sudoku and r/puzzles norms from web search only, not verified: https://redlib.hbubli.cc/r/sudoku/comments/oo8net/request_for_help_post_4/h7dexui/?context=3, https://lr.eu.psf.lt/r/puzzles/comments/1dt9cld/im_still_a_sudoku_novice_any_pointers_how_to, https://reddit.fsky.io/r/sudoku

### Tests that would hold the kit

1. **tests/postKit.test.ts**
   - Reddit body: every URL is inside [text](url); no bare URL; no line break inside a >!…!< span; every grid line starts with 4 spaces; title ≤ 300 and body ≤ 40,000.
   - The position link pulled back out of the body parses (parseShareUrl plus decodePosition) to the same cells; the backticked 81 characters equal the puzzle.
   - For every stored example (EXAMPLES) and each of en, nb and es: stepText and describe() pass through the escaper with no unescaped * _ ~ ^ [ ], no leading # > - or '1.', and no '!<' inside a spoiler.
   - The daily kit contains no technique name (in any language) and no grid.
   - The Discord target uses ||, the forum target uses [code].
2. **tests/boardImage.test.ts**
   - positionSvg without a step draws no hint marks (no arrows, discs or rings).
   - With a step it equals boardSvg(example) (snapshot in the drawingSnapshot style).
   - The candidates drawn equal shownCandidates for each mark contract.
   - Footer present only when asked.
   - No http(s) href, <image> or foreignObject, so the canvas stays untainted and the export works offline.
3. **tests/send.test.ts**, extended in its device() style:
   - sendFile calls share({files}) synchronously on a touch device that supports files; a closed sheet returns 'cancelled'; no file support falls back to Save.
   - On desktop, ClipboardItem when present, else Save.
4. **tests/sharePage.test.ts**
   - A daily page's description names no technique (replacing the pin at :388).
   - A share link with no query ends in '/' and round-trips.
   - The ?vs headline of a daily keeps 'Daily #n'.
5. **Telemetry tests**: worker/telemetry accepts 'image', 'post' and 'save' and refuses anything else; the privacy text mentions them in three languages.
6. **tests/e2e/smoke.spec.ts**
   - Share dialog → Save image → page.waitForEvent('download') → a PNG of the expected size.
   - Copy for Reddit with clipboard permission granted → the text contains '>!' and '](https://sudokui.app/p/'.
   - HintPanel → Share this hint → a download.
   - Run in both font setups, as the other browser tests do.

_effort: days, impact: medium_

Risk: Clipboard and Web Share differ by browser; Playwright's Chromium covers download and clipboard, but iOS Safari needs a manual check.

Evidence: tests/send.test.ts:1-60 (device() harness); tests/sharePage.test.ts:380-416; tests/share.test.ts:38-63 (round trip of position links); playwright.config.ts; vite.config.ts:264 (cloudflare:email alias for Worker tests)

### What a player cannot do today that they would expect

1. Save, share or copy an image of the board, with or without candidates. Today the only way is a screenshot of the whole app.
2. Share a hint as an image, or with its explanation, or with spoiler tags, or as a link that opens the position with the hint showing.
3. Share the daily line again after closing the win dialog; only a reload brings it back.
4. Get a preview that shows the shared puzzle or position. The card shows a different board of the same band, and a position link looks like a fresh puzzle.
5. Keep their cell colours in anything except the position link. The pencil-mark grid and images drop them.
6. Paste a pencil-mark grid into Reddit and have it render.
7. Open a Learn link and see the technique in its preview: the card is generic, because SVG diagrams cannot be og:image.
8. Share the current walk-through frame rather than the whole drawing.
9. Import a SudokuWiki solver link, which r/sudoku answers often use. importLinks reads SudokuPad, f-puzzles, Sudoku Exchange and sudoku.coach only; how common SudokuWiki links are in answers is not verified.
10. Share a solved puzzle's Position link without the solution: it currently encodes the full solved grid. The dialog should warn when the game is won, or offer only the result line.

_effort: days, impact: medium_

Risk: Item 9 (SudokuWiki) is a guess about how players answer, and should be checked before any work.

Evidence: src/ui/Dialogs.tsx:960-1080, 1394-1404; src/ui/HintPanel.tsx:497-520; src/ui/App.tsx:421,1154; src/content/importLinks.ts:6-32 (LinkSource list); dist/learn/*/index.html og:image = og-card.png

### Verification steps for the owner (the live site and Reddit were unreachable from this session)

1. **Live tags.** Fetch the three links with Reddit's and Discord's user agents (curl -sA 'redditbot/1.0' and curl -sA 'Discordbot/2.0') and compare with /home/user/sudokUI/.vite/reach/live/*.html.
2. **Bot challenges.** In Cloudflare, Security > Events, check that redditbot, Discordbot and facebookexternalhit are not challenged by Bot Fight Mode. A challenged fetcher gets no preview at all.
3. **Reddit rendering.** Make one link post and one image post on the owner's own Reddit profile, not a subreddit. Check: which title Reddit suggests, how the 1200x630 card is cropped in compact, card and app views, whether the #s= fragment survives in the posted URL, and that >!spoilers!< and 4-space code blocks render on old.reddit and new Reddit.
4. **Domain filter.** Ask Matt whether his comment with a sudokui.app link is visible when logged out (the AutoModerator domain-filter question).

None of this needs an account beyond the ones that already exist, and nothing is posted to a subreddit.

_effort: hours, impact: medium_

Risk: Without these checks, the claims about crop, title suggestion and fragment handling stay unverified.

Evidence: Proxy status recentRelayFailures, CONNECT 403 for sudokui.app; WebFetch: 'getaddrinfo ENOTFOUND sudokui.app'; WebFetch: 'unable to fetch from old.reddit.com'. Reddit's handling of og:image is undocumented (https://www.joeldare.com/wiki/reddit_pulls_the_wrong_thumbnail, https://htmlcsstoimage.com/features/og-images-for-reddit, https://jameshfisher.com/2017/08/16/reddit-oembed-open-graph/)

## Reddit

Reddit can help with reach but cannot be the main channel: r/sudoku is closed to every app announcement, from anyone. A second-hand source quotes a mod post of 2026-03-13 for this rule (Rule 2). The rule allows puzzles, help requests and technique discussion. Help posts score 40 to 100 there. Developer posts with a "free, offline, no ads" pitch scored 6 to 21 before the rule.

What the owner can do while banned: post as himself in other subreddits under their rules, saying he is the developer, and appeal once by replying to the ban notice. What he must not do: use any other account in r/sudoku (ban evasion, which risks a sitewide suspension), get anyone to post an announcement there for him, or ask anyone for votes. What players can do on their own: post puzzles, help requests and honest recommendations in r/sudoku. They can also use the weekly "Sudoku Puzzle Challenges Thread", which asks for an image, the puzzle string and a playable link. sudokUI can already give the link and the string but not the image.

The most useful app work is a neutral Reddit-ready share kit. It needs four parts: a board image, a Markdown copy, a submit link on desktop, and image sharing through the phone's share sheet. None of the four should preselect r/sudoku, use promotional text or offer rewards.

The best places for the owner's own launch post are r/WebGames (about 144k members, direct link to the game), then r/SideProject and the Saturday threads of r/webdev and r/javascript, then possibly r/Norway or r/norge (rules not checked). Not a fit: r/InternetIsBeautiful (bans web games), and r/opensource and r/selfhosted (both ban AI-built projects; 204 of the 217 commits in the local history are co-authored by Claude). An appeal costs little and has low odds. It would allow taking part in r/sudoku again, never promotion.

How the research was done: reddit.com, old.reddit.com, redditinc.com and web.archive.org were blocked for fetching. support.reddithelp.com, gummysearch.com and reddit.sentinel-team.org are outside this session's allowed network domains; they would have to be allowed in the session's network settings to read those pages directly. So every Reddit rule and post score here comes from web-search summaries, mirror copies indexed by search, and third-party trackers. The owner can still read r/sudoku while banned. He should spend 10 minutes checking the live rules page, the 1rsjzov mod post and the top posts of the year and month before acting. Nothing was posted, no account was created and no /api route was called.

### r/sudoku removes every app, website and channel announcement, whoever posts it

Rule 2, from a mod post dated 2026-03-13 (reddit.com/r/sudoku/comments/1rsjzov/), removes app, website and channel announcements. It is quoted as: "Please do not use r/sudoku as a marketing or user-acquisition channel." Still allowed: individual puzzles (an image or a link), help requests and technique discussion.

So no launch or announcement post about sudokui.app can stand in r/sudoku, whether the owner, Matt or anyone else writes it. Unbanning the owner would not change that. The sub has about 58k to 62k members (third-party estimates).

The same source reports that the mods run a daily puzzle post and are building their own sudoku game inside Reddit (r/playsudoku). That is a possible competing interest to keep in mind for any appeal.

Only the date of the Rule 2 post is confirmed. I could not open the post or the rules page myself. The owner can read both while banned and should check the wording.

_effort: hours, impact: high_

Risk: The rule text is second-hand. If the live rule is softer (for example, an app flair allowed once), parts of this plan would loosen.

Evidence: https://github.com/vitalyiegorov/suuudokuuu/issues/696 (dated 2026-10-27, read with a Redlib mirror; quotes Rule 2 and links https://www.reddit.com/r/sudoku/comments/1rsjzov/); member count from https://gummysearch.com/r/sudoku/ (via search: 58k as of 2026-06-15, 62k in another listing)

### What gets engagement on r/sudoku: help, discussion and complaint posts; app pitches score low

Scores reported for the year to October 2026:
- Help requests: 40 to 100.
- Discussion and complaint posts: "Beware of impossible AI sudoku" 398, "Insane levels I beat with ease" 164, "is auto-candidate cheating?" 59, "the hint just gave me the number" 41, the top app-request thread 104, and "apps WITHOUT three strikes" with 53 comments.
- Developer posts before the ban: "free, offline, no ads" pitches scored 6 to 21. The exception was sudoku.coach's "is now AD FREE" at 246.

Two regular threads fit what sudokUI makes:
- The weekly "Sudoku Puzzle Challenges Thread", posted by AutoModerator. The mods ask for an image, the puzzle string and at least one playable link.
- A weekly teaching thread where solvers name and explain the advanced techniques they used.

Recommendation threads ("good adfree sudoku app for android", "looking for sudoku app recs") are where players name apps in comments. A player who mentions sudokUI there unprompted is the normal, allowed path.

Takeaway: the posts that work are a hard position, a question about technique, or a complaint about how other apps' hints work. sudokUI's drawn chains and "why not" proofs are the kind of image that would get noticed in a teaching or help post that a player writes.

_effort: hours, impact: medium_

Risk: I could not read top-of-month or top-of-year directly. The owner should check both by hand before acting on these patterns.

Evidence: https://github.com/vitalyiegorov/suuudokuuu/issues/696 (scores, mostly undated; thread ids 1wg7ej4, 1qaf08q, 1rf6q2e); weekly thread format from mirror copies of https://www.reddit.com/r/sudoku/comments/1jn3su8/ and https://www.reddit.com/r/sudoku/comments/1hon1zk/ (seen through search); recommendation threads https://www.reddit.com/r/sudoku/comments/1kr11qz/ and https://www.reddit.com/r/sudoku/comments/1huhohc/ (via search)

### What the owner may and may not do while banned from r/sudoku

Reddit's help centre defines community ban evasion as being banned from a community and then taking part there through another account. Its "Disrupting Communities" article covers "Creating or using multiple accounts to circumvent a community ban issued by a mod". Reddit reviews a report of this only when the moderators file it, and it "could result in a sitewide suspension".

The owner MAY:
- Read r/sudoku. A subreddit ban does not hide a public sub.
- Post and comment in every other subreddit under its own rules, from his one main account, saying he is the developer.
- Reply once to the ban notice in modmail.
- Answer players in the app's own channels (GitHub issues, email).
- Start his own subreddit. That is not "reconstituting" a banned community, because r/sudoku is not banned.

The owner MAY NOT:
- Use any second or new account in r/sudoku, even just to comment or vote.
- Get a friend or player to post an announcement there for him. That breaks Rule 2 whoever posts it, and mods may treat it as evasion through someone else.
- Link r/sudoku threads elsewhere and ask people to vote or pile in. Coordinated voting is listed under vote manipulation.
- Message individual mods privately instead of using modmail.
- Complain publicly about the ban in other subs.

Reddit's Rule 2 asks users to "Post authentic content into communities where you have a personal interest" and not to cheat or manipulate content, "including spamming, vote manipulation, ban evasion, or subscriber fraud".

_effort: hours, impact: high_

Risk: Breaking these rules risks a sitewide suspension of the owner's account, which would cut off every subreddit and not just r/sudoku.

Evidence: https://support.reddithelp.com/hc/en-us/articles/360043504811-What-is-ban-evasion ; https://support.reddithelp.com/hc/en-us/articles/360043066412-Disrupting-Communities ; https://redditinc.com/policies/reddit-rules (wording seen in an archived copy: https://webarchive.library.unt.edu/web/20201218091247/https://www.reddit.com/help/contentpolicy). All read through search summaries; the pages could not be fetched.

### What players may do on their own, and the line the app must not cross

A player who posts, unasked, about an app they like is posting authentic content, and no Reddit rule forbids it. In r/sudoku, the player is held to Rule 2 like anyone else.

Players MAY:
- Post a help request with a sudokUI screenshot or position link.
- Post a puzzle (image, string, link).
- Enter the weekly challenge thread with a sudokUI link as the playable link.
- Recommend sudokUI in app-recommendation threads.
- Submit it to r/WebGames or other subs under those subs' rules.

What would turn sharing into coordinated or undisclosed promotion:
- The app or the owner steering posts to r/sudoku: a preselected subreddit, or "Post this on r/sudoku!" prompts.
- Prefilled promotional titles.
- Rewards for posting, such as badges or unlocks.
- Any request for upvotes. Reddiquette discourages asking for votes, and coordinated voting is vote manipulation.
- Accounts that look unconnected but are run by one party. Reddit's "Manipulated Content and Misleading Behavior" policy targets this, as reported by a secondary source.

The app must never reward posting. US FTC guidance warns against incentivised reviews even when they are disclosed. sudokUI is free and gives nothing in return, so it is outside that today.

To Matt and others, the owner can say "if you want to share it, the Share button makes a Reddit-ready post". He should not ask anyone to post in a particular sub or to vote.

_effort: hours, impact: high_

Risk: A share flow that names r/sudoku or nudges players to post would be easy for the mods to read as an organised campaign by a banned developer. The domain could be filtered or the posters banned.

Evidence: https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette ; https://support.reddithelp.com/hc/en-us/articles/360043066412-Disrupting-Communities ; https://support.reddithelp.com/hc/en-us/articles/41180423371156-Manipulated-Content-and-Misleading-Behavior (example wording via https://www.arfadia.com/blog/reddit-self-promotion-rules-explained/) ; https://www.dwt.com/insights/2023/07/ftc-advertising-endorsement-and-testimonial-guides

### In-app Reddit share kit: board image, Markdown copy, desktop submit link, image through the phone's share sheet

What the app has today:
- The Share dialog copies or sends four things: the puzzle link, the position link (#s= with marks and colours), the 81-character puzzle string, and the position as a pencil-mark text grid.
- send.ts uses navigator.share for text and links only.
- There is no board image, and an image is the one item r/sudoku help and challenge posts expect.

What to add so a player can post anything from the app:
1. "Save image": a PNG of the board as it stands, with marks and colours. Optionally include the hint's drawn chain or the "why not" proof, since those are the images that suit technique and help posts. Optionally print the puzzle string in small type under the grid. If the domain is shown, keep it small and let the player turn it off.
2. On phones, share that PNG through navigator.share({files}), so the Reddit app (or any other app) gets the image directly.
3. "Copy for Reddit": a Markdown block with the pencil-mark grid indented four spaces so it renders as a code block in old and new Reddit, then the puzzle string, then the position link. This one block meets the weekly challenge thread's request for an image, a string and a playable link.
4. On desktop, a "Reddit" button that opens reddit.com/submit?url=<share link>&title=<neutral title the player edits>. No subreddit is preselected and the app name stays out of the title. Community answers document url, title, text and selftext for this page. Test it by hand before shipping, because I could not reach reddit.com.

Keep the share-line text factual, as it is now. Do not add a Reddit-only line, a vote request or a prompt to post. The telemetry already records "reddit" as a landing source (worker/telemetry.ts:320), so the effect will show on /admin without anything new.

_effort: days, impact: medium_

Risk: The submit URL parameters and the Reddit app accepting a shared image are both unverified; test both by hand. Reddit's 2018 brand guidelines say a logo usually needs permission, so use a plain text "Reddit" label or check the current brand page.

Evidence: /home/user/sudokUI/src/ui/Dialogs.tsx:960-1075 (ShareDialog: link, position, string, text; no image) ; /home/user/sudokUI/src/ui/send.ts:25-46 (text/url only) ; /home/user/sudokUI/worker/telemetry.ts:320 ; submit URL parameters: https://stackoverflow.com/questions/24823114/post-to-reddit-via-url and https://stackoverflow.com/questions/32410196/is-there-a-way-to-submit-a-text-post-on-reddit-via-a-url (old, community answers) ; weekly thread request for image + string + link (finding 2)

### Appealing through modmail: worth one message, low odds, and it never opens the door to promotion

Who decides:
- A subreddit ban is decided only by that sub's moderators. Reddit admins do not overturn it.
- The only route is to reply to the original ban notification. The reply goes into the sub's shared modmail, in its "Ban Appeals" folder.
- Mods have no duty to answer.
- Rude or repeated messages get muted from modmail for 3, 7 or 28 days.

Why the odds are modest:
- Even if the ban is lifted, Rule 2 still bars any post about sudokUI.
- The mods reportedly run their own sudoku game.

What a lifted ban is worth: the owner could answer help and technique threads as a known solver, which builds his name over time.

How to send it:
- Send it once, a few weeks after the ban if it was recent.
- Do not follow up.
- If refused, accept it and say nothing public about it.

Draft, about 110 words, to fill in with the reason given in the ban notice:

"Hi mods. I'm Anders, the developer of sudokUI (sudokui.app). I was banned for [reason in the ban message], which broke Rule 2, and I understand why. I've read the rules and the March post about not using r/sudoku for marketing. I'm asking to be let back in to take part in help threads and technique discussion, not to promote anything. I won't post about sudokUI or link it in posts or comments. If you'd prefer conditions or a trial period, that's fine with me. Thanks for considering it."

Guides agree that what works is naming the rule that was broken, saying you have read the rules, being brief and arguing nothing.

_effort: hours, impact: low_

Risk: A defensive or repeated appeal can bring a modmail mute, which closes even the reading of appeals for weeks. A promise broken after being let back in ends the matter for good.

Evidence: https://www.reddit.com/r/modnews/comments/i4c7yr/shhh_introducing_new_modmail_mute_length_options/ (mute lengths of 3, 7 and 28 days; via search) ; https://postiz.com/blog/how-to-get-unbanned-from-a-subreddit ; https://www.reddit.com/r/food/wiki/banappeal (via search) ; https://www.reddit.com/r/AskModerators/comments/1ctcbew/ (via search: no chain of command above the mods)

### r/WebGames: the best-fitting place for the owner's own launch post

About 143,846 members (ThreadFox, rules read 2026-09-26). Developers may post their own game, with limits:
- A link post straight to a game playable in the browser.
- The title starts with the game's name.
- The same game may not be reposted within three months, so search for the name and URL first.
- The mods can blacklist sites with heavy ads, malware or spam. sudokUI has no ads.

The audience plays web games rather than solving sudoku. A post with an exact title and a link to the daily or a hard band, followed by a disclosed developer comment explaining the drawn-chain hints, fits the format. There is one shot per three months.

_effort: hours, impact: medium_

Risk: Moderate. These are third-party rule summaries, so check the sidebar. A post that sinks early cannot be tried again for three months.

Evidence: https://threadfox.vip/rules/for/games (r/WebGames entry) ; https://www.reddit.com/r/WebGames/wiki/index (wiki, via a mirror shown in search) ; https://dinogame.gg/blog/best-browser-game-subreddits/

### Builder communities: r/SideProject, the Saturday threads of r/webdev and r/javascript, r/indiegames

- r/SideProject (about 776k to 883k members, figures vary): self-promotion is the purpose of the sub. Bare links get removed; a story with screenshots or a short demo does well. A good angle: built by one person in Oslo, offline PWA, 77 techniques, drawn chains, telemetry without IDs.
- r/webdev: projects only in Showoff Saturday, and posts on other days are removed. A free site can still be removed if it reads like an advert. The sub refers to the 9:1 rule.
- r/javascript: a weekly Showoff Saturday thread, or a separate project post. Being "built with JS" alone does not qualify a site.
- r/indiegames: game promotion is allowed, but not disguised as a request for feedback (mod post, August 2024).

These audiences are makers more than solvers, so expect GitHub stars and a few players rather than a lasting daily crowd. Each is worth one post.

_effort: hours, impact: low_

Risk: Low. Posting to many subs on the same day looks like spam, so space the posts out.

Evidence: https://www.growreddit.com/blog/reddit-self-promotion-rules-sideproject ; https://oneup.today/tools/reddit-self-promotion-checker/sideproject ; https://www.mediafa.st/subreddit/sideproject ; https://r-weld.vercel.app/r/webdev ; https://yomotherboard.com/question/why-was-my-free-front-end-website-removed-from-showoff-saturday/ ; https://www.reddit.com/r/javascript/wiki/index (via search) ; https://www.reddit.com/r/indiegames/duplicates/1esd7yf (mod post, via search)

### Not a fit: r/InternetIsBeautiful, r/opensource and r/selfhosted; mention AI help where a sub asks

- r/InternetIsBeautiful: the summaries list "No Webgames". It also applies a 90/10 rule: 90% of your recent Reddit activity must be unrelated to sites you own. A sudoku app is a web game, and the owner's account probably fails 90/10.
- r/opensource: new rules of 2026-10-24 bar projects that use AI, are made by AI or are for AI. Reports add that a project must be a year old, actively maintained and have several contributors.
- r/selfhosted: has a "No Generative AI or Vibe Coded Applications" rule.

The public repository is AImenes/sudokUI. In the shallow local history, 204 of the 217 commits since 2026-10-02 carry a Claude co-author trailer, so sudokUI fails both AI rules. Other subs are moving the same way, so a hidden AI role found later would hurt more than saying so up front. Where a sub asks about AI use, say in one line that the code is AI-assisted and that the engine is verified by tests.

_effort: hours, impact: medium_

Risk: Posting to these subs would most likely be removed and could get the owner banned there too.

Evidence: https://rankhog.com/subreddits/internetisbeautiful ; https://www.threadotter.com/subreddit-rules/internetisbeautiful ; https://karmaguy.io/en/blog/reddit-self-promotion-rules ; https://www.linux-magazine.com/Online/News/r-opensource-Bans-AI-Assisted-and-AI-Related-Projects ; https://winbuzzer.com/2026/10/27/reddits-open-source-forum-bans-ai-assisted-projects-xcxwbn/ ; https://runtimewire.com/article/r-opensource-bars-ai-projects-and-requires-a-year-of-maintenance-for-promotion ; https://www.reddit.com/r/selfhosted/comments/1rmt39o/ (via search) ; git log in /home/user/sudokUI (204 of 217 commits Co-Authored-By Claude)

### Norwegian subreddits: possibly the best fit for the nb version, rules not checked

Sizes:
- r/Norway: about 547k members; English and Norwegian are both allowed.
- r/norge: about 338k members; Norwegian only.
- r/norske: about 37k to 64k members.

I could not find the self-promotion rules for any of them. A "made in Oslo, free, no ads, no tracking, fully in Norwegian" post is a plausible fit, especially in r/norge, but whether it is allowed depends on the live sidebar. The owner should read each sidebar and pinned posts, or send one modmail asking whether a post about a free, non-commercial app is allowed, before posting.

The nb locale and the Norwegian Learn pages are a real advantage here, because few sudoku apps teach in Norwegian. I found no Spanish-language counterpart worth naming.

_effort: hours, impact: medium_

Risk: Rules are unknown. Many national subs ban advertising outright, so asking the mods first avoids a ban.

Evidence: https://gummysearch.com/r/Norway ; https://gummysearch.com/r/norge/ ; https://reddit.sentinel-team.org/subreddits/norske (all via search, undated)

### Small or missing subreddits: r/puzzles promo thread, r/LogicPuzzles, r/puzzlevideogames, r/CrackingTheCryptic, r/PWA; no killer or help sub found

- r/puzzles (about 432k to 444k members): links to apps or sites are allowed only in the stickied weekly thread "Promote your project in this thread", once a week. It costs little and does little.
- r/LogicPuzzles (about 3k members): asks for no spamming; an app-launch post has appeared there before.
- r/puzzlevideogames (about 22k members): self-promotion is its most common post type.
- r/CrackingTheCryptic: rules not found. Its audience follows variant puzzles, and sudokUI is classic sudoku only.
- r/PWA: active but small and developer-focused; rules not found.
- r/killersudoku, r/sudokusolving and r/SudokuHelp: no trace found. sudokUI has no killer sudoku anyway.
- r/iosgaming and r/AndroidGaming developer threads: wait for a store build. A "0 ads, offline, no tracking" post in r/iosgaming's Developer Saturday scored 820 points, so that pitch can work in gaming subs once there is an app-store link.
- A Reddit-native (Devvit) daily: other developers have built them. It would split the work, put the game behind Reddit accounts and compete with the mods' own game, so not now.

_effort: hours, impact: low_

Risk: Low.

Evidence: https://www.reddit.com/r/puzzles/wiki/index (via search) ; https://gummysearch.com/r/puzzles/ ; https://gummysearch.com/r/LogicPuzzles ; https://gummysearch.com/r/puzzlevideogames/ ; https://github.com/vitalyiegorov/suuudokuuu/issues/696 (r/iosgaming 1plhoso, 820 points) ; https://devpost.com/software/sudoku-sprint

### The 9:1 guideline is now each sub's own rule; disclosure and account history matter

Reddit stopped enforcing the "1 in 10" self-promotion rule sitewide in 2017. Its old self-promotion wiki page is marked "no longer updated".

Today Reddit's Spam article asks people whose contributions mostly link to a business they run or benefit from to be thoughtful about how often they post. Individual subs set their own ratio: r/InternetIsBeautiful uses 90/10 and r/webdev points to 9:1. Mods judge an account by its history, so an account that only ever posts sudokui.app links reads as a spammer.

In practice:
- Take part as a solver in the subs you plan to post in, for a few weeks before posting.
- Disclose in the first line ("I'm the developer").
- Post one project per sub, weeks apart.
- Never post the same text in many subs.

_effort: weeks, impact: medium_

Risk: Low. The risk lies in ignoring it: new or link-only accounts get filtered or banned.

Evidence: https://www.reddit.com/r/modnews/comments/6bj5de/state_of_spam/ (2017, via search) ; https://www.reddit.com/wiki/selfpromotion (marked "no longer updated", via search) ; https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam (via search)

## How comparable apps found their players

How the comparable sudoku apps and sites got their players. Most of the evidence comes from search-engine summaries. WebFetch could not reach reddit.com, news.ycombinator.com, hn.algolia.com, producthunt.com, hey.gg or forum.enjoysudoku.com, so I could not read those pages directly; they would need to be allowed in the session's network settings. I also used up the 200-call web search budget for this turn. "Sudoku Hub" could not be identified at all, and the link between the Enjoy Sudoku app and the forum rests on the shared domain, not on a source that says so. Figures marked as estimates come from Similarweb, Semrush or AppGoblin. Scratch notes are under /home/user/sudokUI/.vite/reach/research/.

What drove reach:
- **SudokuPad** is the player behind the link in every Cracking the Cryptic video. The channel has about 708k subscribers, and its "Miracle Sudoku" video went viral during the 2020 lockdown.
- **sudoku.coach** spread by word of mouth inside r/sudoku. Its developer posts there as u/sudoku_coach, and its "campaign" (a step-by-step learning path) is the stock answer to "how do I learn" threads. About 81% of its traffic is direct.
- **Good Sudoku** had one launch day: a known designer (Zach Gage), a clear claim ("apps don't teach"), and the Apple press all writing about it the same day.
- **Sudoku.com** reached players with money: paid ads, app store rank, and the exact-match domain it bought.
- **sudokuwiki.org** got there through SEO and by being the reference people link to for 15 or more years.
- **HoDoKu** and **Enjoy Sudoku** spread through the expert forum. Enjoy Sudoku shares the enjoysudoku.com domain with the forum.
- **Logic Wiz** spread through the app stores, with a family of related apps.
- **Indie apps** that grew by word of mouth had a name that was also the pitch, plus one good post. Not Evil Sudoku reached 50k installs, mostly organic, after one r/Apple post and Product Hunt. Wordle grew from 90 to 300k players in two months through a spoiler-free share button.

What players miss:
- **Ads**, above all on Sudoku.com: about 27 "too many ads" complaints, including ads in the middle of a game.
- **Hints that teach.** Many hints just reveal the answer, or fail on hard puzzles.
- **Offline play and platform.** Good Sudoku is reported not to work offline (one indie developer's notes say so), and it is iOS-only and paid.
- **Account friction.** sudoku.coach players report campaign progress and sync problems.
- **Three-strike mistake limits.**

"No ads" alone no longer stands out: dozens of apps on the store use it as their name. Reddit is a closed door for promotion. Since a 13 March 2026 moderator post, r/sudoku removes app, website and channel announcements (I could only see this rule through one indie developer's notes). Help requests and puzzle posts are still welcome, and the owner is banned anyway. So Reddit reach can only come from players asking for help with a link to sudokUI.

The gap, in one sentence a player would repeat: "When you're stuck, sudokui.app shows you the actual technique on your own grid, draws the chain, and teaches you to see it next time; it's free, works offline, no ads, no sign-up." For forum regulars: "It's HoDoKu in your pocket, with hints that draw the chain."

Recommended reach work, in order:
1. Ask the sudoku teachers on YouTube (Sudoku Guy, Sudoku Swami), puzzle newsletters and bloggers to use sudokUI position links. This is the SudokuPad route.
2. Make the help-request share kit, so that a player's r/sudoku "I'm stuck" post carries a position link.
3. Do one launch moment built on the hint engine: a Show HN, and an Enjoy Sudoku forum post with the HoDoKu angle and the phase-4 crowd times.
4. Put sudokUI in the Google Play store as a web wrapper (a Trusted Web Activity, as sudoku.coach does), with no accounts.
5. Write factual comparison pages, since the "best sudoku app" search results and AI answers are where people discover apps now.

### SudokuPad: reach came from being the player behind every Cracking the Cryptic link

Cracking the Cryptic (Simon Anthony and Mark Goodliffe, since 2017) has about 708k subscribers. The 'Miracle Sudoku' video (10 May 2020) spread by word of mouth during lockdown, reaching about 3M views; the channel's top video has 10M+. Every video description has a 'try the puzzle' link, which opens in Sven Neumann's player (app.crackingthecryptic.com, now sudokupad.app). Neumann built that player and pays for it himself. Puzzle setters also hand puzzles to each other as SudokuPad links. The paid store app ($2.99) is secondary; the reach is the link format sitting inside a big creator's routine. Lesson for sudokUI: its /p/ and #s= links can play the same role, but only if a teacher or creator uses them in public. Being 'the place the link opens' grows reach on its own, with no accounts needed. Action: email sudoku teaching channels and puzzle writers, offering position links that open their example with candidates and a drawn hint. Teaching channels such as Sudoku Guy (Robin Jarman, reported 85k followers) and Sudoku Swami are recommended on r/sudoku. Cracking the Cryptic itself is tied to SudokuPad.

_effort: days, impact: high_

Risk: Creators may decline or ignore the email. Cracking the Cryptic will not switch away from SudokuPad. Outreach is something the owner does, not a feature.

Evidence: https://en.wikipedia.org/wiki/Cracking_the_Cryptic ; https://theoxfordblue.co.uk/cracking-the-cryptic-on-the-beauty-of-sudoku/ ; https://www.thenationalnews.com/lifestyle/puzzlingly-compelling-watch-a-man-solve-miracle-sudoku-with-only-two-numbers-filled-in-1.1024674 ; https://www.hey.gg/blog/sudokupad (search summary; fetch blocked) ; https://www.diggitmagazine.com/node/6248 ; https://kottke.org/26/06/0049089-variant-sudoku-puzzles ; https://tildes.net/~games/wah/solving_a_sudoku_with_no_actual_digits_at_all ; https://shoptalkshow.com/619/ ; https://infonews.ca/?p=84667 ; https://www.cbc.ca/news/canada/british-columbia/sudoku-guy-online-puzzle-tutorials-1.4580449

### sudoku.coach: word of mouth in r/sudoku, a named learning path, a store wrapper, brand-direct traffic

Jan Feldmann (Aachen) builds sudoku.coach. Its reach drivers:
(a) He takes part in r/sudoku as u/sudoku_coach, and the site is the standard answer in 'how do I learn' threads (July 2024, March 2025, April 2025). Commenters say: 'If you learn by doing, Sudoku.Coach is cool'; 'the campaign teaches all patterns'.
(b) The 'campaign' gives the learning path a name.
(c) A Google Play web wrapper, coach.sudoku.twa: 10k+ downloads, 5.0 from about 100 reviews.
(d) Two Product Hunt launches (Dec 2023; Sept 2024 with 172 upvotes).
(e) A Buy Me a Coffee page for funding.
Semrush (Sept 2025, estimate) puts 81% of its traffic as direct and 7.9% from Google, with the brand name 'sudoku coach' its top keyword (about 42%). In other words, people tell each other the name; generic SEO plays a small part. Similarweb lists sudokuwiki.org as its closest site, so they share an audience. It has accounts: one thread shows campaign progress tied to login and sync, with players blocked at a boss puzzle. Lesson: a named path ('the campaign') is easy to recommend. sudokUI's learning path should have a name players can say. The r/sudoku route is closed to the owner.

_effort: hours, impact: medium_

Risk: Copying its community route is impossible while the owner is banned. Copying its account or social features would break the owner's principles. Take only the named path and the store wrapper.

Evidence: https://play.google.com/store/apps/details?id=coach.sudoku.twa ; https://www.linkedin.com/in/jan-feldmann-a91961276/ ; https://buymeacoffee.com/sudoku.coach ; https://www.producthunt.com/products/sudoku-coach/launches (search summary) ; https://www.semrush.com/website/sudoku.coach/overview/ ; https://www.similarweb.com/website/sudoku.coach/competitors/ ; https://cal1.lr.ggtyler.dev/r/sudoku/comments/1dv63b4/brand_new ; https://redlib.hbubli.cc/r/sudoku/comments/1j6e33x/help_a_fellow_sudoku_player ; https://redlib.hbubli.cc/r/sudoku/comments/1jqgkxp/need_a_new_challenge ; https://axebps-redlib.hf.space/r/sudoku/comments/1k4q0xq/cant_access_lessons_in_sudokucoach ; https://sudokutimes.com/best-sudoku-apps/

### Good Sudoku: one launch day with a designer's name, a clear claim and the Apple press

Launched on iOS on 23 July 2020 by Zach Gage and Jack Schlesinger: free, with a $3.99 unlock. Same-week coverage came from 9to5Mac, iMore, Six Colors, Daring Fireball, MacSparky, Loop Insight, TouchArcade, Pocket Gamer and Vice, and it took a rotating App Store banner in Germany. The claim was simple: existing apps don't teach newcomers. The hints came from a solver running during play and inferring what the player knows. Criticism: auto-complete means 'you are not actually solving the puzzle fully yourself' (noescapevg); a player reported reaching a state that, by its own hints, needs trial and error. An indie developer's notes say players love its hints but criticise that it does not work offline. It is iOS-only and paid. Lesson: one dated launch with a single claim, sent to a hand-picked list of writers, beats a slow drip. sudokUI's claim is close to Good Sudoku's, and stronger: HoDoKu depth, drawn chains, offline, free, every platform.

_effort: days, impact: high_

Risk: sudokUI has no known name behind it, so press pickup is uncertain. Launch only when the hint work is presentable, because a launch can only be done once.

Evidence: https://9to5mac.com/2020/07/23/good-sudoku-ios-app-launches-to-save-sudoku/ ; https://www.imore.com/zach-gage-releases-good-sudoku-reimagined-and-fun-take-classic ; https://sixcolors.com/link/2020/07/zach-gage-returns-with-good-sudoku/ ; https://daringfireball.net/2020/07/good_sudoku_by_zach_gage ; https://www.macsparky.com/blog/2020/07/good-sudoku/ ; https://www.loopinsight.com/2020/07/27/a-sudoku-app-to-rule-them-all/ ; https://www.vice.com/en/article/good-sudoku-is-making-me-good-at-sudoku ; https://www.appgefahren.de/tag/good-sudoku ; https://noescapevg.com/good-sudoku-bad-sudoku/ ; https://game-solver.com/good-sudoku-by-zach-gage/ ; https://github.com/vitalyiegorov/suuudokuuu/issues/696 (search summary)

### Sudoku.com (Easybrain): reach bought with paid ads, store rank and an exact-match domain; ads are the main complaint

Easybrain's portfolio passed 2.5B downloads by April 2026, and Sudoku.com is named as a lead title. AppGoblin estimates the iOS app at about 291M installs and 15.7M monthly users. Easybrain bought the sudoku.com domain from Gaming Realms to take web search. Miniclip bought Easybrain for $1.2B (Nov 2024). Its store reviews carry a 'Too many ads' tag (27), with reports of ads 'every 30 seconds' and a 'random chance to get an ad in the middle of the game every time you complete a line'. Lesson: you cannot match this, but it creates refugees. Yet the 'no ads' niche is crowded: dozens of store apps are literally named 'No Ads' (one, Sudoku ′ No ads, has 28k ratings). Another indie's research found 'free, offline, no ads' no longer stands out, and its English 'sudoku no ads' landing page got 1 impression. Lead with teaching and keep 'no ads' as the closing line.

_effort: hours, impact: medium_

Risk: Leading with 'no ads' blends into the crowd of no-ads apps; leading with teaching takes a sentence of explanation.

Evidence: https://easybrain.com/news ; https://easybrain.com/news/the-easybrain-team-is-excited-to-reach-over-200-000-000-downloads ; https://appgoblin.info/apps/com.easybrain.sudoku.android ; https://www.baijing.cn/article/52535 ; https://gamingonphone.com/news/miniclip-acquires-mobile-game-developer-easybrain-from-embracer-group-for-1-2-billion ; https://mwm.ai/apps/sudoku-com-number-games/1193508329 ; https://apps.apple.com/us/app/-/id329981776 ; https://github.com/vitalyiegorov/suuudokuuu/issues/696 ; https://github.com/vitalyiegorov/suuudokuuu/issues/774

### sudokuwiki.org and HoDoKu: a long-lived reference plus the expert forum; HoDoKu's audience has no app now

sudokuwiki.org (Andrew Stuart, about 2007 onward; book 'The Logic of Sudoku') reached people by being what others link to: strategy pages and a step-by-step solver. Strategy guides cite it as 'the classic reference', and a reader-feedback archive runs from 2006 to 2025. Traffic is about 188k visits in Nov 2025 (Similarweb estimate). It shows ads and explains on its own examples. HoDoKu (Bernhard Hobiger, GPLv3, 2008–12) spread through the expert forums and became the vocabulary for techniques and ratings. Its last release was 2.2.0 in 2012, SourceForge says it is no longer developed, and a fork (1to9only 2.2.4) keeps it alive as desktop Java. Lesson: the HoDoKu audience has no mobile or offline home, and 'HoDoKu's techniques and ratings in your pocket, with drawn hints' is a credible message for the Enjoy Sudoku forum. The 267 Learn pages are the right long-term SEO play (the sudokuwiki route). They pay off over years, not weeks.

_effort: weeks, impact: medium_

Risk: SEO is slow, and the pages must stay engine-checked. A forum audience brings credibility more than traffic.

Evidence: https://www.sudokuwiki.org/ ; https://www.sudokuwiki.org/The_logic_of_Sudoku ; https://www.sudokuwiki.org/sudokufeedback.asp?cy=2006 ; https://amuselabs.com/resources/guides/sudoku-strategy-resources/ ; https://sudoku-play.org/best-sudoku-websites/ ; https://www.similarweb.com/website/dailykillersudoku.com/competitors ; https://hodoku.sourceforge.net/ ; https://sourceforge.net/projects/hodoku/ ; https://sudopedia.sudocue.net/index.php/HoDoKu ; https://github.com/1to9only/HoDoKu

### Enjoy Sudoku: hint design and the forum shared one domain; the app seems to be fading

Enjoy Sudoku (Jason Linhart) had multi-stage hints, 'from a gentle reminder up to an illustration of the exact technique on the current board'. Using a hint added time to the clock, and hints for harder techniques added more. Its levels go up to X-Wings, sashimi fish and XY-Chains. The app manual lives at enjoysudoku.com/iphone and the New Sudoku Players' Forum at forum.enjoysudoku.com, so the app and the expert community share one domain. That is my reading of the URLs; I could not check further. The last version found is 2.5.3 (Sept 2024). One indie's research says it was pulled from the App Store, though an App Store listing with that name still shows; the status is unconfirmed. Lesson: the forum may lack a current mobile app to recommend for learning. The forum's 'On the web' subforum hosts developer threads. One 2023 'Advanced sudoku web app' thread drew 11 replies and the author 'lamented the lack of interest', so a bare announcement goes nowhere there. Bring data, such as the phase-4 median human time per HoDoKu band.

_effort: days, impact: medium_

Risk: Whether it is really gone from the store is unconfirmed. Forum regulars are sceptical of developer posts that bring no new data.

Evidence: http://www.enjoysudoku.com/iphone/manual.html ; https://www.amazon.com/Jason-Linhart-Enjoy-Sudoku/dp/B004AZH4C8 ; https://enjoy-sudoku.updatestar.com/ ; https://sudokupulse.com/articles/best-sudoku-apps/ ; http://forum.enjoysudoku.com/on-the-web-f17.html ; http://forum.enjoysudoku.com/advanced-sudoku-web-app-t41953.html ; https://github.com/vitalyiegorov/suuudokuuu/issues/696 ; https://apps.apple.com/app/id6466218894

### Logic Wiz: app stores, cross-promotion between sibling apps and breadth of variants; sudokUI has no store presence

Logic Wiz's 'Sudoku & Variants' (com.uvmlab.usudoku) has about 931k Google Play installs, 4.70 from 11.8k ratings, and more than $50k a month in estimated revenue (AppGoblin). It sits in a family of apps (Killer, Jigsaw, Suguru) that promote each other, with 35–40 variants and 'smart hints' that show the next logical step. Its reach is store search plus that family. Lesson: many players only look in the stores. sudoku.coach shows that a no-account web wrapper (TWA) on Google Play gets listed and rated (10k+ downloads). sudokUI could ship the same PWA as a Play TWA in a few days, with no accounts, keeping its offline promise. An iOS store presence would need a real app shell and is a bigger step.

_effort: days, impact: medium_

Risk: The Play developer account, data-safety form and reviews add upkeep. Store users expect variants, which sudokUI's goals defer on purpose.

Evidence: https://appgoblin.info/apps/com.uvmlab.usudoku ; https://apps.apple.com/us/app/-/id1530683853 ; https://apps.apple.com/app/id1641151077 ; https://appgoblin.info/apps/com.uvmlab.suguru ; https://play.google.com/store/apps/details?id=coach.sudoku.twa

### Indie apps that grew by word of mouth: a name that is the pitch, one good post, a share button

Not Evil Sudoku (Ashish Selvaraj, launched 14 Apr 2022) reached 20k installs by about Sept 2022, 'mostly organic (18k at least)'. Its 'only marketing was a post on r/Apple that did quite well', plus Twitter with about 100 followers. It passed 50k (organic plus Reddit) by Jan 2023 with a Product Hunt day (#6, 127 upvotes). Its name says the difference. Wordle went from 90 players (1 Nov 2021) to 300k (2 Jan 2022), then millions. The share button (16 Dec 2021) copied a format a player had invented by hand. A Hacker News caution: a sudoku app is a familiar game that 'gets very little buzz... unless it has some overwhelmingly strong new feature'. The 2023 Show HN 'Sudoku with 0 Bells or Whistles' mostly drew pointers to rivals (Open Sudoku, F-Droid apps, SudokuPad). Lesson: a Show HN for sudokUI should be about the hint engine, not 'another sudoku app'. The hint engine means hints drawn from the player's own candidates, HoDoKu's catalogue in TypeScript running offline, free-tier Cloudflare, and ID-less telemetry. Product Hunt gives a modest one-day spike: about 130–170 upvotes for comparable apps.

_effort: days, impact: high_

Risk: A Hacker News post either takes off or vanishes in an hour, and it has to come from the owner. The spike only lasts if the page converts and the daily keeps people coming back.

Evidence: https://www.indiehackers.com/post/my-sudoku-app-passed-20-000-installs-ama-86e6870147 ; https://www.indiehackers.com/post/not-evil-sudoku-is-live-on-ph-crosses-50-000-installs-b5cefc216b ; https://www.producthunt.com/posts/not-evil-sudoku ; https://en.wikipedia.org/wiki/Wordle ; https://techcrunch.com/?p=2256733 ; https://news.ycombinator.com/item?id=34611732 ; https://news.ycombinator.com/item?id=34613400 ; https://news.ycombinator.com/item?id=5067709

### r/sudoku is closed to promotion: only players' help and puzzle posts can carry sudokUI there

According to another indie developer's research (27 Oct 2026), a 13 March 2026 moderator post makes app, website and channel announcements removable under Rule 2, and the moderators asked people not to use the sub for marketing. Individual puzzles, help requests and technique discussion stay welcome. The moderators run a daily puzzle post and are building their own Reddit game (r/playsudoku). Pitch posts for 'free, offline, no ads' apps drew little engagement. The same research says importing a puzzle string or link is the community norm, and treats it as a gap for its own app. With the owner banned, Reddit reach can only come from a player's 'I'm stuck' post or 'nice puzzle' post that carries a sudokUI link. The share kit should make exactly that post easy and good: the position link with candidates and colours, the puzzle string, an image of the board, and the hint behind a spoiler. It should never auto-post or name the app in a promotional way. Treat Reddit as one landing source among many. Telemetry already buckets reddit as a referrer, so its real share can be measured.

_effort: days, impact: medium_

Risk: The rule comes from one third-party summary; read the sidebar before relying on it. Moderators could read sudokUI links as promotion if they look templated. Keep the post text the player's own.

Evidence: https://github.com/vitalyiegorov/suuudokuuu/issues/696 (search summary; original mod post cited there as reddit.com/r/sudoku/comments/1rsjzov/) ; https://github.com/vitalyiegorov/suuudokuuu/issues/697 ; /home/user/sudokUI/worker/telemetry.ts:320 ; /home/user/sudokUI/.vite/reach/proto.test.ts

### What players say they miss

Recurring complaints and wishes:
- **Ads.** Sudoku.com's 'Too many ads' tag, ads in the middle of a game, unclosable ads in other apps.
- **Hints that teach.** Auto-candidates and hints feel 'like it's just telling me the answer' (Quarter To Three forum). Apps advertise hints that 'help you learn the why'. Some solvers show 'No Hints Available' on hard puzzles. HN discusses direct versus suggestive hints.
- **Offline and platform.** Good Sudoku is reported not to work offline, and is iOS-only and paid.
- **Account and sync friction.** sudoku.coach's campaign stalls on login and sync.
- **Mistake limits.** Three-strike limits; another indie found 'no 3-strike limit' a selling point worth stating.
- **Daily puzzles that don't teach.** NYT Sudoku is a daily habit that 'doesn't teach the player' (Medium comparison).
- **Importing.** Players want to bring any puzzle in by paste, link or photo.
sudokUI already answers all of these: hints from the player's own candidates, scan, paste and photo import, offline, no account, no ads. The work is to say so in the words players use.

_effort: hours, impact: high_

Risk: Most of this comes from store reviews and single-author summaries, not a survey.

Evidence: https://mwm.ai/apps/sudoku-com-number-games/1193508329 ; https://forum.quartertothree.com/t/sudoku-are-the-harder-puzzles-just-trial-and-error/162752 ; https://apps.apple.com/is/app/sudoku-classic-puzzle-games/id1566491412 ; https://sudokusolver.app/ ; https://news.ycombinator.com/item?id=34611732 ; https://axebps-redlib.hf.space/r/sudoku/comments/1k4q0xq/cant_access_lessons_in_sudokucoach ; https://github.com/vitalyiegorov/suuudokuuu/issues/702 ; https://github.com/vitalyiegorov/suuudokuuu/issues/697 ; https://medium.com/@noobsudoku67/i-spent-a-week-playing-on-4-sudoku-websites-so-you-dont-have-to-a85b978aad29

### Discovery now runs through 'best sudoku app' listicles and AI answers

Search results for 'best sudoku app' or 'no ads' are filled with indie apps' own listicles: sudoku-royale.com ('Best Free Sudoku Apps With No Ads (2026)', 'Best Alternatives to Sudoku.com'), sudokupulse, nearhub, sudokutimes. There are also AI-visibility pieces, such as Frevana's 'Perplexity says sudoku.coach is the best overall Sudoku web app'. The apps named in these become what AI assistants repeat. sudokUI already counts an 'ai' referrer. Low-cost moves:
- An honest comparison page on the site (sudokUI vs sudoku.coach, SudokuPad, HoDoKu, Good Sudoku), engine-checked and factual.
- Get listed as an alternative on AlternativeTo under HoDoKu, SudokuPad and sudoku.coach. AlternativeTo pages rank in these searches.
- Write to the authors of the roundups.
This is long-tail work, not a spike.

_effort: days, impact: medium_

Risk: Comparison pages can read as marketing and go stale as rivals change. Keep claims dated and checkable.

Evidence: https://www.sudoku-royale.com/resources/best-sudoku-app-no-ads ; https://www.sudoku-royale.com/resources/alternatives-to-sudoku-com ; https://sudokupulse.com/articles/best-sudoku-apps/ ; https://www.nearhub.us/blog/10-best-sudoku-apps-no-ads ; https://sudokutimes.com/best-sudoku-apps/ ; https://www.frevana.com/content/en/best-web-apps-for-playing-sudoku-online-ckgw4u11xrwq8 ; https://alternativeto.net/software/hodoku/about ; https://alternativeto.net/software/sven-s-sudokupad/about ; /home/user/sudokUI/worker/telemetry.ts:279

### The gap sudokUI fills, in one sentence a player would repeat

No comparable app combines all of these:
- sudoku.coach teaches, but needs an account to keep progress and is online.
- Good Sudoku teaches, but is iOS-only and paid, and is reported not to work offline.
- SudokuPad plays beautifully, but does not teach classic techniques.
- sudokuwiki explains on its own examples and shows ads.
- HoDoKu is deep, but is unmaintained desktop Java.
- Sudoku.com is ads.
sudokUI covers all of it at once: free, offline, no account, HoDoKu depth, and hints drawn on the player's own position. Sentence for a friend: "When you're stuck, sudokui.app shows you the actual technique on your own grid, draws the chain, and teaches you to spot it next time; it's free, works offline, no ads, no sign-up." For forum regulars: "HoDoKu in your pocket, with hints that draw the chain." Put it on the home page, the share card text, and any launch post. Name the learning path the way sudoku.coach named its 'campaign', so it can be recommended in two words.

_effort: hours, impact: high_

Risk: The claim only holds while the hints really do teach at every level. The hint-readability work that is continuing is what backs the sentence.

Evidence: Synthesis of the findings above; https://play.google.com/store/apps/details?id=coach.sudoku.twa ; https://axebps-redlib.hf.space/r/sudoku/comments/1k4q0xq/cant_access_lessons_in_sudokucoach ; https://9to5mac.com/2020/07/23/good-sudoku-ios-app-launches-to-save-sudoku/ ; https://sudokupad.app/ ; https://hodoku.sourceforge.net/ ; https://sudoku-play.org/best-sudoku-websites/

## Other channels

Ranked channels other than Reddit for sudokUI, a free, offline, GPL sudoku trainer with no account. The ranking weighs fit with its teaching edge, then impact per hour of the owner's time.

How this was researched:
- Most fetches were blocked in this session. sudokui.app, forum.enjoysudoku.com, news.ycombinator.com, sudokuwiki.org and developer.chrome.com would not resolve; only GitHub was reachable. So the web evidence comes from search-result extracts plus GitHub, and the forum's own rules thread could not be read.
- The shared web-search budget (200 calls) ran out near the end. Search Console setup steps, IndexNow, iOS rules and "app of the week" columns were not verified this session.
- The sitemap was analysed from the build output at /home/user/sudokUI/dist/sitemap.xml, not the live file. The URL list is saved at /home/user/sudokUI/.vite/reach/sitemap-urls.txt.

Ranking:
1. **Enjoy Sudoku forum, Software section** (hours; medium impact, high influence). Authors announcing their own solvers there is the norm.
2. **SEO groundwork, then targeted Learn work** (days to weeks; the highest long-run impact). Search Console, a "HoDoKu online" page, the long tail of rare techniques, per-technique share images, accurate lastmod dates, links to related techniques.
3. **AlternativeTo listing** (hours; medium impact). Its HoDoKu alternatives page ranks for "hodoku online".
4. **Show HN, once** (days of preparation; high variance). Show HN posts from new accounts are restricted since March 2026, and AI-written or AI-edited comments are banned, so the text must be written by hand.
5. **Sending creators a tool for their viewers** (hours per pitch; low to medium impact, high variance). The offer is position links and SudokuPad import, not "please review my app".
6. **Microsoft Store via PWABuilder** (free since September 2025; a day). HoDoKu itself is listed there.
7. **Norway** (hours to days; low to medium impact). A link from menneske.no, a kode24 technical article built around ekomloven § 3-15, then a Norwegian maths-day activity through LAMIS.
8. **Google Play as a Trusted Web Activity** ($25; personal accounts need 12 testers opted in for 14 days; weeks of calendar time). It helps trust and installs, not discovery: about 2,669 apps compete for "sudoku" and the leaders have about 100 million installs.
9. **Cracking the Cryptic fan Discord and the SudokuPad bridge** (ongoing; low to medium impact).
10. **Puzzle newsletters** (hours; low impact).
11. **Product Hunt** (low impact). The best sudoku result found is sudoku.coach at 172 upvotes, #13 of its day; most sudoku launches get 0 to 4.
12. **PWA directories** (low impact; mostly backlinks).
13. **Lemmy, Mastodon and Bluesky** (low impact). No sudoku community of size exists; !sudoku@lemmy.world has about 66 subscribers.
14. **Schools outside Norway** (low impact, slow).

Things that matter across all channels:
- **A direct competitor exists.** Hodoku Revisited (hodokurevisited.com) is a TypeScript rebuild of HoDoKu with an offline "AI coach", four-stage hints and "Why not?". It aims at the same query and the same audience. sudokUI's case has to rest on drawn chains, a learning path built from the player's own play, the shared daily, three languages, and checked correctness.
- **Most visits will not be counted.** Landings are counted only on /p/ and /daily/ addresses, and many channels (AlternativeTo, Product Hunt, Lemmy, most Mastodon servers, Norwegian press) have no word of their own in the landing-source list. Add those words before any launch, and link to share addresses when a post's effect needs to be read.
- **Learn pages share badly.** All 249 Learn pages use the same generic preview image, and the home page's description says "61" practice techniques where goals.md says 65.

### Forum.enjoysudoku.com Software section: announce sudokUI as a program thread, then take part as a solver

FIT: the highest of any channel. This is where HoDoKu, YZF_Sudoku and SudokuExplainer users live. In the forum's own 'most commonly used software' thread, HoDoKu is called very fine but 'far from up to date' (last release 2012). YZF_Sudoku, 'modelled on HoDoKu', last shipped in 2022. SudokuExplainer is the rating standard but is not used for learning. A maintained, browser-based, HoDoKu-compatible trainer fills a gap these people describe themselves.
NORMS: the Software section is for 'programs which generate, solve, and analyze Sudoku puzzles'. Authors open their own threads ('I'm glad to publish my sudoku solver here for the first time'; CSP-Rules; YZF_Sudoku runs to 20+ pages), so announcing your own program there is normal. Members call out drive-by promotion from accounts with two posts. A moderator sends generation topics to the Programmers forum. The written rules thread could not be fetched (the host was blocked in this session).
EFFORT: hours for the post, then ongoing replies.
IMPACT: low to medium in visits (a small forum). High in credibility and second-order reach: these regulars build sudokuwiki-grade knowledge (the Tridagon was developed there in 2022-2025) and will test the ratings. That suits 'Measured, not asserted'. The landing word 'enjoysudoku' already exists.
FIRST STEP: the owner posts in Software, from an account with a few genuine posts first: 'sudokUI: HoDoKu-compatible ratings and drawn hints in the browser (GPL, offline)'. Include the technique table (77 implemented), the HoDoKu-parity claim and how it is tested, and an explicit request to report rating differences against HoDoKu or SE. Link a /p/ address so landings are counted. Later, answer 'Help with puzzles and solving techniques' threads with a #s= position link only where the drawn chain answers the question. Save the phase-4 'median human time per band' result for this forum, as online-goals.md already plans.

_effort: hours, impact: medium_

Risk: The experts will find engine bugs in public; answer quickly, which also makes for good publicity. A brand-new account posting a link first reads as spam.

Evidence: http://forum.enjoysudoku.com/software-f18.html ; http://forum.enjoysudoku.com/what-is-the-most-commonly-used-software-t40117.html ; http://forum.enjoysudoku.com/csp-rules-sudorules-kakurules-t38200.html ; http://forum.enjoysudoku.com/yzf-sudoku-t36846.html ; http://forum.enjoysudoku.com/universal-sudoku-solver-t32972.html ; https://www.sudokuwiki.org/Tridagons ; /home/user/sudokUI/docs/online-goals.md (Phase 4, 'A launch moment'); /home/user/sudokUI/worker/telemetry.ts:321

### Competitor to position against everywhere: Hodoku Revisited and newer technique sites

hodokurevisited.com is 'a free sudoku solver and trainer in your browser' and a TypeScript rebuild of HoDoKu. It claims step-by-step parity with HoDoKu 2.2.0, four-stage hints (Where to look / The pattern / The logic / Conclusion), 'Why not D?' on any cell, an offline install, and a local 'AI Super Solver & Coach' (GitHub ntropey/hodoku_revisited, Revisited Labs). This is almost exactly sudokUI's pitch, aimed at the same 'hodoku online' query and the same Enjoy Sudoku audience. Newer AI-era technique sites (xodoku.pages.dev, rated-sudoku.pages.dev, sudokubliss.com, sudokupulse) also now rank for rare technique names. sudoku.coach owns the Reddit and Product Hunt mindshare.
WHAT TO DO: lead every channel with what is unique to sudokUI. Chains are drawn on the board as arrows. The learning path is built from the player's own unaided moves. Practice puts the target move next. There is a shared daily with global anonymous times. It speaks three languages. The engine is checked by a soundness harness. Never claim to be 'the only HoDoKu in a browser'.

_effort: hours, impact: high_

Risk: If this is ignored, Enjoy Sudoku and HN commenters will ask 'how is this different from Hodoku Revisited / sudoku.coach?' and the thread will go that way.

Evidence: https://hodokurevisited.com/ ; https://github.com/ntropey/hodoku_revisited/pull/43 ; https://github.com/ntropey/revisited_labs ; https://xodoku.pages.dev/techniques/sue-de-coq ; https://rated-sudoku.pages.dev/en/docs/techniques/chain ; https://sudokubliss.com/guides/sue-de-coq ; https://hunted.space/dashboard/sudoku-coach/launches/sudoku-coach-2

### SEO 1: Search Console, sitemap lastmod and the 'HoDoKu online' query (winnable now)

STATE (from the build output dist/sitemap.xml): 270 URLs. That is 83 Learn URLs in each of three languages (80 techniques plus the index, intuition and glossary; 249 in all), plus home, daily-sudoku, sudoku-solver, sudoku-difficulty-rating, hodoku, how-the-best-solve and privacy in each language, all with hreflang. There is no lastmod anywhere. Google ignores changefreq and priority and uses lastmod only when it is 'consistently and verifiably accurate'. Learn pages carry Article and BreadcrumbList; the home page carries WebApplication.
RICH RESULTS ARE NOT WORTH MORE WORK: FAQ rich results were dropped on 7 May 2026, HowTo in 2023, and several education types in 2025-26. Schema will not buy snippets.
WINNABLE QUERY: for 'hodoku online' the results show AlternativeTo's HoDoKu page, SourceForge, an OnWorks 'run HoDoKu online' emulator and Softpedia, with no real web app among them. Hodoku Revisited targets the same query.
FIRST STEPS:
(1) Add a Domain property in Google Search Console, verified by DNS TXT on the Cloudflare zone, and submit /sitemap.xml. Then use URL Inspection on the ten pages that matter most.
(2) Have scripts/build-learn.ts write a real lastmod (the date each page's content last changed, for example from git), never the build date.
(3) Retitle /hodoku/ around the query people type, for example 'HoDoKu online: ratings and hints in your browser, no Java'. Today it is 'HoDoKu-compatible sudoku ratings in your browser'. Credit Bernhard Hobiger and the GPL, and do not imply it is official.
(4) Fix the home page's description, which says 'practise 61 solving techniques' while goals.md says practice covers 65. The stale number already shows in third-party search snippets.
EXPECT weeks to months of 'Crawled / Discovered - currently not indexed' on a new domain; that is normal.

_effort: hours, impact: medium_

Risk: The live sitemap could not be fetched (sudokui.app was blocked in this session), so it may differ from the build output. Fake lastmod dates get ignored.

Evidence: /home/user/sudokUI/dist/sitemap.xml (270 <loc>, 0 lastmod); /home/user/sudokUI/.vite/reach/sitemap-urls.txt ; /home/user/sudokUI/dist/hodoku/index.html <title>; /home/user/sudokUI/src/content/home.ts:88,91,107 ; https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping?hl=es-419 ; https://www.relevantaudience.com/seo/google-search-off-the-record-do-sitemaps-still-matter/ ; https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/ ; https://www.digitalapplied.com/blog/structured-data-after-io-2026-schema-updates ; https://alternativeto.net/software/hodoku/ ; https://www.onworks.net/software/linux/app-sudoku-for-java-hodoku ; https://ahrefs.com/blog/crawled-currently-not-indexed/

### SEO 2: Learn pages, which queries are winnable and what to change on the pages

WINNABILITY (from results observed in this session; the search engine is not Google, so treat as directional):
(a) Rare technique names (sue de coq, tridagon, death blossom, exocet, aligned pair exclusion, ALS-XZ, 3D Medusa, franken fish, sk-loop): the competitors are sudokuwiki, Sudopedia, the HoDoKu docs, forum threads and a few AI-written sites. sudokUI can reach the top five within months. Each query is small, but together they are exactly the target audience.
(b) Mid techniques (x-wing, xy-wing, skyscraper, swordfish, w-wing): crowded with sudokuwiki, sudoku.com.au, sudoku9x9, 247sudoku, sudokuonline.io, sudokulovers and keyword-stuffed spam farms (*.shuduku.it.com subdomains filled the results). Hard for a domain created in July 2026; a long play.
(c) 'sudoku solver step by step': a head term dominated by spam and established solvers; low winnability for /sudoku-solver/.
(d) 'sudoku hint explained': almost no real query; the results are app-store pages. Do not target it.
(e) The nb and es Learn pages may face little competition for queries like 'sudoku teknikker' or 'técnicas sudoku'. This was not verified; confirm with Search Console's language and country filters.
PAGE CHANGES:
- Pages run 370-600 words including navigation (whale 370, median about 519). Deepen the top 15 rare and mid techniques with a second example, 'how to spot it', and the play and practice links above the fold. Interactive practice is the one thing the ranking pages lack.
- Add related links along the chain idea. /learn/x-wing/ links the fish family but not Skyscraper, 2-String Kite, Finned X-Wing or X-Chain, although goals.md calls chains the skill that generalises.
- Every Learn page uses the generic /og-card.png. Render one PNG card per technique (the SVGs already exist in /learn/img/), so a Learn link pasted into a forum, Discord or Mastodon previews the actual pattern. This helps every other channel in this list.

_effort: weeks, impact: high_

Risk: Scaled-content risk if pages are padded with words instead of examples, which the 'Do not build' list already warns against.

Evidence: /home/user/sudokUI/dist/learn/x-wing/index.html (og:image og-card.png; related links) ; word counts measured over /home/user/sudokUI/dist/learn/*/index.html ; https://www.sudokuwiki.org/Tridagons ; https://sudokuwiki.org/Sue_De_Coq ; https://sudopedia.sudocue.net/index.php/Sue_de_Coq ; https://hodoku.sourceforge.net/en/tech_misc.php ; https://www.sudoku9x9.com/x_wing.php ; https://sudoku.com.au/X-Wing-technique.aspx ; https://www.247sudoku.com/news/x-wing-strategy-in-sudoku-master-advanced-solving-technique/ ; https://tricks-to-sudoku.shuduku.it.com/x-wing-technique-sudoku.html ; /home/user/sudokUI/docs/goals.md (principle 3)

### AlternativeTo: list sudokUI as an alternative to HoDoKu, SudokuPad, sudoku.coach, Simple Sudoku and SudokuWiki

FIT: high. The HoDoKu alternatives page is itself the top result for 'hodoku online' in this session. Its open-source filter lists only LibreSudoku, Gauguin, Open Sudoku, KSudoku and USB Sudoku, none of them a technique trainer. SaaSHub's HoDoKu alternatives already picked up sudokUI ('HoDoKu-compatible ratings in your browser'), so the AlternativeTo listing is the missing one. AlternativeTo pages are also widely used as sources by answer engines (the landing list already has an 'ai' word).
NORMS: the owner needs an AlternativeTo account (his own; the app stays account-free). Use 'Suggest new application'. One guide says new accounts must be 7 days old before submitting, and moderation takes about 1-3 days (third-party guides; the FAQ is the authority). The developer can claim the listing with an email from the product's domain. No published self-promotion rule was found. List accurately and do not seed votes.
EFFORT: hours.
IMPACT: medium; steady long-tail visits and a durable backlink.
FIRST STEP: create the account now, so the 7-day wait runs out by the time the listing is ready. Then submit with the tags free, open source, offline, no tracking, no registration, PWA, Windows/Mac/Linux/Android/iOS via browser, and mark it an alternative to HoDoKu, SudokuPad, sudoku.coach, Simple Sudoku, YZF_Sudoku and the SudokuWiki solver. Claim it with feedback@sudokui.app.

_effort: hours, impact: medium_

Risk: Low. Listing details (licence, platforms) must be right, or the community edits them.

Evidence: https://alternativeto.net/software/hodoku/ ; https://alternativeto.net/software/hodoku/?license=opensource ; https://www.saashub.com/hodoku-alternatives ; https://alternativeto.net/faq ; https://noonlaunch.com/blog/alternativeto-review ; https://www.effortlessbacklinks.com/directory/alternativeto ; https://launchbuff.com/blog/how-to-list-on-alternativeto

### Show HN: one launch, built on the engineering and the privacy design, from an account that may post

FIT: high for HN's values: GPL, works with no signup, offline, no tracking, an ID-less telemetry design under Norwegian law (ekomloven § 3-15), Cloudflare free-tier budgeting, and 77 human techniques in TypeScript with drawn chains.
HN RULES (showhn.html as quoted in search extracts):
- It must be something people can try, ideally without signups or emails.
- Blog posts, sign-up pages, newsletters and lists are off topic.
- Minor version bumps do not qualify; a repost needs a major new development.
- No asking friends for votes.
CHANGES IN 2026:
- Since March 2026 HN restricts Show HN posts from new accounts (dang: 'Just new ones for now'; the threshold is at /showlim and was not readable here).
- Since 11 March 2026 the guidelines ban generated and AI-edited comments, and dang's Show HN tips reportedly ask posters to write the text by hand.
COMPARABLES: plain sudoku Show HNs get a lukewarm reception ('I Made a Sudoku Game', January 2024: 'doesn't feel good enough to justify playing a full game'). Others are 'Sudoku with 0 Bells or Whistles', 'Sudokle' and 'SudokuVariants'. Technical sudoku pieces do well: a TypeScript sudoku post reached the front page on 2024-08-23 with 229 points and 90 comments. So lead with the engine and the teaching, not with 'a sudoku app'.
EFFORT: days (the text, a demo position link, staying in the thread for 3-4 hours).
IMPACT: high variance. A front-page day brings a large one-day spike plus follow-on newsletter pickup; otherwise near zero. The 'hackernews' landing word exists.
FIRST STEP: the owner checks that his HN account is allowed to post a Show HN (/showlim). He writes the title and first comment himself, for example 'Show HN: A sudoku trainer that draws the chain behind every hint (offline, no account)', with who he is, why, how the engine is checked, the honest limits (classic only, no variants) and one /p/ link. Post on a weekday US morning (consensus from third-party guides, not an HN rule). Ideally post once the crowd-calibrated band times exist, as online-goals.md plans.

_effort: days, impact: high_

Risk: There is one good shot; a flop limits reposts. A new or low-karma account may be blocked from Show HN. AI-polished text gets flagged.

Evidence: https://news.ycombinator.com/showhn.html ; https://news.ycombinator.com/item?id=31374870 ; https://news.ycombinator.com/item?id=47300772 ; https://keydiscussions.com/2026/03/09/hacker-news-moves-toward-restricting-show-hn-posts-amid-the-ai-slop-wave/ ; https://aitoolly.com/ai-news/article/2026-03-12-hacker-news-updates-guidelines-prohibits-ai-generated-or-edited-comments-to-foster-human-conversatio ; https://favors.dev/blog/show-hn-launch-guide ; https://news.ycombinator.com/item?id=38913220 ; https://news.ycombinator.com/item?id=38915807 ; https://news.ycombinator.com/item?id=34611732 ; https://news.ycombinator.com/item?id=29998984 ; https://news.ycombinator.com/item?id=42782246 ; https://news.ycombinator.com/front?day=2024-08-23 ; https://hn.svelte.dev/item/9772114

### YouTube and creators: offer a tool for their viewers, not a request for a review

LANDSCAPE:
- Cracking the Cryptic: about 708K subscribers (October 2026). It sells its own sudoku apps on iOS, Android and Steam plus a Patreon, is mostly variants, and is unlikely to promote a third-party app. Reach it through its community instead (see the Discord finding).
- Sudoku.Global: about 1.12M subscribers since June 2025, but its videos are 'mainly shot on the Sudoku Global App'. Not a target.
- Classic-technique teachers are the realistic targets. Sudoku Guy (sudokuguy.com) has a numbered tutorial series reaching XY-Wing at #43 and was covered by CBC. Harold Nolte has about 200 videos from easy to diabolical. Smart Hobbies has a 'Sudoku Advanced Tutorial' series (X-Wing, XY-Wing).
- Feedspot's '40 Sudoku YouTubers 2026' (updated July 2026) is a ready list of prospects.
- Spanish press covers sudoku YouTube (Xataka on the 'eureka' videos), which matters for /es/.
THE PITCH: sudokUI already imports SudokuPad, f-puzzles and sudoku.coach links and writes position links (#s=) with marks and colours. A creator can put 'explore this exact position, with hints that draw the logic' under every video, and viewers can practise the technique the video taught. That is useful to the creator and asks nothing of them.
NORMS: one personal email per creator, after watching their work. Name a specific video and send a ready link for it. No mass mail.
EFFORT: about an hour per pitch.
IMPACT: low to medium; replies are rare, but one adopter brings recurring links in video descriptions. The 'social' word (youtube.com and the YouTube Android app) already counts these.
FIRST STEP: pick three tutorial videos (one each from Sudoku Guy, Harold Nolte and Smart Hobbies), build the sudokUI position link for the puzzle in each, and email the creator: 'here is your X-Wing video's position in an app that draws the pattern; free, no account; use it if it helps your viewers'.

_effort: hours, impact: medium_

Risk: Low reply rate. Creators with their own apps (CTC, Sudoku.Global) see sudokUI as a competitor.

Evidence: https://en.wikipedia.org/wiki/Cracking_the_Cryptic ; https://www.builtbyfoundry.io/blog/cracking-the-cryptic-8-sudoku-apps-2-dollar-monthly-puzzle ; https://vidiq.com/youtube-stats/channel/@sudoku.global/about/ ; https://videos.feedspot.com/sudoku_youtube_channels/ ; https://www.youtube.com/watch?v=kzXjcuiX0UQ ; https://www.youtube.com/watch?v=bkcE5w1r_iY ; https://www.cbc.ca/news/canada/british-columbia/sudoku-guy-online-puzzle-tutorials-1.4580449 ; https://www.xataka.com/videos/sudokus-resurgen-momentos-eureka-videos-que-resuelven-nueva-sensacion-youtube ; /home/user/sudokUI/README.md (import from SudokuPad, f-puzzles, Sudoku Exchange, sudoku.coach) ; /home/user/sudokUI/worker/telemetry.ts:327,370

### Cracking the Cryptic fan Discord and the SudokuPad bridge (Sven)

FIT: medium. The CTC fan Discord (discord.gg/BbN89j5) is community-run and dates from May 2020 (3,000 members within a month). It discusses solving, setting, theory and programming, has #ask-ctc, puzzle archive and testing channels, and per one summary beginner and advanced-technique channels. Most of the audience solves variants; sudokUI is classic-only by design.
SudokuPad's author takes feedback in #webapp-feedback there and in #sven-discussion on a 'Sudoku Solvers' Discord. Because sudokUI imports SudokuPad links, 'open this classic SudokuPad puzzle in sudokUI to see the drawn hint' is a natural bridge and not a rival pitch.
Other puzzle Discords are poor targets. Daily Sudoku Together (about 31.6K members) is a competing game's official server; the variant server does not fit.
NORMS: this server's rules could not be read. Discords usually confine self-promotion to a channel, or allow it after real participation. Read the rules and ask a moderator first.
EFFORT: ongoing, an hour or two a week.
IMPACT: low to medium. The 'discord' landing word exists.
FIRST STEP: the owner joins, reads the rules, and asks a moderator where a free classic-technique tool may be mentioned. Separately, a short, friendly note to Sven (svencodes.com) saying sudokUI opens classic SudokuPad links and draws the hint. No request attached.

_effort: hours, impact: low_

Risk: Seen as self-promotion if the first message is a link. Variant solvers may simply not care.

Evidence: https://crackingthecryptic.fandom.com/wiki/CTC_Fan_Discord ; https://crackingthecryptic.com/aboutus ; https://reapers-notes-v3.pages.dev/tutorials/Resources ; https://svencodes.com/ ; https://www.hey.gg/blog/sudokupad ; https://discord.com/servers/daily-sudoku-together-1300499527345770497 ; /home/user/sudokUI/worker/telemetry.ts:324

### Microsoft Store via PWABuilder: free, a day's work, and HoDoKu is already listed there

FIT: medium. HoDoKu is the classic Windows desktop tool, and a HoDoKu package is listed on the Microsoft Store (apps.microsoft.com/detail/9mw2135xrkh6). A Windows user who searches the Store for HoDoKu could find a listing that describes HoDoKu-compatible ratings.
COSTS AND RULES: individual registration has been free since September 2025, with no credit card, but needs a government ID and selfie check. PWABuilder packages the PWA (Package for stores, then Windows). A privacy policy is required, and /privacy/ exists. PWA is an accepted format.
EFFORT: about a day (the manifest needs screenshots, an id and better icons; see the 'share enablers' finding).
IMPACT: low to medium. It adds credibility and an install path for desktop users who never use 'Install app' in the browser. How crowded Store search for 'sudoku' is was not measured.
FIRST STEP: open a Partner Center individual account (the owner's own), reserve the name 'sudokUI', run sudokui.app through PWABuilder, and submit with a description that leads with 'HoDoKu-compatible ratings, 77 techniques, hints that draw the logic, offline, no account'.

_effort: days, impact: medium_

Risk: Identity verification. Store review may ask for changes. Low discovery if Store search is dominated by big sudoku publishers.

Evidence: https://www.neowin.net/news/microsoft-store-now-lets-individual-developers-join-for-free/ ; https://blogs.windows.com/windowsdeveloper/2025/05/19/microsoft-store-expands-opportunities-for-windows-app-developers/ ; https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account ; https://www.digitalinformationworld.com/2025/09/microsoft-drops-store-fees-for.html ; https://apps.microsoft.com/detail/9mw2135xrkh6?hl=en-US ; https://progressivewebapps.com/installation/app-stores/ ; /home/user/sudokUI/dist/manifest.webmanifest

### Google Play as a Trusted Web Activity (Bubblewrap or PWABuilder): worth it for trust and installs, not for discovery

COSTS AND RULES:
- A one-time $25 registration with identity verification.
- Personal accounts created after 13 November 2023 must run a closed test with at least 12 testers opted in continuously for 14 days before applying for production. Review takes about 7 days, and Google may ask for more testing if engagement is low.
- Packaging: Bubblewrap gives an .aab; PWABuilder wraps Bubblewrap and also emits assetlinks.json. Serve that file at /.well-known/assetlinks.json. After the first upload, add Play's re-signing SHA-256 fingerprint, or the app shows a browser bar or crashes.
- Policy: the Spam and Minimum Functionality policy was updated on 31 August 2024. Vendor reports say 'a website in a wrapper' can be rejected. sudokUI is a full offline app, so the risk is moderate, not nil.
- Android developer verification (from 30 September 2026 in four countries, globally in 2027) concerns installs from outside Play, not Play itself.
DISCOVERY: one ASO tracker counts about 2,669 apps competing for 'sudoku', with incumbents at about 95M (Sudoku.com) and about 108M installs. Organic search for 'sudoku' will bring nothing. Niche terms ('sudoku solver', 'sudoku techniques', 'hodoku') might bring a little.
REAL VALUE: Android players who would never 'Add to Home screen', store ratings, and being findable by name after hearing of it.
EFFORT: days of work spread over 3-4 calendar weeks (the 12-tester window).
IMPACT: low to medium.
FIRST STEP: do it only after 12 genuine testers can be named (daily players and Norwegian friends; never a paid tester-exchange). Then generate the package with PWABuilder, add public/.well-known/assetlinks.json, add 'screenshots' and 'id' to the manifest, and start the closed test. Consider a distinct telemetry source for the TWA so installs can be told apart.

_effort: weeks, impact: low_

Risk: The 12-tester rule is the real blocker. The policy can be read against wrappers. Play reviews are public and need answering.

Evidence: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en ; https://www.iconikai.com/blog/google-play-developer-account-fee-2026 ; https://www.thinktecture.com/en/pwa/twa-bubblewrap/ ; https://github.com/googlechromelabs/bubblewrap ; https://www.mobiloud.com/blog/publishing-pwa-app-store/ ; https://androidauthority.com/google-apps-play-store-3462390 ; https://primetestlab.com/blog/twa-app-rejected-google-play-switch-to-webview ; https://www.theregister.com/2026/02/24/google_android_developer_verification_plan/ ; https://appgoblin.info/apps/com.tn.Sudoku/keywords ; https://appgoblin.info/apps/com.easybrain.sudoku.android/keywords

### Norway 1: menneske.no and kode24, the two concrete Norwegian openings

MENNESKE.NO: Vegard Hanssen's long-running sudoku site (Norwegian, with an English interface). It has a large puzzle archive with solving methods per puzzle and is reported at about 1M hits a month in a Cappelen Damm author blurb; he has published sudoku books there.
- Fit: high, the most natural Norwegian sudoku partner.
- First step: a personal email in Norwegian. Offer that any menneske.no puzzle can be opened in sudokUI with drawn hints (one /p/ link as a demo), and ask whether a link on his techniques or links page would suit his readers.
- Effort: hours. Impact: low to medium.
KODE24 (Aller Media's developer outlet): publishes pieces by outside developers, such as a reader's story of releasing an app built with a coding agent, and covers side-project networks.
- The best angle is unique to sudokUI: 'a game with no consent banner: ID-less telemetry under ekomloven § 3-15'. The topic is live; TU reports the state is auditing Norway's 500 largest sites for cookies. A second angle is HoDoKu-grade solving in TypeScript on Cloudflare's free tier.
- Fit: medium (Norwegian developers, not sudoku players), with a local backlink and credibility.
- Effort: 1-2 days to write. Impact: low to medium.
- First step: email the kode24 editors a 3-line pitch with a draft outline. docs/online-goals.md's 'Norwegian law' section is most of the article already.
CONTEXT: Aftenposten once ran a Sudoku-NM with the Nordic papers, and Nordic championships were held in 2005 and 2012. No active Norwegian sudoku forum or association was found. Norwegian sudoku is newspaper-driven, so a local Oslo paper story ('Oslo developer gives away a world-class sudoku trainer') is a plausible low-effort extra; no source checked.

_effort: days, impact: medium_

Risk: kode24 may not run it. The legal reading must be framed as the owner's reading, as the doc already does, not as legal advice.

Evidence: https://www.menneske.no/sudoku/ ; https://menneske.no/sudoku/nobox/3/eng/index.html ; https://cd-netthandel.cappelendamm.no/boker/wordoku-vegard-hanssen-9788202255701 ; https://www.kode24.no/artikkel/gir-ut-app-uten-a-kunne-app-utvikling/252529 ; https://www.kode24.no/artikkel/nytt-nettverk-for-sideprosjekter-det-magiske-er-at-du-kan-bli-okonomisk-fri/207087 ; https://www.aller.no/merkevarer/kode24 ; https://www.tu.no/artikler/na-skal-staten-granske-norges-500-storste-nettsteder/223046 ; https://www.aftenposten.no/norge/i/JQr0j/sudoku-nm-er-i-gang ; https://kalsgaard.eu/mesterskaber ; /home/user/sudokUI/docs/online-goals.md ('Norwegian law, in brief')

### Norway 2 and schools: a 'sudoku as proof' activity for LAMIS's maths day and maths clubs

FIT: medium for Norway, low elsewhere.
NORWAY: LK20's maths core elements include 'utforsking og problemløsing' (exploration and problem solving; Udir calls it the most important element, about searching for patterns and finding new methods) and 'resonnering og argumentasjon' (following and assessing chains of mathematical thought, and justifying why results hold). That is what the chain trainer and 'Why not?' do.
- LAMIS (the national association for school mathematics) publishes a yearly idea booklet for schools' maths day (week 6), with photocopiable activities from preschool to upper secondary, and has local chapters.
- Matematikksenteret runs the Kangaroo contest in Norway.
ELSEWHERE: the 'sudoku for teachers' space is full of printable-pack sites (sudokuaday, sudoku247online, puzzlegenerator, finalsudoku). A generic teacher page will not stand out; only the 'every placement is a proof' angle is distinctive. NRICH, TES and Common Sense Education were not verified this session.
EFFORT: days for a one-page activity sheet in Norwegian with three position links (a Hidden Single, an X-Wing, a short chain), then emails.
IMPACT: low in visits and slow, but durable .no links and a Norwegian audience nobody else serves.
FIRST STEP: write 'Sudoku som bevis' for grades 8-13. Offer it to LAMIS's Oslo chapter and to the booklet editors for the next maths day, and give it to two or three maths teachers the owner knows.

_effort: days, impact: low_

Risk: Booklet deadlines are long; the 2027 maths day is likely already planned. Classrooms may block unknown sites.

Evidence: https://data.udir.no/kl06/v201906/laereplaner-lk20/MAT07-02.pdf?lang=nob ; https://hoering.udir.no/LastNedVedlegg/2855 ; https://www.matematikksenteret.no/sites/default/files/attachments/MAM/Revisjon%2020-21/Modul%201/Kjerneelementer%20i%20matematikk%20-%20Utdrag%20fra%20LK20.pdf ; https://www.lamis.no/index.php?pageID=277 ; https://lamis.no/om-oss/ ; https://www.utdanningsnytt.no/skolenes-matematikkdag-i-uke-6/139952 ; https://www.matematikk.org/binfil/download2.php?tid=127605 ; https://www.matematikksenteret.no/sites/default/files/attachments/Kenguru/Made%20in%20Norwary%202024%20.pdf ; https://sudokupulse.com/articles/sudoku-in-the-classroom/ ; https://sudokuaday.com/printable-sudoku-puzzles/classroom

### Puzzle newsletters and blogs: small, friendly, cheap to try

TARGETS FOUND:
- Puzzle Weekly (Substack; 28+ puzzles every Monday, sudoku every week).
- Puzzles from India (Substack; weekly, one pencil puzzle and two handmade sudokus).
- Paradox Puzzles (weekly, free).
- Pixelogic Weekly (a fellow indie web-puzzle maker; a natural cross-mention).
- Artisanal Sudoku by James Sinclair (variants; low fit).
- GMPuzzles: Feedspot's top sudoku blog; Thomas Snyder; sudokUI's corner marks are 'Snyder-friendly'. It publishes puzzles, not app reviews.
'Best sudoku apps' listicles are mostly AI or app-store aggregators (nearhub, sudokupulse.pages.dev) and are not worth chasing.
THE PITCH: offer each newsletter a /p/ link per weekly sudoku so readers who are stuck get a hint that teaches, not the answer. That serves the author's readers and asks for no feature.
EFFORT: hours. IMPACT: low, but these readers solve every week.
FIRST STEP: write to the authors of Puzzle Weekly and Puzzles from India with last week's sudoku already turned into a sudokUI link.
'APP OF THE WEEK' columns at mobile sites generally cover store apps; they depend on the Play or Microsoft listing. Not verified this session.

_effort: hours, impact: low_

Risk: Authors may see the links as spoilers; offer them as hints only, opt-in for readers.

Evidence: https://puzzleweekly.substack.com ; https://puzzleweekly.substack.com/archive ; https://chandrachudnanduri.substack.com ; https://nicolefegan.substack.com ; https://weekly.pixelogic.app/about ; https://bloggers.feedspot.com/sudoku_blogs/ ; https://www.nearhub.us/blog/10-best-sudoku-apps-no-ads ; https://sudokupulse.pages.dev/articles/best-sudoku-apps ; /home/user/sudokUI/README.md ('Snyder-friendly' corner marks)

### Product Hunt: low priority; the best sudoku result on record is modest

DATA: sudoku.coach (also a teaching tool) launched on 25 September 2024 with 172 upvotes and 29 comments, #13 of its day, and with 103 upvotes on 5 December 2023. Most sudoku launches get 0 to 4 upvotes (Kodiak Sudoku 3, SudoZen 4, Squoku 3, several at 0).
2026 guides (third-party, unofficial) say ranking now leans on engagement and discounts new accounts and vote rings; self-hunting is fine. Critics say paid boosts favour funded products. The audience is makers and marketers, not sudoku solvers.
EFFORT: 1-2 days to do well (gallery, maker comment, day-of replies). The owner would need a PH account.
IMPACT: low. A backlink and a listing; a few hundred visits at best.
FIRST STEP: none now. If done, do it the week after Show HN and reuse its assets. Never join upvote-exchange groups.

_effort: days, impact: low_

Risk: Time spent on a non-sudoku audience. Ranking games are frowned on.

Evidence: https://hunted.space/dashboard/sudoku-coach/launches/sudoku-coach-2 ; https://www.producthunt.com/products/sudoku-coach/launches ; https://webmail.hunted.space/product/sudozen ; https://hunted.space/product/squoku ; https://webmail.hunted.space/product/kodiak-sudoku ; https://getlaunchlist.com/blog/how-to-launch-on-product-hunt-2026 ; https://www.foundra.ai/key-reads/product-hunt-playbook-first-time-founders-2026-after-algorithm-shift ; https://launchedly.app/blog/why-product-hunt-killed-indie-makers

### PWA directories: mostly backlinks; submit to the ones that are crawlable and moderated

WHAT WAS FOUND:
- pwa.directory: about 995 apps. Free review in about 7 days, or a $19.99 fast track refunded if rejected. It checks the manifest, service worker, HTTPS and 'genuine value'.
- pwa.directory itself recommends store.app and pwastore.io (818 URLs in its sitemap, a /submit page). Also PWA List (pwalist.app) and PWA Marketplace (pwa.com).
- findPWA accepts submissions, but a rival reports its catalogue is visible only after JavaScript runs and its feed is blocked by its own robots.txt. That claim was not independently checked.
EFFORT: hours. IMPACT: low; a few backlinks and occasional visits from PWA enthusiasts. Do not pay for fast tracks.
FIRST STEP: before submitting, add 'screenshots' (wide and narrow), 'id' and 'shortcuts' (Daily, Learn) to the manifest; directories and Chrome's richer install dialog use them. Then submit free to pwa.directory, pwastore.io and store.app.

_effort: hours, impact: low_

Risk: Low. Some directories are SEO-farm grade; skip those that charge to be listed.

Evidence: https://pwa.directory/about ; https://pwa.directory/blog/where-to-submit-your-pwa ; https://pwa.directory/ ; https://www.findpwa.com/ ; https://www.producthunt.com/products/pwa-list ; https://www.pwa.com/ ; /home/user/sudokUI/dist/manifest.webmanifest (no screenshots, id or shortcuts)

### Lemmy, Mastodon, Bluesky: no sudoku community of size; use the FOSS and privacy angle once, then only if a habit forms

LEMMY: !sudoku@lemmy.world exists with about 66 subscribers and 8 posts. lemmy.ml calls itself 'a community of privacy and FOSS enthusiasts', which fits a GPL, no-tracking, no-account app better than any sudoku crowd. Lemmyverse lists communities.
MASTODON AND BLUESKY: no sudoku feed or hub was found. Puzzle game makers are present (Draknek & Friends on Bluesky). Daily-puzzle setters point people to the CTC Discord rather than to a feed.
NORMS: post from the owner's own account, with hashtags (#sudoku #FOSS #privacy), images over links, and no repeated posting.
EFFORT: hours for one post per network; ongoing if continued.
IMPACT: low.
MEASUREMENT GAP: landingFrom maps only mastodon.social, bsky.app and the official Mastodon Android app to 'social'. Other Mastodon servers and every Lemmy instance land in 'other'.
FIRST STEP: one post in a FOSS or privacy community on Lemmy and on Mastodon. Show a drawn-chain screenshot and the 'no account, no tracking, works offline, GPL' line, linking a /p/ address. Repeat only if those posts bring landings.

_effort: hours, impact: low_

Risk: Fragmented audiences; easy to spend time with no return.

Evidence: https://lemmy.world/post/17682412 ; https://lemmy.world/post/27014206 ; https://lemmy.ml/ ; https://lemmyverse.net/ ; https://bsky.app/profile/draknek.bsky.social ; https://news.ycombinator.com/item?id=41063103 ; /home/user/sudokUI/worker/telemetry.ts:327,374

### sudokuwiki.org: goodwill, not a placement

Andrew Stuart's site is the reference that ranks for most technique names and runs the main 'solver that explains' competitor (150th solver update on 8 December 2025). He publishes readers' messages and his answers on a feedback page with yearly archives.
FIT: medium. NORMS: a feedback page, not a directory. He is unlikely to link a competing solver, but he engages with substantive technique questions.
EFFORT: hours. IMPACT: low; the upside is a mention if sudokUI's engine teaches him something.
FIRST STEP: only when there is something useful to say, such as a puzzle where sudokUI's rating or a technique result differs from his solver, verified. Send it through his feedback page as a technique note, with the sudokUI link as context.

_effort: hours, impact: low_

Risk: A cold promotional message gets ignored or published unfavourably on his feedback page.

Evidence: https://www.sudokuwiki.org/Sudokufeedback.aspx ; https://www.sudokuwiki.org/sudokufeedback.aspx?cy=2025 ; https://www.sudokuwiki.org/Whats_New ; https://www.sudokuwiki.org/Sudoku_Solver___Version_History

### GitHub as a quiet channel: add the 'hodoku' topic and sharpen the repo description

STATE: AImenes/sudokUI has 1 star and 1 fork. Its topics are sudoku, sudoku-solver, pwa, offline-first and others, but not 'hodoku'. The description is 'The ultimate free sudoku app for the community'.
The GitHub topic 'hodoku' has only 5 repositories (HoDoKu forks, including 1to9only's, a known forum regular, and ntropey/hodoku_revisited), so adding it puts sudokUI in a five-repository list that HoDoKu programmers browse. Topic 'sudoku' has 3,304 repositories, where it will not be seen.
No maintained 'awesome-sudoku' list exists (every one found has 0 stars).
EFFORT: minutes. IMPACT: low.
FIRST STEP: add the topics 'hodoku', 'sudoku-techniques' and 'sudoku-trainer'. Change the description to say what is unique, for example 'Sudoku trainer: HoDoKu-compatible ratings, 77 techniques, hints that draw the logic. Offline PWA, no account'.

_effort: hours, impact: low_

Risk: None.

Evidence: gh api repos/AImenes/sudokUI (topics, stars=1, created 2026-07-05) ; gh api search/repositories?q=topic:hodoku (5 repos) ; gh api search/repositories?q=topic:sudoku (3,304) ; https://github.com/topics/hodoku

### Before any launch: make each channel measurable and every link preview the right thing

MEASUREMENT:
- The Worker counts a landing only on the share routes (/p/, /daily/). The home page and the 249 Learn pages are static assets that run no code, so a post linking sudokui.app/ is seen only as later 'started' lines with no source. When a post's effect matters, link a /daily/<date> or /p/ address. Use Search Console for the Learn pages.
- The source words are reddit, enjoysudoku, hackernews, facebook, discord, social, chat, mail, github, sudoku, ai and other. AlternativeTo, Product Hunt, PWA directories, Lemmy, non-flagship Mastodon servers, kode24 and other Norwegian press, menneske.no and the Microsoft Store would all read 'other'.
- Fix: add a few closed-list words before launching ('directory': alternativeto.net, producthunt.com, pwa.directory, pwastore.io, store.app; 'fediverse': the Lemmy and Mastodon hosts; 'press'; 'sudoku' should take menneske.no and hodokurevisited.com). Then compare channels on the dashboard by landings per share.
PREVIEWS:
- Learn pages share the generic og-card.png. Per-technique PNG cards would make every forum or Discord paste show the pattern (see SEO 2).
- The manifest lacks screenshots and id, which store packaging and directories want.
- The home description says 61 practice techniques while goals.md says 65.
EFFORT: hours (code) to a day (the cards).
IMPACT: medium, as it multiplies every other channel and lets the owner drop the ones that do not work.

_effort: days, impact: medium_

Risk: Each new referrer word must stay a closed-list word, so no referrer is ever stored; the existing design already guarantees this.

Evidence: /home/user/sudokUI/worker/telemetry.ts:279-336 (landingFrom words and hosts), :359-374 (Android packages) ; /home/user/sudokUI/docs/online-goals.md ('A landing is a person', 'A landing says where it came from') ; /home/user/sudokUI/dist/learn/x-wing/index.html (og:image og-card.png) ; /home/user/sudokUI/dist/manifest.webmanifest ; /home/user/sudokUI/src/content/home.ts:88,91,107 ; /home/user/sudokUI/docs/goals.md ('Practice mode for 65 techniques')

