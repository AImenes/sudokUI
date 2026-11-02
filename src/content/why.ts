// Why sudokUI?, in the owner's words (2 November 2026): what the app is for
// and what it promises, in the three languages. One copy, two places: the
// static page /why/ (and /nb/why/, /es/why/), which search engines read
// (src/content/learnPages.ts builds it, like the privacy page), and the
// dialog the app opens from its footer and its win screen
// (src/ui/SettingsInfo.tsx WhyDialog). Never shown on its own.
//
// {privacy} is the link to the privacy page, {feedback} the way to send
// feedback: a link to the app on the page, the report dialog in the app.
import type { Lang } from '../state/settings';
import { WHY_URL } from './staticRoutes';

export { WHY_URL };

export interface WhyCopy {
  /** the footers' word for it, and the dialog's title */
  name: string;
  /** the tab and a search result's headline */
  title: string;
  /** a search result's line: the teaching first */
  description: string;
  lead: string;
  sections: { heading: string; paragraphs: string[] }[];
  /** the words {privacy} and {feedback} stand for */
  privacyLink: string;
  feedbackLink: string;
}

export const WHY: Record<Lang, WhyCopy> = {
  en: {
    name: 'Why sudokUI?',
    title: 'Why sudokUI? A free sudoku app that teaches',
    description:
      'A free sudoku app whose hints draw each technique on your own grid and explain it. HoDoKu ratings, a learning path, and it works offline: no ads, no account.',
    lead:
      "sudokUI is for playing sudoku without the clutter, and for getting better at it. When you're stuck, a hint shows the technique on your own grid, one step at a time, and says why it works. Next time you'll see it yourself. Want to learn something specific? Pick a technique and you get a puzzle that needs it.",
    sections: [
      {
        heading: "What's in it",
        paragraphs: [
          'All the techniques human solvers use, found and rated the way HoDoKu does it (thanks to its author, Bernhard Hobiger). A learning path from your own games, a chain trainer, a daily puzzle and a guide to every technique. In English, Norwegian and Spanish.'
        ]
      },
      {
        heading: 'What stays true',
        paragraphs: [
          "Free: no ads, no paywall, no account. Your games stay on your device. We count games started and finished, with no ID and nothing that tells you apart ({privacy}). It's a web app you can install, and it works offline: load it once and it keeps working, even through a seven-hour flight. Only the website's articles and the daily's global times need a connection."
        ]
      },
      {
        heading: "What we're aiming for",
        paragraphs: [
          'The best solver engine and the best board to play on, on a phone, a tablet or a computer, with highlighting that shows what matters. Light and quick, and out of your way: no feeds, no followers, no streak guilt.'
        ]
      },
      {
        heading: 'Who makes it',
        paragraphs: [
          "AImenes on GitHub, with Claude. It's never finished, and every message gets read: tap “Looks wrong?” under a hint, or {feedback}."
        ]
      }
    ],
    privacyLink: 'see the privacy page',
    feedbackLink: 'send feedback from the app'
  },
  nb: {
    name: 'Hvorfor sudokUI?',
    title: 'Hvorfor sudokUI? En gratis sudoku-app som lærer deg',
    description:
      'En gratis sudoku-app der hintene tegner teknikken på ditt eget brett og forklarer den. HoDoKu-vurdering og læringssti, virker uten nett, uten reklame og konto.',
    lead:
      'sudokUI er for å spille sudoku uten rot og fyll, og for å bli bedre til det. Når du står fast, viser et hint teknikken på ditt eget brett, ett steg om gangen, og forklarer hvorfor den virker. Neste gang ser du den selv. Vil du lære noe bestemt? Velg en teknikk, så får du en oppgave som trenger den.',
    sections: [
      {
        heading: 'Hva du får',
        paragraphs: [
          'Alle teknikkene menneskelige løsere bruker, funnet og vurdert slik HoDoKu gjør det (takk til forfatteren, Bernhard Hobiger). En læringssti bygget på dine egne spill, en kjedetrener, dagens oppgave og en guide til hver teknikk. På engelsk, norsk og spansk.'
        ]
      },
      {
        heading: 'Det som alltid gjelder',
        paragraphs: [
          'Gratis: ingen reklame, ingen betalingsmur, ingen konto. Spillene dine blir på enheten din. Vi teller spill som startes og fullføres, uten ID og uten noe som skiller deg fra andre ({privacy}). Det er en nettapp du kan installere, og den virker uten nett: last den inn én gang, så fortsetter den å virke, også gjennom en flytur på sju timer. Bare artiklene på nettstedet og de globale tidene for dagens oppgave trenger nett.'
        ]
      },
      {
        heading: 'Det vi sikter mot',
        paragraphs: [
          'Den beste løsningsmotoren og det beste brettet å spille på, på mobil, nettbrett eller datamaskin, med markering som viser det som betyr noe. Lett og rask, og den står ikke i veien: ingen strømmer, ingen følgere, ingen dårlig samvittighet for en brutt rekke.'
        ]
      },
      {
        heading: 'Hvem som lager den',
        paragraphs: [
          'AImenes på GitHub, sammen med Claude. Den blir aldri ferdig, og hver melding blir lest: trykk «Ser det feil ut?» under et hint, eller {feedback}.'
        ]
      }
    ],
    privacyLink: 'se personvernsiden',
    feedbackLink: 'send en tilbakemelding fra appen'
  },
  es: {
    name: '¿Por qué sudokUI?',
    title: '¿Por qué sudokUI? Una app de sudoku gratis que enseña',
    description:
      'App de sudoku gratis cuyas pistas dibujan la técnica en tu tablero y la explican. Valoración HoDoKu, ruta de aprendizaje, sin conexión, sin anuncios ni cuenta.',
    lead:
      'sudokUI es para jugar al sudoku sin estorbos y para mejorar. Cuando te atascas, una pista muestra la técnica en tu propio tablero, paso a paso, y explica por qué funciona. La próxima vez la verás tú. ¿Quieres aprender algo concreto? Elige una técnica y tendrás un sudoku que la necesita.',
    sections: [
      {
        heading: 'Qué incluye',
        paragraphs: [
          'Todas las técnicas que usan los resolutores humanos, encontradas y valoradas como lo hace HoDoKu (gracias a su autor, Bernhard Hobiger). Un camino de aprendizaje a partir de tus propias partidas, un entrenador de cadenas, un sudoku diario y una guía de cada técnica. En inglés, noruego y español.'
        ]
      },
      {
        heading: 'Lo que no cambia',
        paragraphs: [
          'Gratis: sin anuncios, sin muro de pago, sin cuenta. Tus partidas se quedan en tu dispositivo. Contamos las partidas empezadas y terminadas, sin identificador y sin nada que te distinga ({privacy}). Es una aplicación web que puedes instalar y funciona sin conexión: cárgala una vez y sigue funcionando, incluso durante un vuelo de siete horas. Solo los artículos de la web y los tiempos globales del diario necesitan conexión.'
        ]
      },
      {
        heading: 'A qué aspiramos',
        paragraphs: [
          'El mejor motor de resolución y el mejor tablero para jugar, en el móvil, la tableta o el ordenador, con un resaltado que muestra lo que importa. Ligera, rápida y sin estorbar: sin muros de publicaciones, sin seguidores, sin la culpa de romper una racha.'
        ]
      },
      {
        heading: 'Quién la hace',
        paragraphs: [
          'AImenes en GitHub, con Claude. Nunca está terminada y leemos cada mensaje: toca «¿Parece incorrecta?» bajo una pista o {feedback}.'
        ]
      }
    ],
    privacyLink: 'consulta la página de privacidad',
    feedbackLink: 'envía tus comentarios desde la app'
  }
};
