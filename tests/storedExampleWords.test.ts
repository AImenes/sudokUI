/**
 * The words the Learn pages show for the stored examples that moved when
 * the AIC was filed with the Nice Loops (docs/rating-chains.md), in
 * English, Norwegian and Spanish. tests/chainWords.test.ts and
 * tests/linkHouses.test.ts pin the examples they were written against
 * (tests/examplesBefore.ts); these pin the ones a player reads now
 * (src/content/examples.json): the open chain's ending (M2 of
 * docs/hint-readability-2026-11.md), the loop's closing (H4) and the
 * houses each link names, in the walk and in the chain trainer (M17).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import { walkFrames, conclusionText, linkText } from '../src/engine/hintFrames';
import { findStep } from '../src/engine/humanSolver';
import { setEngineText } from '../src/engine/text';
import { extend, chainStep, EMPTY_CHAIN } from '../src/engine/chainTrainer';
import type { Chain } from '../src/engine/chainTrainer';
import type { Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

afterEach(() => setEngineText('en', null));

const LANGS = [
  ['en', null],
  ['nb', engineNb],
  ['es', engineEs]
] as const;
type Lang = (typeof LANGS)[number][0];
const inEach = (fn: (lang: Lang) => void) => {
  for (const [lang, loc] of LANGS) {
    setEngineText(lang, loc as never);
    fn(lang);
  }
};

const last = (s: Step) => walkFrames(s).at(-1)!.text;
const closing = (s: Step) => walkFrames(s).find((f) => f.links === s.links!.length && !f.sets)!.text;
/** the example's step as its finder gives it at its position: the step the Learn page walks */
const found = (tech: Tech) => {
  const step = findStep(tech, exampleGrid(EXAMPLES[tech]!))!;
  expect(JSON.stringify(step.links), tech).toBe(JSON.stringify(EXAMPLES[tech]!.step.links));
  return step;
};
const links = (tech: Tech) => {
  const step = found(tech);
  return step.links!.map((l) => linkText(l, step));
};

describe('the stored open chains end on both their ends (M2)', () => {
  const WANT: Record<Lang, Partial<Record<Tech, string>>> = {
    en: {
      AIC: 'Either r1c3 (by the small dot) is 2, or the chain makes r2c1 8. Either way r1c3 is not 8.',
      AIC_ALS: 'Either r2c9 (by the small dot) is 8, or the chain makes r6c9 9. Either way r6c9 is not 8.',
      AIC_GROUPED: 'Either r1c2 (by the small dot) is 8, or the chain puts 8 in one of r8c6, r9c6. Each removed 8 sees every 8 of both.'
    },
    nb: {
      AIC: 'Enten er r1c3 (ved den lille prikken) 2, eller så gjør kjeden r2c1 til 8. Uansett er r1c3 ikke 8.',
      AIC_ALS: 'Enten er r2c9 (ved den lille prikken) 8, eller så gjør kjeden r6c9 til 9. Uansett er r6c9 ikke 8.',
      AIC_GROUPED: 'Enten er r1c2 (ved den lille prikken) 8, eller så setter kjeden 8 i en av r8c6, r9c6. Hvert 8-tall som fjernes, ser alle 8-tallene i begge.'
    },
    es: {
      AIC: 'O bien r1c3 (junto al punto pequeño) es 2, o la cadena hace que r2c1 sea 8. En cualquier caso, r1c3 no es 8.',
      AIC_ALS: 'O bien r2c9 (junto al punto pequeño) es 8, o la cadena hace que r6c9 sea 9. En cualquier caso, r6c9 no es 8.',
      AIC_GROUPED: 'O bien r1c2 (junto al punto pequeño) es 8, o la cadena pone el 8 en una de r8c6, r9c6. Cada 8 eliminado ve todos los 8 de ambos extremos.'
    }
  };

  it('in English, Norwegian and Spanish, before the removals', () => {
    inEach((lang) => {
      for (const [tech, words] of Object.entries(WANT[lang]) as [Tech, string][]) {
        const step = EXAMPLES[tech]!.step;
        expect(last(step), `${lang} ${tech}`).toBe(`${words} ${conclusionText(step)}`);
      }
    });
  });
});

describe('the stored Grouped Nice Loop says it closed (H4)', () => {
  it('in English, Norwegian and Spanish, at its weak link inside the start cell', () => {
    const want: Record<Lang, string> = {
      en: 'In r6c3: if it is 3, it cannot be 1. The chain is back at r6c3, as it began: the loop holds whichever way round it is read, so each weak link, dashed or inside a cell, has exactly one end that is true.',
      nb: 'I r6c3: hvis den er 3, kan den ikke være 1. Kjeden er tilbake ved r6c3, akkurat slik den begynte: sløyfen holder uansett hvilken vei den leses, så hver svak lenke, stiplet eller inne i en rute, har nøyaktig én ende som er sann.',
      es: 'En r6c3: si es 3, no puede ser 1. La cadena ha vuelto a r6c3, tal como empezó: el bucle es válido sea cual sea el sentido en que se lea, así que cada enlace débil, discontinuo o dentro de una casilla, tiene exactamente un extremo verdadero.'
    };
    inEach((lang) => {
      const step = EXAMPLES.GROUPED_NICE_LOOP!.step;
      expect(closing(step), lang).toBe(want[lang]);
      // said once, and the conclusion stays the removals
      expect(walkFrames(step).filter((f) => f.text.includes(lang === 'en' ? 'The chain is back at' : lang === 'nb' ? 'Kjeden er tilbake ved' : 'La cadena ha vuelto a'))).toHaveLength(1);
      expect(last(step), lang).toBe(conclusionText(step));
    });
  });
});

describe('the stored examples name the house of each link (M17)', () => {
  it('the Grouped Nice Loop and the AIC, in English, Norwegian and Spanish', () => {
    const gnl: Record<Lang, string[]> = {
      en: [
        'Strong link on 1 in column 3: r6c3, r7c3, r8c3 and r9c3 are its only 1s, so if r6c3 is not 1, one of r7c3, r8c3, r9c3 is.',
        'Weak link on 1 in box 7: r7c3, r8c3, r9c3 and r7c1 all see each other, so if one of r7c3, r8c3, r9c3 is 1, r7c1 is not.',
        'In r7c1: if it is not 1, it must be 3 (the cell has only these two).',
        'Weak link on 3 in column 1: r7c1, r4c1 and r6c1 all see each other, so if r7c1 is 3, none of r4c1, r6c1 is.',
        'Strong link on 3 in box 4: r4c1, r6c1 and r6c3 are its only 3s, so if none of r4c1, r6c1 is 3, r6c3 is.',
        'In r6c3: if it is 3, it cannot be 1.'
      ],
      nb: [
        'Sterk lenke på 1 i kolonne 3: r6c3, r7c3, r8c3 og r9c3 er de eneste 1-erne der, så hvis r6c3 ikke er 1, er en av r7c3, r8c3, r9c3 det.',
        'Svak lenke på 1 i boks 7: r7c3, r8c3, r9c3 og r7c1 ser alle hverandre, så hvis en av r7c3, r8c3, r9c3 er 1, er r7c1 det ikke.',
        'I r7c1: hvis den ikke er 1, må den være 3 (ruten har bare disse to).',
        'Svak lenke på 3 i kolonne 1: r7c1, r4c1 og r6c1 ser alle hverandre, så hvis r7c1 er 3, er ingen av r4c1, r6c1 det.',
        'Sterk lenke på 3 i boks 4: r4c1, r6c1 og r6c3 er de eneste 3-erne der, så hvis ingen av r4c1, r6c1 er 3, er r6c3 det.',
        'I r6c3: hvis den er 3, kan den ikke være 1.'
      ],
      es: [
        'Enlace fuerte en el 1, en la columna 3: r6c3, r7c3, r8c3 y r9c3 son sus únicos 1, así que si r6c3 no es 1, una de r7c3, r8c3, r9c3 sí lo es.',
        'Enlace débil en el 1, en la caja 7: r7c3, r8c3, r9c3 y r7c1 se ven todas entre sí, así que si una de r7c3, r8c3, r9c3 es 1, r7c1 no lo es.',
        'En r7c1: si no es 1, debe ser 3 (la casilla solo tiene estos dos).',
        'Enlace débil en el 3, en la columna 1: r7c1, r4c1 y r6c1 se ven todas entre sí, así que si r7c1 es 3, ninguna de r4c1, r6c1 lo es.',
        'Enlace fuerte en el 3, en la caja 4: r4c1, r6c1 y r6c3 son sus únicos 3, así que si ninguna de r4c1, r6c1 es 3, r6c3 sí lo es.',
        'En r6c3: si es 3, no puede ser 1.'
      ]
    };
    const aic: Record<Lang, string[]> = {
      en: [
        'Strong link on 2 in row 1: r1c3 and r1c8 are its only 2s, so if r1c3 is not 2, r1c8 is.',
        'In r1c8: if it is 2, it cannot be 7.',
        'Strong link on 7 in column 8: r1c8 and r2c8 are its only 7s, so if r1c8 is not 7, r2c8 is.',
        'In r2c8: if it is 7, it cannot be 8.',
        'Strong link on 8 in row 2: r2c8 and r2c1 are its only 8s, so if r2c8 is not 8, r2c1 is.'
      ],
      nb: [
        'Sterk lenke på 2 i rad 1: r1c3 og r1c8 er de eneste 2-erne der, så hvis r1c3 ikke er 2, er r1c8 det.',
        'I r1c8: hvis den er 2, kan den ikke være 7.',
        'Sterk lenke på 7 i kolonne 8: r1c8 og r2c8 er de eneste 7-erne der, så hvis r1c8 ikke er 7, er r2c8 det.',
        'I r2c8: hvis den er 7, kan den ikke være 8.',
        'Sterk lenke på 8 i rad 2: r2c8 og r2c1 er de eneste 8-erne der, så hvis r2c8 ikke er 8, er r2c1 det.'
      ],
      es: [
        'Enlace fuerte en el 2, en la fila 1: r1c3 y r1c8 son sus únicos 2, así que si r1c3 no es 2, r1c8 sí lo es.',
        'En r1c8: si es 2, no puede ser 7.',
        'Enlace fuerte en el 7, en la columna 8: r1c8 y r2c8 son sus únicos 7, así que si r1c8 no es 7, r2c8 sí lo es.',
        'En r2c8: si es 7, no puede ser 8.',
        'Enlace fuerte en el 8, en la fila 2: r2c8 y r2c1 son sus únicos 8, así que si r2c8 no es 8, r2c1 sí lo es.'
      ]
    };
    inEach((lang) => {
      expect(links('GROUPED_NICE_LOOP'), lang).toEqual(gnl[lang]);
      expect(links('AIC'), lang).toEqual(aic[lang]);
    });
  });

  it("the AIC built in the chain trainer, in English, Norwegian and Spanish", () => {
    const want: Record<Lang, string[]> = {
      en: [
        'If the 2 in r1c3 is false, the 2 in r1c8 is true (strong link: they are the only 2s in row 1).',
        'If the 2 in r1c8 is true, the 7 in r1c8 is false (weak link).',
        'If the 7 in r1c8 is false, the 7 in r2c8 is true (strong link: they are the only 7s in column 8).',
        'If the 7 in r2c8 is true, the 8 in r2c8 is false (a strong link, used here as a weak one).',
        'If the 8 in r2c8 is false, the 8 in r2c1 is true (strong link: they are the only 8s in row 2).'
      ],
      nb: [
        'Hvis 2-tallet i r1c3 er usant, er 2-tallet i r1c8 sant (sterk lenke: de er de eneste 2-erne i rad 1).',
        'Hvis 2-tallet i r1c8 er sant, er 7-tallet i r1c8 usant (svak lenke).',
        'Hvis 7-tallet i r1c8 er usant, er 7-tallet i r2c8 sant (sterk lenke: de er de eneste 7-erne i kolonne 8).',
        'Hvis 7-tallet i r2c8 er sant, er 8-tallet i r2c8 usant (en sterk lenke, brukt her som en svak).',
        'Hvis 8-tallet i r2c8 er usant, er 8-tallet i r2c1 sant (sterk lenke: de er de eneste 8-erne i rad 2).'
      ],
      es: [
        'Si el 2 de r1c3 es falso, el 2 de r1c8 es verdadero (enlace fuerte: son los únicos 2 de la fila 1).',
        'Si el 2 de r1c8 es verdadero, el 7 de r1c8 es falso (enlace débil).',
        'Si el 7 de r1c8 es falso, el 7 de r2c8 es verdadero (enlace fuerte: son los únicos 7 de la columna 8).',
        'Si el 7 de r2c8 es verdadero, el 8 de r2c8 es falso (un enlace fuerte, usado aquí como débil).',
        'Si el 8 de r2c8 es falso, el 8 de r2c1 es verdadero (enlace fuerte: son los únicos 8 de la fila 2).'
      ]
    };
    const ex = EXAMPLES.AIC!;
    inEach((lang) => {
      const g = exampleGrid(ex);
      let chain: Chain = EMPTY_CHAIN;
      for (const node of [ex.step.links![0].from[0], ...ex.step.links!.map((l) => l.to[0])]) chain = extend(g, chain, node).chain;
      expect(chainStep(g, chain).links!.map((l) => l.text), lang).toEqual(want[lang]);
    });
  });
});
