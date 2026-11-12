// The privacy page, /privacy/ (and /nb/privacy/, /es/privacy/): what leaves
// the device, exactly, in the three languages (docs/online-goals.md,
// phase 3). Every sentence describes what the code does: the live lines
// src/state/telemetry.ts sends by default, what the Settings switch adds,
// the daily's times (src/state/dailyStats.ts), the share links
// (src/content/share.ts), the landing count (worker/telemetry.ts), the
// reports (src/ui/report.ts, worker/feedback.ts) and the name the tab that
// plays keeps for itself (src/state/play.ts).
// When one of those changes, change this page.
//
// src/content/learnPages.ts builds the page from this copy, like the
// landing pages, with the site's header and footer; the app's footer and
// the Settings dialog link to it. tests/telemetry.test.ts holds the three
// versions to the same structure and the Norwegian and Spanish to their
// own words.
import type { Lang } from '../state/settings';
import { PRIVACY_URL } from './staticRoutes';

export { PRIVACY_URL };

export interface PrivacyCopy {
  /** the footer's word for the page */
  name: string;
  /** the tab and a search result's headline, with the brand */
  title: string;
  description: string;
  h1: string;
  lead: string;
  sections: { heading: string; paragraphs: string[] }[];
  /** the closing line */
  updated: string;
}

/** {source} in a paragraph is the link to the repository */
export const PRIVACY: Record<Lang, PrivacyCopy> = {
  en: {
    name: 'Privacy',
    title: 'Privacy: what sudokUI sends',
    description:
      'What sudokUI sends: two anonymous lines per game and one per share, while online; never your IP address, no account, no cookies. And what only you switch on.',
    h1: 'What sudokUI sends, and what it keeps',
    lead:
      'sudokUI runs on your device. It has no account, no cookie banner and no advertising, and by default it sends nothing about you. This page lists everything that leaves the device, exactly.',
    sections: [
      {
        heading: 'By default: two lines per game, while online',
        paragraphs: [
          'When you make the first move of a game and when it is solved, the app sends one short line to sudokui.app: which of the two it was, what kind of game it is (the daily puzzle, a new puzzle, a practice puzzle, or one opened from a link someone shared), the language the app is set to, the puzzle’s difficulty level, the solve time rounded down to a 15-second step (two hours and up count as one step), whether the app runs installed or in a browser tab, and the app’s version. The server adds the country the connection came from, as Cloudflare reports it, and keeps the counts for three months in Cloudflare’s Workers Analytics Engine.',
          'That is all. The line carries no name, no account, no cookie, no device ID and no IP address: the server reads the address only to refuse floods, in memory, and the user agent your browser sends (its name and system, sometimes the device model) only to leave out robots: search engines, link previews, headless browsers and test tools. It writes down neither. One game cannot be linked to another. Nothing is stored on your device for this. Offline, nothing is sent and nothing is kept.',
          'A game you open but never play sends nothing. Anything you put on the board is a first move: a digit, a mark, a colour, or candidates shown. A practice puzzle may open part-way through, with digits and candidates the app put there; it counts at your own first move on it. A position someone shares with you, or a grid you paste, that opens with any of these on it counts as begun when it opens. Restarting the puzzle you are playing before you have solved it, or choosing it again while it is still on the board, does not count as a new game; playing a puzzle again after solving it does, even if you undid the last digit.'
        ]
      },
      {
        heading: 'If you ask: counting your offline plays too',
        paragraphs: [
          'Settings has a switch, “Help count plays, including offline ones”. It is off until you turn it on. On, the app keeps the same lines on your device while you are offline and sends them, marked as sent late, the next time it is open online. It also remembers the day it first counted a game with the switch on, so a line can say whether this device had played on an earlier day. Both are deleted the moment you turn the switch off.',
          'Still no identifier: the lines are the ones above, plus “sent late”, “counting on” and “played before”. They let the counts estimate how much is played offline without following anyone.'
        ]
      },
      {
        heading: 'If you ask: leaving this device out of the counts',
        paragraphs: [
          'Settings also has “Leave this device out of the counts”. On, the app sends none of these lines from this device, nor the line for a link or a picture you share (below), online or offline, and deletes anything the other switch had kept. The setting itself is remembered on your device, like your other settings, because you asked for it. It holds in every ordinary window of the browser you turn it on in, not in a private one; an app added to a home screen may keep its own settings, so turn it on there too. Two things it does not change: a share or daily link, or the home page, opened from outside sudokui.app in a browser or app where the switch is not on can still count as a landing, because the server counts it from the request and cannot see any switch; and daily times are still sent when you tap the button, or by themselves once you have switched that on (below).'
        ]
      },
      {
        heading: 'The daily puzzle’s times',
        paragraphs: [
          'After an unassisted solve of the daily, the win screen offers “Send my time and compare”. Only if you tap it, or have switched on sending your times automatically (below), the app sends your time, the finished grid, that you solved it without help, and a random token it keeps for that day, so the same time is not counted twice. Until the server has taken it, the time waits on your device with the token: if the app cannot send it or hear the answer, because you are offline, the server is busy, or the app was closed or went on in another of its tabs first, it sends the same again, with the same token, the next time it is open online, and the server counts it once. The server keeps the time in its 15-second step with the day’s other times, and with it the token and the day it arrived. Nothing links one day’s token to another day’s. To show how many have solved the day’s puzzle, the win screen also asks the server for the day’s numbers, and so does the Share dialog when it offers your daily result again; that request carries nothing about you.',
          'Once you have sent a time, the win screen offers a switch, “Send my daily times automatically”, and Settings has the same switch. It is off until you turn it on. On, the app sends exactly what the button sends, by itself, after each later unassisted solve of a daily, and shows where your time stands at once; never an assisted solve. Off again, a time goes only when you tap the button. The switch is remembered on your device, like your other settings. Your own daily solves, their time and whether you had help, are kept on your device too, at most 31 days of them, so that their share line can be sent again after the win screen has closed; they leave the device only in the ways this page describes. A daily you solve again keeps your first solve as its result, and no other time of yours goes in for it, unless the first had help and the new one did not. If that first time was never sent, the new solve’s win screen offers to send it, and with the switch on it goes by itself after an unassisted solve.'
        ]
      },
      {
        heading: 'Share links and pictures, and visits from other sites',
        paragraphs: [
          'A link you share carries the puzzle, its level and HoDoKu rating, up to three technique names and, if you choose to challenge someone, your time in seconds.',
          'When a link or a picture of the board goes from the app to someone, because it went through your device’s share menu, was copied or, for a picture, was saved as a file, the app sends one more line while online: that something was shared, which kind (a puzzle, a position, a challenge after a solve, the daily puzzle’s line, or a picture of the board: one kind, whether or not a hint is drawn on it, and the line does not say which), whether it went through the share menu, was copied or was saved, the puzzle’s level, whether the app runs installed or in a browser tab, and the app’s version. Not the link, not the text, not the picture, not where it went or to whom. The picture is made on your device and is never sent to sudokui.app; whether it shows the candidates or your pencil marks, your colours and the line under it naming sudokui.app is remembered on your device for the next picture, and nowhere else. Copying the puzzle string, or the position as text (the pencil-mark grid), sends nothing. As with the lines above, the server adds the country and keeps the count for three months, reads the address only to refuse floods and the user agent only to leave out robots, and writes down neither. Nothing is kept on your device for the line: offline, or with this device left out of the counts, nothing is sent.',
          'When someone opens a shared link, a daily puzzle’s link or the home page, in any of its three languages, from outside sudokui.app, the server counts one landing, with which of these it was, the puzzle’s level where there is one, the country and one word for where it was opened from. The word comes from what the browser reports about where the link was opened from: for another site, usually just that site’s address; on Android, sometimes the name of the app. When the browser reports nothing, the server reads one tag in the link itself, utm_source, which some AI assistants add to the links they give (ChatGPT’s is utm_source=chatgpt.com): if it is the address of ChatGPT, Perplexity, Claude, Gemini or Copilot, the word is “an AI assistant”. Nothing else in the link is read for this word, and the tag is not kept. The word is one of these: none (a link typed or bookmarked, or opened from an app that reports nothing, as most do), a search engine, an AI assistant, Reddit, the Enjoy Sudoku forum, Hacker News, Facebook, Discord, Lemmy or Mastodon, another social site or app, a chat app or site, a mail app or webmail, GitHub, another sudoku site, an app directory such as AlternativeTo, a news site, or another site or app. The address itself is not kept. No landing is counted when the browser already holds sudokUI and opens the link or the page itself, and who opened it is not recorded.'
        ]
      },
      {
        heading: 'If you write: reports and letters',
        paragraphs: [
          '“Send feedback”, in the footer and in Info, and “Looks wrong?”, under a hint, open a form. Only when you press Send does the app send what you wrote, the kind of report, the app’s version and language, how long the form was open (which the server uses only to tell people from robots, and does not pass on) and, if you give one, your e-mail address for an answer. A hint report also carries the hint: its technique, its line of notation, the uniqueness and marks settings it was found under, and whether the app found it agrees with the solution. While “Include the board” is ticked, the report carries the board as it stands, as a position link; only if you tick “Include my browser’s details” does it carry your browser’s user agent (its name and system, sometimes the device model).',
          'The server checks the report and passes it on as an e-mail to Anders Imenes, who runs sudokUI; it keeps no copy itself. The IP address the report came from is read only to refuse floods, in memory, as above. Letters to feedback@sudokui.app reach the same inbox. Cloudflare carries the mail through its Email Routing and keeps a log of each letter it handles, with its sender, recipient and subject, for 31 days; that log clears itself, and deleting cannot reach it sooner. Cloudflare, Inc. is in the United States, and the mail passes through it under its data processing terms (the EU–US Data Privacy Framework and the EU’s standard contractual clauses). The inbox itself is with an ordinary mail provider. A report or a letter is kept there until it has been dealt with, at most 12 months, and then deleted, together with any answer to it.',
          'Anders Imenes, in Norway, is responsible for this (the data controller). A report is handled on the basis of your consent, given by sending it, to fix what it describes or to answer you; you can withdraw it at any time, and what you sent is then deleted. You can ask for a copy of what you sent, also in a machine-readable form, to have it corrected or deleted, or its handling restricted, by writing to feedback@sudokui.app, and you can complain to Datatilsynet, the Norwegian Data Protection Authority.'
        ]
      },
      {
        heading: 'What is never collected',
        paragraphs: [
          'No account, no password, no cookie, no fingerprint, no advertising, no third-party script, and no e-mail address unless you give one in a report or write to feedback@sudokui.app. Your games, pencil marks, statistics, technique record and daily streak stay in your browser’s storage, on your device, and leave it only in the ways this page describes. With the app open in more than one tab or window, one of them plays at a time and the others write nothing: the one that plays keeps a random name for itself in the same storage, so a tab that wakes up after the browser paused it can tell at once that it no longer plays. That name is never sent, and the tabs pass the play to each other inside the browser alone. In each tab’s own history the app also notes whether it has started on that page and, when it reloads itself, why; the browser keeps these notes with the tab’s history, they say nothing about you, and they are never sent.'
        ]
      },
      {
        heading: 'Who runs this, and how to check',
        paragraphs: [
          'sudokUI is run from Norway by its author, Anders Imenes, and served by Cloudflare. The source code, including everything this page describes, is public: {source}. Questions and corrections are welcome at feedback@sudokui.app, or as an issue there.'
        ]
      }
    ],
    updated: 'Last changed: November 2026.'
  },
  nb: {
    name: 'Personvern',
    title: 'Personvern: hva sudokUI sender',
    description:
      'Hva sudokUI sender: to anonyme linjer per spill, én per deling, bare på nett; aldri IP-adressen, ingen konto eller informasjonskapsler. Og hva bare du slår på.',
    h1: 'Hva sudokUI sender, og hva appen beholder',
    lead:
      'sudokUI kjører på enheten din. Appen har ingen konto, ingen samtykkeboks og ingen reklame, og som standard sender den ingenting om deg. Denne siden lister opp alt som forlater enheten, nøyaktig.',
    sections: [
      {
        heading: 'Som standard: to linjer per spill, når du er på nett',
        paragraphs: [
          'Når du gjør det første trekket i et spill og når det er løst, sender appen én kort linje til sudokui.app: hvilken av de to det var, hva slags spill det er (dagens sudoku, en ny oppgave, en øvingsoppgave eller en som ble åpnet fra en lenke noen delte), språket appen er satt til, oppgavens vanskelighetsgrad, løsetiden rundet ned til nærmeste 15 sekunder (to timer og mer teller som ett trinn), om appen kjører installert eller i en nettleserfane, og appens versjon. Tjeneren legger til landet tilkoblingen kom fra, slik Cloudflare oppgir det, og beholder tallene i tre måneder i Cloudflares Workers Analytics Engine.',
          'Det er alt. Linjen inneholder ingen navn, ingen konto, ingen informasjonskapsel, ingen enhets-ID og ingen IP-adresse: tjeneren leser adressen bare for å avvise flommer, i minnet, og brukeragenten nettleseren din sender (navnet og systemet, noen ganger enhetsmodellen) bare for å holde roboter utenfor: søkemotorer, lenkeforhåndsvisninger, hodeløse nettlesere og testverktøy. Ingen av delene skrives ned. Ett spill kan ikke knyttes til et annet. Ingenting lagres på enheten din for dette. Uten nett sendes ingenting, og ingenting beholdes.',
          'Et spill du åpner men aldri spiller, sender ingenting. Alt du setter på brettet, er et første trekk: et tall, et notat, en farge eller kandidater som vises. En øvingsoppgave kan åpnes et stykke ut i løsningen, med tall og kandidater appen har satt inn; den telles først når du gjør ditt eget første trekk i den. En stilling noen deler med deg, eller et brett du limer inn, som åpnes med noe av dette, teller som påbegynt når det åpnes. Å starte oppgaven du holder på med på nytt før du har løst den, eller velge den igjen mens den fortsatt står på brettet, teller ikke som et nytt spill; å spille en oppgave på nytt etter at du har løst den, gjør det, også om du angret det siste tallet.'
        ]
      },
      {
        heading: 'Hvis du ber om det: telle spillene dine uten nett også',
        paragraphs: [
          'I innstillingene finnes bryteren «Hjelp til å telle spill, også uten nett». Den er av til du slår den på. Når den er på, beholder appen de samme linjene på enheten din mens du er uten nett, og sender dem, merket som sendt sent, neste gang den er åpen på nett. Den husker også dagen den første gang telte et spill med bryteren på, slik at en linje kan si om denne enheten hadde spilt en tidligere dag. Begge deler slettes i det øyeblikket du slår bryteren av.',
          'Fortsatt ingen identifikator: linjene er de samme som over, pluss «sendt sent», «telling på» og «spilt før». De lar tallene anslå hvor mye som spilles uten nett, uten å følge noen.'
        ]
      },
      {
        heading: 'Hvis du ber om det: holde denne enheten utenfor tellingen',
        paragraphs: [
          'I innstillingene finnes også «Hold denne enheten utenfor tellingen». Når den er på, sender appen ingen av disse linjene fra denne enheten, heller ikke linjen for en lenke eller et bilde du deler (se under), verken på nett eller uten, og sletter det den andre bryteren hadde beholdt. Selve innstillingen huskes på enheten din, som de andre innstillingene, fordi du har bedt om det. Den gjelder i alle vanlige vinduer i nettleseren du slår den på i, men ikke i private vinduer; en app lagt til på en hjemskjerm kan ha egne innstillinger, så slå den på der også. To ting endrer den ikke: en delingslenke, en lenke til dagens sudoku eller forsiden som åpnes fra utsiden av sudokui.app i en nettleser eller app der bryteren ikke er på, kan fortsatt telles som en landing, fordi tjeneren teller den ut fra forespørselen og ikke kan se noen bryter; og tidene på dagens sudoku sendes fortsatt når du trykker på knappen, eller av seg selv når du har slått det på (se under).'
        ]
      },
      {
        heading: 'Tidene på dagens sudoku',
        paragraphs: [
          'Etter en løsning av dagens sudoku uten hjelp tilbyr seiersskjermen «Send inn tiden min og sammenlign». Bare hvis du trykker på den, eller har slått på at tidene sendes automatisk (se under), sender appen tiden din, det ferdige brettet, at du løste den uten hjelp, og et tilfeldig merke appen beholder for den dagen, slik at samme tid ikke telles to ganger. Til tjeneren har tatt imot tiden, venter den på enheten din sammen med merket: får ikke appen sendt den eller hørt svaret, fordi du er uten nett, tjeneren har det travelt, eller appen ble lukket eller gikk videre i en annen av fanene sine først, sender den det samme igjen, med det samme merket, neste gang den er åpen på nett, og tjeneren teller den én gang. Tjeneren beholder tiden i trinnet på 15 sekunder den faller i, sammen med dagens andre tider, og med den merket og dagen den kom inn. Ingenting knytter én dags merke til en annen dags. For å vise hvor mange som har løst dagens oppgave, spør seiersskjermen også tjeneren om dagens tall, og det samme gjør delingsvinduet når det tilbyr resultatet ditt på dagens oppgave igjen; den forespørselen inneholder ingenting om deg.',
          'Når du har sendt inn en tid, tilbyr seiersskjermen en bryter, «Send inn tiden min på dagens oppgave automatisk», og den samme bryteren finnes i innstillingene. Den er av til du slår den på. Når den er på, sender appen nøyaktig det knappen sender, av seg selv, etter hver senere løsning av dagens oppgave uten hjelp, og viser med en gang hvor tiden din står; aldri en løsning der du har fått hjelp. Slår du den av igjen, sendes en tid bare når du trykker på knappen. Bryteren huskes på enheten din, som de andre innstillingene. Dine egne løsninger av dagens oppgave, tiden og om du fikk hjelp, beholdes også på enheten, høyst 31 dager av dem, slik at linjen for å dele dem kan sendes igjen etter at seiersskjermen er lukket; de forlater enheten bare på måtene denne siden beskriver. Løser du dagens oppgave på nytt, står den første løsningen din som resultatet, og ingen annen tid fra deg sendes inn for den, med mindre du fikk hjelp første gang og ikke denne gangen. Ble den første tiden aldri sendt, tilbyr seiersskjermen for den nye løsningen å sende den, og med bryteren på sendes den av seg selv etter en løsning uten hjelp.'
        ]
      },
      {
        heading: 'Delingslenker og bilder, og besøk fra andre nettsteder',
        paragraphs: [
          'En lenke du deler, bærer oppgaven, dens vanskelighetsgrad og poengsum, opptil tre teknikknavn og, hvis du velger å utfordre noen, tiden din i sekunder.',
          'Når en lenke eller et bilde av brettet går fra appen til noen, fordi det ble delt via delingsmenyen på enheten din, kopiert eller, for et bilde, lagret som en fil, sender appen én linje til mens du er på nett: at noe ble delt, hva slags (en oppgave, en stilling, en utfordring etter en løsning, linjen til dagens sudoku eller et bilde av brettet: én type, enten det er tegnet inn et hint eller ikke, og linjen sier ikke hvilken av delene), om det gikk via delingsmenyen, ble kopiert eller ble lagret, oppgavens vanskelighetsgrad, om appen kjører installert eller i en nettleserfane, og appens versjon. Ikke lenken, ikke teksten, ikke bildet, ikke hvor det gikk eller til hvem. Bildet lages på enheten din og sendes aldri til sudokui.app; om det viser kandidatene eller notatene dine, fargene dine og linjen under som nevner sudokui.app, huskes på enheten din til neste bilde, og ingen andre steder. Å kopiere tegnstrengen, eller stillingen som tekst (rutenettet med kandidater), sender ingenting. Som for linjene over legger tjeneren til landet og beholder tallet i tre måneder, leser adressen bare for å avvise flommer og brukeragenten bare for å holde roboter utenfor, og skriver ned ingen av delene. Ingenting lagres på enheten din for linjen: uten nett, eller når denne enheten holdes utenfor tellingen, sendes ingenting.',
          'Når noen åpner en delt lenke, en lenke til dagens sudoku eller forsiden, på et hvilket som helst av de tre språkene, fra utsiden av sudokui.app, teller tjeneren én landing, med hvilken av disse det var, oppgavens vanskelighetsgrad der det finnes en, landet og ett ord for hvor den ble åpnet fra. Ordet kommer fra det nettleseren oppgir om hvor lenken ble åpnet fra: for et annet nettsted vanligvis bare adressen til det nettstedet, på Android noen ganger navnet på appen. Når nettleseren ikke oppgir noe, leser tjeneren én merkelapp i selve lenken, utm_source, som noen KI-assistenter legger til lenkene de gir (ChatGPTs er utm_source=chatgpt.com): er den adressen til ChatGPT, Perplexity, Claude, Gemini eller Copilot, blir ordet «en KI-assistent». Ingenting annet i lenken leses for dette ordet, og merkelappen beholdes ikke. Ordet er ett av disse: ingen (en lenke som er skrevet inn eller lagret som bokmerke, eller åpnet fra en app som ikke oppgir noe, slik de fleste gjør), en søkemotor, en KI-assistent, Reddit, Enjoy Sudoku-forumet, Hacker News, Facebook, Discord, Lemmy eller Mastodon, et annet sosialt nettsted eller en annen sosial app, en chatapp eller et chatnettsted, en e-postapp eller e-post på nettet, GitHub, et annet sudokunettsted, en appkatalog som AlternativeTo, et nyhetsnettsted, eller et annet nettsted eller en annen app. Selve adressen beholdes ikke. Ingen landing telles når nettleseren allerede har sudokUI lagret og åpner lenken eller siden selv, og hvem som åpnet den, registreres ikke.'
        ]
      },
      {
        heading: 'Hvis du skriver: meldinger og e-post',
        paragraphs: [
          '«Send tilbakemelding», i bunnteksten og under Info, og «Ser det feil ut?», under et hint, åpner et skjema. Bare når du trykker på Send, sender appen det du skrev, hva slags melding det er, appens versjon og språk, hvor lenge skjemaet var åpent (som tjeneren bare bruker til å skille mennesker fra roboter, og ikke sender videre) og, hvis du oppgir en, e-postadressen din for å få svar. En melding om et hint har også med hintet: teknikken, linjen med notasjon, innstillingene for entydighet og notater det ble funnet med, og om appen fant at det stemmer med løsningen. Så lenge «Ta med brettet» er krysset av, har meldingen med brettet slik det står, som en stillingslenke; bare hvis du krysser av for «Ta med detaljer om nettleseren min», har den med brukeragenten til nettleseren din (navnet og systemet, noen ganger enhetsmodellen).',
          'Tjeneren sjekker meldingen og sender den videre som en e-post til Anders Imenes, som driver sudokUI; selv beholder den ingen kopi. IP-adressen meldingen kom fra, leses bare for å avvise flommer, i minnet, som over. Brev til feedback@sudokui.app kommer til den samme innboksen. Cloudflare frakter e-posten gjennom Email Routing og fører en logg over hvert brev selskapet håndterer, med avsender, mottaker og emne, i 31 dager; loggen tømmer seg selv, og sletting kan ikke nå den før. Cloudflare, Inc. holder til i USA, og e-posten går gjennom selskapet etter databehandlingsvilkårene deres (EU–USA-rammeverket for personvern og EUs standardkontraktsbestemmelser). Selve innboksen ligger hos en vanlig e-postleverandør. En melding eller et brev beholdes der til saken er behandlet, høyst i 12 måneder, og slettes så, sammen med et eventuelt svar.',
          'Anders Imenes, i Norge, er ansvarlig for dette (behandlingsansvarlig). En melding behandles på grunnlag av samtykket ditt, som du gir ved å sende den, for å rette det den beskriver eller svare deg; du kan trekke det tilbake når som helst, og det du sendte, slettes da. Du kan be om en kopi av det du sendte, også i et maskinlesbart format, om å få det rettet eller slettet, eller om at behandlingen begrenses, ved å skrive til feedback@sudokui.app, og du kan klage til Datatilsynet.'
        ]
      },
      {
        heading: 'Hva som aldri samles inn',
        paragraphs: [
          'Ingen konto, ingen passord, ingen informasjonskapsel, ingen digitale fingeravtrykk, ingen reklame, ingen skript fra tredjeparter, og ingen e-postadresse med mindre du oppgir en i en melding eller skriver til feedback@sudokui.app. Spillene dine, notatene, statistikken, teknikkoversikten og rekken på dagens sudoku blir i nettleserens lagring, på enheten din, og forlater den bare på måtene denne siden beskriver. Er appen åpen i flere faner eller vinduer, spiller én av dem om gangen, og de andre skriver ingenting: den som spiller, beholder et tilfeldig navn på seg selv i den samme lagringen, slik at en fane som våkner etter at nettleseren satte den på pause, straks ser at den ikke lenger spiller. Navnet sendes aldri, og fanene gir turen videre til hverandre bare inne i nettleseren. I hver fanes egen historikk noterer appen også om den har startet på den siden, og hvorfor, når den laster seg inn på nytt; nettleseren beholder disse notatene sammen med fanens historikk, de sier ingenting om deg, og de sendes aldri.'
        ]
      },
      {
        heading: 'Hvem som driver dette, og hvordan du kan sjekke det',
        paragraphs: [
          'sudokUI drives fra Norge av forfatteren, Anders Imenes, og leveres av Cloudflare. Kildekoden, inkludert alt denne siden beskriver, er åpen: {source}. Spørsmål og rettelser er velkomne på feedback@sudokui.app, eller som en sak der.'
        ]
      }
    ],
    updated: 'Sist endret: november 2026.'
  },
  es: {
    name: 'Privacidad',
    title: 'Privacidad: qué envía sudokUI',
    description:
      'Qué envía sudokUI: dos líneas anónimas por partida y una por enlace o imagen compartidos, solo en línea; nunca tu IP, sin cuenta ni cookies. Y qué activas tú.',
    h1: 'Qué envía sudokUI y qué conserva',
    lead:
      'sudokUI funciona en tu dispositivo. No tiene cuenta, ni aviso de cookies, ni publicidad, y por defecto no envía nada sobre ti. Esta página enumera todo lo que sale del dispositivo, exactamente.',
    sections: [
      {
        heading: 'Por defecto: dos líneas por partida, mientras estás en línea',
        paragraphs: [
          'Cuando haces el primer movimiento de una partida y cuando se resuelve, la app envía una línea corta a sudokui.app: cuál de las dos fue, qué tipo de partida es (el sudoku del día, un sudoku nuevo, un sudoku de práctica o uno abierto desde un enlace que alguien compartió), el idioma en que está la app, el nivel de dificultad del sudoku, el tiempo de resolución redondeado hacia abajo a tramos de 15 segundos (dos horas o más cuentan como un solo tramo), si la app funciona instalada o en una pestaña del navegador, y la versión de la app. El servidor añade el país desde el que llegó la conexión, tal como lo indica Cloudflare, y conserva los recuentos durante tres meses en Workers Analytics Engine de Cloudflare.',
          'Eso es todo. La línea no lleva nombre, ni cuenta, ni cookie, ni identificador del dispositivo, ni dirección IP: el servidor lee la dirección solo para rechazar avalanchas, en memoria, y el agente de usuario que envía tu navegador (su nombre y su sistema, a veces el modelo del dispositivo) solo para dejar fuera a los robots: buscadores, vistas previas de enlaces, navegadores sin interfaz y herramientas de prueba. No anota ninguno de los dos. Una partida no puede vincularse con otra. No se guarda nada en tu dispositivo para esto. Sin conexión, no se envía nada y no se conserva nada.',
          'Una partida que abres pero no juegas no envía nada. Todo lo que pones en el tablero es un primer movimiento: un número, una anotación, un color o los candidatos a la vista. Un sudoku de práctica puede abrirse ya avanzado, con números y candidatos que puso la app; cuenta desde tu propio primer movimiento en él. Una posición que alguien comparte contigo, o un tablero que pegas, que se abre con algo de esto cuenta como empezada al abrirse. Reiniciar el sudoku que estás jugando antes de resolverlo, o volver a elegirlo mientras sigue en el tablero, no cuenta como una partida nueva; volver a jugarlo después de resolverlo sí, aunque hayas deshecho el último número.'
        ]
      },
      {
        heading: 'Si lo pides: contar también tus partidas sin conexión',
        paragraphs: [
          'En Ajustes hay un interruptor, «Ayudar a contar partidas, también sin conexión». Está apagado hasta que lo enciendes. Encendido, la app conserva las mismas líneas en tu dispositivo mientras estás sin conexión y las envía, marcadas como enviadas tarde, la próxima vez que esté abierta en línea. También recuerda el día en que contó por primera vez una partida con el interruptor encendido, para que una línea pueda decir si este dispositivo ya había jugado otro día. Ambas cosas se borran en el momento en que apagas el interruptor.',
          'Sigue sin haber identificador: las líneas son las mismas de arriba, más «enviada tarde», «recuento activado» y «ya había jugado». Permiten que los recuentos estimen cuánto se juega sin conexión sin seguir a nadie.'
        ]
      },
      {
        heading: 'Si lo pides: dejar este dispositivo fuera del recuento',
        paragraphs: [
          'En Ajustes también está «Dejar este dispositivo fuera del recuento». Encendido, la app no envía ninguna de estas líneas desde este dispositivo, ni la de un enlace o una imagen que compartes (más abajo), con o sin conexión, y borra lo que hubiera conservado el otro interruptor. El ajuste en sí se recuerda en tu dispositivo, como tus demás ajustes, porque lo has pedido. Vale en todas las ventanas normales del navegador en el que lo enciendes, no en las privadas; una app añadida a la pantalla de inicio puede tener sus propios ajustes, así que enciéndelo también allí. Hay dos cosas que no cambia: un enlace compartido, el del sudoku del día o la página de inicio, abiertos desde fuera de sudokui.app en un navegador o una app donde el interruptor no está encendido, pueden seguir contando como una llegada, porque el servidor la cuenta a partir de la petición y no puede ver ningún interruptor; y los tiempos del sudoku del día se siguen enviando cuando pulsas el botón, o por sí solos si lo has activado (más abajo).'
        ]
      },
      {
        heading: 'Los tiempos del sudoku del día',
        paragraphs: [
          'Tras resolver el sudoku del día sin ayuda, la pantalla de victoria ofrece «Enviar mi tiempo y comparar». Solo si lo pulsas, o si has activado el envío automático de tus tiempos (más abajo), la app envía tu tiempo, el tablero terminado, que lo resolviste sin ayuda y una ficha aleatoria que conserva para ese día, para que el mismo tiempo no se cuente dos veces. Hasta que el servidor lo recibe, el tiempo espera en tu dispositivo junto con la ficha: si la app no puede enviarlo u oír la respuesta, porque estás sin conexión, el servidor está ocupado, o la app se cerró o siguió en otra de sus pestañas antes, vuelve a enviar lo mismo, con la misma ficha, la próxima vez que esté abierta con conexión, y el servidor lo cuenta una vez. El servidor guarda el tiempo en su tramo de 15 segundos junto con los demás tiempos del día, y con él la ficha y el día en que llegó. Nada vincula la ficha de un día con la de otro. Para mostrar cuántos han resuelto el sudoku del día, la pantalla de victoria también pide al servidor las cifras del día, igual que la ventana de compartir cuando vuelve a ofrecer tu resultado del sudoku del día; esa petición no lleva nada sobre ti.',
          'Cuando ya has enviado un tiempo, la pantalla de victoria ofrece un interruptor, «Enviar mis tiempos del sudoku del día automáticamente», y Ajustes tiene el mismo. Está apagado hasta que lo enciendes. Encendido, la app envía por sí sola exactamente lo que envía el botón, tras cada sudoku del día que resuelvas después sin ayuda, y muestra al momento cómo queda tu tiempo; nunca una partida en la que hayas usado ayuda. Si vuelves a apagarlo, un tiempo solo se envía cuando pulsas el botón. El interruptor se recuerda en tu dispositivo, como tus demás ajustes. Tus propias partidas del sudoku del día, su tiempo y si tuviste ayuda, también se guardan en tu dispositivo, como mucho las de 31 días, para que su línea para compartir pueda enviarse de nuevo después de cerrar la pantalla de victoria; solo salen del dispositivo de las maneras que describe esta página. Si vuelves a resolver un sudoku del día, tu primera partida sigue siendo su resultado y no se envía ningún otro tiempo tuyo para él, salvo que en la primera tuvieras ayuda y en la nueva no. Si ese primer tiempo nunca se envió, la pantalla de victoria de la nueva partida ofrece enviarlo, y con el interruptor encendido se envía solo tras una partida sin ayuda.'
        ]
      },
      {
        heading: 'Enlaces e imágenes para compartir, y visitas desde otros sitios',
        paragraphs: [
          'Un enlace que compartes lleva el sudoku, su nivel y su puntuación, hasta tres nombres de técnicas y, si decides retar a alguien, tu tiempo en segundos.',
          'Cuando un enlace o una imagen del tablero sale de la app hacia alguien, porque pasó por el menú de compartir de tu dispositivo, se copió o, si es una imagen, se guardó como archivo, la app envía una línea más mientras estás en línea: que se compartió algo, de qué tipo (un sudoku, una posición, un reto tras resolver, la línea del sudoku del día o una imagen del tablero: un solo tipo, tenga o no una pista dibujada, y la línea no dice si la tiene), si pasó por el menú de compartir, se copió o se guardó, el nivel del sudoku, si la app funciona instalada o en una pestaña del navegador, y la versión de la app. Ni el enlace, ni el texto, ni la imagen, ni adónde fue ni a quién. La imagen se crea en tu dispositivo y nunca se envía a sudokui.app; si muestra los candidatos o tus anotaciones, tus colores y la línea de debajo que nombra sudokui.app se recuerda en tu dispositivo para la próxima imagen, y en ningún otro sitio. Copiar el sudoku en texto, o la posición en texto (la cuadrícula de candidatos), no envía nada. Como con las líneas de arriba, el servidor añade el país y conserva el recuento durante tres meses, lee la dirección solo para rechazar avalanchas y el agente de usuario solo para dejar fuera a los robots, y no anota ninguno de los dos. No se guarda nada en tu dispositivo para esa línea: sin conexión, o con este dispositivo fuera del recuento, no se envía nada.',
          'Cuando alguien abre un enlace compartido, el enlace de un sudoku del día o la página de inicio, en cualquiera de sus tres idiomas, desde fuera de sudokui.app, el servidor cuenta una llegada, con cuál de ellos fue, el nivel del sudoku si lo hay, el país y una palabra que dice desde dónde se abrió. La palabra sale de lo que el navegador indica sobre el lugar desde el que se abrió el enlace: si es otro sitio, normalmente solo la dirección de ese sitio; en Android, a veces el nombre de la app. Si el navegador no indica nada, el servidor lee una sola etiqueta del propio enlace, utm_source, que algunos asistentes de IA añaden a los enlaces que dan (la de ChatGPT es utm_source=chatgpt.com): si es la dirección de ChatGPT, Perplexity, Claude, Gemini o Copilot, la palabra es «un asistente de IA». No se lee nada más del enlace para esta palabra, y la etiqueta no se guarda. La palabra es una de estas: ninguna (un enlace escrito o guardado en marcadores, o abierto desde una app que no indica nada, como la mayoría), un buscador, un asistente de IA, Reddit, el foro Enjoy Sudoku, Hacker News, Facebook, Discord, Lemmy o Mastodon, otra red social (web o app), una app o web de chat, una app de correo o un correo web, GitHub, otro sitio de sudoku, un directorio de apps como AlternativeTo, un sitio de noticias, u otro sitio u otra app. La dirección en sí no se guarda. No se cuenta ninguna llegada cuando el navegador ya tiene sudokUI guardado y abre el enlace o la página por sí mismo, y quién lo abrió no se registra.'
        ]
      },
      {
        heading: 'Si escribes: mensajes y correos',
        paragraphs: [
          '«Enviar comentarios», en el pie de página y en Info, y «¿Parece incorrecta?», bajo una pista, abren un formulario. Solo cuando pulsas Enviar, la app envía lo que escribiste, el tipo de mensaje, la versión y el idioma de la app, cuánto tiempo estuvo abierto el formulario (que el servidor usa solo para distinguir personas de robots, y no reenvía) y, si la das, tu dirección de correo para responderte. Un mensaje sobre una pista lleva también la pista: su técnica, su línea de notación, los ajustes de unicidad y de anotaciones con los que se encontró, y si la app comprobó que concuerda con la solución. Mientras «Incluir el tablero» esté marcado, el mensaje lleva el tablero tal como está, como enlace a la posición; solo si marcas «Incluir los datos de mi navegador» lleva el agente de usuario de tu navegador (su nombre y su sistema, a veces el modelo del dispositivo).',
          'El servidor comprueba el mensaje y lo reenvía como correo electrónico a Anders Imenes, que lleva sudokUI; el servidor no guarda ninguna copia. La dirección IP desde la que llegó el mensaje se lee solo para rechazar avalanchas, en memoria, como arriba. Los correos a feedback@sudokui.app llegan al mismo buzón. Cloudflare transporta el correo mediante su Email Routing y guarda un registro de cada correo que gestiona, con su remitente, destinatario y asunto, durante 31 días; ese registro se borra solo, y borrar no puede alcanzarlo antes. Cloudflare, Inc. tiene su sede en Estados Unidos, y el correo pasa por ella según sus condiciones de tratamiento de datos (el Marco de Privacidad de Datos UE-EE. UU. y las cláusulas contractuales tipo de la UE). El buzón en sí está en un proveedor de correo corriente. Un mensaje o un correo se conserva allí hasta que se ha atendido, como máximo 12 meses, y después se borra, junto con la respuesta, si la hubo.',
          'Anders Imenes, en Noruega, es el responsable de este tratamiento. Un mensaje se trata con tu consentimiento, que das al enviarlo, para corregir lo que describe o responderte; puedes retirarlo en cualquier momento, y lo que enviaste se borra entonces. Puedes pedir una copia de lo que enviaste, también en un formato legible por máquina, que se corrija o se borre, o que se limite su tratamiento, escribiendo a feedback@sudokui.app, y puedes reclamar ante Datatilsynet, la autoridad noruega de protección de datos.'
        ]
      },
      {
        heading: 'Lo que nunca se recoge',
        paragraphs: [
          'Sin cuenta, sin contraseña, sin cookie, sin huella digital, sin publicidad, sin scripts de terceros, y sin dirección de correo salvo que la des en un mensaje o escribas a feedback@sudokui.app. Tus partidas, tus anotaciones, tus estadísticas, tu registro de técnicas y tu racha del sudoku del día se quedan en el almacenamiento de tu navegador, en tu dispositivo, y solo salen de él de las maneras que describe esta página. Con la app abierta en más de una pestaña o ventana, juega una a la vez y las demás no escriben nada: la que juega guarda un nombre aleatorio para sí en ese mismo almacenamiento, para que una pestaña que despierta después de que el navegador la pausara vea al instante que ya no es la que juega. Ese nombre nunca se envía, y las pestañas se pasan el turno unas a otras solo dentro del navegador. En el historial propio de cada pestaña la app anota además si ya ha arrancado en esa página y, cuando se recarga sola, por qué; el navegador guarda estas notas con el historial de la pestaña, no dicen nada de ti y nunca se envían.'
        ]
      },
      {
        heading: 'Quién lleva esto, y cómo comprobarlo',
        paragraphs: [
          'sudokUI lo lleva su autor, Anders Imenes, desde Noruega y lo sirve Cloudflare. El código fuente, incluido todo lo que describe esta página, es público: {source}. Las preguntas y correcciones son bienvenidas en feedback@sudokui.app o como una incidencia allí.'
        ]
      }
    ],
    updated: 'Última modificación: noviembre de 2026.'
  }
};
