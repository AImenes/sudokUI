// The privacy page, /privacy/ (and /nb/privacy/, /es/privacy/): what leaves
// the device, exactly, in the three languages (docs/online-goals.md,
// phase 3). Every sentence describes what the code does: the live lines
// src/state/telemetry.ts sends by default, what the Settings switch adds,
// the daily's times (src/state/dailyStats.ts), the share links
// (src/content/share.ts) and the landing count (worker/telemetry.ts).
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
      'What sudokUI sends from your device, exactly: two anonymous lines per game while online, never your IP address, no account, no cookies. And what only you can switch on.',
    h1: 'What sudokUI sends, and what it keeps',
    lead:
      'sudokUI runs on your device. It has no account, no cookie banner and no advertising, and by default it sends nothing about you. This page lists everything that leaves the device, exactly.',
    sections: [
      {
        heading: 'By default: two lines per game, while online',
        paragraphs: [
          'When a game starts and when it is solved, the app sends one short line to sudokui.app: which of the two it was, the puzzle’s difficulty band, the solve time rounded down to a 15-second step (two hours and up count as one step), whether the app runs installed or in a browser tab, and the app’s version. The server adds the country the connection came from, as Cloudflare reports it, and keeps the counts for three months in Cloudflare’s Workers Analytics Engine.',
          'That is all. The line carries no name, no account, no cookie, no device ID and no IP address: the server reads the address only to refuse floods, in memory, and never writes it down. One game cannot be linked to another. Nothing is stored on your device for this. Offline, nothing is sent and nothing is kept.',
          'A practice puzzle, which starts part-way through, sends nothing. Restarting a puzzle does not count as a new game.'
        ]
      },
      {
        heading: 'If you ask: counting your offline plays too',
        paragraphs: [
          'Settings has a switch, “Help count plays, including offline ones”. It is off until you turn it on. On, the app keeps the same lines on your device while you are offline and sends them, marked as sent late, the next time it is open online. It also remembers the day you turned the switch on, so a line can say whether this device had played on an earlier day. Both are deleted the moment you turn the switch off.',
          'Still no identifier: the lines are the ones above, plus “sent late”, “counting on” and “played before”. They let the counts estimate how much is played offline without following anyone.'
        ]
      },
      {
        heading: 'The daily puzzle’s times',
        paragraphs: [
          'After an unassisted solve of the daily, the win screen offers “Send my time and compare”. Only if you tap it, the app sends your time, the finished grid and a random token it keeps for that day, so the same time is not counted twice. The server keeps the time in 15-second steps with the day’s other times, and the token with it. Nothing links one day’s token to another day’s.'
        ]
      },
      {
        heading: 'Share links',
        paragraphs: [
          'A link you share carries the puzzle, its band and rating, up to three technique names and, if you choose to challenge someone, your time in seconds. When someone opens it from outside sudokui.app, the server counts one landing, with the band and the country; who opened it is not recorded.'
        ]
      },
      {
        heading: 'What is never collected',
        paragraphs: [
          'No account, no e-mail address, no password, no cookie, no fingerprint, no advertising, no third-party script. Your games, pencil marks, statistics, technique record and daily streak stay in your browser’s storage, on your device, and leave it only in the ways this page describes.'
        ]
      },
      {
        heading: 'Who runs this, and how to check',
        paragraphs: [
          'sudokUI is run from Norway by its author and served by Cloudflare. The source code, including everything this page describes, is public: {source}. Questions and corrections are welcome as an issue there.'
        ]
      }
    ],
    updated: 'Last changed: October 2026.'
  },
  nb: {
    name: 'Personvern',
    title: 'Personvern: hva sudokUI sender',
    description:
      'Hva sudokUI sender fra enheten din, nøyaktig: to anonyme linjer per spill når du er på nett, aldri IP-adressen din, ingen konto, ingen informasjonskapsler. Og hva bare du kan slå på.',
    h1: 'Hva sudokUI sender, og hva appen beholder',
    lead:
      'sudokUI kjører på enheten din. Appen har ingen konto, ingen samtykkeboks og ingen reklame, og som standard sender den ingenting om deg. Denne siden lister opp alt som forlater enheten, nøyaktig.',
    sections: [
      {
        heading: 'Som standard: to linjer per spill, når du er på nett',
        paragraphs: [
          'Når et spill starter og når det er løst, sender appen én kort linje til sudokui.app: hvilken av de to det var, oppgavens vanskelighetsgrad, løsetiden rundet ned til nærmeste 15 sekunder (to timer og mer teller som ett trinn), om appen kjører installert eller i en nettleserfane, og appens versjon. Tjeneren legger til landet tilkoblingen kom fra, slik Cloudflare oppgir det, og beholder tallene i tre måneder i Cloudflares Workers Analytics Engine.',
          'Det er alt. Linjen inneholder ingen navn, ingen konto, ingen informasjonskapsel, ingen enhets-ID og ingen IP-adresse: tjeneren leser adressen bare for å avvise flommer, i minnet, og skriver den aldri ned. Ett spill kan ikke knyttes til et annet. Ingenting lagres på enheten din for dette. Uten nett sendes ingenting, og ingenting beholdes.',
          'En øvingsoppgave, som starter et stykke ut i løsningen, sender ingenting. Å starte en oppgave på nytt teller ikke som et nytt spill.'
        ]
      },
      {
        heading: 'Hvis du ber om det: telle spillene dine uten nett også',
        paragraphs: [
          'I innstillingene finnes bryteren «Hjelp til å telle spill, også uten nett». Den er av til du slår den på. Når den er på, beholder appen de samme linjene på enheten din mens du er uten nett, og sender dem, merket som sendt sent, neste gang den er åpen på nett. Den husker også dagen du slo bryteren på, slik at en linje kan si om denne enheten hadde spilt en tidligere dag. Begge deler slettes i det øyeblikket du slår bryteren av.',
          'Fortsatt ingen identifikator: linjene er de samme som over, pluss «sendt sent», «telling på» og «spilt før». De lar tallene anslå hvor mye som spilles uten nett, uten å følge noen.'
        ]
      },
      {
        heading: 'Tidene på dagens sudoku',
        paragraphs: [
          'Etter en løsning av dagens sudoku uten hjelp tilbyr seiersskjermen «Send inn tiden min og sammenlign». Bare hvis du trykker på den, sender appen tiden din, det ferdige brettet og et tilfeldig merke appen beholder for den dagen, slik at samme tid ikke telles to ganger. Tjeneren beholder tiden i trinn på 15 sekunder sammen med dagens andre tider, og merket sammen med den. Ingenting knytter én dags merke til en annen dags.'
        ]
      },
      {
        heading: 'Delingslenker',
        paragraphs: [
          'En lenke du deler, bærer oppgaven, dens vanskelighetsgrad og poengsum, opptil tre teknikknavn og, hvis du velger å utfordre noen, tiden din i sekunder. Når noen åpner den fra utsiden av sudokui.app, teller tjeneren én landing, med vanskelighetsgraden og landet; hvem som åpnet den, registreres ikke.'
        ]
      },
      {
        heading: 'Hva som aldri samles inn',
        paragraphs: [
          'Ingen konto, ingen e-postadresse, ingen passord, ingen informasjonskapsel, ingen digitale fingeravtrykk, ingen reklame, ingen skript fra tredjeparter. Spillene dine, notatene, statistikken, teknikkoversikten og rekken på dagens sudoku blir i nettleserens lagring, på enheten din, og forlater den bare på måtene denne siden beskriver.'
        ]
      },
      {
        heading: 'Hvem som driver dette, og hvordan du kan sjekke det',
        paragraphs: [
          'sudokUI drives fra Norge av forfatteren og leveres av Cloudflare. Kildekoden, inkludert alt denne siden beskriver, er åpen: {source}. Spørsmål og rettelser er velkomne som en sak der.'
        ]
      }
    ],
    updated: 'Sist endret: oktober 2026.'
  },
  es: {
    name: 'Privacidad',
    title: 'Privacidad: qué envía sudokUI',
    description:
      'Qué envía sudokUI desde tu dispositivo, exactamente: dos líneas anónimas por partida mientras estás en línea, nunca tu dirección IP, sin cuenta, sin cookies. Y qué solo tú puedes activar.',
    h1: 'Qué envía sudokUI y qué conserva',
    lead:
      'sudokUI funciona en tu dispositivo. No tiene cuenta, ni aviso de cookies, ni publicidad, y por defecto no envía nada sobre ti. Esta página enumera todo lo que sale del dispositivo, exactamente.',
    sections: [
      {
        heading: 'Por defecto: dos líneas por partida, mientras estás en línea',
        paragraphs: [
          'Cuando una partida empieza y cuando se resuelve, la app envía una línea corta a sudokui.app: cuál de las dos fue, el nivel de dificultad del sudoku, el tiempo de resolución redondeado hacia abajo a tramos de 15 segundos (dos horas o más cuentan como un solo tramo), si la app funciona instalada o en una pestaña del navegador, y la versión de la app. El servidor añade el país desde el que llegó la conexión, tal como lo indica Cloudflare, y conserva los recuentos durante tres meses en Workers Analytics Engine de Cloudflare.',
          'Eso es todo. La línea no lleva nombre, ni cuenta, ni cookie, ni identificador del dispositivo, ni dirección IP: el servidor lee la dirección solo para rechazar avalanchas, en memoria, y nunca la anota. Una partida no puede vincularse con otra. No se guarda nada en tu dispositivo para esto. Sin conexión, no se envía nada y no se conserva nada.',
          'Un sudoku de práctica, que empieza a medio resolver, no envía nada. Reiniciar un sudoku no cuenta como una partida nueva.'
        ]
      },
      {
        heading: 'Si lo pides: contar también tus partidas sin conexión',
        paragraphs: [
          'En Ajustes hay un interruptor, «Ayudar a contar partidas, también sin conexión». Está apagado hasta que lo enciendes. Encendido, la app conserva las mismas líneas en tu dispositivo mientras estás sin conexión y las envía, marcadas como enviadas tarde, la próxima vez que esté abierta en línea. También recuerda el día en que encendiste el interruptor, para que una línea pueda decir si este dispositivo ya había jugado otro día. Ambas cosas se borran en el momento en que apagas el interruptor.',
          'Sigue sin haber identificador: las líneas son las mismas de arriba, más «enviada tarde», «recuento activado» y «ya había jugado». Permiten que los recuentos estimen cuánto se juega sin conexión sin seguir a nadie.'
        ]
      },
      {
        heading: 'Los tiempos del sudoku del día',
        paragraphs: [
          'Tras resolver el sudoku del día sin ayuda, la pantalla de victoria ofrece «Enviar mi tiempo y comparar». Solo si lo pulsas, la app envía tu tiempo, el tablero terminado y una ficha aleatoria que conserva para ese día, para que el mismo tiempo no se cuente dos veces. El servidor guarda el tiempo en tramos de 15 segundos junto con los demás tiempos del día, y la ficha con él. Nada vincula la ficha de un día con la de otro.'
        ]
      },
      {
        heading: 'Enlaces para compartir',
        paragraphs: [
          'Un enlace que compartes lleva el sudoku, su nivel y su puntuación, hasta tres nombres de técnicas y, si decides retar a alguien, tu tiempo en segundos. Cuando alguien lo abre desde fuera de sudokui.app, el servidor cuenta una llegada, con el nivel y el país; quién lo abrió no se registra.'
        ]
      },
      {
        heading: 'Lo que nunca se recoge',
        paragraphs: [
          'Sin cuenta, sin dirección de correo, sin contraseña, sin cookie, sin huella digital, sin publicidad, sin scripts de terceros. Tus partidas, tus anotaciones, tus estadísticas, tu registro de técnicas y tu racha del sudoku del día se quedan en el almacenamiento de tu navegador, en tu dispositivo, y solo salen de él de las maneras que describe esta página.'
        ]
      },
      {
        heading: 'Quién lleva esto, y cómo comprobarlo',
        paragraphs: [
          'sudokUI lo lleva su autor desde Noruega y lo sirve Cloudflare. El código fuente, incluido todo lo que describe esta página, es público: {source}. Las preguntas y correcciones son bienvenidas como una incidencia allí.'
        ]
      }
    ],
    updated: 'Última modificación: octubre de 2026.'
  }
};
