# Launch posts: the advent calendar, December 2026

Ready-to-paste posts for the sudoku advent calendar, which opens on
Tuesday 1 December 2026: in Norwegian (bokmål) and English, a short and a
longer version for each place. Each post uses the link that its place
will count right on `/admin`, and says which word it will show as.

The calendar, as the posts describe it (src/content/adventPage.ts): 24
doors, one opening each day from 1 to 24 December at midnight by the
player's own clock, a sudoku behind each. Door 1 is very easy, and each
door is a little harder than the one before: doors 1 to 18 are Easy
(singles only), 19 to 24 Medium. Everyone gets the same puzzle behind the
same door; a door solved without help can send its time and see where it
stands among everyone's. Every open door stays open until 31 December.
The app is free, has no ads and no account, works in the browser on a
phone, tablet or computer, and works offline; when you are stuck, a hint
shows the next step on your own board and why it works.

Placeholders in square brackets, such as `[navn]`, are for you to fill
in. Nothing here names a person, a group or a place on purpose.

## The links, and the word each shows as

Every post links to the calendar's page (or, for the reminders, to a
door), never to the home page. The calendar's page is counted for
everyone who comes from outside the site, even a player whose browser
already holds the app; the home page is not.

The word comes from what the browser says about where the link was
opened from (worker/telemetry.ts, `landingWord`). Where a place says
nothing, or names only the Android app that opened the link (Google Lens,
a phone's camera), our own tag on the link gives the word:
`?utm_source=chat` for a chat, `?utm_source=poster` on the printed QR
code. A tag names a kind of place, never a person. Where the browser
names a site, such as facebook.com, the site decides, tag or not.

| Post | Link | Word on /admin |
|---|---|---|
| 1. Facebook, your own wall | `https://sudokui.app/nb/julekalender/` (English: `https://sudokui.app/advent/`) | `facebook` (a few may be `none`) |
| 2. Facebook, a local or hobby group | the same | `facebook` |
| 3. Messenger or a family chat | `https://sudokui.app/nb/julekalender/?utm_source=chat` (English: `https://sudokui.app/advent/?utm_source=chat`) | `chat` |
| 4. Church newsletter, on paper | the QR code from the flyer, or the address written out: `sudokui.app/nb/julekalender` | `poster` for the code, `none` when typed |
| 4. Church newsletter, by e-mail | `https://sudokui.app/nb/julekalender/` | `mail` from webmail and the Gmail and Outlook apps on Android, `none` from most mail apps; sometimes `search` or `other` (see below) |
| 5. Workplace social channel | the chat link, `...?utm_source=chat` | `chat` |
| 6. Noticeboard: poster and flyer | the printed QR code (`?utm_source=poster`, promo/print/) | `poster` |
| 7. Reminders, door 8 and door 15 | a door's own address: `https://sudokui.app/nb/advent/2026/8` on Facebook, with `?utm_source=chat` in a chat | `facebook` or `chat`, on the door's row |

On `/admin` these show in the Christmas section, "Where the calendar's
landings came from" (rows Facebook, A chat app or site, Paper, A mail app
or webmail, No referrer), and in "Landings per day by word, last 28 days"
(a column per word, a row per day).

Why no tag on the Facebook and e-mail links: Facebook sends its own
address with the click, which decides anyway. A chat tag there would only
mislabel the few clicks that come with nothing. And no tag fits e-mail:
the chat tag would count a newsletter as a chat.

## What cannot be told apart

- **Your wall and a Facebook group** are both `facebook`. To tell them
  apart, post them on different days (below) and read them day by day in
  the 28-day table.
- **The family chat and the workplace channel** are both `chat`. Post
  them on different days too.
- **One poster and another.** Every poster and flyer, at the library or
  the café, is `poster`. Write in the launch log the day each one goes up.
- **`none` is a mix**: a typed address (from a poster, a printed
  newsletter or a friend's mouth), a bookmark, a mail app, and a few
  Facebook clicks on an iPhone. It cannot be split.
- **E-mail can hide.** Gmail on the web may pass a link through Google's
  own redirect, which reads as `search`, and a work mailbox's link
  checker may read as `other`. Count a newsletter as `mail` plus some
  `none`, and do not expect it to be exact.
- **Shared on.** A link that someone forwards counts where it was opened
  the second time: your Facebook post sent on in a chat shows as `chat`.
  A tagged link keeps its tag when it is copied, so a chat link pasted
  into an e-mail still reads `chat`. That is still your post's doing.
- **A door's link** (the reminders) counts only a person whose browser
  does not hold the app yet: an installed app opens a door itself, so a
  returning player's click is not a landing. The calendar's page counts
  everyone. The reminders are for bringing people into the puzzle, not
  for counting.
- **The home page.** Someone who types only `sudokui.app` lands on the
  home page, counted there as `home` with `none`, and not in the
  Christmas section. From 1 to 24 December a first visit to the home
  page opens today's door anyway.

## When to post

- **By Monday 30 November:** hang the posters and leave the flyers
  (promo/print/README.md says how to print them and to ask first).
  Before 1 December the calendar's page says that it opens on
  1 December, so an early scan is not wasted.
- **Church newsletter:** ask now. The first Sunday of Advent is 29
  November; the December issue of a printed parish magazine may already
  be printed, but the Sunday notices or an e-mailed newsletter may still
  have room, for 29 November or 6 December.
- **Tuesday 1 December, morning (about 7 to 8.30, before work and over
  breakfast):** door 1 is open. Post on your own Facebook wall and in the
  family chat. Their words differ, `facebook` and `chat`.
- **Wednesday 2 December:** the Facebook group (after an admin's yes) in
  the morning, and the workplace channel at lunch. Again one `facebook`
  and one `chat`, on a day of their own.
- **Tuesday 8 December, door 8:** a reminder on your wall (a new short
  post or a comment on the first one), and in the family chat only if
  people there liked it. Not in the group or at work.
- **Tuesday 15 December, door 15:** a second reminder, the same way. From
  door 19 the puzzles are Medium: a good thing to say.

Post once in each place. Do not post the same text in many groups on the
same day: it looks like spam, to people and to Facebook.

## Pictures: which goes with which post

The pictures in promo/ are made by `npx vite-node scripts/promo-cards.ts`
(after `npm run build`); promo/ is not in the repository, apart from
promo/print/. The link previews are the site's own: a link to the
calendar's page shows its card (public/og-advent-2026.nb.png, and
og-advent-2026.png in English), and a door's link shows that door's
picture (public/og/advent/door-08.png, door-15.png).

| Post | Picture |
|---|---|
| 1. Facebook, your own wall | Just the link: Facebook shows the calendar's card, and the whole card is a link. For a picture post instead, `promo/sudokui-christmas-square.nb.png` (`.en.png`), with the link in the text; a picture post may be seen more but clicked less. |
| 2. Facebook group | Just the link and its card; or `promo/sudokui-christmas-square.nb.png` if the group likes pictures. |
| 3. Messenger or a family chat | Just the link: the chat shows the card. |
| 4. Church newsletter | On paper: the flyer as an insert (`promo/print/advent-flyer-a5.nb.pdf`, or two to a sheet, `advent-flyers-2up-a4.nb.pdf`). If they would rather print the code in the newsletter itself, give them the flyer's PDF to place in their layout, and ask that the code stays at least 3 cm wide (the PNG previews are too coarse for print). By e-mail: `promo/sudokui-christmas-square.nb.png`. |
| 5. Workplace channel | Just the link. Keep it small. |
| 6. Noticeboard | `promo/print/advent-poster-a4.nb.pdf` and the flyers, `promo/print/advent-flyers-2up-a4.nb.pdf` (English: `.en.pdf`). |
| 7. Reminders | The door's link: its own picture shows by itself. |

The story pictures, `promo/sudokui-christmas-story.*.png`, are for a
Facebook or Instagram story, which these posts do not cover. The everyday
pictures, `promo/sudokui-regular-square.*.png` and `-story.*.png` (the
hints), are for January, not for these posts.

## The posts

### 1. Facebook, your own wall

Link: `https://sudokui.app/nb/julekalender/` (English
`https://sudokui.app/advent/`). Word: `facebook`.

Norsk, kort:

```text
Nå har jeg laget en sudoku-julekalender! Fra 1. til 24. desember åpner det en ny luke hver dag, med en sudoku bak. Gratis, uten reklame og uten konto.

https://sudokui.app/nb/julekalender/
```

Norsk, lengre:

```text
Julekalender for alle som liker sudoku

På fritiden har jeg laget sudokUI, en sudoku-app som virker rett i nettleseren. I år har den fått en julekalender: fra 1. til 24. desember åpner det en ny luke hver dag, med en sudoku bak.

Luke 1 er veldig lett, og hver luke er litt vanskeligere enn den før, så du trenger ikke ha spilt sudoku før. Alle får den samme oppgaven bak samme luke, og løser du en luke uten hjelp, kan du se hvordan tiden din står seg mot alle andres.

Står du fast, viser et hint deg neste steg på ditt eget brett, og forklarer hvorfor det virker.

Den er gratis, uten reklame og uten konto, og virker på mobil, nettbrett og PC. Har du gått glipp av en dag, står lukene åpne til 31. desember.

Luke 1 er åpen nå: https://sudokui.app/nb/julekalender/

Del gjerne med noen som liker sudoku!
```

English, short:

```text
I've made a sudoku advent calendar! From 1 to 24 December a new door opens every day, with a sudoku behind it. Free, no ads, no account.

https://sudokui.app/advent/
```

English, longer:

```text
An advent calendar for anyone who likes sudoku

In my spare time I've made sudokUI, a sudoku app that works right in the browser. This year it has an advent calendar: from 1 to 24 December a new door opens every day, with a sudoku behind it.

Door 1 is very easy, and each door is a little harder than the one before, so you don't need to have played before. Everyone gets the same puzzle behind the same door, and if you solve a door without help, you can see how your time compares with everyone else's.

Stuck? A hint shows you the next step on your own board, and why it works.

It's free, with no ads and no account, and works on a phone, tablet or computer. Missed a day? The doors stay open until 31 December.

Door 1 is open now: https://sudokui.app/advent/

Feel free to share it with someone who likes sudoku!
```

### 2. Facebook, a local or hobby group

Link: the same as on your wall. Word: `facebook` (the same word as your
wall: post it on another day).

**Before you post:** read the group's rules. Many groups do not allow
promotion, or only on a set day. Ask an admin first, and post only after
a yes. Say in the post that an admin said yes.

Message to an admin, norsk:

```text
Hei! Jeg har laget en gratis sudoku-julekalender på nett, som et fritidsprosjekt: ingen reklame, ingen konto, ingenting å kjøpe. Er det greit at jeg legger ut ett innlegg om den i gruppa? Hvis ikke, er det helt i orden. Takk!
```

Message to an admin, English:

```text
Hi! I've made a free sudoku advent calendar as a spare-time project: no ads, no account, nothing to buy. Would it be all right to post about it once in the group? If not, that's completely fine. Thanks!
```

Norsk, kort:

```text
Liker du sudoku? Jeg har laget en gratis sudoku-julekalender på nett: én ny luke hver dag fra 1. til 24. desember. Luke 1 er veldig lett, og så blir de litt vanskeligere for hver dag. Ingen reklame og ingen konto. (Lagt ut etter avtale med admin.)

https://sudokui.app/nb/julekalender/
```

Norsk, lengre (for en gruppe om sudoku, kryssord eller hjernetrim):

```text
Sudoku-julekalender, gratis (lagt ut etter avtale med admin)

Jeg har laget en sudoku-julekalender på fritiden. Fra 1. til 24. desember åpner det en ny luke hver dag, med en sudoku bak, og alle får den samme oppgaven bak samme luke.

Den begynner rolig og blir litt vanskeligere for hver dag. Hver luke viser nivå og HoDoKu-poengsum: luke 1 har rundt 100, luke 24 rundt 1000. Luke 1 til 18 er Lett (bare singler), luke 19 til 24 er Middels (der trengs også låste kandidater, par eller tripler).

Står du fast, viser et hint neste steg på ditt eget brett og forklarer hvorfor det virker. Løser du en luke uten hjelp, kan du sende inn tiden din og se hvor den står blant alles.

Gratis, ingen reklame, ingen konto, og den virker uten nett. Lukene står åpne til 31. desember.

https://sudokui.app/nb/julekalender/
```

English, short:

```text
Like sudoku? I've made a free sudoku advent calendar: a new door every day from 1 to 24 December. Door 1 is very easy, and each one gets a little harder. No ads, no account. (Posted with the admins' OK.)

https://sudokui.app/advent/
```

English, longer (for a sudoku, crossword or puzzle group):

```text
A free sudoku advent calendar (posted with the admins' OK)

In my spare time I've made a sudoku advent calendar. From 1 to 24 December a new door opens every day, with a sudoku behind it, and everyone gets the same puzzle behind the same door.

It starts gently and gets a little harder each day. Every door shows its level and its HoDoKu rating: about 100 behind door 1, about 1000 behind door 24. Doors 1 to 18 are Easy (singles only); doors 19 to 24 are Medium (they also take locked candidates, pairs or triples).

Stuck? A hint shows the next step on your own board and explains why it works. Solve a door without help and you can send your time and see where it stands among everyone's.

Free, no ads, no account, and it works offline. The doors stay open until 31 December.

https://sudokui.app/advent/
```

### 3. Messenger or a family chat

Link: `https://sudokui.app/nb/julekalender/?utm_source=chat` (English
`https://sudokui.app/advent/?utm_source=chat`). Word: `chat`. Keep the
`?utm_source=chat` on the link: Messenger on an iPhone, WhatsApp and text
messages often say nothing about where a link was opened, and the tag is
what lets the dashboard count them as a chat. It names no one.

Norsk, kort:

```text
Hei! Jeg har laget en sudoku-julekalender, med en ny luke hver dag frem til jul. Gratis og uten reklame. Første luke er åpen nå: https://sudokui.app/nb/julekalender/?utm_source=chat
```

Norsk, lengre:

```text
Hei alle sammen! Et lite juletips fra meg: Jeg har laget en sudoku-julekalender. Fra i dag og frem til julaften åpner det en ny luke hver dag, med en sudoku bak. Luke 1 er veldig lett, og så blir de litt vanskeligere for hver dag. Alle får samme oppgave, så vi kan jo se hvem som er raskest! Den er gratis, uten reklame og uten konto, og virker rett på mobilen. Si gjerne fra hva dere synes.

https://sudokui.app/nb/julekalender/?utm_source=chat
```

English, short:

```text
Hi! I've made a sudoku advent calendar, with a new door every day until Christmas. Free and no ads. Door 1 is open now: https://sudokui.app/advent/?utm_source=chat
```

English, longer:

```text
Hi everyone! A little Christmas tip from me: I've made a sudoku advent calendar. From today until Christmas Eve a new door opens every day, with a sudoku behind it. Door 1 is very easy, and they get a little harder each day. Everyone gets the same puzzle, so we can see who's fastest! It's free, with no ads and no account, and works right on your phone. Let me know what you think.

https://sudokui.app/advent/?utm_source=chat
```

### 4. A church newsletter or bulletin

Ask the parish office or the editor; offer the text and the flyer, and
let them choose. On paper, the QR code is what counts: from the flyer it
reads as `poster` (the same word as the posters). The address written out
reads as `none` when someone types it. By e-mail, use the plain link
(`https://sudokui.app/nb/julekalender/`): it reads as `mail` or `none`,
and sometimes `search` or `other` (above). Do not use the chat link in a
newsletter.

Norsk, kort (til kunngjøringer eller en liten rute):

```text
Sudoku-julekalender: En ny sudoku hver dag fra 1. til 24. desember. Den første er veldig lett. Gratis og uten reklame, på mobil, nettbrett eller PC. Gå til sudokui.app/nb/julekalender
```

Norsk, lengre (til menighetsbladet eller nyhetsbrevet):

```text
Litt hjernetrim i adventstiden

Har du lyst på en liten sudoku hver dag frem mot jul? På sudokui.app finnes en sudoku-julekalender med en ny luke hver dag fra 1. til 24. desember. Luke 1 er veldig lett, og hver luke er litt vanskeligere enn den før, så du trenger ikke ha spilt sudoku før. Står du fast, viser et hint deg neste steg. Kalenderen er gratis, uten reklame og uten innlogging, og virker på mobil, nettbrett og PC. Har du gått glipp av en dag, står lukene åpne til 31. desember.

Skriv sudokui.app/nb/julekalender i nettleseren, eller skann QR-koden.
```

(Leave out "eller skann QR-koden" when there is no code beside it.)

English, short:

```text
A sudoku advent calendar: a new sudoku every day from 1 to 24 December. The first is very easy. Free and no ads, on a phone, tablet or computer. Go to sudokui.app/advent
```

English, longer:

```text
A little brain teaser for Advent

Fancy a small sudoku every day in the run-up to Christmas? sudokui.app has a sudoku advent calendar with a new door every day from 1 to 24 December. Door 1 is very easy, and each door is a little harder than the one before, so you don't need to have played before. If you get stuck, a hint shows you the next step. The calendar is free, with no ads and no sign-in, and works on a phone, tablet or computer. Missed a day? The doors stay open until 31 December.

Type sudokui.app/advent into your browser, or scan the QR code.
```

### 5. A workplace social channel

Link: the chat link, `https://sudokui.app/nb/julekalender/?utm_source=chat`
(English `https://sudokui.app/advent/?utm_source=chat`). Word: `chat`
(the same word as the family chat: post it on another day). Teams and
Slack opened in their desktop apps say nothing about where a link came
from; the tag counts them.

Keep it short and low-key. It is your own spare-time project, not the
company's: say so. Post only in a channel meant for social or off-topic
posts, follow the company's rules on personal projects, post it once,
and no reminders there.

Norsk, kort:

```text
Litt reklame for et fritidsprosjekt: Jeg har laget en sudoku-julekalender, med en ny sudoku hver dag frem til jul. Gratis og uten reklame. Hvis noen trenger noe til kaffepausen: https://sudokui.app/nb/julekalender/?utm_source=chat
```

Norsk, lengre:

```text
Et lite hobbyprosjekt fra fritiden: Jeg har laget sudokUI, en gratis sudoku-app som virker i nettleseren, og i desember har den en julekalender. Fra 1. til 24. desember åpner det en ny luke hver dag. Den første er veldig lett, og så blir de litt vanskeligere. Ingen reklame og ingen konto. Passer fint til kaffepausen, om noen har lyst: https://sudokui.app/nb/julekalender/?utm_source=chat
```

English, short:

```text
A bit of spare-time self-promotion: I've made a sudoku advent calendar, with a new puzzle every day until Christmas. Free and no ads. If anyone needs something for the coffee break: https://sudokui.app/advent/?utm_source=chat
```

English, longer:

```text
A small hobby project from my spare time: I've made sudokUI, a free sudoku app that works in the browser, and in December it has an advent calendar. From 1 to 24 December a new door opens every day. The first is very easy, and they get a little harder from there. No ads and no account. Good for a coffee break, if anyone fancies it: https://sudokui.app/advent/?utm_source=chat
```

### 6. A note to hand to a librarian or a senior centre, with the flyer

Hand it over with the poster or a few flyers (promo/print/). The flyer's
QR code is the link: word `poster`. Print the note, or write it by hand;
an e-mail works too, with the poster attached.

Norsk, kort (en lapp):

```text
Hei! Jeg har laget en gratis sudoku-julekalender på nett: en ny sudoku hver dag fra 1. til 24. desember, uten reklame og uten konto. Kan jeg få henge opp denne plakaten, eller legge igjen noen løpesedler? Tusen takk!
Hilsen [navn], [telefon eller e-post]
```

Norsk, lengre (et brev):

```text
Hei!

Jeg heter [navn] og har på fritiden laget sudokUI, en gratis sudoku-app som virker i nettleseren på mobil, nettbrett og PC. I desember har den en julekalender: en ny luke hver dag fra 1. til 24. desember, med en sudoku bak.

Luke 1 er veldig lett, og hver luke er litt vanskeligere enn den før, så den passer også for dem som aldri har løst en sudoku. Står man fast, viser et hint neste steg og forklarer hvorfor. Den er helt gratis, uten reklame og uten konto. Den som heller vil skrive enn å skanne, finner adressen på plakaten: sudokui.app/nb/julekalender

Kan jeg få henge opp den vedlagte plakaten på oppslagstavla, eller legge igjen noen løpesedler? Jeg tar den gjerne ned igjen i januar.

Vennlig hilsen
[navn]
[telefon eller e-post]
```

English, short (a note):

```text
Hello! I've made a free online sudoku advent calendar: a new sudoku every day from 1 to 24 December, with no ads and no account. Could I put up this poster, or leave a few flyers? Thank you!
[name], [phone or e-mail]
```

English, longer (a letter):

```text
Hello,

My name is [name], and in my spare time I've made sudokUI, a free sudoku app that works in the browser on a phone, tablet or computer. In December it has an advent calendar: a new door every day from 1 to 24 December, with a sudoku behind it.

Door 1 is very easy, and each door is a little harder than the one before, so it also suits people who have never solved a sudoku. If you get stuck, a hint shows the next step and explains why. It is completely free, with no ads and no account. Anyone who would rather type than scan will find the address on the poster: sudokui.app/advent

Could I put the enclosed poster up on your noticeboard, or leave a few flyers? I will gladly take it down again in January.

Kind regards,
[name]
[phone or e-mail]
```

### 7. Reminders: door 8 and door 15

A door's link opens that door's puzzle straight away, and its preview
shows the door's own picture. On Facebook use the plain door link (word
`facebook`); in a chat add the tag (word `chat`). These show on the
door's own row in the Christmas section, and under "A door's address".
They count only people whose browser does not hold the app yet (above).

Door 8, Tuesday 8 December. Norsk:

```text
Luke 8 i sudoku-julekalenderen er åpen! Gikk du glipp av noen? Alle lukene står åpne til 31. desember.
https://sudokui.app/nb/advent/2026/8
```

In a chat: `https://sudokui.app/nb/advent/2026/8?utm_source=chat`.

Door 8, English:

```text
Door 8 of the sudoku advent calendar is open! Missed a few? Every door stays open until 31 December.
https://sudokui.app/advent/2026/8
```

In a chat: `https://sudokui.app/advent/2026/8?utm_source=chat`.

Door 15, Tuesday 15 December. Norsk:

```text
Halvveis i desember: luke 15 i sudoku-julekalenderen er åpen. Snart blir det litt mer å bryne seg på: fra luke 19 er oppgavene på nivået Middels.
https://sudokui.app/nb/advent/2026/15
```

In a chat: `https://sudokui.app/nb/advent/2026/15?utm_source=chat`.

Door 15, English:

```text
Halfway through December: door 15 of the sudoku advent calendar is open. It gets a little more challenging soon: from door 19 the puzzles are Medium.
https://sudokui.app/advent/2026/15
```

In a chat: `https://sudokui.app/advent/2026/15?utm_source=chat`.

## After a week: what to read on /admin

On Tuesday 8 December the dashboard's "last 7 days" are 1 to 7 December,
the calendar's first week. Read, in this order:

1. **Toward 100 a day**, at the top: the games begun a day over the
   week, against the 35 a day of late November and against the owner's
   line, which wants about 47 a day for the week to 7 December (and
   about 53 for the week to 14 December). Copy the reading with its
   button into the Readings of docs/launch-log.md, with "Read for: the
   calendar's launch, day 7". Its landings now end with the calendar's
   page by word, `poster` among them.
2. **The Christmas section**: games begun and completed for doors 1 to
   7, and the completion rate. Fewer games each day after door 1 is
   normal; if door 2 already has half of door 1's, people try once and
   leave. Then "Where the calendar's landings came from": Facebook, A
   chat app or site, Paper, A mail app or webmail, No referrer. That is
   the posts against each other.
3. **Landings per day by word, last 28 days**: the 1 December row (your
   wall's `facebook`, the family chat's `chat`), the 2 December row (the
   group's `facebook`, work's `chat`), and the `poster` column from the
   days the posters went up.
4. **Games begun per day, by kind and language**: the Advent calendar
   column beside New and Daily. Are the calendar's games new games, or did the players
   who were already here move from New to the doors?

Judge the launch on day 14, Tuesday 15 December, as the launch log says:
the 7-day average of games begun against the 35 a day before, and against
the line. Landings that do not turn into games begun are not reach.

## Lines for the launch log

Add each line to "Actions" in docs/launch-log.md on the day you act,
with the link you really used:

| Date | Action | Link used | Landing word expected |
|---|---|---|---|
| 2026-11-30 | Posters and flyers up: [where] | QR on promo/print/ (`/nb/julekalender/?utm_source=poster`) | `poster` |
| 2026-12-01 | Facebook, own wall: the calendar | `https://sudokui.app/nb/julekalender/` | `facebook` |
| 2026-12-01 | Family chat: the calendar | `https://sudokui.app/nb/julekalender/?utm_source=chat` | `chat` |
| 2026-12-02 | Facebook group [kind of group], with the admin's yes | `https://sudokui.app/nb/julekalender/` | `facebook` |
| 2026-12-02 | Workplace social channel | `https://sudokui.app/nb/julekalender/?utm_source=chat` | `chat` |
| [date] | Church newsletter | flyer's QR, or the written address | `poster`, `none` (`mail` by e-mail) |
| 2026-12-08 | Reminder, door 8 | `https://sudokui.app/nb/advent/2026/8` | `facebook` (door 8's row) |
| 2026-12-15 | Reminder, door 15 | `https://sudokui.app/nb/advent/2026/15` | `facebook` (door 15's row) |
