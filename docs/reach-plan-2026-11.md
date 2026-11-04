# Reach plan, November 2026

_Drawn on 2 November 2026 from the reach workflow (four researchers, a critic and a planner; the evidence is in [reach-research-2026-11.md](reach-research-2026-11.md), the critic's corrections at its end). Ranked by impact per hour of the owner's time; Claude builds the app items. It keeps the principles of [goals.md](goals.md) and [online-goals.md](online-goals.md): no account, offline first, private, no ads. Not yet decided by the owner item by item; re-check rules and dates before acting._

**The sentence a player would repeat:** When you're stuck, sudokui.app draws the actual technique on your own grid and teaches you to spot it next time; it's free, works offline, no ads, no sign-up.

## Build (in the app)

### 1. Fix what a launch would show first: spoilers, thin-crowd wording, broken and cut links, stale numbers

Every channel below sends people to the same few places: the daily's preview, the share line and share links. Each of these is wrong today:
- The daily's preview names its techniques (src/content/share.ts:101), which goes against the 14 October spoiler-free decision.
- With two solvers, Matt's line can read 'faster than 0% today' (src/ui/Dialogs.tsx:1211). descriptionDaily promises 'everyone's times' to compare against.
- 65% of puzzles end in '.'. Reddit (verified in snudown's source), chat apps and GFM renderers strip that dot from a bare /p/ link, so the link 404s.
- A #s= link that gets cut short decodes silently to a different position, because BitReader fills missing bits with 0.
- The result line cannot be shared again after 'Admire the grid' (App.tsx:242 keeps that state in memory only).
- On a won game, the Position link gives away the whole solution.
- The home page says '61' practice techniques in nine strings; goals.md says 65.
Each fix takes hours and costs less than a bad first impression.

**What.** - src/content/share.ts:
  - Drop `techs` from the daily branch of shareParamsOf. Keep them for the phase-4 archive, behind a spoiler.
  - Add ogTitleDailyVs, 'Daily #{no}: solved in {time}. Can you beat it?'.
  - Make descriptionDaily true when only a few have played, e.g. 'One board for everyone, the same day'.
  - Have sharePath emit '/p/<81>/' when the query is empty. SHARE_PATH and APP_NAVIGATION already accept the slash; check navigateFallbackAllowlist too.
- src/ui/Dialogs.tsx and src/content/dailies.ts: below 20 solvers, show rank wording ('2nd of 3 so far today') or no comparison. Show the percentile from 20 solvers up.
- src/state/gameStore.ts decodePosition: compute the expected bit length as it decodes, and refuse a payload that is too short or too long. The app then opens the puzzle without the position and says 'This link looks cut off'.
- ShareDialog:
  - When today's daily is won, offer the result line again, built from the stored result.
  - When the game is won, hide the Position link, or warn that it shows the solution.
- src/content/home.ts: change 61 to 65 in the en, nb and es strings. Public copy says '80 technique pages in English, Norwegian and Spanish', never '267 Learn pages'.
- Tests:
  - tests/sharePage.test.ts: a daily's description names no technique in any language (this replaces the pin at :388); the ?vs headline keeps 'Daily #n'; a link with no query ends in '/' and round-trips.
  - tests/share.test.ts: a position link cut by 1 or by 5 characters is refused.
  - Rank wording at n = 2, 3, 19 and 20.

**Effort.** Claude: about half a day. Owner: 15 minutes to read the wording in all three languages.

**Principles.** It takes information out of previews and adds none. Nothing new is sent or stored. Links stay spoiler-free by default, as decided on 14 October. Play never waits for the network.

**As built, 2 November 2026.** All of it, with two corrections. The home page keeps '61': the practice dialog offers 61 techniques (PRACTICE_TECHS, '61 of 80 techniques playable'); goals.md's '65' counted the four the picker shows but cannot serve, and now says 61 (tests/home.test.ts already pins the home page to the catalogue). The rank wording follows the owner's decision of the same day: below 20 times the place ('2nd fastest of 5 today', 'tied for', 'the only time sent'), from 20 the percentile; a tie is two times in one 15-second step, the finest the server keeps. With it, as the owner decided: 'Send my time and compare' is the daily win screen's main button, and after a first send an unticked switch sends each later unassisted daily by itself (Settings has it too; the privacy page says so). The day's solve is kept on the device so the Share dialog can offer its line again; that is new local storage, never sent, and the privacy page names it.

### 2. Make each channel measurable before using any: home landings, new source words, play kind and language, a launch log

At about 10 starts a day, the day-to-day noise is as large as a small channel's effect. Most planned channels are invisible today:
- '/', '/nb/', '/es/' and the Learn pages run no Worker code.
- The iOS Reddit app sends no referrer.
- AlternativeTo, Lemmy, menneske.no and kode24 would all read 'other'.
- Play lines carry no daily flag and no language, so neither a Norwegian push nor a growing daily can be read.
Principle 5 ('Measured, not asserted') needs this before the first launch, and the owner needs it to drop the channels that do not work.

**What.** - wrangler.jsonc run_worker_first: add the exact paths '/', '/nb/' and '/es/'.
- worker/index.ts: on those paths, write the existing ID-less landing point with slot 'home' when the referrer is not sudokui.app and the request is not from a bot. Then return env.ASSETS.fetch(request). Returning visitors are answered from the service worker's cache, so this counts mostly first visits.
- worker/telemetry.ts LANDING_FROM, new words:
  - 'directory': alternativeto.net, saashub.com, producthunt.com, pwa.directory, pwastore.io, store.app
  - 'fediverse': lemmy.world, lemmy.ml and the common Mastodon hosts
  - 'press': kode24.no, tu.no, aftenposten.no
  - add menneske.no to 'sudoku'.
- Started and completed lines: add closed-list fields kind ('daily' | 'new' | 'practice' | 'shared') and lang ('en' | 'nb' | 'es') in src/state/telemetry.ts and worker/telemetry.ts. /admin shows both as columns.
- src/content/privacy.ts, in the same commit and in all three languages: the home landing, the new words, the two fields.
- docs/launch-log.md: a dated table (date, action, link used, landing word expected). The owner adds one line per action.
- Tests: the worker accepts the new words and fields and refuses anything else; no home landing is written for a same-site or bot referrer.

**Effort.** Claude: about half a day. Owner: 10 minutes to read the privacy diff.

**Principles.** No identifier, cookie or address is stored: each landing is one closed-list word, each field one closed-list value, as in the existing landing design ('A landing is a person'). The privacy page changes in the same commit, so it stays accurate. The few extra Worker invocations per new visitor are far below the free tier.

**Built** on 2 November 2026, as above, with two additions: practice games are counted now, because the kind 'practice' needs them (they open part-way, so they count from the player's own first move, and /admin keeps them out of its other play numbers); and a bare '#p=' link, which is mostly the Learn pages' own, counts as 'new', so 'shared' means a share address or a position link. The home pages also cost up to three Worker calls per device after each deploy, when the service worker fetches them again; docs/online-goals.md, Budgets, has the numbers. Details in docs/online-goals.md, 'Measured per channel'.

### 3. Board and hint image export, plus 'Share this hint'

Images are what puzzle communities post: help, challenge and technique posts on Reddit, Discord and the forum. Today the drawn chain, the app's selling point, can only leave as a screenshot of the whole app. The same images are what the owner's own outreach needs: the forum thread, AlternativeTo and store screenshots, creator emails, the press page. The prototype already renders sharp 1140 px PNGs offline from boardSvg (/home/user/sudokUI/.vite/reach/proto/*.png).

**What.** - src/content/boardSvg.ts, new options:
  - step: optional; no marks when absent
  - frame: passed through to frameMarks, which is called with null today, so the current walk-through frame can be drawn
  - player colours: from the Grid.tsx PALETTE
  - footer: about 40 px, reading 'sudokui.app · Hard 1288'.
- New src/content/boardImage.ts (pure): positionSvg({cells, puzzle, autoCandidates, markContract, step?, frame?, footer?}), built from shownCandidates the way formatPencilGrid is.
- New src/ui/boardPng.ts: svgToPng(svg, scale = 2) through Blob, <img>, canvas and toBlob.
- src/ui/send.ts sendFile(file):
  - The PNG is built when the dialog opens or an option changes, so the tap calls navigator.share({files}) before any await.
  - On touch devices that can share files, it uses the share sheet.
  - Otherwise it offers Copy image (ClipboardItem image/png) and Save image (<a download>).
- ShareDialog (src/ui/Dialogs.tsx:960-1080): an Image row with a live preview and ticks for Candidates, Colours and Footer. The footer is visible in the preview, and the choice is remembered per device (localStorage inside try/catch).
- src/ui/HintPanel.tsx: a 'Share this hint' button next to 'Copy step'. It opens the same dialog with the hint, or the current frame, drawn. The technique name is not printed in the image.
- Telemetry: kind 'image' (SHARE_KINDS, ShareKind) and way 'save'; admin SHARE_LABELS; privacy.ts in all three languages, in the same commit. The image itself is never sent.
- Tests:
  - tests/boardImage.test.ts: no hint marks without a step; with a step, equal to boardSvg; candidates equal shownCandidates; footer only when asked; no http href, <image> or foreignObject (so the canvas is never tainted and export works offline).
  - tests/send.test.ts: share is called synchronously; a closed sheet returns 'cancelled'; without file support it falls back to Save.
  - e2e: Save image produces a PNG download; Share this hint produces a download.

**Effort.** Claude: 2 to 3 days, alongside the hint work. Owner: 20 minutes on a phone, sharing an image into Reddit, Discord and Messages.

**Principles.** The image is made on the device by the existing renderer, using system fonts. Nothing is uploaded or rendered on a server, and it works offline with no account. Telemetry gains one closed-list kind and one way, never the content or where it went. The player can turn the footer off.

**As built, 2 November 2026.** All of it, with these choices. The picture is always drawn light, as the Learn diagrams are, whatever the app's theme: it has to read the same in a dark Reddit app and a light forum. With a hint, every digit the hint marks in the frame shown is drawn even with Candidates off, as the board adds them. A walk frame's picture leaves out the walk's numbers, which the board puts on each arrow while walking; the dialog's note says the picture has no step numbers on its arrows. A solved board's picture is the puzzle from the start, its givens alone, for the reason the Position link is hidden. The Colours tick appears only when the board has colours, and the set tracker's hidden colours are drawn as the board draws them. The footer reads 'sudokui.app · Hard 1288' ('sudokui.app · Daily #15 · Hard 1288' for a daily, plain 'sudokui.app' for a puzzle the app has not rated). On a phone or a tablet whose share sheet takes files there is one button, Share image; a sheet that refuses saves the file instead, and a closed sheet saves nothing. Elsewhere, Copy image (where the browser's clipboard takes a PNG) and Save image. The player colours moved from Grid.tsx to src/content/playerColours.ts so the pure renderer can draw them. /admin's share table gains a Saved column, and its landings per share leaves pictures out, since a picture carries no link. No legend is drawn in the picture: the player writes their own words.

**Changed, 3 November 2026: the board as the player sees it** (the owner's choice for the one finding of the candidates hunt left to him, docs/candidates-2026-11.md). The picture took its candidates from the pencil-mark grid's rule, so with auto candidates off and the marks' contract unknown or open it drew the engine's candidates in every empty cell, and a player who worked by hand shared a position behind the one on screen. Now it draws what the board draws. With auto candidates off, the player's own corner and centre marks, whatever their contract, laid out by the board's own rule (src/content/pencilLayout.ts, which src/ui/Grid.tsx renderMarks, the hint geometry's digitShown and the picture share): corner marks alone on the 3×3 grid, a little bold; centre marks alone a line of up to four digits, and on the 3×3 grid from five; both layers, the corner marks round the edge and the centre line between them, smaller from five digits; and a cell the hint marks, in full or in the frame shown, on the 3×3 grid with the hint's digits, as the board draws it then. With auto candidates on, the auto candidates, as before. Sizes and places are the board's, scaled as the picture's candidates are (13 in a 60-unit cell where the board has 23 in 100): a centre line 14.7, a corner mark round the edge 11.9, so at 1140 px a centre line is set at about 29 px and a corner mark round the edge at about 24 px, beside the candidates' 26. The Candidates tick is named for what it draws, Your pencil marks with auto candidates off and Candidates with them on, and shows only when the empty cells draw something; off, only the hint's digits. A solved board's picture is its givens alone, now without any candidates either. The dialog's note says so: 'A picture of the board as you see it, for a post or a chat.' Position as text writes each cell's list as the solver reads it (contractGrid, through src/content/textGrid.ts candidateLists), since HoDoKu and SudokuWiki read every list in it as complete: with auto candidates off, manual marks and the mark question never answered, it asks the question first (contractFor 'text', titled 'How should Position as text read your pencil marks?', shown over the Share dialog), and the answer's own tap copies the text; the answer is remembered for the puzzle, as Hint's is. 'My remaining candidates' writes a marked cell's corner and centre marks together, less a digit the placed digits rule out, and every candidate still open in an unmarked cell; 'partial notes' writes every candidate still open, and a line under the buttons says that the marks were left out. With no manual marks, with auto candidates on, or with the answer known, it asks nothing. With auto candidates off, the candidates still open leave out the eliminations the app applied and checked (an applied hint), as Hint and Fill do. The picture is still made on the device and never sent, and nothing sent changed, so the privacy page is unchanged. Tests: tests/boardImage.test.ts holds the picture to the board's own layout, cell by cell (the board rendered beside it), for each layout, with a hint and in both auto states; tests/shareText.test.ts the text's question at the store; tests/e2e/smoke.spec.ts both in the browser.

### 4. 'Copy as post': formatting for the player's own words (Reddit format ships after the composer test)

The owner wants players to be able to post anything from the app. Pasting into a community fails in several ways today:
- A pasted grid collapses on Reddit without a 4-space indent.
- Bare links lose their trailing dots.
- Each platform has its own spoiler syntax.
But the kit must not look like a campaign. Prefilled titles and a fixed 'Open in sudokUI' line from many players, all linking a banned developer's domain, would. Also unverified: pasted Markdown may show as raw text in new Reddit's rich-text composer and in the apps. So the kit only formats, and the player writes. Help posts come last: a stuck sudokUI player usually taps Hint.

**What.** - New pure module src/content/postKit.ts: postBody(format, kind, parts, lang), with three formats:
  - 'markdown' (Reddit): >!…!< with one span per paragraph, the grid indented 4 spaces, links always as [text](url)
  - 'discord': ||…|| and ``` fences
  - 'forum': the grid in [code], and no spoiler tag until the forum's tag is confirmed
  - An escaper for * _ ~ ^ [ ] \ and a leading # > - or 1., and no '!<' inside a spoiler.
- No title is generated. The body holds:
  - the 81-character string in backticks
  - an optional link, with neutral text 'playable link with candidates', localised and without the app name
  - the pencil-mark grid
  - for a hint: the technique name, the step and describe(hint), each behind spoiler tags, then a /learn/<slug>/ link.
- The link is a tick. It is on by default for Discord and forum. For Reddit it stays off by default until the owner's logged-out check shows that sudokui.app links survive there.
- Kinds, in this order: hint, then puzzle or challenge (image, string and playable link), then daily (the existing spoiler-free line, unchanged), then help.
- Clipboard: write text/plain (Markdown) and text/html (a real <a> and a <pre> grid) in one ClipboardItem, so rich-text composers get a working link. On phones, one button labelled 'Copy text and share image', followed by a 'Text copied' toast.
- A collapsible, generic 'Posting tips': show your candidates, say what you tried, put names behind spoilers, mark an image post as a spoiler, read the community's rules. No subreddit is named anywhere in the app.
- Telemetry: one kind, 'post', never the format. The privacy sentence 'Copying … sends nothing' changes in the same commit.
- Tests:
  - tests/postKit.test.ts: no bare URL; no newline inside a spoiler span; every grid line starts with 4 spaces; the link round-trips to the same cells through parseShareUrl and decodePosition; for every stored example in en, nb and es, the step text escapes cleanly; the daily body has no technique name and no grid; Discord uses ||; forum uses [code].
  - e2e: a copied post contains '>!' and '](https://sudokui.app/p/'.

**Effort.** Claude: about 2 days. Owner: the one-hour composer test (owner action 2) before the Reddit format is turned on.

**Principles.** It is plain text built on the device. Nothing is posted for the player, and no community is preselected. There is no account, no reward and no prompt to post. Telemetry counts one 'post' kind and never the destination, which keeps the privacy page's promise: 'not where it went or to whom'.

### 5. Previews and listings that show the right thing: daily cards, honest /p/ cards, Learn cards, lastmod, manifest, a press page

A link is judged by its preview, and today's previews mislead:
- A /p/ or position link previews a different, full and solvable-looking Hard board under 'Can you solve this Hard sudoku?', with the copy 'No ads, no account'. In a player's link post that reads as an advert, and readers try to solve the wrong board.
- All 249 Learn pages share one generic card, so a Learn link pasted in a forum or Discord does not show the pattern.
- The sitemap has no lastmod.
- The manifest lacks id and screenshots, which stores and directories need.
- Outreach has no page of screenshots and pitch to point to.

**What.** - scripts/og-share-cards.ts: one static card per daily (451 now), language-neutral: the day's givens, 'Daily #n' and the ISO date. Served at /og/daily/<date>.png and used by the daily branch of renderSharePage. Add og/** to globIgnores to be explicit about the precache. dailies.json is already public, so nothing is spoiled.
- Redraw the 24 /p/ band cards so they cannot be taken for the shared puzzle: band and rating, a faded partial grid labelled 'example', no ad copy.
- One PNG card per technique and language, rendered from /learn/img/*.svg and set as og:image by scripts/build-learn.ts.
- scripts/build-learn.ts writes each page's lastmod from the git date of its content, never the build date.
- Retitle /hodoku/ for what people type ('HoDoKu online: ratings and hints in your browser, no Java'), crediting Bernhard Hobiger and the GPL and saying it is unofficial.
- Manifest (vite.config.ts): id, screenshots (wide and narrow), and shortcuts for Daily and Learn.
- A static /press/ page in three languages: screenshots and hint images made with item 3, the one-sentence pitch, the line 'built with AI assistance; the engine is checked against HoDoKu by tests', and a contact address.
- Tests: the daily page uses its own card; no lastmod equals the build date for unchanged pages.

**Effort.** Claude: 1 to 2 days. Owner: none.

**Principles.** All of it is static and made at build time, at no Worker cost. There are no per-generated-puzzle pages: the dailies are a fixed, published list, which the 'Do not build' rule does not cover. Nothing is tracked, and nothing is added to the offline precache.

### 6. Follow the daily and take a puzzle onto paper without an account: an Atom feed and a print view with a QR code

The daily is the habit loop, and Matt is usually alone on its times. A feed is the account-free way to follow the daily. It is already planned in online-goals phase 4, and forum regulars use feeds. A print view suits Norway's newspaper sudoku habit, the school sheet (owner action 6) and older solvers, and its QR code brings a paper puzzle back to its hints.

**What.** - worker/index.ts: GET /daily/feed.xml, already covered by run_worker_first /daily/*:
  - renders Atom from dailies.json for dates up to today only
  - one entry per day: 'Daily #n · {level} ({score})', linking /daily/<date>, with no techniques
  - Cache-Control of one hour
  - linked with <link rel="alternate" type="application/atom+xml"> from home and /daily-sudoku/.
- Print: a 'Print' button in the Share dialog opens an @media print view with:
  - the boardSvg board, without marks (candidates optional)
  - the band and rating
  - a small QR code to the puzzle or daily link, from a bundled, lazy-loaded MIT QR encoder that needs no network
  - an option of two puzzles per page, for teachers.
- No telemetry for either. A feed reader's poll is not a person.
- Tests: the feed holds no future date and no technique name, and validates as Atom; the print view contains the givens, and its QR code decodes to the share link.

**Effort.** Claude: about a day. Owner: none.

**Principles.** No subscription, email or identity: a feed is a public file, and a printout works offline by nature. The core does not wait for the network, and nothing new is stored or sent.

## The owner's actions

### 1. Thirty minutes of setup that keeps paying: Search Console, GitHub topics, start the AlternativeTo account clock

Search Console is the only way to see whether the 249 Learn pages work. The rare-technique queries (sue de coq, death blossom, ALS-XZ, tridagon) are the long tail sudokUI can win within months. GitHub's 'hodoku' topic lists only 5 repositories, which HoDoKu programmers browse. AlternativeTo reportedly requires an account that is 7 days old before it accepts a listing.

**First step.** Create a Domain property for sudokui.app in Google Search Console. Add its TXT record in Cloudflare DNS, then submit /sitemap.xml. In the same sitting:
- Add the topics 'hodoku', 'sudoku-trainer' and 'sudoku-techniques' to AImenes/sudokUI.
- Change its description to 'Sudoku trainer: HoDoKu-compatible ratings, 77 techniques, hints that draw the logic. Offline PWA, no account'.
- Create your own AlternativeTo account.

**Effort.** 30 to 45 minutes

**Risk.** None. On a new domain, expect weeks of 'Discovered, currently not indexed'.

### 2. Check the previews, bot access and Reddit's composers yourself (this decides how build items 4 and 5 ship)

In the research session, the live site and Reddit could not be reached. These are still unverified:
- the tags the deployed build serves
- whether Cloudflare challenges the preview bots
- how Reddit crops a card
- whether the #s= fragment survives in a post
- whether pasted Markdown, spoilers and 4-space grids render in new Reddit's rich-text composer and in the apps
- whether sudokui.app links are filtered in r/sudoku.

**First step.** Run curl -sA 'redditbot/1.0' and curl -sA 'Discordbot/2.0' against one /p/ link and one /daily/ link. Compare the og: tags with /home/user/sudokUI/.vite/reach/live/*.html.
In Cloudflare Security > Events, check that redditbot, Discordbot and facebookexternalhit are not challenged.
Once item 3 ships:
- Make one image post and one text post on your own Reddit profile (not a subreddit), pasting from the kit.
- View them on old.reddit, on new Reddit in both rich-text and Markdown mode, and in the phone app. Delete them afterwards.
- Logged out, open reddit.com/domain/sudokui.app and your own pre-ban posts to see whether links survive.

**Effort.** About 1 hour, in two sittings

**Risk.** Low. Never test in r/sudoku, and never through Matt or anyone else.

### 3. Enjoy Sudoku forum: one Software thread, after a few posts as a solver

This is the best-fit audience: HoDoKu, YZF_Sudoku and SudokuExplainer users, whose favourite tool was last released in 2012. Authors announcing their own solvers there is normal. The 'enjoysudoku' landing word already exists. The credibility carries over to every later channel: the experts will test the ratings, which is exactly what 'Measured, not asserted' wants. It is a small forum, so expect tens of visits, not hundreds.

**First step.** This week, answer two or three threads in 'Help with puzzles and solving techniques' as a solver, without links. In week 3, open a Software thread in your own words. Include:
- the technique table
- how HoDoKu parity is tested
- one line saying it is built with AI assistance
- a /p/ link
- an explicit request to report rating differences from HoDoKu or SE.

**Effort.** 2 to 3 hours, then replies over a week

**Risk.** The experts will find engine bugs in public; fix them quickly and say so. A new account whose first post is a link reads as spam. Make no claims about rivals, and do not name Hodoku Revisited.

### 4. AlternativeTo listing, once the account is 7 days old

Its HoDoKu alternatives page ranks first for 'hodoku online' and lists no technique trainer. AI answer engines read these pages. It brings steady, small traffic (a few visits a week) and a lasting backlink. After build item 2 ships, those visits show under 'directory'.

**First step.** Use 'Suggest new application' and state only things you have checked yourself:
- free, GPL, offline, no registration, runs in the browser on every platform
- an alternative to HoDoKu, SudokuPad, sudoku.coach and Simple Sudoku.
Use the screenshots from build item 5. Then claim the listing with feedback@sudokui.app.

**Effort.** 1 hour

**Risk.** Low. If details are wrong, the community edits them. Do not seed votes.

### 5. Teachers and newsletters: send a ready tool for their viewers, three at a time

SudokuPad's reach came from being the link under every Cracking the Cryptic video. One teacher who puts sudokUI position links under their videos brings recurring traffic, with no account and no social features. Include one Spanish creator, since /es/ has no other channel.

**First step.** Pick one tutorial video each from Sudoku Guy, Harold Nolte and Smart Hobbies. For each, build a position link and a hint image of the puzzle in the video, and send one short personal email: 'here is your X-Wing position in an app that draws the pattern; free, no account; use it if it helps your viewers'. Do the same for Puzzle Weekly, with last week's sudoku as a link.

**Effort.** About 1 hour per pitch

**Risk.** Expect few replies. Skip Cracking the Cryptic and Sudoku.Global, which run their own apps.

### 6. Norway: menneske.no now, a kode24 article later

Almost nothing teaches sudoku techniques in Norwegian. menneske.no (Vegard Hanssen) is the natural Norwegian sudoku partner, reported at about 1M hits a month. kode24 has an angle no competitor has: a game with no consent banner, because its telemetry carries no IDs, under ekomloven § 3-15. Most of that article is already written in online-goals.md, 'Norwegian law'. Once the print view exists, a 'Sudoku som bevis' sheet for LAMIS's maths day can follow.

**First step.** Email Vegard Hanssen in Norwegian, with one menneske.no puzzle opened in sudokUI as a link. Ask whether a link from his techniques page would suit his readers.

**Effort.** 1 hour for menneske.no; 1 to 2 days to write the kode24 piece

**Risk.** kode24 may decline. Present the legal reading as your own reading, not as advice.

### 7. One general launch post at a time: r/WebGames first, Show HN only when the phase-4 band times exist

These are high-variance spikes. A front page can bring thousands of visits in a day, but 1 to 3% stay. Each venue allows about one attempt, so spend it after the fixes, the images and the measurement are live. Show HN works best around the crowd-calibrated median time per band, which nobody else publishes.

**First step.** Read r/WebGames' sidebar and wiki yourself; the rules seen here come from third-party summaries. Search the sub for sudokui.app. Then post a link to the daily with a title that starts with 'sudokUI', and add a developer comment you write yourself, saying you made it and that it is built with AI assistance. For HN, check /showlim first, and write the text by hand.

**Effort.** 2 to 4 hours including staying in the thread; Show HN takes days

**Risk.** Reportedly one post per game per three months on r/WebGames. HN reportedly limits Show HN for new accounts and bans AI-written comments (unverified). Space posts weeks apart, and never post the same text in several subs.

### 8. Optional: one appeal to r/sudoku, as a reply to the ban notice

If the ban is lifted, you could answer help and technique threads as a solver, the one form of presence there that every report calls welcome. Promotion stays barred by Rule 2 either way, so the payoff is modest and the odds are low.

**First step.** Read r/sudoku's rules and the 13 March 2026 mod post yourself; a ban does not stop you reading. Then reply once to the original ban message, in your own words:
- name the rule you broke
- say you have read the rules
- commit to follow Rule 2, not to announce or promote the app, and to say you made it whenever you link it.
Do not promise never to link it.

**Effort.** 20 minutes

**Risk.** A defensive or repeated message can bring a modmail mute of 3 to 28 days. Send it once and do not follow up. If it is refused, say nothing in public.

## AI assistants

_Added on 4 November 2026_, after the first fan who does not know the owner (Matt, a player from the feedback e-mails) found sudokUI by asking ChatGPT for apps to get better at sudoku ([launch-log.md](launch-log.md), "Notes"). People ask an assistant the question a search box used to get, and the assistant answers from what it can read about the app. Nothing here asks anyone to mention sudokUI, and nothing pays for a place in an answer: the app is described truthfully where an assistant reads, and the arrivals are counted.

**What is built.**
- Counting (worker/telemetry.ts). A landing whose referrer is an assistant's address (chatgpt.com, chat.openai.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com) was already `ai`. Assistants often send no referrer but tag the link instead, as ChatGPT does with `utm_source=chatgpt.com`. So a landing with no referrer whose link carries `utm_source` naming one of those addresses is `ai` too (`landingWord`, `assistantTagged`). That one parameter is the only thing read from the address, and nothing of it is kept. A referrer, when there is one, always decides. The privacy page says so in all three languages.
- Describing (public/llms.txt, src/content/home.ts). `/llms.txt` is a plain file in the format llmstxt.org describes: what sudokUI is, who it is for (players who want to improve at their own pace), what it does (hints that walk through each technique on your own grid, practice for 61 techniques, the daily, three languages, offline, no account) and what it does not do (no account, no ads, no leaderboards, no course), with links to the home pages, Why, the Learn pages and the privacy page, and no other app named. The asset hosting serves it; the Worker never runs for it. The three home pages carry schema.org JSON-LD as the build writes them: a WebApplication with its name, description, address, category (GameApplication), operating system (any), a price of 0 and its language. tests/llms.test.ts and the browser test hold both to the truth and to the build.

**Reading it on /admin.** "Where landings came from, last 7 days" has a row "An AI assistant": a landing with an assistant's address as the referrer, or with no referrer and its tag on the link. Read it as the other channels are read, a 7-day count next to the baseline. It is a floor, not the total: an assistant's app that opens a link with neither a referrer nor a tag reads as `none`, a link the assistant gives to a Learn page is counted only in Search Console, and a player who already has the app installed is answered by the service worker and not counted at all. A rise in `ai` landings that leaves completions and daily participants flat two weeks later is not reach, as for any channel.

**What not to do.** No text written to steer assistants (lists of keywords, claims about other apps, "the best sudoku app"); no paid "AI visibility" service; no asking players to tell an assistant about sudokUI. Keep `/llms.txt` as true as the privacy page: when a number or a promise changes, change it in the same commit.

## Reddit

The facts, and how sure they are:
- r/sudoku's Rule 2 removes app, website and channel announcements whoever posts them. It comes from a mod post of 13 March 2026, https://www.reddit.com/r/sudoku/comments/1rsjzov/.
- That rule is known from one second-hand source: a rival developer's issue that read Reddit through a Redlib mirror and could not read the comments (https://github.com/vitalyiegorov/suuudokuuu/issues/696).
- Reddit itself could not be reached in this research.
- A subreddit ban does not stop reading, so the owner should read the rule and the post himself before acting.
- Lifting the ban would not allow promotion.

THE OWNER MAY:
(1) Read r/sudoku.
(2) Post and comment from his one account in other subreddits, under their rules. He says in the first line that he is the developer, and in every launch post that the code is AI-assisted: 205 of 218 commits carry a Claude co-author trailer, and readers will see that.
(3) Reply once to the ban notice. It goes to the sub's shared modmail; he must not message moderators privately.
(4) Check whether the domain is filtered without anyone posting: logged out, look at reddit.com/domain/sudokui.app and at his own pre-ban posts.
(5) Make test posts on his own profile, then delete them.
(6) If a player asks, tell them: 'the Share button makes a ready post if you ever want one'.

THE OWNER MUST NOT:
- Use any second or new account in r/sudoku, even to vote or comment. That is ban evasion, which can bring a sitewide suspension.
- Ask Matt or anyone else to post in r/sudoku, or to 'test' whether a sudokui.app link survives there. That is proxy posting for a banned developer.
- Give anyone drafted text, a subreddit or a time to post.
- Ask for votes, or link threads so people pile in.
- Complain about the ban in public.
- Post the same text in several subs on one day.

PLAYERS MAY, on their own and unasked, all under each sub's rules (in r/sudoku that includes Rule 2):
- post puzzles, hint images, challenge entries (image, string and a playable link), daily times and help requests in r/sudoku;
- recommend sudokUI in app-recommendation threads;
- answer other people's help posts with a drawn hint;
- submit the app to r/WebGames or other subs.

THE APP'S SIDE OF THE LINE. The app formats and hands over, nothing more:
- It never names r/sudoku or any subreddit.
- It never prefills a title, and never uses the app's name in link text.
- It never posts in one tap.
- It never rewards sharing or asks for votes.
- It never records which platform a post was for.
- It has no reddit.com/submit button for puzzle or position links. That would make a link post whose thumbnail is a different board with the band card's advert copy.
- On phones, the share sheet sends the image to the Reddit app (to be checked by hand). On desktop, Save or Copy image plus Copy text.
- Default for the link inside a Reddit post: off until the owner's logged-out check shows links survive, so a player's help post is not silently removed.

NOT RELYING ON REDDIT: Reddit is one landing word among about fifteen. The forum, Discord, search, AlternativeTo, creators and Norway do not depend on it, and the same kit writes Discord and forum formats.

WHERE THE OWNER'S OWN POSTS FIT (rules reported by third parties; read each sidebar first):
- r/WebGames: a direct link, the title starting with the game's name, once per three months.
- r/SideProject, and the Saturday threads of r/webdev and r/javascript: one each, weeks apart.
- r/norge or r/Norway: only after asking their mods.
Not a fit:
- r/InternetIsBeautiful: bans web games, and applies a 90/10 rule.
- r/opensource and r/selfhosted: both reportedly bar AI-built projects.

Sources:
https://github.com/vitalyiegorov/suuudokuuu/issues/696
https://support.reddithelp.com/hc/en-us/articles/360043504811-What-is-ban-evasion
https://support.reddithelp.com/hc/en-us/articles/360043066412-Disrupting-Communities
https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette
https://redditinc.com/policies/reddit-rules
https://github.com/reddit/snudown/blob/master/src/autolink.c
https://threadfox.vip/rules/for/games
https://www.linux-magazine.com/Online/News/r-opensource-Bans-AI-Assisted-and-AI-Related-Projects
https://rankhog.com/subreddits/internetisbeautiful
Only snudown and issue #696 were read directly; the rest come from search summaries.

## Do not

- Accounts, profiles, follows, comments, friend lists or a social feed in the app. No account, ever (online-goals principle 2). Let sudoku.coach own that ground.
- A leaderboard, badges, streak rewards or any reward for sharing or posting. The rank wording on the daily line is enough.
- Naming r/sudoku or any subreddit in the app, prefilling post titles, or putting the app's name in link text.
- A reddit.com/submit button for puzzle, position or help links. It makes a link post whose thumbnail is a different board with advert copy.
- Asking Matt or any player to post, to 'test' a link in r/sudoku, or to vote, and handing anyone drafted text. That is proxy promotion by a banned developer.
- Using a second Reddit account anywhere near r/sudoku, or posting the same text in several subs.
- Recording in telemetry which platform a post or copy was for. The privacy page promises 'not where it went or to whom'.
- Changing telemetry without changing privacy.ts in all three languages in the same commit.
- Publishing claims about rivals that come second-hand (Good Sudoku offline, Enjoy Sudoku pulled, sudoku.coach needing an account), or naming Hodoku Revisited. Comparison text must be first-hand and dated, as EU comparative-advertising rules require.
- Putting 'HoDoKu' in a store app's name, or implying the app is official. Say 'HoDoKu-compatible' and credit Bernhard Hobiger.
- Inflated or stale numbers in public: '267 Learn pages' (it is 80 technique pages in three languages) and '61' practice techniques (65).
- Pasting AI-drafted text into Show HN, the forum or the appeal. The drafts in these reports are notes; the owner writes the posts himself, and every launch post says the code is AI-assisted.
- Launching several channels in one week, or before build item 2 and two weeks of baseline.
- Leading with 'no ads': dozens of store apps are literally named that. Lead with the teaching, and end with 'free, offline, no ads, no sign-up'.
- Rendering OG images on the server for each generated puzzle, or pages per generated puzzle.
- Product Hunt, paid directory fast tracks, r/InternetIsBeautiful, r/opensource and r/selfhosted for now.
- A Reddit-native (Devvit) game: it ties play to Reddit accounts and competes with the r/sudoku mods' own game.
- An iOS App Store wrapper: $99 a year, and Apple's guideline 4.2 rejects bare web wrappers. This is a decision, not an oversight. Google Play as a Trusted Web Activity waits until 12 real testers can be named.

## Measuring it

BASELINE FIRST. Build item 2 ships first, then two weeks of baseline with no outreach. The passive changes can land during it, because they send nobody: the fixes, the previews and Search Console.

Read these on /admin as 7-day averages and write them in docs/launch-log.md:
- games completed per day (today about 5)
- games started (about 10), split by the new kind and lang fields
- daily participants, i.e. D1 time submissions per day (about 1 to 2)
- landings per day by word, now including 'home'
- shares per day by kind: puzzle, position, challenge, daily, and later image and post.

ONE CHANNEL PER WEEK. Log each with its date, the link used and the landing word expected. Use a /daily/<date> or /p/ link when the effect matters, because the Learn pages are counted only through Search Console. Judge each action 14 days after it, on two things:
(a) landings with its word in the first 7 days;
(b) the 7-day averages of completions and of daily participants at day 14, against the baseline.
At about 5 completions a day, the 7-day average moves by about plus or minus 1 by chance:
- a rise of 3 a day or more, held for a week, is real;
- anything smaller counts as no effect;
- a spike in landings that leaves completions and daily participants unchanged two weeks later is not reach.

PER STEP:
1. Fixes: no number. Re-run the curl from owner action 2: the daily's preview names no technique. Matt's line shows rank wording.
2. Measurement: within 48 hours /admin shows home landings and kind and lang columns. If home landings stay at 0 for a week, the route is wrong.
3 and 4. Image and post kit: shares of kind 'image' and 'post' per week, and landings from reddit, discord and enjoysudoku. At today's numbers, expect a few image shares a week at best. If there is still under one a week after a month, the kit's value is the owner's own posts; stop adding formats.
5. Previews: check by unfurling a link in Discord and on the owner's Reddit profile. In Search Console, watch impressions for Learn pages and for rare-technique and nb/es queries. Judge at 8 to 12 weeks.
6. Feed and print: not counted, by design. Watch daily participants only.
7. AI assistants ("AI assistants" above, since 4 November 2026): the 'ai' row of /admin's "Where landings came from", with an assistant's address as the referrer or its tag on the link. There is no launch day to judge from: read the weekly count against the baseline, and judge /llms.txt and the structured data at 8 to 12 weeks, as for the previews.

Owner actions:
- Forum: at least 20 enjoysudoku landings in week one, and at least one substantive technical reply.
- AlternativeTo: a few 'directory' landings a week after a month.
- Creators: any recurring 'social' landings on their links.
- Norway: the nb share of started games rises, and 'sudoku' or 'press' landings appear.
- r/WebGames or Show HN: judged like any other channel; the spike itself does not count.

REALISTIC EXPECTATION for a side project with about 10 players a day: a good two months takes daily participants from 1 or 2 to 5 to 10, and completions from 5 to 10 or 15 a day. That is enough for Matt to see others on the daily's times. Judge the whole plan 8 weeks after the baseline ends (principle 5 asks for four to eight weeks of data). Keep the moves that showed a held rise, and drop the rest.

## The first 30 days

1. Days 1-3: Claude ships build item 1 (spoilers, rank wording, trailing slash, length check for cut links, re-sharing the daily line, 61 to 65) and build item 2 (home landings, new source words, kind and lang, privacy text, docs/launch-log.md). The owner does action 1 (Search Console, GitHub topics, AlternativeTo account) and the first part of action 2 (curl, Cloudflare bot events). The hint work continues.
2. Days 3-17: the two-week baseline; no outreach. Claude builds item 3 (image export, 'Share this hint'), then item 5 (daily cards, honest band cards, Learn cards, lastmod, manifest, /press/). The owner answers two or three Enjoy Sudoku threads as a solver, with no links.
3. Day 10: once the account is 7 days old, the owner submits the AlternativeTo listing (action 4). It is passive and its visits carry their own 'directory' word, so it does not blur the baseline.
4. Days 12-17: the owner does the second part of action 2: test posts on his own Reddit profile, viewed on old.reddit, new Reddit (rich text and Markdown) and the app, plus the logged-out domain check. Claude builds item 4 to the results, and turns on the Reddit format only if it renders.
5. Day 17: the baseline ends. The owner writes the numbers in the launch log and opens the Enjoy Sudoku Software thread (action 3): in his own words, with the AI-assistance line and a /p/ link. He replies in the thread through the week.
6. Day 24: the owner sends the menneske.no email (action 6) and three creator emails plus one to Puzzle Weekly (action 5), with position links and hint images. Their landing words differ ('sudoku' and 'social'), so they can be read apart. Claude ships item 6 (Atom feed, print view with QR code).
7. Day 30: the owner reads /admin against the baseline: 7-day completions, daily participants, landings by word, shares of kind image and post. He judges the forum thread at day 31 (14 days after). He picks the next single channel: r/WebGames in week 6, or the kode24 pitch. He leaves Show HN until the phase-4 band times exist, and decides on the optional r/sudoku appeal (action 8).

## Sources

- /home/user/sudokUI/docs/online-goals.md (principles 1-6, Phase 4 feed and launch moment, Do not build)
- /home/user/sudokUI/docs/goals.md (principle 6; 77 techniques implemented, practice mode for 65)
- /home/user/sudokUI/src/content/share.ts:101 (techs: daily.techs), :104-116 (sharePath has no trailing slash), :175-190 (ogTitle, descriptionDaily)
- /home/user/sudokUI/src/ui/Dialogs.tsx:960-1080 (ShareDialog), :1209-1211 (crowdPct when stats.count > 1)
- /home/user/sudokUI/src/ui/App.tsx:242, 1154 (victoryDismissed kept in memory only)
- /home/user/sudokUI/src/state/gameStore.ts:1929-2012 (encodePosition and decodePosition, no length check)
- /home/user/sudokUI/src/content/boardSvg.ts:132-137 (boardSvg, frameMarks called with null)
- /home/user/sudokUI/src/content/home.ts:88-167 ('61' in the en, nb and es strings)
- /home/user/sudokUI/src/content/privacy.ts:75 ('not where it went or to whom'; copying sends nothing)
- /home/user/sudokUI/worker/telemetry.ts:63 (SHARE_KINDS), :85-101 (event fields), :279-336 (LANDING_FROM and hosts)
- /home/user/sudokUI/wrangler.jsonc:38 (run_worker_first)
- /home/user/sudokUI/vite.config.ts:217-230 (Workbox precache and allowlist)
- /home/user/sudokUI/.vite/reach/live/*.html (crawler tags rendered through worker/index.ts)
- /home/user/sudokUI/.vite/reach/proto/*.png and *-reddit.md (image export and post-text prototypes)
- https://github.com/reddit/snudown/blob/master/src/autolink.c (strips only trailing ?!., from a bare link; read directly)
- https://github.com/vitalyiegorov/suuudokuuu/issues/696 (only source for r/sudoku Rule 2 and the 13 March 2026 mod post; read directly)
- https://www.reddit.com/r/sudoku/comments/1rsjzov/ (the mod post; not read, the owner should read it)
- https://support.reddithelp.com/hc/en-us/articles/360043504811-What-is-ban-evasion (via search summary)
- https://support.reddithelp.com/hc/en-us/articles/360043066412-Disrupting-Communities (via search summary)
- https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette (via search summary)
- https://github.com/ntropey/hodoku_revisited (read directly; GPL PWA, 0 stars; for positioning only, not to name)
- http://forum.enjoysudoku.com/software-f18.html and http://forum.enjoysudoku.com/what-is-the-most-commonly-used-software-t40117.html (via search)
- https://alternativeto.net/software/hodoku/ (via search)
- https://threadfox.vip/rules/for/games (r/WebGames rules, third-party summary)
- https://news.ycombinator.com/showhn.html and https://keydiscussions.com/2026/03/09/hacker-news-moves-toward-restricting-show-hn-posts-amid-the-ai-slop-wave/ (not verified this session)
- https://www.linux-magazine.com/Online/News/r-opensource-Bans-AI-Assisted-and-AI-Related-Projects (not verified this session)
- https://en.wikipedia.org/wiki/Cracking_the_Cryptic and https://www.hey.gg/blog/sudokupad (SudokuPad's reach through video links)
- https://www.cbc.ca/news/canada/british-columbia/sudoku-guy-online-puzzle-tutorials-1.4580449 and https://videos.feedspot.com/sudoku_youtube_channels/ (creators)
- https://puzzleweekly.substack.com (newsletter)
- https://www.menneske.no/sudoku/ and https://www.kode24.no/artikkel/gir-ut-app-uten-a-kunne-app-utvikling/252529 (Norway)
- https://www.lamis.no/index.php?pageID=277 (LAMIS maths day)
- https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping (lastmod must be accurate)
- https://www.indiehackers.com/post/my-sudoku-app-passed-20-000-installs-ama-86e6870147 (what one indie sudoku app's word-of-mouth growth looked like)
