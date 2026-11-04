# Google Play plan, November 2026

_Drawn on 4 November 2026, at the owner's request ("Play plan in docs"). A plan, not yet decided item by item. It keeps the principles of [goals.md](goals.md) and [online-goals.md](online-goals.md): no account ever, offline first, private, no ads. The reach plan held Play back "until 12 real testers can be named" ([reach-plan-2026-11.md](reach-plan-2026-11.md), "Do not"); this plan is what to do once they can. Google's help pages (support.google.com, play.google.com) and Chrome's (developer.chrome.com) could not be reached from this session, so the rules taken from them come from search summaries and are marked so under Sources. Read those pages yourself before each step, and re-check dates._

## In one paragraph

Put sudokUI on Google Play as a Trusted Web Activity (TWA): a tiny Android app, made with Google's Bubblewrap tool, that opens https://sudokui.app full screen in the phone's browser, usually Chrome. It runs the same code as the website, gets every update with the web deploy, and asks for no Android permissions. Google needs a personal developer account ($25 once, identity check), a closed test with at least 12 testers for 14 days, a build that targets Android 16 (API 36), a file on sudokui.app that proves the app and the site belong together, a privacy policy URL, a Data safety form, a content rating, and a store listing. About two days of code, and six to eight hours of the owner's time spread over three to five weeks, most of it waiting.

## What the app is: a Trusted Web Activity

- A TWA is the browser itself, opened without its address bar for a site the app proves it owns. There is no WebView and no copy of the app's code inside the Android package. The browser's service worker, storage and update prompt work exactly as in the installed web app.
- **Bubblewrap** (`@bubblewrap/cli`, version 1.27.0 of 9 October 2026 on npm) makes the Android project from the web manifest. It needs Node 18 or newer and JDK 17, and offers to download JDK and the Android SDK itself on first run. Its template sets `compileSdkVersion 36` and `targetSdkVersion 36` (read in its source). It writes `twa-manifest.json`, builds a signed app bundle (`.aab`) for Play and an `.apk` for a phone, and can write `assetlinks.json` (`bubblewrap fingerprint generateAssetLinks`).
- **PWABuilder** is a web form that wraps the same tool and hands back a zip with the bundle, a test APK, a signing key and `assetlinks.json` (search summary). Good for a first look, but the settings end up in a zip.
- **Choose Bubblewrap.** `twa-manifest.json` then lives in the repository, and the yearly rebuild is three commands. With no notifications and the default fallback, the template adds no permission at all (only the WebView fallback adds INTERNET).
- If the phone has no browser that supports TWAs, the default fallback opens a Custom Tab: the same site with a thin address bar.

## What Google asks, late 2026

| Item | What it is now | How sure |
|---|---|---|
| Developer account | Personal account, $25 once, no yearly fee | Search summaries agree |
| Identity | Legal name, address, phone and a government ID; Google says about three business days | Search summary of Google's help |
| Android device | New personal accounts confirm they own an Android phone, through the Play Console app | Search summaries; not confirmed on a Google page |
| What players see | Legal name, country and the developer e-mail; the full address only if you sell something | Search summary of Google's help; reports differ |
| Closed test | Personal accounts made after 13 November 2023: at least 12 testers opted in, without a break, for at least 14 days, then "Apply for production" with questions about the test. Still in force (older guides say 20 testers) | Google's help page, via search summary |
| Production review | Third-party guides: usually up to about 7 days | Search summaries only |
| Target API | From 31 August 2026, new apps and updates must target Android 16 (API 36); an extension to 1 November 2026 could be asked for | Read on developer.android.com |
| Signing | New apps must use Play App Signing: you sign with an upload key, Google signs for users. A lost upload key can be reset in Play Console | Read on developer.android.com |
| Privacy policy | Every app links one in Play Console and inside the app: a public web page, not a PDF, naming the developer or the app | Search summaries of Google's policy |
| Data safety | Every app fills it in, including the data deletion questions | Search summaries; data types read on developer.android.com |
| Content rating | The IARC questionnaire in Play Console; no app goes out without a rating | Search summary of Google's help |
| Developer verification | Android's new identity check for apps (Brazil, Indonesia, Singapore and Thailand from 30 September 2026, worldwide from 2027). Play registers almost all its apps by itself | Read on developer.android.com |

## Digital Asset Links: how sudokui.app serves the file

The TWA hides the address bar only if `https://sudokui.app/.well-known/assetlinks.json` names the app's package and the SHA-256 fingerprint of the key it is signed with. Google's rules: served over HTTPS, as `application/json`, with no redirect.

**How this Worker would serve it: it would not run at all.** The file is a static asset:
- It goes in `public/.well-known/assetlinks.json`. Vite copies `public/` as it is, folders starting with a dot included (`copyDir` in Vite 5.4.21).
- Wrangler 4.148.0 leaves out only `.assetsignore`, `_redirects` and `_headers` when it uploads assets (`createAssetsIgnoreFunction` in its source), so the folder is uploaded.
- The path is not in `run_worker_first` (wrangler.jsonc), so Cloudflare's asset hosting answers it before any Worker code: free, uncounted, and `application/json` from the extension. `html_handling` only touches `.html` files, so there is no redirect.
- The service worker does not precache `.json` and never answers it, and Google's verifier asks the server, not a phone's cache.

It holds two fingerprints: the **app signing key** that Google makes at the first upload (shown on Play Console's App signing page, with a ready snippet), and the owner's **upload key**, so a build installed by hand verifies too. Missing the first one is the classic mistake: the app from Play then shows an address bar.

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.sudokui",
    "sha256_cert_fingerprints": ["<app signing key>", "<upload key>"]
  }
}]
```

After the deploy, check that `curl -sI https://sudokui.app/.well-known/assetlinks.json` gives 200 and `application/json`, that Google's checker (`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://sudokui.app&relation=delegate_permission/common.handle_all_urls`) lists the statement, and that Cloudflare Security > Events shows no challenge on the path.

## The Data safety form, answered from privacy.ts

Play's own definitions decide the boxes (developer.android.com, "Data safety section guidance"). Two of them matter here: location **derived from an IP address** counts as location, and **approximate location** is any area of 3 km² or more, so the country the server adds is approximate location. Cloudflare and the mail provider handle data for sudokUI, as service providers, which Play does not count as sharing.

| Play's data type | What sudokUI sends (src/content/privacy.ts) | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|---|
| Location: Approximate location | The country Cloudflare reports, added by the server to each count | Yes | No | Yes: Settings, "Leave this device out of the counts" | Analytics |
| App activity: App interactions | The two lines per game and the line per share: kind of game, level, time in a 15-second step, installed or tab, version, language; what was shared and how | Yes | No | Yes, the same switch | Analytics |
| App activity: Other actions | A daily time, the finished grid, "no help", and a random token for that day, only after "Send my time" or the automatic switch | Yes | No | Yes | App functionality |
| Personal info: Email address | Only if the player types one into a report | Yes | No | Yes | App functionality (to answer) |
| App activity: Other user-generated content | A report's text, and the board while "Include the board" is ticked | Yes | No | Yes | App functionality |
| App info and performance: Diagnostics | A hint report's technique, notation and settings; the browser's user agent only if ticked | Yes | No | Yes | App functionality |

- **Not collected:** name, user IDs, device or other IDs, contacts, photos (a scanned photo is read on the device and never sent), files, precise location, crash logs, web browsing, purchases, health, messages, audio, calendar. Games, marks, statistics and the streak stay on the device, which Play does not count as collected.
- **The IP address** is read in memory to refuse floods and never written. The form has no type for it, so it is not declared; the privacy page already says it.
- **Encrypted in transit:** Yes, HTTPS only.
- **Deletion:** recommend Yes. What a player sends in a report is deleted on request at feedback@sudokui.app (the privacy page says so). The counts carry nothing that could be matched to a person, and expire after three months. The rule that apps must offer account deletion applies only to apps with accounts.
- **No ads; no advertising ID.** Check that the built bundle's manifest has no `AD_ID` permission.
- **Optional, with one condition.** A landing (the page, the level, the country and one word for where it came from) is counted from the request, which no switch can stop. That is why the code part stops counting the app's own opens as landings (below). Until that ships, mark location and app interactions as not optional.

**Rule from now on:** when privacy.ts changes, re-check this form in the same week. A wrong Data safety answer is a policy breach on Play, not just a stale page.

## Privacy policy URL

Use `https://sudokui.app/privacy/`. It is already what Play asks for: a public web page, not a PDF, not limited by country; it names the app, its operator (Anders Imenes) and a contact; it gives how long things are kept and how to have them deleted; and the app links it from its footer and Settings. The code part adds a short section in all three languages, in the same commit as the telemetry change:

> **The app from Google Play.** The sudokUI app on Google Play is this website, opened by your phone's browser in a window of its own. It sends exactly what this page describes and nothing more, and it asks for no Android permissions. Your games and settings, including the two switches above, are kept in that browser's storage for sudokui.app, so they are the same in the app and in the browser. Opening the app is not counted as a landing. Google Play records that you installed it, under Google's own privacy policy; sudokUI sees only Google's totals, such as installs per country.

## Content rating and target audience

- **Content rating:** answer the IARC questionnaire as a puzzle game: no violence, fear, sex, gambling, bad language or drugs; no in-app chat or other way for players to reach each other (a share hands a link to another app, which is not in-app interaction); no location shared; nothing to buy. Expect the lowest rating everywhere (Everyone, PEGI 3, USK 0). That is an expectation; IARC issues the rating.
- **Target audience: 13 and over.** Including under-13s brings in Play's Families policy. The app has no ads and no IDs, but the report form takes an e-mail address, which that policy treats strictly for children. The listing art must not look made for children either; the board and the drawn chains do not. School use with a teacher does not make the app "designed for children".

## The store listing

**Basics:** a Game, category Puzzle; Free; contact `feedback@sudokui.app` (shown in public), website `https://sudokui.app`, no phone. Default language English (en-US). Add Norwegian (`no-NO`) and the same Spanish text for `es-ES`, `es-419` and `es-US`, so Latin America does not fall back to English.

**Rules that shape the words** (Play's metadata policy, via search summaries): title at most 30 characters, short description 80, full description 4000; no "free", "no ads", "best", "#1", prices, emoji or capitals-only in the title, the icon or the developer name; no ranking or deal text on any graphic; no keyword lists. Following the owner's rule and the reach plan, no competitor is named anywhere, HoDoKu included, although the website says "HoDoKu-compatible". Lead with the teaching; end with "free, offline, no ads, no sign-up".

**Search:** Play weighs the title most, then the short description, then the long one. "Sudoku" sits in all three, with the words people type: hints, techniques, solver, daily, offline, and the technique names experts search for (X-Wing, chains, ALS, Exocet). Expect few installs from Play search, where "sudoku" is crowded; most will come from people who already know the site.

### English (en-US)

- **Title** (26): `sudokUI: Sudoku with Hints`. Alternative (30): `sudokUI: Sudoku Solver & Hints`.
- **Short description** (79): `Stuck? See the technique drawn on your own grid and learn to spot it next time.`

```text
When you are stuck, sudokUI shows you the next step the way a strong solver sees it. It names the technique, draws it on your own grid, cell by cell and link by link, and explains in plain words why it works. Next time, you spot it yourself.

WHAT YOU CAN DO
• Get hints that teach: 77 solving techniques, from singles and pairs to X-Wings, chains, ALS and Exocets, each drawn on your board.
• Practise 61 named techniques, with puzzles that need exactly the one you want to learn.
• Play seven levels, from Beginner to Nightmare. Every puzzle has a difficulty score, so you know what it will ask of you.
• Rate any sudoku you type in, paste or scan from a photo, and solve it step by step with every step named and explained.
• Solve the daily sudoku, the same puzzle for everyone, and compare your time with the day's other times if you choose to send it.
• Use corner and centre pencil marks, colours, undo and, when you want them, automatic candidates.
• Share a puzzle, a position or a picture of the board as a link that opens it.
• Read a short guide to every technique, in English, Norwegian or Spanish.

HOW IT WORKS
sudokUI runs on your phone. Puzzles are made, rated and solved on the device, so it plays offline, on a plane or on the bus. There is no account, no advertising and nothing to buy. Your games and statistics stay on the device.

While online, the app sends two short anonymous lines per game, with no ID of any kind, so its author can see how much it is played. You can switch that off in Settings. The privacy page lists exactly what leaves the device: https://sudokui.app/privacy/

The same app runs in any browser at sudokui.app, and its source code is public.

Free, offline, no ads, no sign-up.
```

### Norwegian (no-NO)

- **Title** (24): `sudokUI: Sudoku med hint`. Alternative (28): `sudokUI: Lær sudokuteknikker`.
- **Short description** (78): `Står du fast? Se teknikken tegnet på ditt eget brett, og lær å finne den selv.`

```text
Når du står fast, viser sudokUI deg neste steg slik en sterk løser ser det. Appen navngir teknikken, tegner den på ditt eget brett, rute for rute og lenke for lenke, og forklarer med enkle ord hvorfor den virker. Neste gang ser du den selv.

DETTE KAN DU GJØRE
• Få hint som lærer deg noe: 77 løsningsteknikker, fra singler og par til X-Wing, kjeder, ALS og Exocet, hver av dem tegnet på brettet ditt.
• Øv på 61 navngitte teknikker, med oppgaver som krever akkurat den du vil lære.
• Spill på sju nivåer, fra Nybegynner til Mareritt. Hver oppgave har en poengsum for vanskelighetsgrad, så du vet hva den krever.
• Vurder enhver sudoku du skriver inn, limer inn eller skanner fra et bilde, og løs den steg for steg, med hvert steg navngitt og forklart.
• Løs dagens sudoku, den samme oppgaven for alle, og sammenlign tiden din med dagens andre tider hvis du velger å sende den inn.
• Bruk notater i hjørnet og i midten, farger, angre og, når du vil, automatiske kandidater.
• Del en oppgave, en stilling eller et bilde av brettet som en lenke som åpner den.
• Les en kort veiledning til hver teknikk, på norsk, engelsk eller spansk.

SLIK VIRKER DEN
sudokUI kjører på telefonen din. Oppgavene lages, vurderes og løses på enheten, så appen virker uten nett, på flyet eller på bussen. Den har ingen konto, ingen reklame og ingenting å kjøpe. Spillene og statistikken din blir på enheten.

Når du er på nett, sender appen to korte, anonyme linjer per spill, uten noen form for ID, slik at den som har laget den, kan se hvor mye den brukes. Du kan slå det av i innstillingene. Personvernsiden lister opp nøyaktig hva som forlater enheten: https://sudokui.app/nb/privacy/

Den samme appen kjører i alle nettlesere på sudokui.app, og kildekoden er åpen.

Gratis, virker uten nett, ingen reklame, ingen innlogging.
```

### Spanish (es-ES, es-419, es-US)

- **Title** (26): `sudokUI: Sudoku con pistas`. Alternative (23): `sudokUI: Aprende sudoku`.
- **Short description** (74): `¿Te atascas? Ve la técnica dibujada en tu tablero y aprende a encontrarla.`

```text
Cuando te atascas, sudokUI te muestra el siguiente paso tal como lo ve un buen resolvedor. Nombra la técnica, la dibuja en tu propio tablero, casilla a casilla y enlace a enlace, y explica con palabras sencillas por qué funciona. La próxima vez, la ves tú.

QUÉ PUEDES HACER
• Pistas que enseñan: 77 técnicas de resolución, de los únicos y los pares al X-Wing, las cadenas, los ALS y el Exocet, cada una dibujada en tu tablero.
• Practica 61 técnicas con nombre propio, con sudokus que necesitan justo la que quieres aprender.
• Juega en siete niveles, de Principiante a Pesadilla. Cada sudoku tiene una puntuación de dificultad, para que sepas lo que te va a pedir.
• Puntúa cualquier sudoku que escribas, pegues o escanees de una foto, y resuélvelo paso a paso, con cada paso nombrado y explicado.
• Resuelve el sudoku del día, el mismo para todos, y compara tu tiempo con los demás tiempos del día si decides enviarlo.
• Usa anotaciones en la esquina y en el centro, colores, deshacer y, cuando quieras, candidatos automáticos.
• Comparte un sudoku, una posición o una imagen del tablero como un enlace que lo abre.
• Lee una guía breve de cada técnica, en español, inglés o noruego.

CÓMO FUNCIONA
sudokUI funciona en tu teléfono. Los sudokus se crean, se puntúan y se resuelven en el dispositivo, así que funciona sin conexión, en el avión o en el autobús. No tiene cuenta, ni publicidad, ni nada que comprar. Tus partidas y tus estadísticas se quedan en el dispositivo.

Mientras estás en línea, la app envía dos líneas cortas y anónimas por partida, sin ningún tipo de identificador, para que su autor pueda ver cuánto se juega. Puedes desactivarlo en Ajustes. La página de privacidad enumera exactamente lo que sale del dispositivo: https://sudokui.app/es/privacy/

La misma app funciona en cualquier navegador en sudokui.app, y su código fuente es público.

Gratis, sin conexión, sin anuncios, sin registro.
```

Each long text is under 2,000 of the 4,000 characters. Each claim matches the app as of 4 November: 77 techniques, practice for 61, seven picks from Beginner to Nightmare, typing in, pasting and scanning a puzzle, the solver's steps, the daily times, corner and centre marks, colours, auto candidates, share links and pictures, Learn in three languages, and the privacy lines. When a number changes in the app, change it here and on Play.

### Graphics

- **Icon:** 512 × 512, 32-bit PNG, at most 1 MB, a **full square** with no rounded corners and no shadow: Play rounds the corners itself (read on developer.android.com). Today's `public/icon-512.png` has rounded, see-through corners, so it needs a full-bleed version. The manifest's maskable icon is the same file and should get a full-bleed version too, since Bubblewrap uses it for the Android launcher icon.
- **Feature graphic:** 1024 × 500, JPEG or 24-bit PNG with no transparency, one per language: the board with the X-Wing drawn (scripts/og-card.ts already makes it), the name, and one line such as "Hints that draw the technique on your grid". No price, ranking or "no ads" text on it.
- **Phone screenshots:** 4 to 8 per language, 1080 × 1920 (9:16), JPEG or 24-bit PNG (Play takes 2 to 8, each side 320 to 3,840 px; search summaries). Suggested: a drawn chain with its explanation, a hint panel, the practice catalogue, the New game levels, the daily win screen with times, a Learn page; dark and light themes. Made from the real app in each language, from the scenes in src/ui/demo.ts.
- Tablet screenshots and a video are optional; skip them at first.

## What stays the same

- **Updates ship with the web deploy.** Merging to main updates the Play app the moment its browser loads the new service worker, with the same "new version" prompt (`registerType: 'prompt'`). No Play review for web changes. Play's policy allows this: its ban on downloading code exempts JavaScript running in a browser, but that JavaScript must still follow Play's policies (search summary of the Device and Network Abuse policy). So a web change that breaks a Play rule breaks the app too.
- **The Android shell needs a new upload only** when its name, icon, colours or start URL change, and once a year for the target API: Google has raised it every August, so plan a rebuild with the newest Bubblewrap each summer, before 31 August.
- **No accounts.** Play needs a Google account to install, which is Google's; the website stays the no-account way in.
- **Telemetry `lang`** is unchanged: it is the app's own language setting. The TWA opens `/`, so a first open takes the phone's language (`deviceLang`, src/state/settings.ts), then the player's choice. The listing's language never reaches the app.
- **Landing kinds** (`p`, `daily`, `home`) and the landing words are unchanged.
- **Storage and switches** live in the browser's storage for sudokui.app, so the Play app and the same browser share games, settings and "Leave this device out of the counts" (to confirm on the first test build).
- **The free-tier budget** is unchanged: a Play user is a web app user with a service worker.

## Should a TWA launch count as its own landing kind?

**What would happen with no change.** A first open on a phone whose browser has never loaded sudokui.app reaches the Worker as a visit to `/` from outside the site. Chrome is reported to send the launching app as the referrer, `android-app://app.sudokui` (a search summary of a Chromium change; android-browser-helper sets none itself). `landingFrom` reads an unknown app as `other`. Every later open is answered by the service worker and never reaches the Worker. So Play installs would trickle into `home` landings with the word `other`: noise in the very numbers the reach plan watches. Google's pre-launch test phones would add a few after each upload.

**Recommendation: no, not its own landing kind.** Treat the app's own package like the site itself: no landing. Opening an installed app is not a person arriving from a link, and Play Console already counts store visits and installs, as Google's totals. Fewer points are written, and nothing new is sent.

**Measure the channel another way, if the owner wants it:** a third value for the existing installed-or-tab field, `play`, next to `pwa` and `tab`. The TWA starts at `/?from=play`, a fixed marker that is the same for everyone; the app reads it at start-up and keeps it in memory only, so nothing is stored on the device (principle 3 and ekomloven § 3-15 stay as they are). The service worker already answers `/` with any query string offline (`APP_NAVIGATION`, src/content/home.ts), and the Worker matches `/` by path, so neither changes. /admin gains the column, so the owner can see how much play comes through Play.

**What it means for the privacy page,** in all three languages and in the same commit as the code (the reach plan's rule):
- the landing paragraph gains "or when sudokUI's app from Google Play opens it" after "No landing is counted when the browser already holds sudokUI and opens the link or the page itself";
- with `play`, "whether the app runs installed or in a browser tab" becomes "whether the app runs installed, as the app from Google Play, or in a browser tab", in the play line and the share line;
- the new section "The app from Google Play" (above).

**Check on the first test build:** that the TWA matches `display-mode: standalone` (it should read `pwa` today; unconfirmed) and what referrer it sends. Neither could be confirmed from a source this session could read.

## Risks

- **"Webview spam" and minimum functionality.** Google removes apps that are only a website in a frame, made to drive traffic. sudokUI owns its site (the asset file proves it) and does real work on the phone, offline. Lower the risk with a review note in "App access": an offline puzzle app whose engine runs on the device, no login, every feature open.
- **The 12 testers are the long pole.** They must stay opted in for 14 days without a break, and the production application asks about the test. Use real people who play; third-party "tester" services exist, and the safe route is not to use them.
- **The wrong fingerprint** shows an address bar in the app from Play while a hand-installed build looks fine. Check on a phone after the first install from Play.
- **The very first open offline** shows the browser's error page, because the service worker is not there yet (Chrome's offline-first guide). It is rare right after a download; a custom Android launcher could fix it, but that is native code, which this plan avoids.
- **Phones without Chrome** use another browser that supports TWAs, or a Custom Tab with an address bar. Storage is then that browser's.
- **The yearly target API date.** Miss it and new users on newer Android stop seeing the app. Put the rebuild in the calendar.
- **The upload key** lives with the owner. If lost, Play can reset it; keep an offline backup anyway.
- **Public details.** A personal account shows the owner's legal name and country, and the developer e-mail.
- **A wrong Data safety answer** after a web change is a policy breach. Keep the re-check rule above.
- **Small numbers.** Play search is crowded and slow; expect installs mostly from people who already know the site.

## The plan, step by step

### The owner's part

1. **Line up 12 testers first.** People with an Android phone and a Google account who will keep the test app installed for 14 days and play a few games. Ask now; the rest waits for this. _About 1 hour of messages; days of waiting._
2. **Create the Play Console personal account:** $25 once, legal name, address, phone, a government ID, and the check with an Android phone. Developer name "sudokUI"; developer e-mail feedback@sudokui.app. _45 minutes, then up to a few days for the check._
3. **Choose the package name.** Recommended: `app.sudokui`. It can never change. _5 minutes._
4. **Create the app** (sudokUI, English, Game, Free) and fill in App content: privacy policy URL, ads (no), app access (all open, with the review note), content rating, target audience 13+, Data safety (the table above), advertising ID (no), and no to the government, finance, health and news questions. _About 1.5 hours._
5. **Read and paste the store listing** in English, Norwegian and Spanish, and upload the icon, feature graphics and screenshots the code part makes. _About 1 hour._
6. **Build and upload the first bundle** to the closed testing track: run the two Bubblewrap commands the code part writes down, upload `app-release-bundle.aab`, keep Play App Signing on, and send the code part the two SHA-256 fingerprints. Add the testers (an e-mail list or a Google Group) once the asset file is live, and send them the opt-in link. _About 1 hour, then a few days of review._
7. **Check it on your own phone:** installed from Play, no address bar, works offline after the first open, the same games as in the browser, the update prompt after a deploy. _20 minutes._
8. **Run the test for 14 days.** Answer testers and write down what they say; the production application asks. _A little each day._
9. **Apply for production** and answer its questions. _30 minutes, then up to about a week._
10. **Release** to production, and add a dated line to [launch-log.md](launch-log.md). Give it its own week, as the reach plan's one-channel-a-week rule asks. _20 minutes._
11. **Every summer,** before 31 August: rebuild with the newest Bubblewrap and upload. _30 minutes a year._

### The code part

1. **Manifest** (vite.config.ts): `id`, `start_url` and `scope` stated; a full-bleed maskable icon; screenshots and shortcuts (part of the reach plan's build item 5); a full-square 512 px icon for Play (scripts/make-icons.mjs). _About 2 hours._
2. **The Android project** in `android/`: `twa-manifest.json` for Bubblewrap 1.27 (package, host sudokui.app, start URL, colour #1a1d29, standalone, notifications off, Custom Tab fallback, no extra features, the web manifest and icon URLs, the signing key's path outside the repository), the generated project, a `.gitignore` for keys and builds, and `android/README.md` with the build and yearly-update commands. Check the built bundle asks for no permission and has no `AD_ID`. _2 to 3 hours._
3. **Digital Asset Links:** `public/.well-known/assetlinks.json` with both fingerprints, a test that it is valid, names the package and reaches `dist/`, and the curl and API checks after the deploy. _1 hour, once the fingerprints exist._
4. **Telemetry and privacy:** the app's own `android-app://` referrer is no landing (worker/telemetry.ts, `isLanding`); if the owner agrees, the `play` value (SOURCES in worker/telemetry.ts, `playedFrom` in src/state/dailyStats.ts, the /admin column); tests that the worker takes `play`, refuses other values and writes no landing for the app's own referrer; privacy.ts in all three languages in the same commit. _About half a day._
5. **Store graphics:** a script that photographs the real app at 1080 × 1920 in en, nb and es from the demo scenes, and a 1024 × 500 feature graphic per language from scripts/og-card.ts, with no transparency and no promotional words. _About a day, with checking each picture._
6. **Docs:** deployment.md says when the Android shell needs an upload and how; this plan gets its Status; the launch log its line. _1 hour._

## Time, honestly

- **Code:** about 2 to 2.5 days of sessions, mostly the screenshots in three languages.
- **Owner, hands-on:** about 6 to 8 hours in all.
- **Calendar:** three to five weeks from creating the account to production, if the 12 testers are ready on day one: a few days for the identity check, a few for the first review, 14 days of testing at the least, and up to a week for the production review. Add however long it takes to find the testers.
- **After launch:** about half an hour a year, plus a Data safety check whenever privacy.ts changes.

## For the owner to decide

1. Go, and in which week, given one reach channel a week.
2. The package name (`app.sudokui` recommended; permanent).
3. The title in each language (one choice and one alternative above).
4. The `play` value on play lines: yes or no.
5. The target audience: 13 and over (recommended).
6. The deletion answer on the Data safety form: Yes (recommended).
7. Whether one attributed line about HoDoKu-compatible scores belongs in the long description later. The default here is no, by the no-competitor rule.

## Sources

Read directly in this session:
- https://developer.android.com/google/play/requirements/target-sdk (API 36 from 31 August 2026; extension to 1 November 2026)
- https://developer.android.com/training/app-links/configure-assetlinks (the file's format, HTTPS, `application/json`, no redirect, Play App Signing's fingerprint)
- https://developer.android.com/studio/publish/app-signing (Play App Signing required for apps made since August 2021; upload key reset)
- https://developer.android.com/guide/topics/data/collect-share (Data safety data types; IP-derived location; approximate location at 3 km² or more)
- https://developer.android.com/developer-verification (the timeline; Play registers 99% of apps itself)
- https://developer.android.com/distribute/google-play/resources/icon-design-specifications (512 px, 32-bit PNG, 1 MB, full square, Play rounds the corners)
- https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md (requirements, fingerprints, `twa-manifest.json` fields); packages/core/template_project/app/build.gradle (target and compile SDK 36), its AndroidManifest.xml and src/lib/features/FeatureManager.ts (permissions)
- `npm view @bubblewrap/cli time` (1.27.0, 9 October 2026)
- https://github.com/GoogleChrome/developer.chrome.com, site/en/docs/android/trusted-web-activity/query-parameters and offline-first (the source of Chrome's TWA guides: a fixed query parameter in the start URL for analytics; the first open offline shows the error page)
- https://github.com/GoogleChrome/android-browser-helper, trusted/LauncherActivity.java and TwaLauncher.java (no referrer set by the library)
- This repository: node_modules/wrangler 4.148.0 (`createAssetsIgnoreFunction`), node_modules/vite 5.4.21 (`copyDir`), wrangler.jsonc, worker/index.ts, worker/telemetry.ts, vite.config.ts, src/content/home.ts, src/state/settings.ts, src/state/dailyStats.ts, src/content/privacy.ts

From search summaries only (the pages could not be fetched here; read them before acting):
- https://support.google.com/googleplay/android-developer/answer/14151465 (testing requirements for new personal accounts)
- https://support.google.com/googleplay/android-developer/answer/13628312 (account details; what Play shows in public)
- https://support.google.com/googleplay/android-developer/answer/10787469 (Data safety section; sharing exemptions)
- https://support.google.com/googleplay/android-developer/answer/13327111 (account deletion applies to apps with accounts)
- https://support.google.com/googleplay/android-developer/answer/9898842 (metadata policy)
- https://support.google.com/googleplay/android-developer/answer/9888379 (Device and Network Abuse: JavaScript in a browser is exempt)
- https://support.google.com/googleplay/android-developer/answer/9859455 (privacy policy in Play Console)
- https://support.google.com/googleplay/android-developer/answer/9867159 and /answer/9893335 (target audience; Families)
- https://support.google.com/googleplay/android-developer/answer/9898843 (content ratings)
- https://support.google.com/googleplay/android-developer/answer/1078870 (graphic assets)
- https://android-developers.googleblog.com/2020/10/developer-tips-and-guides-common-policy.html (webview spam and minimum functionality)
- https://developer.chrome.com/docs/android/trusted-web-activity/quick-start (a failed check falls back to a Custom Tab)
- https://codereview.chromium.org/1284743003 (Chrome builds an `android-app://` referrer from the calling package)
- https://spacenexus.us/blog/play-store-launch-checklist-pwa-twa-android (PWABuilder's zip; the second fingerprint after the first upload)
- https://appradar.com/blog/android-app-screenshot-sizes-and-guidelines-for-google-play (screenshot sizes)
- https://www.apptweak.com/en/aso-blog/how-to-prepare-for-new-google-metadata-policy-changes (words banned from titles)
