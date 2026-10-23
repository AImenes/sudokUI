// The privacy page, /privacy/ (and /nb/privacy/, /es/privacy/): what leaves
// the device, exactly, in the three languages (docs/online-goals.md,
// phase 3). Every sentence describes what the code does: the live lines
// src/state/telemetry.ts sends by default, what the Settings switch adds,
// the daily's times (src/state/dailyStats.ts), the share links
// (src/content/share.ts), the landing count (worker/telemetry.ts) and the
// reports (src/ui/report.ts, worker/feedback.ts).
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
      'What sudokUI sends from your device, exactly: two anonymous lines per game and one per link you share, while online; never your IP address, no account, no cookies. And what only you can switch on.',
    h1: 'What sudokUI sends, and what it keeps',
    lead:
      'sudokUI runs on your device. It has no account, no cookie banner and no advertising, and by default it sends nothing about you. This page lists everything that leaves the device, exactly.',
    sections: [
      {
        heading: 'By default: two lines per game, while online',
        paragraphs: [
          'When you make the first move of a game and when it is solved, the app sends one short line to sudokui.app: which of the two it was, the puzzle’s difficulty level, the solve time rounded down to a 15-second step (two hours and up count as one step), whether the app runs installed or in a browser tab, and the app’s version. The server adds the country the connection came from, as Cloudflare reports it, and keeps the counts for three months in Cloudflare’s Workers Analytics Engine.',
          'That is all. The line carries no name, no account, no cookie, no device ID and no IP address: the server reads the address only to refuse floods, in memory, and the user agent your browser sends (its name and system, sometimes the device model) only to leave out robots: search engines, link previews, headless browsers and test tools. It writes down neither. One game cannot be linked to another. Nothing is stored on your device for this. Offline, nothing is sent and nothing is kept.',
          'A game you open but never play sends nothing, and neither does a practice puzzle. Anything you put on the board is a first move: a digit, a mark, a colour, or candidates shown. A position someone shares with you, or a grid you paste, that opens with any of these on it counts as begun when it opens. Restarting the puzzle you are playing before you have solved it, or choosing it again while it is still on the board, does not count as a new game; playing a puzzle again after solving it does, even if you undid the last digit.'
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
          'Settings also has “Leave this device out of the counts”. On, the app sends none of these lines from this device, nor the line for a link you share (below), online or offline, and deletes anything the other switch had kept. The setting itself is remembered on your device, like your other settings, because you asked for it. It holds in every ordinary window of the browser you turn it on in, not in a private one; an app added to a home screen may keep its own settings, so turn it on there too. Two things it does not change: a share or daily link opened from outside sudokui.app in a browser or app where the switch is not on can still count as a landing, because the server counts it from the request and cannot see any switch; and daily times are still sent only when you tap the button.'
        ]
      },
      {
        heading: 'The daily puzzle’s times',
        paragraphs: [
          'After an unassisted solve of the daily, the win screen offers “Send my time and compare”. Only if you tap it, the app sends your time, the finished grid, that you solved it without help, and a random token it keeps for that day, so the same time is not counted twice. The server keeps the time in its 15-second step with the day’s other times, and with it the token and the day it arrived. Nothing links one day’s token to another day’s. To show how many have solved the day’s puzzle, the win screen also asks the server for the day’s numbers; that request carries nothing about you.'
        ]
      },
      {
        heading: 'Share links',
        paragraphs: [
          'A link you share carries the puzzle, its level and HoDoKu rating, up to three technique names and, if you choose to challenge someone, your time in seconds.',
          'When a link goes from the app to someone, because it went through your device’s share menu or was copied, the app sends one more line while online: that a link was shared, which kind (a puzzle, a position, a challenge after a solve, or the daily puzzle’s line), whether it went through the share menu or was copied, the puzzle’s band, whether the app runs installed or in a browser tab, and the app’s version. Not the link, not the text, not where it went or to whom. Copying the puzzle string, or the position as text (the pencil-mark grid), sends nothing. As with the lines above, the server adds the country and keeps the count for three months, reads the address only to refuse floods and the user agent only to leave out robots, and writes down neither. Nothing is kept on your device for it: offline, or with this device left out of the counts, nothing is sent.',
          'When someone opens a shared link, or a daily puzzle’s link, from outside sudokui.app, the server counts one landing, with the level, the country and one word for where it was opened from. The word comes from what the browser reports about where the link was opened from: for another site, usually just that site’s address; on Android, sometimes the name of the app. It is one of these: none (a link typed or bookmarked, or opened from an app that reports nothing, as most do), a search engine, an AI assistant, Reddit, the Enjoy Sudoku forum, Hacker News, Facebook, Discord, another social site or app, a chat app or site, a mail app or webmail, GitHub, another sudoku site, or another site or app. The address itself is not kept. No landing is counted when the browser already holds sudokUI and opens the link itself, and who opened it is not recorded.'
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
          'No account, no password, no cookie, no fingerprint, no advertising, no third-party script, and no e-mail address unless you give one in a report or write to feedback@sudokui.app. Your games, pencil marks, statistics, technique record and daily streak stay in your browser’s storage, on your device, and leave it only in the ways this page describes.'
        ]
      },
      {
        heading: 'Who runs this, and how to check',
        paragraphs: [
          'sudokUI is run from Norway by its author, Anders Imenes, and served by Cloudflare. The source code, including everything this page describes, is public: {source}. Questions and corrections are welcome at feedback@sudokui.app, or as an issue there.'
        ]
      }
    ],
    updated: 'Last changed: October 2026.'
  },
  nb: {
    name: 'Personvern',
    title: 'Personvern: hva sudokUI sender',
    description:
      'Hva sudokUI sender, nøyaktig: to anonyme linjer per spill og én per delt lenke, bare på nett; aldri IP-adressen din, ingen konto, ingen informasjonskapsler. Og hva bare du kan slå på.',
    h1: 'Hva sudokUI sender, og hva appen beholder',
    lead:
      'sudokUI kjører på enheten din. Appen har ingen konto, ingen samtykkeboks og ingen reklame, og som standard sender den ingenting om deg. Denne siden lister opp alt som forlater enheten, nøyaktig.',
    sections: [
      {
        heading: 'Som standard: to linjer per spill, når du er på nett',
        paragraphs: [
          'Når du gjør det første trekket i et spill og når det er løst, sender appen én kort linje til sudokui.app: hvilken av de to det var, oppgavens vanskelighetsgrad, løsetiden rundet ned til nærmeste 15 sekunder (to timer og mer teller som ett trinn), om appen kjører installert eller i en nettleserfane, og appens versjon. Tjeneren legger til landet tilkoblingen kom fra, slik Cloudflare oppgir det, og beholder tallene i tre måneder i Cloudflares Workers Analytics Engine.',
          'Det er alt. Linjen inneholder ingen navn, ingen konto, ingen informasjonskapsel, ingen enhets-ID og ingen IP-adresse: tjeneren leser adressen bare for å avvise flommer, i minnet, og brukeragenten nettleseren din sender (navnet og systemet, noen ganger enhetsmodellen) bare for å holde roboter utenfor: søkemotorer, lenkeforhåndsvisninger, hodeløse nettlesere og testverktøy. Ingen av delene skrives ned. Ett spill kan ikke knyttes til et annet. Ingenting lagres på enheten din for dette. Uten nett sendes ingenting, og ingenting beholdes.',
          'Et spill du åpner men aldri spiller, sender ingenting, og det gjør heller ikke en øvingsoppgave. Alt du setter på brettet, er et første trekk: et tall, et notat, en farge eller kandidater som vises. En stilling noen deler med deg, eller et brett du limer inn, som åpnes med noe av dette, teller som påbegynt når det åpnes. Å starte oppgaven du holder på med på nytt før du har løst den, eller velge den igjen mens den fortsatt står på brettet, teller ikke som et nytt spill; å spille en oppgave på nytt etter at du har løst den, gjør det, også om du angret det siste tallet.'
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
          'I innstillingene finnes også «Hold denne enheten utenfor tellingen». Når den er på, sender appen ingen av disse linjene fra denne enheten, heller ikke linjen for en lenke du deler (se under), verken på nett eller uten, og sletter det den andre bryteren hadde beholdt. Selve innstillingen huskes på enheten din, som de andre innstillingene, fordi du har bedt om det. Den gjelder i alle vanlige vinduer i nettleseren du slår den på i, men ikke i private vinduer; en app lagt til på en hjemskjerm kan ha egne innstillinger, så slå den på der også. To ting endrer den ikke: en delingslenke eller en lenke til dagens sudoku som åpnes fra utsiden av sudokui.app i en nettleser eller app der bryteren ikke er på, kan fortsatt telles som en landing, fordi tjeneren teller den ut fra forespørselen og ikke kan se noen bryter; og tidene på dagens sudoku sendes fortsatt bare når du trykker på knappen.'
        ]
      },
      {
        heading: 'Tidene på dagens sudoku',
        paragraphs: [
          'Etter en løsning av dagens sudoku uten hjelp tilbyr seiersskjermen «Send inn tiden min og sammenlign». Bare hvis du trykker på den, sender appen tiden din, det ferdige brettet, at du løste den uten hjelp, og et tilfeldig merke appen beholder for den dagen, slik at samme tid ikke telles to ganger. Tjeneren beholder tiden i trinnet på 15 sekunder den faller i, sammen med dagens andre tider, og med den merket og dagen den kom inn. Ingenting knytter én dags merke til en annen dags. For å vise hvor mange som har løst dagens oppgave, spør seiersskjermen også tjeneren om dagens tall; den forespørselen inneholder ingenting om deg.'
        ]
      },
      {
        heading: 'Delingslenker',
        paragraphs: [
          'En lenke du deler, bærer oppgaven, dens vanskelighetsgrad og poengsum, opptil tre teknikknavn og, hvis du velger å utfordre noen, tiden din i sekunder.',
          'Når en lenke går fra appen til noen, fordi den ble delt via delingsmenyen på enheten din eller kopiert, sender appen én linje til mens du er på nett: at en lenke ble delt, hva slags lenke (en oppgave, en stilling, en utfordring etter en løsning eller linjen til dagens sudoku), om den gikk via delingsmenyen eller ble kopiert, oppgavens vanskelighetsgrad, om appen kjører installert eller i en nettleserfane, og appens versjon. Ikke lenken, ikke teksten, ikke hvor den gikk eller til hvem. Å kopiere tegnstrengen, eller stillingen som tekst (rutenettet med kandidater), sender ingenting. Som for linjene over legger tjeneren til landet og beholder tallet i tre måneder, leser adressen bare for å avvise flommer og brukeragenten bare for å holde roboter utenfor, og skriver ned ingen av delene. Ingenting lagres på enheten din for dette: uten nett, eller når denne enheten holdes utenfor tellingen, sendes ingenting.',
          'Når noen åpner en delt lenke, eller en lenke til dagens sudoku, fra utsiden av sudokui.app, teller tjeneren én landing, med vanskelighetsgraden, landet og ett ord for hvor den ble åpnet fra. Ordet kommer fra det nettleseren oppgir om hvor lenken ble åpnet fra: for et annet nettsted vanligvis bare adressen til det nettstedet, på Android noen ganger navnet på appen. Det er ett av disse: ingen (en lenke som er skrevet inn eller lagret som bokmerke, eller åpnet fra en app som ikke oppgir noe, slik de fleste gjør), en søkemotor, en KI-assistent, Reddit, Enjoy Sudoku-forumet, Hacker News, Facebook, Discord, et annet sosialt nettsted eller en annen sosial app, en chatapp eller et chatnettsted, en e-postapp eller e-post på nettet, GitHub, et annet sudokunettsted, eller et annet nettsted eller en annen app. Selve adressen beholdes ikke. Ingen landing telles når nettleseren allerede har sudokUI lagret og åpner lenken selv, og hvem som åpnet den, registreres ikke.'
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
          'Ingen konto, ingen passord, ingen informasjonskapsel, ingen digitale fingeravtrykk, ingen reklame, ingen skript fra tredjeparter, og ingen e-postadresse med mindre du oppgir en i en melding eller skriver til feedback@sudokui.app. Spillene dine, notatene, statistikken, teknikkoversikten og rekken på dagens sudoku blir i nettleserens lagring, på enheten din, og forlater den bare på måtene denne siden beskriver.'
        ]
      },
      {
        heading: 'Hvem som driver dette, og hvordan du kan sjekke det',
        paragraphs: [
          'sudokUI drives fra Norge av forfatteren, Anders Imenes, og leveres av Cloudflare. Kildekoden, inkludert alt denne siden beskriver, er åpen: {source}. Spørsmål og rettelser er velkomne på feedback@sudokui.app, eller som en sak der.'
        ]
      }
    ],
    updated: 'Sist endret: oktober 2026.'
  },
  es: {
    name: 'Privacidad',
    title: 'Privacidad: qué envía sudokUI',
    description:
      'Qué envía sudokUI, exactamente: dos líneas anónimas por partida y una por enlace compartido, solo en línea; nunca tu dirección IP, sin cuenta, sin cookies. Y qué solo tú puedes activar.',
    h1: 'Qué envía sudokUI y qué conserva',
    lead:
      'sudokUI funciona en tu dispositivo. No tiene cuenta, ni aviso de cookies, ni publicidad, y por defecto no envía nada sobre ti. Esta página enumera todo lo que sale del dispositivo, exactamente.',
    sections: [
      {
        heading: 'Por defecto: dos líneas por partida, mientras estás en línea',
        paragraphs: [
          'Cuando haces el primer movimiento de una partida y cuando se resuelve, la app envía una línea corta a sudokui.app: cuál de las dos fue, el nivel de dificultad del sudoku, el tiempo de resolución redondeado hacia abajo a tramos de 15 segundos (dos horas o más cuentan como un solo tramo), si la app funciona instalada o en una pestaña del navegador, y la versión de la app. El servidor añade el país desde el que llegó la conexión, tal como lo indica Cloudflare, y conserva los recuentos durante tres meses en Workers Analytics Engine de Cloudflare.',
          'Eso es todo. La línea no lleva nombre, ni cuenta, ni cookie, ni identificador del dispositivo, ni dirección IP: el servidor lee la dirección solo para rechazar avalanchas, en memoria, y el agente de usuario que envía tu navegador (su nombre y su sistema, a veces el modelo del dispositivo) solo para dejar fuera a los robots: buscadores, vistas previas de enlaces, navegadores sin interfaz y herramientas de prueba. No anota ninguno de los dos. Una partida no puede vincularse con otra. No se guarda nada en tu dispositivo para esto. Sin conexión, no se envía nada y no se conserva nada.',
          'Una partida que abres pero no juegas no envía nada, y tampoco un sudoku de práctica. Todo lo que pones en el tablero es un primer movimiento: un número, una anotación, un color o los candidatos a la vista. Una posición que alguien comparte contigo, o un tablero que pegas, que se abre con algo de esto cuenta como empezada al abrirse. Reiniciar el sudoku que estás jugando antes de resolverlo, o volver a elegirlo mientras sigue en el tablero, no cuenta como una partida nueva; volver a jugarlo después de resolverlo sí, aunque hayas deshecho el último número.'
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
          'En Ajustes también está «Dejar este dispositivo fuera del recuento». Encendido, la app no envía ninguna de estas líneas desde este dispositivo, ni la de un enlace que compartes (más abajo), con o sin conexión, y borra lo que hubiera conservado el otro interruptor. El ajuste en sí se recuerda en tu dispositivo, como tus demás ajustes, porque lo has pedido. Vale en todas las ventanas normales del navegador en el que lo enciendes, no en las privadas; una app añadida a la pantalla de inicio puede tener sus propios ajustes, así que enciéndelo también allí. Hay dos cosas que no cambia: un enlace compartido o del sudoku del día abierto desde fuera de sudokui.app en un navegador o una app donde el interruptor no está encendido puede seguir contando como una llegada, porque el servidor la cuenta a partir de la petición y no puede ver ningún interruptor; y los tiempos del sudoku del día se siguen enviando solo cuando pulsas el botón.'
        ]
      },
      {
        heading: 'Los tiempos del sudoku del día',
        paragraphs: [
          'Tras resolver el sudoku del día sin ayuda, la pantalla de victoria ofrece «Enviar mi tiempo y comparar». Solo si lo pulsas, la app envía tu tiempo, el tablero terminado, que lo resolviste sin ayuda y una ficha aleatoria que conserva para ese día, para que el mismo tiempo no se cuente dos veces. El servidor guarda el tiempo en su tramo de 15 segundos junto con los demás tiempos del día, y con él la ficha y el día en que llegó. Nada vincula la ficha de un día con la de otro. Para mostrar cuántos han resuelto el sudoku del día, la pantalla de victoria también pide al servidor las cifras del día; esa petición no lleva nada sobre ti.'
        ]
      },
      {
        heading: 'Enlaces para compartir',
        paragraphs: [
          'Un enlace que compartes lleva el sudoku, su nivel y su puntuación, hasta tres nombres de técnicas y, si decides retar a alguien, tu tiempo en segundos.',
          'Cuando un enlace sale de la app hacia alguien, porque pasó por el menú de compartir de tu dispositivo o se copió, la app envía una línea más mientras estás en línea: que se compartió un enlace, de qué tipo (un sudoku, una posición, un reto tras resolver o la línea del sudoku del día), si pasó por el menú de compartir o se copió, el nivel del sudoku, si la app funciona instalada o en una pestaña del navegador, y la versión de la app. Ni el enlace, ni el texto, ni adónde fue ni a quién. Copiar el sudoku en texto, o la posición en texto (la cuadrícula de candidatos), no envía nada. Como con las líneas de arriba, el servidor añade el país y conserva el recuento durante tres meses, lee la dirección solo para rechazar avalanchas y el agente de usuario solo para dejar fuera a los robots, y no anota ninguno de los dos. No se guarda nada en tu dispositivo para esto: sin conexión, o con este dispositivo fuera del recuento, no se envía nada.',
          'Cuando alguien abre un enlace compartido, o el enlace de un sudoku del día, desde fuera de sudokui.app, el servidor cuenta una llegada, con el nivel, el país y una palabra que dice desde dónde se abrió. La palabra sale de lo que el navegador indica sobre el lugar desde el que se abrió el enlace: si es otro sitio, normalmente solo la dirección de ese sitio; en Android, a veces el nombre de la app. Es una de estas: ninguna (un enlace escrito o guardado en marcadores, o abierto desde una app que no indica nada, como la mayoría), un buscador, un asistente de IA, Reddit, el foro Enjoy Sudoku, Hacker News, Facebook, Discord, otra red social (web o app), una app o web de chat, una app de correo o un correo web, GitHub, otro sitio de sudoku, u otro sitio u otra app. La dirección en sí no se guarda. No se cuenta ninguna llegada cuando el navegador ya tiene sudokUI guardado y abre el enlace por sí mismo, y quién lo abrió no se registra.'
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
          'Sin cuenta, sin contraseña, sin cookie, sin huella digital, sin publicidad, sin scripts de terceros, y sin dirección de correo salvo que la des en un mensaje o escribas a feedback@sudokui.app. Tus partidas, tus anotaciones, tus estadísticas, tu registro de técnicas y tu racha del sudoku del día se quedan en el almacenamiento de tu navegador, en tu dispositivo, y solo salen de él de las maneras que describe esta página.'
        ]
      },
      {
        heading: 'Quién lleva esto, y cómo comprobarlo',
        paragraphs: [
          'sudokUI lo lleva su autor, Anders Imenes, desde Noruega y lo sirve Cloudflare. El código fuente, incluido todo lo que describe esta página, es público: {source}. Las preguntas y correcciones son bienvenidas en feedback@sudokui.app o como una incidencia allí.'
        ]
      }
    ],
    updated: 'Última modificación: octubre de 2026.'
  }
};
