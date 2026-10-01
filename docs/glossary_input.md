# sudokUI Sudoku Glossary: Audit, Expansion and EN/NB/ES Translation

The glossary is mostly sound, but six real errors and several ambiguities need fixing before it ships. The errors are:
- the fish definition's claim that "base sets share no candidates";
- the fin rule;
- the confusing WXYZ "pivot" wording;
- the continuous-loop elimination rule;
- the missing overlap restriction on RCCs;
- two alias collisions ("score" and "link").

The most important product caveat is that HoDoKu does not implement WXYZ-wing or Exocet, so those techniques cannot carry "HoDoKu-compatible" scores.\[1\]

## TL;DR

- **Fix six substantive issues.**
  - Base sets may overlap as houses. The real rule is that no base *candidate* lies in two base sets, and a candidate that does is an endo fin.
  - A finned fish eliminates only those possible eliminations that also see every fin.
  - Every link in a continuous loop has exactly one true end.
  - An RCC must not lie in the overlap of the two ALSs.
  - The aliases "score" (under rating) and "link" (under inference) must go.
  - The WXYZ-wing "pivot" definition needs rewriting.
  
  HoDoKu's own pages support each fix.
- **Add 38 entries** (34 techniques and concepts plus 4 basic terms). The hints and existing definitions already use these terms without defining them:
  - Basics: digit, solution, proper puzzle, contradiction, link, technique score, pencil mark grid.
  - App terms: Steps, Check.
  - Fish: swordfish, jellyfish, finned fish, endo fin, cannibalism, mutant fish, kraken fish.
  - Wings and single-digit patterns: XY-, XYZ-, WXYZ- and W-wing, remote pair, skyscraper, two-string kite, turbot fish, empty rectangle.
  - Chains and colouring: X-chain, XY-chain, multi-colouring, 3D Medusa.
  - ALS family: ALS-XZ, ALS-XY-wing, death blossom, Sue de Coq.
  - Uniqueness: hidden rectangle, avoidable rectangle, BUG+1.
- **Translate the basics, keep most technique names in English.**
  - Native grid words: NB rute, rad, kolonne, boks, kandidat; ES casilla/celda, fila, columna, caja, candidato.
  - English names for advanced techniques (X-Wing, Swordfish, XY-Wing, AIC, BUG, Exocet, Nishio, Sashimi, Kraken, 3D Medusa), because that is what Norwegian sources do.
  - In Spanish, "ala X" and "pez espada" are established, but list them only as aliases. Spanish "medusa" for jellyfish would collide with 3D Medusa.
  - Keep r1c1 notation in both languages.

## 1. Executive summary

1. **Fish.** HoDoKu's "Fish (General)" page says base sets must be "non overlapping", which "means, that any base candidate is contained only in one base set, the sets themselves can overlap".\[2\] The pasted text, "Base sets share no candidates", fits basic fish only. It ignores endo fins in franken and mutant fish, and it ignores cannibalism: a base candidate in two cover sets is eliminated.\[2\]
2. **Fins.** HoDoKu's rule is: "In a finned fish all possible eliminations that see all the fins can be eliminated."\[2\] The pasted entry drops the "possible eliminations" condition, and it covers only exo fins.
3. **Continuous loop.** In a continuous loop every link, strong or weak, has exactly one true end. HoDoKu notes that "all weak links in the loop are converted into strong links".\[3\]
4. **Discontinuous loop.** The entry is missing the most common productive case: a strong link on one digit and a weak link on another meeting in the same cell (Sudopedia's "different inference"). In that case the weak-link digit is eliminated from that cell.\[4\]
5. **RCC.** HoDoKu says "ALS are allowed overlap in all ALS techniques".\[5\] A restricted common candidate, however, must not be in the shared cells (SudokuWiki ALS).\[6\]
6. **WXYZ-wing.** HoDoKu says "Expanded wings with even more candidates have been described, but they are hard to find and are not supported by HoDoKu."\[1\] SudokuWiki uses a single "hinge".\[7\] The sample hint is really a bivalue cell plus a three-cell ALS, which is ALS-XZ logic. Drop "pivots" from WXYZ hints.
7. **Collisions.**
   - "score" (alias of rating) versus technique score.
   - "link" (alias of inference) versus link as its own concept.
   - "locked set" versus HoDoKu's Locked Pair/Triple, which means a naked subset that also lies in an intersection.\[8\]
   - "band" as grid band versus difficulty band.
   - "medusa" in Spanish.
8. **HoDoKu facts.**
   - **Author and licence:** the HoDoKu manual pages on hodoku.sourceforge.net give "meta-author: Bernhard Hobiger" and show a GPLv3 logo linking to gnu.org/licenses/gpl-3.0.html.\[8\]\[9\]
   - **Rating:** the score is the sum of step scores ("The 'score' of all steps in the solution is simply summed up").\[9\]\[10\] The solver restarts from the first technique after each step.\[8\]
   - **Score range:** the New Sudoku Players' Forum thread "How is the difficulty of a Sudoku puzzle determined?" says "All of the scores attached to each strategy have 'default' values both in 'Score' [a number ranging from 4 to 10000 ] and in 'Level' [Easy, Medium, Hard, Unfair, Extreme]."\[11\]
   - **Levels:** the HoDoKu User Manual, Chapter 4, says "The 'level' assignes the technique to one of HoDoKu's five difficulty levels (Easy, Medium, Hard, Unfair, Extreme)".\[9\] So Beginner, Tricky and Nightmare are sudokUI-only bands.
   - **Typical scores:** the same chapter says "Medium" "contains Singles, Locked Candidates, Pairs, and Triples and normally scores between 600 and 1200 approximately".\[9\]

## 2. Audit change log

| Entry | Status | Issue → fix | Source |
|---|---|---|---|
| sample hint | correct | "pivots" is non-standard. Name the parts "bivalue cell" and "the three cells". | HoDoKu Wings; SudokuWiki WXYZ |
| cell, row, column, box, unit, line, peer, sees, given | OK | 27 units and 20 peers are correct. | HoDoKu Introduction\[12\] |
| band / stack / chute | reword | HoDoKu: horizontal chute = floor, vertical = tower.\[12\] Note the clash with difficulty band. | HoDoKu Introduction |
| intersection | reword | Add aliases minirow/minicolumn. | Exocet threads |
| pencil mark | reword | Add a separate "pencil mark grid (PM)" entry.\[12\] | HoDoKu Introduction |
| centre mark / Check | ambiguous | Confirm in code whether Check ignores corner marks. | app |
| Snyder notation | correct | Usually two places; some solvers also mark three.\[13\] | Sudopedia |
| cell name | reword | Add the combined form r57c2 = r5c2 and r7c2.\[12\] | HoDoKu Introduction |
| full house | reword | Strictly, "last digit" means the last cell of the whole grid.\[14\] | HoDoKu Singles |
| locked set | ambiguous | Note HoDoKu's Locked Pair/Triple meaning.\[8\] | HoDoKu SSTS list |
| inference | correct | Remove the "link" alias; make link its own entry. | Sudopedia Nice Loop |
| continuous loop | correct | Rule applies to every link. | HoDoKu Chains |
| discontinuous loop | correct | Add the strong-weak case in one cell. | Sudopedia Nice Loop |
| colouring | reword | Name colour wrap and colour trap; "exactly one colour is true".\[15\]\[16\] | HoDoKu Coloring; Sudopedia |
| Nishio | ambiguous | Strict sense follows only one digit. | Sudopedia |
| fish, base set, cover set | correct | Overlap wording, cannibalism, sizes.\[2\] | HoDoKu Fish (general) |
| fin, sashimi | correct | Exo vs endo fins; "possible eliminations"; sashimi = degenerate without its fins.\[2\] | HoDoKu Fish (general) |
| X-wing | reword | It is a fish, not a wing.\[2\] | HoDoKu Fish (general) |
| wing, pivot | correct | W-wing has no pivot; remove the WXYZ sentence. | HoDoKu Wings |
| RCC | correct | Add the overlap restriction. | HoDoKu ALS; SudokuWiki |
| Exocet | correct | Junior Exocet: targets must not see the base; requires the cover-line condition.\[17\] Not in HoDoKu. | forum Exocet thread (David P Bird) |
| unique rectangle | reword | Add "none of them givens". | HoDoKu Uniqueness |
| BUG | correct | "No solution or more than one"; split out BUG+1. | Sudopedia BUG; SudokuWiki\[18\]\[19\] |
| rating | correct | Remove "score" alias. | HoDoKu Ch. 4 |
| difficulty band | reword | HoDoKu has five levels;\[9\] sudokUI has eight. | HoDoKu Ch. 4 |
| all others | OK | | |

## 3. New entries: rationale

Each is either used or implied by hints, or used undefined in existing definitions. Full text is in section 5.

Not added: minimal puzzle, unique loop, set-logic truth/link/rank, Eureka notation and bivalue graph. They appear rarely in hints; add them only if hints start printing Eureka notation.

## 4. Terminology decisions

**Policy.** Use the native term where one is attested; otherwise keep the English name.
- **Norwegian.** kryssordet.no writes "teknikker som X-Wing, Swordfish og XY-Wing".\[20\] The basics are attested: rute, rad, kolonne, 3×3-boks, kandidat, notater, gitte tall, naken/skjult singel, nakne par, låste kandidater.
- **Spanish.** Wextensible's "Sudoku: Fish. X-Wing, Swordfish y Jellyfish" writes "X-Wing (2x2), Swordfish (3x3) y Jellyfish (4x4) (Ala X, Pez espada y Medusa)", with headings "Pez espada (Swordfish)" and "Medusa (Jellyfish)".\[21\] So the native names exist but sit next to the English ones.
- **Cross-reference words.** NB "Se", ES "Véase".
- **Cell notation.** Keep r1c1 in both languages. No Norwegian source writes coordinates; matematikk.org uses "(4,5)".\[22\] Spanish sites use "R3C5".

| EN | NB | ES | Status NB / ES | Conf. |
|---|---|---|---|---|
| cell | rute (celle) | casilla (LatAm celda) | est. / est. | high |
| box | boks | caja (región, bloque, subcuadrícula) | est. / est. | high |
| unit | enhet | unidad | alt. / coined | med |
| given | gitt tall | pista (número dado) | est. / est. | high |
| pencil mark | notat (blyantnotat) | anotación (marca de lápiz) | est. / est. | high |
| candidate | kandidat | candidato | est. / est. | high |
| naked/hidden single | naken/skjult singel | único desnudo/oculto | est. / est. | high |
| pair/triple/quad | par/trippel/kvartett | par/trío/cuarteto | est. / est. | high |
| locked candidates | låste kandidater | candidatos bloqueados | est. / alt. | high |
| pointing / claiming | pekende / hevdende | puntero / reclamante | est., coined / est., coined | med |
| strong/weak link | sterk/svak lenke | enlace fuerte/débil | coined / alt. | med |
| bivalue cell | toverdirute | casilla bivalor | coined / alt. | med |
| conjugate pair | konjugert par | par conjugado | coined / alt. | med |
| fish, fin | fisk, finne | pez, aleta | alt. / alt. | med |
| X-Wing, Swordfish, Jellyfish | English | English (aliases ala X, pez espada, medusa) | est. / est. | high |
| ALS, RCC | nesten låst mengde, begrenset felles kandidat | conjunto casi bloqueado, candidato común restringido | coined / alt. | med |
| deadly pattern | dødelig mønster | patrón mortal | coined / alt. | med |
| solve path, crux | løsningssti, nøkkeltrinn | ruta de resolución, paso clave | coined / coined | med |
| rating | poengsum | puntuación | coined / alt. | med |
| difficulty band | vanskelighetsgrad | nivel de dificultad | est. / est. | high |

**Difficulty bands.**
- **NB:** Nybegynner, Lett, Middels, Lur, Vanskelig, Urettferdig, Ekstrem, Mareritt. Lett, Middels and Vanskelig are attested by kryssordet.no; the rest are coined.\[20\]
- **ES:** Principiante, Fácil, Medio, Engañoso, Difícil, Injusto, Extremo, Pesadilla.

**UI labels.**
| EN | NB | ES |
|---|---|---|
| Auto | Auto | Auto |
| Check | Sjekk | Comprobar (LatAm: Verificar) |
| Steps | Steg | Pasos |
| Hint | Hint | Pista |
| Corner | Hjørne | Esquina |
| Centre | Midt | Centro |

## 5. Final glossary (structured data)

YAML. `see` lists entry ids and is shared by all three languages. Render cross-references with the prefix "See" / "Se" / "Véase".

```yaml
- id: cell
  category: grid
  sudokui_specific: false
  see: [given, cell-name, peer]
  en: {term: cell, aliases: [square], definition: "One of the 81 squares of the grid. It holds a given, a digit you have placed, or pencil marks while it is unsolved."}
  nb: {term: rute, aliases: [celle], definition: "En av de 81 rutene i rutenettet. Den inneholder et gitt tall, et tall du har plassert, eller notater så lenge den er uløst."}
  es: {term: casilla, aliases: [celda], definition: "Una de las 81 casillas de la cuadrícula. Contiene un número dado, un número que has colocado o anotaciones mientras no está resuelta."}
- id: row
  category: grid
  sudokui_specific: false
  see: [column, line, unit]
  en: {term: row, aliases: [], definition: "A horizontal line of nine cells. Each digit from 1 to 9 appears exactly once in every row."}
  nb: {term: rad, aliases: [], definition: "En vannrett linje med ni ruter. Hvert tall fra 1 til 9 forekommer nøyaktig én gang i hver rad."}
  es: {term: fila, aliases: [], definition: "Una línea horizontal de nueve casillas. Cada número del 1 al 9 aparece exactamente una vez en cada fila."}
- id: column
  category: grid
  sudokui_specific: false
  see: [row, line, unit]
  en: {term: column, aliases: [], definition: "A vertical line of nine cells. Each digit from 1 to 9 appears exactly once in every column."}
  nb: {term: kolonne, aliases: [], definition: "En loddrett linje med ni ruter. Hvert tall fra 1 til 9 forekommer nøyaktig én gang i hver kolonne."}
  es: {term: columna, aliases: [], definition: "Una línea vertical de nueve casillas. Cada número del 1 al 9 aparece exactamente una vez en cada columna."}
- id: box
  category: grid
  sudokui_specific: false
  see: [unit, band, stack]
  en: {term: box, aliases: [block, region, nonet], definition: "One of the nine squares of three by three cells marked by thick lines. Each digit from 1 to 9 appears exactly once in every box. Boxes are numbered 1 to 9 from the top left, row by row."}
  nb: {term: boks, aliases: [3×3-boks, blokk], definition: "Et av de ni feltene på tre ganger tre ruter som er avgrenset med tykke streker. Hvert tall fra 1 til 9 forekommer nøyaktig én gang i hver boks. Boksene nummereres 1 til 9 fra øverst til venstre, rad for rad."}
  es: {term: caja, aliases: [región, bloque, subcuadrícula], definition: "Uno de los nueve cuadrados de tres por tres casillas delimitados por líneas gruesas. Cada número del 1 al 9 aparece exactamente una vez en cada caja. Las cajas se numeran del 1 al 9 desde arriba a la izquierda, fila por fila."}
- id: unit
  category: grid
  sudokui_specific: false
  see: [row, column, box, peer]
  en: {term: unit, aliases: [house], definition: "A row, a column or a box: any group of nine cells that must contain each digit from 1 to 9 exactly once. The grid has 27 units."}
  nb: {term: enhet, aliases: [hus, gruppe], definition: "En rad, en kolonne eller en boks, altså en gruppe på ni ruter som må inneholde hvert tall fra 1 til 9 nøyaktig én gang. Rutenettet har 27 enheter."}
  es: {term: unidad, aliases: [casa, grupo], definition: "Una fila, una columna o una caja, es decir, un grupo de nueve casillas que debe contener cada número del 1 al 9 exactamente una vez. La cuadrícula tiene 27 unidades."}
- id: line
  category: grid
  sudokui_specific: false
  see: [row, column, unit]
  en: {term: line, aliases: [], definition: "A row or a column. The word is used when a rule works the same way in both directions."}
  nb: {term: linje, aliases: [], definition: "En rad eller en kolonne. Ordet brukes når en regel virker likt i begge retninger."}
  es: {term: línea, aliases: [], definition: "Una fila o una columna. Se usa cuando una regla funciona igual en ambas direcciones."}
- id: band
  category: grid
  sudokui_specific: false
  see: [stack, chute, difficulty-band]
  en: {term: band, aliases: [floor], definition: "Three boxes side by side, covering three neighbouring rows. The grid has three bands: top, middle and bottom. Not to be confused with a difficulty band."}
  nb: {term: bånd, aliases: [etasje], definition: "Tre bokser side om side som dekker tre naborader. Rutenettet har tre bånd: øverst, i midten og nederst. Må ikke forveksles med vanskelighetsgrad."}
  es: {term: banda, aliases: [piso], definition: "Tres cajas una al lado de otra que cubren tres filas contiguas. La cuadrícula tiene tres bandas: superior, central e inferior. No debe confundirse con el nivel de dificultad."}
- id: stack
  category: grid
  sudokui_specific: false
  see: [band, chute]
  en: {term: stack, aliases: [tower], definition: "Three boxes on top of each other, covering three neighbouring columns. The grid has three stacks: left, middle and right."}
  nb: {term: stabel, aliases: [tårn], definition: "Tre bokser over hverandre som dekker tre nabokolonner. Rutenettet har tre stabler: venstre, midtre og høyre."}
  es: {term: pila, aliases: [torre], definition: "Tres cajas una encima de otra que cubren tres columnas contiguas. La cuadrícula tiene tres pilas: izquierda, central y derecha."}
- id: chute
  category: grid
  sudokui_specific: false
  see: [band, stack, box]
  en: {term: chute, aliases: [], definition: "A band or a stack: three boxes in a line, together with the three rows or columns that run through them."}
  nb: {term: boksrekke, aliases: [chute], definition: "Et bånd eller en stabel, altså tre bokser på rad sammen med de tre radene eller kolonnene som går gjennom dem."}
  es: {term: franja, aliases: [chute], definition: "Una banda o una pila, es decir, tres cajas en línea junto con las tres filas o columnas que las atraviesan."}
- id: intersection
  category: grid
  sudokui_specific: false
  see: [locked-candidates, pointing, claiming, grouped-node]
  en: {term: intersection, aliases: [mini-line, minirow, minicolumn, box-line intersection], definition: "The three cells that a box shares with a row or column crossing it. Locked candidates work on intersections, and a grouped node lies inside one."}
  nb: {term: skjæring, aliases: [minilinje], definition: "De tre rutene som en boks har felles med en rad eller kolonne som krysser den. Låste kandidater virker på skjæringer, og en gruppenode ligger inne i én."}
  es: {term: intersección, aliases: [minilínea, minifila, minicolumna], definition: "Las tres casillas que una caja comparte con una fila o columna que la cruza. Los candidatos bloqueados actúan sobre intersecciones, y un nodo agrupado está dentro de una."}
- id: peer
  category: grid
  sudokui_specific: false
  see: [sees, unit]
  en: {term: peer, aliases: [buddy], definition: "A cell that shares a row, column or box with another cell. Every cell has 20 peers, and no peer can hold the same digit as the cell itself."}
  nb: {term: nabo, aliases: [partner], definition: "En rute som deler rad, kolonne eller boks med en annen rute. Hver rute har 20 naboer, og ingen nabo kan ha samme tall som ruten selv."}
  es: {term: vecina, aliases: [compañera], definition: "Una casilla que comparte fila, columna o caja con otra. Cada casilla tiene 20 vecinas, y ninguna puede contener el mismo número que ella."}
- id: sees
  category: grid
  sudokui_specific: false
  see: [peer, unit, weak-link]
  en: {term: sees, aliases: [], definition: "Two cells see each other when they share a row, column or box, so they cannot hold the same digit. Two candidates for the same digit see each other when their cells do."}
  nb: {term: ser, aliases: [], definition: "To ruter ser hverandre når de deler rad, kolonne eller boks, og da kan de ikke ha samme tall. To kandidater for samme tall ser hverandre når rutene deres gjør det."}
  es: {term: ve, aliases: [se ven], definition: "Dos casillas se ven cuando comparten fila, columna o caja, así que no pueden contener el mismo número. Dos candidatos del mismo número se ven cuando sus casillas se ven."}
- id: digit
  category: grid
  sudokui_specific: false
  see: [cell, candidate]
  en: {term: digit, aliases: [number, value], definition: "One of the nine symbols 1 to 9. Digits are labels, not quantities, so no arithmetic is involved."}
  nb: {term: tall, aliases: [siffer, verdi], definition: "Ett av de ni symbolene 1 til 9. Tallene er merkelapper, ikke mengder, så det er ingen regning involvert."}
  es: {term: número, aliases: [dígito, cifra, valor], definition: "Uno de los nueve símbolos del 1 al 9. Son etiquetas, no cantidades, así que no hay que hacer cálculos."}
- id: given
  category: grid
  sudokui_specific: false
  see: [cell, unique-solution]
  en: {term: given, aliases: [clue], definition: "A digit printed in the puzzle from the start. Givens are always correct and cannot be changed."}
  nb: {term: gitt tall, aliases: [ledetråd, forhåndsutfylt tall], definition: "Et tall som står i oppgaven fra starten. Gitte tall er alltid riktige og kan ikke endres."}
  es: {term: número dado, aliases: [pista], definition: "Un número impreso en el sudoku desde el principio. Los números dados siempre son correctos y no se pueden cambiar."}
- id: solution
  category: grid
  sudokui_specific: false
  see: [unique-solution, proper-puzzle]
  en: {term: solution, aliases: [], definition: "A completely filled grid that keeps every given and obeys the rule in all 27 units."}
  nb: {term: løsning, aliases: [], definition: "Et helt utfylt rutenett som beholder alle gitte tall og følger regelen i alle 27 enheter."}
  es: {term: solución, aliases: [], definition: "Una cuadrícula completamente rellena que conserva todos los números dados y cumple la regla en las 27 unidades."}
- id: proper-puzzle
  category: grid
  sudokui_specific: false
  see: [unique-solution, uniqueness]
  en: {term: proper puzzle, aliases: [valid puzzle], definition: "A puzzle with exactly one solution. Uniqueness techniques are valid only for proper puzzles."}
  nb: {term: gyldig oppgave, aliases: [], definition: "En oppgave med nøyaktig én løsning. Entydighetsteknikker er bare gyldige for gyldige oppgaver."}
  es: {term: sudoku válido, aliases: [sudoku bien planteado], definition: "Un sudoku con exactamente una solución. Las técnicas de unicidad solo son válidas en sudokus válidos."}
- id: contradiction
  category: logic
  sudokui_specific: false
  see: [forcing-chain, nishio, brute-force]
  en: {term: contradiction, aliases: [conflict], definition: "A state that breaks the rules: a cell with no candidates, a digit with no place in a unit, or the same digit twice in a unit. An assumption that leads to one is false."}
  nb: {term: motsigelse, aliases: [konflikt], definition: "En tilstand som bryter reglene: en rute uten kandidater, et tall uten plass i en enhet, eller samme tall to ganger i en enhet. En antakelse som fører til en motsigelse, er usann."}
  es: {term: contradicción, aliases: [conflicto], definition: "Un estado que rompe las reglas: una casilla sin candidatos, un número sin sitio en una unidad o el mismo número dos veces en una unidad. Una suposición que lleva a una contradicción es falsa."}
- id: pencil-mark
  category: notation
  sudokui_specific: false
  see: [candidate, corner-mark, centre-mark, snyder-notation, pencil-mark-grid]
  en: {term: pencil mark, aliases: [note, pencilmark], definition: "A small digit written in a cell as a note, usually to record a candidate. sudokUI has two positions for pencil marks, corner and centre."}
  nb: {term: notat, aliases: [blyantnotat], definition: "Et lite tall som skrives i en rute som et notat, vanligvis for å merke en kandidat. sudokUI har to plasseringer for notater, hjørne og midt."}
  es: {term: anotación, aliases: [nota, marca de lápiz], definition: "Un número pequeño escrito en una casilla como nota, normalmente para registrar un candidato. sudokUI tiene dos posiciones para las anotaciones, esquina y centro."}
- id: pencil-mark-grid
  category: notation
  sudokui_specific: false
  see: [pencil-mark, auto-candidates]
  en: {term: pencil mark grid, aliases: [PM], definition: "The grid with every candidate of every unsolved cell written in. Most techniques beyond singles are read from it."}
  nb: {term: kandidatrutenett, aliases: [PM], definition: "Rutenettet med alle kandidater i alle uløste ruter skrevet inn. De fleste teknikker utover singler leses ut fra det."}
  es: {term: cuadrícula de candidatos, aliases: [PM], definition: "La cuadrícula con todos los candidatos de todas las casillas sin resolver anotados. La mayoría de las técnicas más allá de los únicos se leen en ella."}
- id: corner-mark
  category: app
  sudokui_specific: true
  see: [pencil-mark, centre-mark, snyder-notation]
  en: {term: corner mark, aliases: [corner pencil mark], definition: "A pencil mark drawn at its digit's fixed spot in a three by three layout, or round the cell's edge when centre marks share the cell. Corner is a position, not a meaning, though Snyder notation usually goes there."}
  nb: {term: hjørnenotat, aliases: [hjørne], definition: "Et notat som tegnes på tallets faste plass i et tre ganger tre-mønster, eller langs kanten av ruten når den også har midtnotater. Hjørne er en plassering, ikke en betydning, selv om Snyder-notasjon vanligvis står der."}
  es: {term: nota de esquina, aliases: [esquina], definition: "Una anotación dibujada en la posición fija de su número en una disposición de tres por tres, o alrededor del borde de la casilla cuando esta también tiene notas centrales. Esquina es una posición, no un significado, aunque la notación Snyder suele ir ahí."}
- id: centre-mark
  category: app
  sudokui_specific: true
  see: [pencil-mark, corner-mark, candidate, auto-candidates]
  en: {term: centre mark, aliases: [centre pencil mark, center mark], definition: "A pencil mark written in the middle of the cell, the usual place for a full list of candidates. Hints read both positions alike, but Auto and Check treat centre marks as the cell's remaining candidates."}
  nb: {term: midtnotat, aliases: [midt], definition: "Et notat som skrives midt i ruten, det vanlige stedet for en fullstendig kandidatliste. Hint leser begge plasseringene likt, men Auto og Sjekk behandler midtnotater som rutens gjenværende kandidater."}
  es: {term: nota central, aliases: [centro], definition: "Una anotación escrita en el centro de la casilla, el lugar habitual para la lista completa de candidatos. Las pistas leen ambas posiciones igual, pero Auto y Comprobar tratan las notas centrales como los candidatos que le quedan a la casilla."}
- id: snyder-notation
  category: notation
  sudokui_specific: false
  see: [pencil-mark, corner-mark, box]
  en: {term: Snyder notation, aliases: [Snyder marks], definition: "A marking method named after Thomas Snyder: in each box, a digit is marked only if it has exactly two possible places there, though some solvers also mark three. The marks are partial, so a missing mark does not mean the digit is eliminated."}
  nb: {term: Snyder-notasjon, aliases: [], definition: "En merkemetode oppkalt etter Thomas Snyder: i hver boks merkes et tall bare hvis det har nøyaktig to mulige plasser der, selv om noen også merker tre. Merkingen er ufullstendig, så et manglende merke betyr ikke at tallet er eliminert."}
  es: {term: notación Snyder, aliases: [], definition: "Un método de anotación que debe su nombre a Thomas Snyder: en cada caja solo se anota un número si tiene exactamente dos posiciones posibles, aunque algunos también anotan tres. Las marcas son parciales, así que la falta de una marca no significa que el número esté eliminado."}
- id: auto-candidates
  category: app
  sudokui_specific: true
  see: [candidate, pencil-mark, centre-mark]
  en: {term: auto candidates, aliases: [Auto], definition: "A sudokUI tool, switched on with the Auto button, that works out the candidates of every unsolved cell and keeps them up to date. New games start with it off, except practice puzzles that jump to the technique."}
  nb: {term: autokandidater, aliases: [Auto], definition: "Et verktøy i sudokUI, som slås på med Auto-knappen, som regner ut kandidatene i alle uløste ruter og holder dem oppdatert. Nye spill starter med det av, unntatt øvingsoppgaver som hopper rett til teknikken."}
  es: {term: candidatos automáticos, aliases: [Auto], definition: "Una herramienta de sudokUI, que se activa con el botón Auto, que calcula los candidatos de cada casilla sin resolver y los mantiene al día. Las partidas nuevas empiezan con ella desactivada, salvo los sudokus de práctica que saltan directamente a la técnica."}
- id: check
  category: app
  sudokui_specific: true
  see: [centre-mark, solution]
  en: {term: Check, aliases: [], definition: "A sudokUI button that compares your placed digits, and your centre marks, with the solution and shows any mistakes."}
  nb: {term: Sjekk, aliases: [Kontroller], definition: "En knapp i sudokUI som sammenligner tallene du har plassert, og midtnotatene dine, med løsningen og viser eventuelle feil."}
  es: {term: Comprobar, aliases: [Verificar], definition: "Un botón de sudokUI que compara los números que has colocado, y tus notas centrales, con la solución y muestra los errores."}
- id: steps
  category: app
  sudokui_specific: true
  see: [solve-path, crux]
  en: {term: Steps, aliases: [], definition: "The sudokUI list that shows the solve path one step at a time, with the crux highlighted."}
  nb: {term: Steg, aliases: [], definition: "Listen i sudokUI som viser løsningsstien ett steg om gangen, med nøkkeltrinnet uthevet."}
  es: {term: Pasos, aliases: [], definition: "La lista de sudokUI que muestra la ruta de resolución paso a paso, con el paso clave resaltado."}
- id: cell-name
  category: notation
  sudokui_specific: false
  see: [cell, row, column]
  en: {term: cell name, aliases: [r1c1 notation], definition: "The address of a cell, written as its row and column numbers counted from the top left: r3c5 is the cell in row 3, column 5. Several cells can be combined, so r57c2 means r5c2 and r7c2. sudokUI hints name cells this way."}
  nb: {term: rutenavn, aliases: [r1c1-notasjon], definition: "Adressen til en rute, skrevet som rad- og kolonnenummer talt fra øverst til venstre: r3c5 er ruten i rad 3, kolonne 5. Flere ruter kan slås sammen, så r57c2 betyr r5c2 og r7c2. Hint i sudokUI navngir ruter slik."}
  es: {term: nombre de casilla, aliases: [notación r1c1], definition: "La dirección de una casilla, escrita con sus números de fila y columna contados desde arriba a la izquierda: r3c5 es la casilla de la fila 3, columna 5. Se pueden combinar varias, así que r57c2 significa r5c2 y r7c2. Las pistas de sudokUI nombran así las casillas."}
- id: candidate
  category: logic
  sudokui_specific: false
  see: [pencil-mark, elimination, peer, auto-candidates]
  en: {term: candidate, aliases: [possibility], definition: "A digit that is still possible in an unsolved cell: no peer of the cell holds it, and no logic has ruled it out. Solving removes candidates until every cell has one left."}
  nb: {term: kandidat, aliases: [mulighet], definition: "Et tall som fortsatt er mulig i en uløst rute: ingen nabo har det, og ingen logikk har utelukket det. Løsningen fjerner kandidater til hver rute har én igjen."}
  es: {term: candidato, aliases: [posibilidad], definition: "Un número que todavía es posible en una casilla sin resolver: ninguna vecina lo contiene y ninguna lógica lo ha descartado. Resolver consiste en eliminar candidatos hasta que a cada casilla le quede uno."}
- id: placement
  category: logic
  sudokui_specific: false
  see: [elimination, single]
  en: {term: placement, aliases: [], definition: "Writing a digit into a cell as its final value. A hint that ends in a placement has proved that the digit must go there."}
  nb: {term: plassering, aliases: [], definition: "Å skrive et tall inn i en rute som dens endelige verdi. Et hint som ender i en plassering, har bevist at tallet må stå der."}
  es: {term: colocación, aliases: [], definition: "Escribir un número en una casilla como su valor definitivo. Una pista que termina en una colocación ha demostrado que el número debe ir ahí."}
- id: elimination
  category: logic
  sudokui_specific: false
  see: [candidate, placement, technique]
  en: {term: elimination, aliases: [exclusion], definition: "Removing a candidate from a cell because logic proves the digit cannot go there. Most advanced techniques end in eliminations, not placements."}
  nb: {term: eliminering, aliases: [utelukkelse], definition: "Å fjerne en kandidat fra en rute fordi logikken beviser at tallet ikke kan stå der. De fleste avanserte teknikker ender i elimineringer, ikke plasseringer."}
  es: {term: eliminación, aliases: [descarte], definition: "Quitar un candidato de una casilla porque la lógica demuestra que el número no puede ir ahí. La mayoría de las técnicas avanzadas terminan en eliminaciones, no en colocaciones."}
- id: single
  category: technique
  sudokui_specific: false
  see: [naked, hidden, full-house, placement]
  en: {term: single, aliases: [], definition: "A placement forced because only one possibility is left: a cell with one candidate (naked single) or a digit with one possible cell in a unit (hidden single)."}
  nb: {term: singel, aliases: [], definition: "En plassering som er tvunget fordi bare én mulighet er igjen: en rute med én kandidat (naken singel) eller et tall med én mulig rute i en enhet (skjult singel)."}
  es: {term: único, aliases: [single], definition: "Una colocación forzada porque solo queda una posibilidad: una casilla con un candidato (único desnudo) o un número con una sola casilla posible en una unidad (único oculto)."}
- id: full-house
  category: technique
  sudokui_specific: false
  see: [single, unit]
  en: {term: full house, aliases: [last digit], definition: "A unit with only one empty cell left, which must take the one digit the unit is missing. It is the simplest kind of single; strictly, last digit means the last empty cell of the whole grid."}
  nb: {term: full house, aliases: [siste tall], definition: "En enhet med bare én tom rute igjen, som må få det ene tallet enheten mangler. Det er den enkleste typen singel; strengt tatt betyr siste tall den siste tomme ruten i hele rutenettet."}
  es: {term: full house, aliases: [último número], definition: "Una unidad con una sola casilla vacía, que debe llevar el único número que le falta. Es el tipo de único más sencillo; en sentido estricto, último número es la última casilla vacía de toda la cuadrícula."}
- id: naked
  category: technique
  sudokui_specific: false
  see: [hidden, single, subset, locked-set]
  en: {term: naked, aliases: [], definition: "Describes a pattern found in the cells: N cells of one unit hold only N candidates between them. A naked single is a cell with one candidate; a naked pair removes its two digits from the unit's other cells."}
  nb: {term: naken, aliases: [nakne], definition: "Beskriver et mønster i rutene: N ruter i én enhet har til sammen bare N kandidater. En naken singel er en rute med én kandidat; et naket par fjerner sine to tall fra enhetens andre ruter."}
  es: {term: desnudo, aliases: [], definition: "Describe un patrón en las casillas: N casillas de una unidad tienen entre todas solo N candidatos. Un único desnudo es una casilla con un candidato; un par desnudo elimina sus dos números de las demás casillas de la unidad."}
- id: hidden
  category: technique
  sudokui_specific: false
  see: [naked, single, subset]
  en: {term: hidden, aliases: [], definition: "Describes a pattern found in the digits: N digits of one unit have only N cells to go in. A hidden single is a digit with one possible cell; a hidden pair removes all other candidates from its two cells."}
  nb: {term: skjult, aliases: [skjulte], definition: "Beskriver et mønster i tallene: N tall i én enhet har bare N ruter å stå i. En skjult singel er et tall med én mulig rute; et skjult par fjerner alle andre kandidater fra sine to ruter."}
  es: {term: oculto, aliases: [], definition: "Describe un patrón en los números: N números de una unidad solo tienen N casillas donde ir. Un único oculto es un número con una sola casilla posible; un par oculto elimina todos los demás candidatos de sus dos casillas."}
- id: subset
  category: technique
  sudokui_specific: false
  see: [naked, hidden, locked-set]
  en: {term: subset, aliases: [pair, triple, quadruple, quad], definition: "N cells of one unit that must hold N digits between them, found as a naked or a hidden pattern. Sizes two, three and four are called pair, triple and quadruple."}
  nb: {term: delmengde, aliases: [par, trippel, kvartett], definition: "N ruter i én enhet som til sammen må inneholde N tall, funnet som et naket eller et skjult mønster. Størrelsene to, tre og fire kalles par, trippel og kvartett."}
  es: {term: subconjunto, aliases: [par, pareja, trío, cuarteto], definition: "N casillas de una unidad que deben contener entre ellas N números, encontradas como patrón desnudo u oculto. Los tamaños dos, tres y cuatro se llaman par, trío y cuarteto."}
- id: locked-set
  category: technique
  sudokui_specific: false
  see: [subset, naked, almost-locked-set]
  en: {term: locked set, aliases: [naked subset], definition: "N unsolved cells in one unit that hold exactly N candidates between them. Those digits must fill those cells, so they are removed from every other cell of the unit. HoDoKu's Locked Pair and Locked Triple are the special case that also lies in one intersection."}
  nb: {term: låst mengde, aliases: [naken delmengde], definition: "N uløste ruter i én enhet som til sammen har nøyaktig N kandidater. Disse tallene må fylle disse rutene, så de fjernes fra alle andre ruter i enheten. HoDoKus Locked Pair og Locked Triple er spesialtilfellet som også ligger i én skjæring."}
  es: {term: conjunto bloqueado, aliases: [subconjunto desnudo], definition: "N casillas sin resolver de una unidad que tienen entre ellas exactamente N candidatos. Esos números deben ocupar esas casillas, así que se eliminan de todas las demás casillas de la unidad. Los Locked Pair y Locked Triple de HoDoKu son el caso particular que además está en una intersección."}
- id: locked-candidates
  category: technique
  sudokui_specific: false
  see: [intersection, pointing, claiming]
  en: {term: locked candidates, aliases: [intersection removal], definition: "A digit whose possible cells in one unit all lie inside its intersection with a second unit. The digit must go in the intersection, so it is removed from the rest of the second unit."}
  nb: {term: låste kandidater, aliases: [], definition: "Et tall der alle de mulige rutene i én enhet ligger i skjæringen med en annen enhet. Tallet må stå i skjæringen, så det fjernes fra resten av den andre enheten."}
  es: {term: candidatos bloqueados, aliases: [reducción por intersección], definition: "Un número cuyas casillas posibles en una unidad están todas dentro de su intersección con otra unidad. El número debe ir en la intersección, así que se elimina del resto de la segunda unidad."}
- id: pointing
  category: technique
  sudokui_specific: false
  see: [locked-candidates, claiming, intersection]
  en: {term: pointing, aliases: [locked candidates type 1, pointing pair, pointing triple], definition: "Locked candidates starting from a box: every place for a digit in the box lies in one row or column, so the digit is removed from the rest of that row or column."}
  nb: {term: pekende, aliases: [pekende par, pekende trippel], definition: "Låste kandidater sett fra en boks: alle plassene for et tall i boksen ligger i én rad eller kolonne, så tallet fjernes fra resten av den raden eller kolonnen."}
  es: {term: puntero, aliases: [par puntero, trío puntero], definition: "Candidatos bloqueados vistos desde una caja: todas las posiciones de un número en la caja están en una fila o columna, así que el número se elimina del resto de esa fila o columna."}
- id: claiming
  category: technique
  sudokui_specific: false
  see: [locked-candidates, pointing, intersection]
  en: {term: claiming, aliases: [locked candidates type 2, box-line reduction], definition: "Locked candidates starting from a line: every place for a digit in a row or column lies in one box, so the digit is removed from the rest of that box."}
  nb: {term: hevdende, aliases: [boks-linje-reduksjon], definition: "Låste kandidater sett fra en linje: alle plassene for et tall i en rad eller kolonne ligger i én boks, så tallet fjernes fra resten av den boksen."}
  es: {term: reclamante, aliases: [reducción caja-línea], definition: "Candidatos bloqueados vistos desde una línea: todas las posiciones de un número en una fila o columna están en una caja, así que el número se elimina del resto de esa caja."}
- id: bivalue-cell
  category: logic
  sudokui_specific: false
  see: [strong-link, weak-link, conjugate-pair, bug]
  en: {term: bivalue cell, aliases: [bi-value cell], definition: "An unsolved cell with exactly two candidates. Exactly one of them is true, so the two are joined by a strong link and a weak link at once."}
  nb: {term: toverdirute, aliases: [], definition: "En uløst rute med nøyaktig to kandidater. Nøyaktig én av dem er sann, så de to er forbundet med både en sterk og en svak lenke."}
  es: {term: casilla bivalor, aliases: [], definition: "Una casilla sin resolver con exactamente dos candidatos. Exactamente uno es verdadero, así que los dos están unidos a la vez por un enlace fuerte y un enlace débil."}
- id: conjugate-pair
  category: logic
  sudokui_specific: false
  see: [bilocation, strong-link, weak-link, colouring]
  en: {term: conjugate pair, aliases: [], definition: "The only two candidates for a digit in a unit. Exactly one is true: if one is false the other is true (strong link), and if one is true the other is false (weak link)."}
  nb: {term: konjugert par, aliases: [], definition: "De to eneste kandidatene for et tall i en enhet. Nøyaktig én er sann: er den ene usann, er den andre sann (sterk lenke), og er den ene sann, er den andre usann (svak lenke)."}
  es: {term: par conjugado, aliases: [], definition: "Los dos únicos candidatos de un número en una unidad. Exactamente uno es verdadero: si uno es falso, el otro es verdadero (enlace fuerte), y si uno es verdadero, el otro es falso (enlace débil)."}
- id: bilocation
  category: logic
  sudokui_specific: false
  see: [conjugate-pair, bivalue-cell, strong-link]
  en: {term: bilocation, aliases: [], definition: "A digit that has exactly two possible cells left in a unit. Those two candidates form a conjugate pair."}
  nb: {term: toplassering, aliases: [bilokasjon], definition: "Et tall som har nøyaktig to mulige ruter igjen i en enhet. De to kandidatene danner et konjugert par."}
  es: {term: bilocación, aliases: [], definition: "Un número al que le quedan exactamente dos casillas posibles en una unidad. Esos dos candidatos forman un par conjugado."}
- id: link
  category: logic
  sudokui_specific: false
  see: [strong-link, weak-link, inference, chain]
  en: {term: link, aliases: [], definition: "A logical relation between two candidates, or between nodes, that a chain can use. Links are strong or weak, and a strong link can also be used as a weak one."}
  nb: {term: lenke, aliases: [kobling], definition: "En logisk forbindelse mellom to kandidater, eller mellom noder, som en kjede kan bruke. Lenker er sterke eller svake, og en sterk lenke kan også brukes som en svak."}
  es: {term: enlace, aliases: [vínculo], definition: "Una relación lógica entre dos candidatos, o entre nodos, que una cadena puede usar. Los enlaces son fuertes o débiles, y un enlace fuerte también puede usarse como débil."}
- id: strong-link
  category: logic
  sudokui_specific: false
  see: [weak-link, conjugate-pair, bivalue-cell, inference]
  en: {term: strong link, aliases: [strong inference], definition: "A link between candidates A and B meaning that if A is false then B is true, so at least one of them is true. Conjugate pairs and bivalue cells give strong links."}
  nb: {term: sterk lenke, aliases: [sterk slutning], definition: "En lenke mellom kandidatene A og B som betyr at hvis A er usann, er B sann, så minst én av dem er sann. Konjugerte par og toverdiruter gir sterke lenker."}
  es: {term: enlace fuerte, aliases: [inferencia fuerte], definition: "Un enlace entre los candidatos A y B que significa que si A es falso, B es verdadero, así que al menos uno de los dos es verdadero. Los pares conjugados y las casillas bivalor dan enlaces fuertes."}
- id: weak-link
  category: logic
  sudokui_specific: false
  see: [strong-link, sees, inference]
  en: {term: weak link, aliases: [weak inference], definition: "A link between candidates A and B meaning that if A is true then B is false, so at most one of them is true. Two candidates in one cell, or for one digit in one unit, are weakly linked."}
  nb: {term: svak lenke, aliases: [svak slutning], definition: "En lenke mellom kandidatene A og B som betyr at hvis A er sann, er B usann, så høyst én av dem er sann. To kandidater i samme rute, eller for samme tall i samme enhet, er svakt lenket."}
  es: {term: enlace débil, aliases: [inferencia débil], definition: "Un enlace entre los candidatos A y B que significa que si A es verdadero, B es falso, así que como mucho uno de los dos es verdadero. Dos candidatos de una misma casilla, o de un mismo número en una misma unidad, están enlazados débilmente."}
- id: inference
  category: logic
  sudokui_specific: false
  see: [strong-link, weak-link, chain, link]
  en: {term: inference, aliases: [], definition: "One step of reasoning from one candidate to the next. A strong inference says that if this is false, that is true; a weak inference says that if this is true, that is false."}
  nb: {term: slutning, aliases: [inferens], definition: "Ett resonnementsteg fra én kandidat til den neste. En sterk slutning sier at hvis dette er usant, er det andre sant; en svak slutning sier at hvis dette er sant, er det andre usant."}
  es: {term: inferencia, aliases: [], definition: "Un paso de razonamiento de un candidato al siguiente. Una inferencia fuerte dice que si esto es falso, aquello es verdadero; una inferencia débil dice que si esto es verdadero, aquello es falso."}
- id: chain
  category: logic
  sudokui_specific: false
  see: [node, inference, aic, nice-loop]
  en: {term: chain, aliases: [], definition: "A sequence of nodes joined by links, each inference feeding the next, so that one state of the first node forces a state of the last."}
  nb: {term: kjede, aliases: [], definition: "En rekke noder forbundet med lenker, der hver slutning fører videre til den neste, slik at én tilstand i den første noden tvinger fram en tilstand i den siste."}
  es: {term: cadena, aliases: [], definition: "Una sucesión de nodos unidos por enlaces, donde cada inferencia lleva a la siguiente, de modo que un estado del primer nodo fuerza un estado del último."}
- id: node
  category: logic
  sudokui_specific: false
  see: [chain, grouped-node, almost-locked-set]
  en: {term: node, aliases: [], definition: "One element of a chain. It is usually a single candidate, meaning one digit in one cell, but it can also be a grouped node or an almost locked set."}
  nb: {term: node, aliases: [], definition: "Ett ledd i en kjede. Vanligvis er det én kandidat, altså ett tall i én rute, men det kan også være en gruppenode eller en nesten låst mengde."}
  es: {term: nodo, aliases: [], definition: "Un elemento de una cadena. Normalmente es un solo candidato, es decir, un número en una casilla, pero también puede ser un nodo agrupado o un conjunto casi bloqueado."}
- id: aic
  category: technique
  sudokui_specific: false
  see: [chain, strong-link, weak-link, nice-loop, grouped-node]
  en: {term: alternating inference chain, aliases: [AIC], definition: "A chain whose links alternate strong and weak, beginning and ending with a strong link. At least one of its two end nodes is true, so any candidate that is weakly linked to both ends is eliminated."}
  nb: {term: AIC, aliases: [vekslende slutningskjede], definition: "En kjede der lenkene veksler mellom sterke og svake, og som begynner og slutter med en sterk lenke. Minst én av de to endenodene er sann, så enhver kandidat som er svakt lenket til begge endene, elimineres."}
  es: {term: AIC, aliases: [cadena de inferencias alternas], definition: "Una cadena cuyos enlaces alternan entre fuertes y débiles, y que empieza y termina con un enlace fuerte. Al menos uno de sus dos nodos extremos es verdadero, así que se elimina cualquier candidato enlazado débilmente con ambos extremos."}
- id: grouped-node
  category: logic
  sudokui_specific: false
  see: [node, intersection, aic]
  en: {term: grouped node, aliases: [group node], definition: "A node made of the two or three candidates for one digit inside one intersection. It counts as true when any one of its cells holds the digit."}
  nb: {term: gruppenode, aliases: [], definition: "En node som består av de to eller tre kandidatene for ett tall i én skjæring. Den regnes som sann når en hvilken som helst av rutene har tallet."}
  es: {term: nodo agrupado, aliases: [], definition: "Un nodo formado por los dos o tres candidatos de un número dentro de una intersección. Cuenta como verdadero cuando cualquiera de sus casillas contiene el número."}
- id: nice-loop
  category: technique
  sudokui_specific: false
  see: [continuous-loop, discontinuous-loop, x-cycle, aic]
  en: {term: nice loop, aliases: [loop], definition: "A chain of alternating strong and weak links that closes into a loop by returning to where it started. It is continuous if the alternation holds all the way round, and discontinuous if it breaks at one node."}
  nb: {term: nice loop, aliases: [sløyfe], definition: "En kjede av vekslende sterke og svake lenker som lukker seg til en sløyfe ved å vende tilbake til utgangspunktet. Den er kontinuerlig hvis vekslingen holder hele veien rundt, og diskontinuerlig hvis den brytes i én node."}
  es: {term: nice loop, aliases: [bucle], definition: "Una cadena de enlaces fuertes y débiles alternos que se cierra en un bucle al volver a su punto de partida. Es continuo si la alternancia se mantiene en toda la vuelta, y discontinuo si se rompe en un nodo."}
- id: continuous-loop
  category: technique
  sudokui_specific: false
  see: [nice-loop, discontinuous-loop, weak-link]
  en: {term: continuous loop, aliases: [continuous nice loop, AIC loop], definition: "A nice loop whose links alternate without a break. Every link in it, strong or weak, then has exactly one true end, so any other candidate that is weakly linked to both ends of any of its links is eliminated."}
  nb: {term: kontinuerlig sløyfe, aliases: [], definition: "En nice loop der lenkene veksler uten brudd. Da har hver lenke i den, sterk eller svak, nøyaktig én sann ende, så enhver annen kandidat som er svakt lenket til begge endene av en av lenkene, elimineres."}
  es: {term: bucle continuo, aliases: [], definition: "Un nice loop cuyos enlaces alternan sin interrupción. Entonces cada enlace, fuerte o débil, tiene exactamente un extremo verdadero, así que se elimina cualquier otro candidato enlazado débilmente con ambos extremos de cualquiera de sus enlaces."}
- id: discontinuous-loop
  category: technique
  sudokui_specific: false
  see: [nice-loop, continuous-loop, strong-link, weak-link]
  en: {term: discontinuous loop, aliases: [discontinuous nice loop], definition: "A nice loop whose alternation breaks at one node. Two strong links meeting there prove that candidate true, and two weak links meeting there prove it false. When a strong link on one digit and a weak link on another meet in one cell, the digit of the weak link is false there."}
  nb: {term: diskontinuerlig sløyfe, aliases: [], definition: "En nice loop der vekslingen brytes i én node. To sterke lenker som møtes der, beviser at kandidaten er sann, og to svake lenker beviser at den er usann. Når en sterk lenke på ett tall og en svak lenke på et annet møtes i én rute, er tallet på den svake lenken usant der."}
  es: {term: bucle discontinuo, aliases: [], definition: "Un nice loop cuya alternancia se rompe en un nodo. Dos enlaces fuertes que se encuentran ahí demuestran que ese candidato es verdadero, y dos enlaces débiles demuestran que es falso. Cuando un enlace fuerte de un número y uno débil de otro se encuentran en una casilla, el número del enlace débil es falso ahí."}
- id: x-cycle
  category: technique
  sudokui_specific: false
  see: [nice-loop, x-chain, conjugate-pair]
  en: {term: X-cycle, aliases: [fishy cycle], definition: "A nice loop on a single digit: a closed chain of strong and weak links between the possible cells of one digit."}
  nb: {term: X-cycle, aliases: [], definition: "En nice loop på ett enkelt tall: en lukket kjede av sterke og svake lenker mellom de mulige rutene for ett tall."}
  es: {term: X-cycle, aliases: [ciclo X], definition: "Un nice loop de un solo número: una cadena cerrada de enlaces fuertes y débiles entre las casillas posibles de un número."}
- id: x-chain
  category: technique
  sudokui_specific: false
  see: [aic, x-cycle, turbot-fish]
  en: {term: X-chain, aliases: [], definition: "An AIC on a single digit. At least one end is true, so the digit is removed from every cell that sees both ends."}
  nb: {term: X-chain, aliases: [X-kjede], definition: "En AIC på ett enkelt tall. Minst én ende er sann, så tallet fjernes fra alle ruter som ser begge endene."}
  es: {term: X-chain, aliases: [cadena X], definition: "Una AIC de un solo número. Al menos un extremo es verdadero, así que el número se elimina de todas las casillas que ven ambos extremos."}
- id: xy-chain
  category: technique
  sudokui_specific: false
  see: [aic, bivalue-cell, remote-pair, xy-wing]
  en: {term: XY-chain, aliases: [], definition: "An AIC made only of bivalue cells, with weak links between cells on a shared digit. If both ends hold digit Z, Z is removed from every cell that sees both ends."}
  nb: {term: XY-chain, aliases: [XY-kjede], definition: "En AIC som bare består av toverdiruter, med svake lenker mellom rutene på et felles tall. Hvis begge endene har tallet Z, fjernes Z fra alle ruter som ser begge endene."}
  es: {term: XY-chain, aliases: [cadena XY], definition: "Una AIC formada solo por casillas bivalor, con enlaces débiles entre casillas en un número común. Si ambos extremos tienen el número Z, Z se elimina de todas las casillas que ven ambos extremos."}
- id: remote-pair
  category: technique
  sudokui_specific: false
  see: [xy-chain, bivalue-cell]
  en: {term: remote pair, aliases: [], definition: "An XY-chain of an even number of cells that all hold the same two digits. Both digits are removed from every cell that sees both ends."}
  nb: {term: remote pair, aliases: [fjernpar], definition: "En XY-chain med et partall antall ruter som alle har de samme to tallene. Begge tallene fjernes fra alle ruter som ser begge endene."}
  es: {term: remote pair, aliases: [par remoto], definition: "Una XY-chain con un número par de casillas que tienen todas los mismos dos números. Ambos números se eliminan de todas las casillas que ven ambos extremos."}
- id: colouring
  category: technique
  sudokui_specific: false
  see: [cluster, conjugate-pair, sees, multi-colouring]
  en: {term: colouring, aliases: [Simple Colors, simple colours, coloring], definition: "Giving a cluster's candidates two colours so that the ends of every conjugate pair differ. Exactly one colour is true everywhere: two candidates of one colour that see each other make that colour false (colour wrap), and an outside candidate that sees both colours is eliminated (colour trap)."}
  nb: {term: fargelegging, aliases: [Simple Colors], definition: "Å gi kandidatene i en klynge to farger slik at endene av hvert konjugert par får ulik farge. Nøyaktig én farge er sann overalt: to kandidater med samme farge som ser hverandre, gjør den fargen usann (fargebrudd), og en kandidat utenfor som ser begge fargene, elimineres (fargefelle)."}
  es: {term: coloreado, aliases: [Simple Colors], definition: "Dar dos colores a los candidatos de un clúster de modo que los extremos de cada par conjugado sean distintos. Exactamente un color es verdadero en todas partes: dos candidatos del mismo color que se ven hacen falso ese color (color wrap), y un candidato externo que ve ambos colores se elimina (color trap)."}
- id: multi-colouring
  category: technique
  sudokui_specific: false
  see: [colouring, cluster]
  en: {term: multi-colouring, aliases: [Multi Colors], definition: "Colouring two separate clusters of one digit. If a colour of one cluster sees both colours of the other, it is false; if one colour of each cluster see each other, a candidate seeing the other two colours is eliminated."}
  nb: {term: multifargelegging, aliases: [Multi Colors], definition: "Fargelegging av to separate klynger for ett tall. Hvis en farge i den ene klyngen ser begge fargene i den andre, er den usann; hvis én farge i hver klynge ser hverandre, elimineres en kandidat som ser de to andre fargene."}
  es: {term: coloreado múltiple, aliases: [Multi Colors], definition: "Coloreado de dos clústeres separados de un número. Si un color de un clúster ve ambos colores del otro, es falso; si un color de cada clúster se ven entre sí, se elimina un candidato que vea los otros dos colores."}
- id: cluster
  category: logic
  sudokui_specific: false
  see: [colouring, conjugate-pair, 3d-medusa]
  en: {term: cluster, aliases: [], definition: "A set of candidates connected to each other by conjugate pairs (and, in 3D Medusa, by bivalue cells). Settling one of them settles them all, which is why a cluster can be coloured in two colours."}
  nb: {term: klynge, aliases: [], definition: "En mengde kandidater som er forbundet med hverandre gjennom konjugerte par (og i 3D Medusa også gjennom toverdiruter). Avgjøres én av dem, avgjøres alle, og derfor kan en klynge fargelegges med to farger."}
  es: {term: clúster, aliases: [grupo], definition: "Un conjunto de candidatos conectados entre sí por pares conjugados (y, en 3D Medusa, por casillas bivalor). Al decidir uno se deciden todos, y por eso un clúster puede colorearse con dos colores."}
- id: 3d-medusa
  category: technique
  sudokui_specific: false
  see: [colouring, cluster, bivalue-cell]
  en: {term: 3D Medusa, aliases: [], definition: "Colouring across several digits, joining candidates through both conjugate pairs and bivalue cells. Its rules extend colour wrap and colour trap to candidates in the same cell."}
  nb: {term: 3D Medusa, aliases: [], definition: "Fargelegging på tvers av flere tall, der kandidater forbindes både gjennom konjugerte par og toverdiruter. Reglene utvider fargebrudd og fargefelle til kandidater i samme rute."}
  es: {term: 3D Medusa, aliases: [], definition: "Coloreado a través de varios números, que une candidatos mediante pares conjugados y casillas bivalor. Sus reglas extienden el color wrap y el color trap a candidatos de la misma casilla."}
- id: forcing-chain
  category: technique
  sudokui_specific: false
  see: [chain, forcing-net, nishio, contradiction]
  en: {term: forcing chain, aliases: [], definition: "A technique that follows each case of a premise, such as every candidate of one cell, to its consequences. What holds in every case is true, and a single case that ends in a contradiction is false."}
  nb: {term: forcing chain, aliases: [tvangskjede], definition: "En teknikk som følger hvert tilfelle av en premiss, for eksempel hver kandidat i én rute, fram til konsekvensene. Det som gjelder i alle tilfeller, er sant, og et enkelt tilfelle som ender i en motsigelse, er usant."}
  es: {term: cadena forzada, aliases: [forcing chain], definition: "Una técnica que sigue cada caso de una premisa, como cada candidato de una casilla, hasta sus consecuencias. Lo que se cumple en todos los casos es verdadero, y un caso que acaba en contradicción es falso."}
- id: forcing-net
  category: technique
  sudokui_specific: false
  see: [forcing-chain, nishio, brute-force]
  en: {term: forcing net, aliases: [], definition: "A forcing chain whose reasoning may branch and rejoin, so that one conclusion can depend on several earlier ones together. It is the last logical technique sudokUI tries before brute force."}
  nb: {term: forcing net, aliases: [tvangsnett], definition: "En forcing chain der resonnementet kan forgrene seg og gå sammen igjen, slik at én konklusjon kan bygge på flere tidligere samtidig. Det er den siste logiske teknikken sudokUI prøver før prøving og feiling."}
  es: {term: red forzada, aliases: [forcing net], definition: "Una cadena forzada cuyo razonamiento puede ramificarse y volver a unirse, de modo que una conclusión puede depender de varias anteriores a la vez. Es la última técnica lógica que sudokUI prueba antes de la fuerza bruta."}
- id: nishio
  category: technique
  sudokui_specific: false
  see: [forcing-chain, forcing-net, elimination]
  en: {term: Nishio, aliases: [Nishio forcing chain], definition: "A test of one candidate: assume it is true and follow the consequences. If they lead to a contradiction, the candidate is false and is eliminated. In the strict sense only that one digit is followed."}
  nb: {term: Nishio, aliases: [], definition: "En test av én kandidat: anta at den er sann og følg konsekvensene. Fører de til en motsigelse, er kandidaten usann og elimineres. I streng forstand følges bare det ene tallet."}
  es: {term: Nishio, aliases: [], definition: "Una prueba de un candidato: se supone verdadero y se siguen las consecuencias. Si llevan a una contradicción, el candidato es falso y se elimina. En sentido estricto solo se sigue ese número."}
- id: fish
  category: technique
  sudokui_specific: false
  see: [base-set, cover-set, x-wing, fin, franken-fish, mutant-fish]
  en: {term: fish, aliases: [squirmbag, whale, leviathan], definition: "A pattern on one digit: N base sets whose candidates for the digit all lie inside N cover sets. Every candidate of the digit in the cover sets that is not in a base set is eliminated. Sizes 2 to 7 are X-wing, swordfish, jellyfish, squirmbag, whale and leviathan."}
  nb: {term: fisk, aliases: [fiskemønster], definition: "Et mønster på ett tall: N basismengder der alle kandidatene for tallet ligger innenfor N dekkmengder. Hver kandidat for tallet i dekkmengdene som ikke ligger i en basismengde, elimineres. Størrelse 2 til 7 heter X-Wing, Swordfish, Jellyfish, Squirmbag, Whale og Leviathan."}
  es: {term: pez, aliases: [fish], definition: "Un patrón de un número: N conjuntos base cuyos candidatos para ese número están todos dentro de N conjuntos de cobertura. Se elimina cada candidato del número en los conjuntos de cobertura que no esté en un conjunto base. Los tamaños 2 a 7 son X-Wing, Swordfish, Jellyfish, Squirmbag, Whale y Leviathan."}
- id: x-wing
  category: technique
  sudokui_specific: false
  see: [fish, swordfish, base-set, cover-set]
  en: {term: X-wing, aliases: [], definition: "The smallest fish: in two rows (or columns) a digit has places only in the same two columns (or rows), so it is removed from the rest of those. Despite the name it is a fish, not a wing."}
  nb: {term: X-Wing, aliases: [], definition: "Den minste fisken: i to rader (eller kolonner) har et tall plass bare i de samme to kolonnene (eller radene), så det fjernes fra resten av dem. Til tross for navnet er det en fisk, ikke en wing."}
  es: {term: X-Wing, aliases: [ala X], definition: "El pez más pequeño: en dos filas (o columnas) un número solo tiene sitio en las mismas dos columnas (o filas), así que se elimina del resto de ellas. A pesar del nombre es un pez, no un wing."}
- id: swordfish
  category: technique
  sudokui_specific: false
  see: [fish, x-wing, jellyfish]
  en: {term: swordfish, aliases: [], definition: "A fish of size three: in three lines a digit has places only in the same three crossing lines, so it is removed from the rest of those."}
  nb: {term: Swordfish, aliases: [], definition: "En fisk av størrelse tre: i tre linjer har et tall plass bare i de samme tre kryssende linjene, så det fjernes fra resten av dem."}
  es: {term: Swordfish, aliases: [pez espada], definition: "Un pez de tamaño tres: en tres líneas un número solo tiene sitio en las mismas tres líneas que las cruzan, así que se elimina del resto de ellas."}
- id: jellyfish
  category: technique
  sudokui_specific: false
  see: [fish, swordfish]
  en: {term: jellyfish, aliases: [], definition: "A fish of size four: in four lines a digit has places only in the same four crossing lines, so it is removed from the rest of those."}
  nb: {term: Jellyfish, aliases: [], definition: "En fisk av størrelse fire: i fire linjer har et tall plass bare i de samme fire kryssende linjene, så det fjernes fra resten av dem."}
  es: {term: Jellyfish, aliases: [medusa], definition: "Un pez de tamaño cuatro: en cuatro líneas un número solo tiene sitio en las mismas cuatro líneas que las cruzan, así que se elimina del resto de ellas."}
- id: base-set
  category: technique
  sudokui_specific: false
  see: [fish, cover-set, fin, endo-fin]
  en: {term: base set, aliases: [base unit, base sector], definition: "One of the N units that define a fish. No candidate of the digit may lie in two base sets, though the units themselves may overlap; a candidate that does is treated as an endo fin. Each base set must hold the digit exactly once, which makes N true cells in all."}
  nb: {term: basismengde, aliases: [basisenhet], definition: "En av de N enhetene som definerer en fisk. Ingen kandidat for tallet kan ligge i to basismengder, selv om enhetene selv kan overlappe; en kandidat som gjør det, behandles som en endofinne. Hver basismengde må ha tallet nøyaktig én gang, til sammen N sanne ruter."}
  es: {term: conjunto base, aliases: [unidad base], definition: "Una de las N unidades que definen un pez. Ningún candidato del número puede estar en dos conjuntos base, aunque las unidades sí pueden solaparse; un candidato que lo esté se trata como aleta interna. Cada conjunto base debe contener el número exactamente una vez, lo que da N casillas verdaderas en total."}
- id: cover-set
  category: technique
  sudokui_specific: false
  see: [fish, base-set, fin, cannibalism]
  en: {term: cover set, aliases: [cover unit, cover sector], definition: "One of the N units that together contain every candidate of a fish's base sets. The base sets need N true cells and each cover set takes only one, so cover candidates outside the base sets lose the digit."}
  nb: {term: dekkmengde, aliases: [dekkenhet], definition: "En av de N enhetene som til sammen inneholder alle kandidatene i fiskens basismengder. Basismengdene trenger N sanne ruter og hver dekkmengde tar bare én, så dekkandidater utenfor basismengdene mister tallet."}
  es: {term: conjunto de cobertura, aliases: [unidad de cobertura], definition: "Una de las N unidades que juntas contienen todos los candidatos de los conjuntos base de un pez. Los conjuntos base necesitan N casillas verdaderas y cada conjunto de cobertura solo admite una, así que los candidatos de cobertura fuera de los conjuntos base pierden el número."}
- id: fin
  category: technique
  sudokui_specific: false
  see: [fish, finned-fish, endo-fin, sashimi]
  en: {term: fin, aliases: [exo fin], definition: "A base candidate of a fish that lies outside every cover set. Either one of the fins is true or the plain fish holds, so a finned fish eliminates only those cover candidates outside the base sets that also see every fin."}
  nb: {term: finne, aliases: [eksofinne], definition: "En basiskandidat i en fisk som ligger utenfor alle dekkmengder. Enten er én av finnene sann, eller så holder den vanlige fisken, så en fisk med finner eliminerer bare dekkandidater utenfor basismengdene som også ser alle finnene."}
  es: {term: aleta, aliases: [aleta externa], definition: "Un candidato base de un pez que está fuera de todos los conjuntos de cobertura. O una de las aletas es verdadera o el pez simple se cumple, así que un pez con aletas solo elimina los candidatos de cobertura fuera de los conjuntos base que además ven todas las aletas."}
- id: finned-fish
  category: technique
  sudokui_specific: false
  see: [fin, fish, sashimi]
  en: {term: finned fish, aliases: [finned X-wing, finned swordfish], definition: "A fish with one or more fins. Its eliminations are the plain fish's eliminations that also see every fin."}
  nb: {term: fisk med finner, aliases: [finned fish], definition: "En fisk med én eller flere finner. Elimineringene er den vanlige fiskens elimineringer som også ser alle finnene."}
  es: {term: pez con aletas, aliases: [finned fish], definition: "Un pez con una o más aletas. Sus eliminaciones son las del pez simple que además ven todas las aletas."}
- id: endo-fin
  category: technique
  sudokui_specific: false
  see: [fin, base-set, franken-fish]
  en: {term: endo fin, aliases: [], definition: "A base candidate that lies in two base sets, possible only in franken and mutant fish. It is treated as a fin, because if it were true the base sets would hold fewer than N true cells."}
  nb: {term: endofinne, aliases: [], definition: "En basiskandidat som ligger i to basismengder, noe som bare er mulig i franken- og mutantfisk. Den behandles som en finne, for hvis den var sann, ville basismengdene ha færre enn N sanne ruter."}
  es: {term: aleta interna, aliases: [endo fin], definition: "Un candidato base que está en dos conjuntos base, algo posible solo en peces franken y mutantes. Se trata como una aleta, porque si fuera verdadero los conjuntos base tendrían menos de N casillas verdaderas."}
- id: cannibalism
  category: technique
  sudokui_specific: false
  see: [cover-set, fish]
  en: {term: cannibalism, aliases: [cannibalistic fish], definition: "A base candidate that lies in two cover sets is eliminated by its own fish, because if it were true one cover set would hold the digit twice. In a finned fish it must also see every fin."}
  nb: {term: kannibalisme, aliases: [kannibalistisk fisk], definition: "En basiskandidat som ligger i to dekkmengder, elimineres av sin egen fisk, for hvis den var sann, ville én dekkmengde ha tallet to ganger. I en fisk med finner må den også se alle finnene."}
  es: {term: canibalismo, aliases: [pez caníbal], definition: "Un candidato base que está en dos conjuntos de cobertura es eliminado por su propio pez, porque si fuera verdadero un conjunto de cobertura tendría el número dos veces. En un pez con aletas, además debe ver todas las aletas."}
- id: sashimi
  category: technique
  sudokui_specific: false
  see: [fin, fish, base-set]
  en: {term: sashimi, aliases: [sashimi fish], definition: "A finned fish that would not be a proper fish of its size without its fins, for example because a base set would be left with only one candidate. Eliminations follow the same rule as for any finned fish."}
  nb: {term: Sashimi, aliases: [sashimifisk], definition: "En fisk med finner som uten finnene ikke ville vært en fullverdig fisk av sin størrelse, for eksempel fordi en basismengde bare ville hatt én kandidat igjen. Elimineringene følger samme regel som for alle fisker med finner."}
  es: {term: Sashimi, aliases: [pez sashimi], definition: "Un pez con aletas que sin ellas no sería un pez completo de su tamaño, por ejemplo porque a un conjunto base solo le quedaría un candidato. Las eliminaciones siguen la misma regla que en cualquier pez con aletas."}
- id: franken-fish
  category: technique
  sudokui_specific: false
  see: [fish, base-set, cover-set, mutant-fish]
  en: {term: franken fish, aliases: [], definition: "A fish in which boxes are allowed among the base sets or the cover sets. Apart from boxes, one side uses only rows and the other only columns."}
  nb: {term: Franken-fisk, aliases: [], definition: "En fisk der bokser er tillatt blant basismengdene eller dekkmengdene. Bortsett fra boksene bruker den ene siden bare rader og den andre bare kolonner."}
  es: {term: pez Franken, aliases: [], definition: "Un pez en el que se permiten cajas entre los conjuntos base o de cobertura. Aparte de las cajas, un lado usa solo filas y el otro solo columnas."}
- id: mutant-fish
  category: technique
  sudokui_specific: false
  see: [fish, franken-fish]
  en: {term: mutant fish, aliases: [], definition: "A fish whose base sets or cover sets mix rows, columns and boxes in any way."}
  nb: {term: mutantfisk, aliases: [], definition: "En fisk der basismengdene eller dekkmengdene blander rader, kolonner og bokser fritt."}
  es: {term: pez mutante, aliases: [], definition: "Un pez cuyos conjuntos base o de cobertura mezclan filas, columnas y cajas de cualquier forma."}
- id: kraken-fish
  category: technique
  sudokui_specific: false
  see: [finned-fish, forcing-chain]
  en: {term: kraken fish, aliases: [], definition: "A finned fish combined with chains: a candidate is eliminated if it is false both when the plain fish holds and when any one fin is true."}
  nb: {term: Kraken-fisk, aliases: [], definition: "En fisk med finner kombinert med kjeder: en kandidat elimineres hvis den er usann både når den vanlige fisken holder og når en hvilken som helst finne er sann."}
  es: {term: pez Kraken, aliases: [], definition: "Un pez con aletas combinado con cadenas: se elimina un candidato si es falso tanto si se cumple el pez simple como si cualquiera de las aletas es verdadera."}
- id: turbot-fish
  category: technique
  sudokui_specific: false
  see: [x-chain, skyscraper, two-string-kite, empty-rectangle]
  en: {term: turbot fish, aliases: [], definition: "A single-digit chain of two conjugate pairs joined by a weak link. The digit is removed from every cell that sees both free ends. Skyscraper and two-string kite are special cases."}
  nb: {term: Turbot fish, aliases: [], definition: "En kjede på ett tall av to konjugerte par forbundet med en svak lenke. Tallet fjernes fra alle ruter som ser begge de frie endene. Skyscraper og two-string kite er spesialtilfeller."}
  es: {term: Turbot fish, aliases: [], definition: "Una cadena de un número formada por dos pares conjugados unidos por un enlace débil. El número se elimina de todas las casillas que ven ambos extremos libres. Skyscraper y two-string kite son casos particulares."}
- id: skyscraper
  category: technique
  sudokui_specific: false
  see: [turbot-fish, conjugate-pair]
  en: {term: skyscraper, aliases: [], definition: "Two parallel conjugate pairs of one digit, in two rows or two columns, with one end of each in the same crossing line. The digit is removed from cells that see both other ends."}
  nb: {term: Skyscraper, aliases: [skyskraper], definition: "To parallelle konjugerte par for ett tall, i to rader eller to kolonner, med én ende av hvert i samme kryssende linje. Tallet fjernes fra ruter som ser begge de andre endene."}
  es: {term: Skyscraper, aliases: [rascacielos], definition: "Dos pares conjugados paralelos de un número, en dos filas o dos columnas, con un extremo de cada uno en la misma línea transversal. El número se elimina de las casillas que ven los otros dos extremos."}
- id: two-string-kite
  category: technique
  sudokui_specific: false
  see: [turbot-fish, conjugate-pair, box]
  en: {term: two-string kite, aliases: [2-String Kite], definition: "A conjugate pair in a row and one in a column for the same digit, with one end of each in the same box. The digit is removed from the cell that sees both other ends."}
  nb: {term: Two-string kite, aliases: [], definition: "Et konjugert par i en rad og ett i en kolonne for samme tall, med én ende av hvert i samme boks. Tallet fjernes fra ruten som ser begge de andre endene."}
  es: {term: Two-string kite, aliases: [cometa de dos cuerdas], definition: "Un par conjugado en una fila y otro en una columna para el mismo número, con un extremo de cada uno en la misma caja. El número se elimina de la casilla que ve los otros dos extremos."}
- id: empty-rectangle
  category: technique
  sudokui_specific: false
  see: [turbot-fish, box, conjugate-pair]
  en: {term: empty rectangle, aliases: [ER], definition: "A box whose candidates for a digit all lie in one row and one column of the box, combined with a conjugate pair outside it. Together they act as a chain that removes the digit from one cell."}
  nb: {term: Empty rectangle, aliases: [tomt rektangel], definition: "En boks der alle kandidatene for et tall ligger i én rad og én kolonne i boksen, kombinert med et konjugert par utenfor. Sammen virker de som en kjede som fjerner tallet fra én rute."}
  es: {term: Empty rectangle, aliases: [rectángulo vacío], definition: "Una caja cuyos candidatos de un número están todos en una fila y una columna de la caja, combinada con un par conjugado fuera de ella. Juntos actúan como una cadena que elimina el número de una casilla."}
- id: wing
  category: technique
  sudokui_specific: false
  see: [pivot, pincer, xy-wing, w-wing]
  en: {term: wing, aliases: [], definition: "A small pattern, such as the XY-wing, XYZ-wing, WXYZ-wing or W-wing, proving that a digit Z must go in one of a few cells. Z is removed from every cell that sees all of them. The X-wing is a fish, not a wing."}
  nb: {term: wing, aliases: [vinge], definition: "Et lite mønster, som XY-Wing, XYZ-Wing, WXYZ-Wing eller W-Wing, som beviser at et tall Z må stå i én av noen få ruter. Z fjernes fra alle ruter som ser alle disse. X-Wing er en fisk, ikke en wing."}
  es: {term: wing, aliases: [ala], definition: "Un patrón pequeño, como el XY-Wing, XYZ-Wing, WXYZ-Wing o W-Wing, que demuestra que un número Z debe ir en una de unas pocas casillas. Z se elimina de todas las casillas que las ven todas. El X-Wing es un pez, no un wing."}
- id: pivot
  category: technique
  sudokui_specific: false
  see: [wing, pincer, xy-wing, xyz-wing]
  en: {term: pivot, aliases: [hinge], definition: "The middle cell of an XY-wing or XYZ-wing, which sees both pincers. In an XY-wing it holds XY; in an XYZ-wing it holds XYZ, so eliminations must also see it."}
  nb: {term: pivot, aliases: [hengsel], definition: "Midtruten i en XY-Wing eller XYZ-Wing, som ser begge klypene. I en XY-Wing har den XY; i en XYZ-Wing har den XYZ, så elimineringene må også se den."}
  es: {term: pivote, aliases: [bisagra], definition: "La casilla central de un XY-Wing o XYZ-Wing, que ve ambas pinzas. En un XY-Wing contiene XY; en un XYZ-Wing contiene XYZ, así que las eliminaciones también deben verla."}
- id: pincer
  category: technique
  sudokui_specific: false
  see: [wing, pivot]
  en: {term: pincer, aliases: [pincer cell], definition: "One of the two outer cells of an XY-wing or XYZ-wing, each of which sees the pivot. The pincers hold XZ and YZ."}
  nb: {term: klype, aliases: [], definition: "En av de to ytre rutene i en XY-Wing eller XYZ-Wing, som hver ser pivoten. Klypene har XZ og YZ."}
  es: {term: pinza, aliases: [], definition: "Una de las dos casillas exteriores de un XY-Wing o XYZ-Wing, cada una de las cuales ve el pivote. Las pinzas contienen XZ e YZ."}
- id: xy-wing
  category: technique
  sudokui_specific: false
  see: [wing, pivot, pincer, xy-chain]
  en: {term: XY-wing, aliases: [Y-wing], definition: "A bivalue pivot XY that sees two bivalue pincers XZ and YZ. Whatever the pivot is, one pincer is Z, so Z is removed from every cell that sees both pincers."}
  nb: {term: XY-Wing, aliases: [Y-Wing], definition: "En toverdi-pivot XY som ser to toverdi-klyper XZ og YZ. Uansett hva pivoten blir, er én klype Z, så Z fjernes fra alle ruter som ser begge klypene."}
  es: {term: XY-Wing, aliases: [Y-Wing], definition: "Un pivote bivalor XY que ve dos pinzas bivalor XZ e YZ. Sea cual sea el pivote, una pinza es Z, así que Z se elimina de todas las casillas que ven ambas pinzas."}
- id: xyz-wing
  category: technique
  sudokui_specific: false
  see: [xy-wing, pivot, pincer]
  en: {term: XYZ-wing, aliases: [], definition: "An XY-wing whose pivot also holds Z. One of the three cells is Z, so Z is removed only from cells that see the pivot and both pincers."}
  nb: {term: XYZ-Wing, aliases: [], definition: "En XY-Wing der pivoten også har Z. Én av de tre rutene er Z, så Z fjernes bare fra ruter som ser pivoten og begge klypene."}
  es: {term: XYZ-Wing, aliases: [], definition: "Un XY-Wing cuyo pivote también contiene Z. Una de las tres casillas es Z, así que Z solo se elimina de las casillas que ven el pivote y ambas pinzas."}
- id: wxyz-wing
  category: technique
  sudokui_specific: false
  see: [wing, almost-locked-set, als-xz, bivalue-cell]
  en: {term: WXYZ-wing, aliases: [bent quad], definition: "Four cells holding four digits between them, in which every digit except Z is restricted, meaning all its places see each other. One of the four must then be Z, so Z is removed from every cell that sees all the Zs among them. sudokUI hints usually show it as a bivalue cell and a three-cell set."}
  nb: {term: WXYZ-Wing, aliases: [], definition: "Fire ruter med til sammen fire tall, der hvert tall unntatt Z er begrenset, altså at alle plassene ser hverandre. Da må én av de fire være Z, så Z fjernes fra alle ruter som ser alle Z-ene blant dem. Hint i sudokUI viser den vanligvis som en toverdirute og en mengde på tre ruter."}
  es: {term: WXYZ-Wing, aliases: [], definition: "Cuatro casillas con cuatro números entre ellas, en las que cada número salvo Z está restringido, es decir, todas sus posiciones se ven entre sí. Entonces una de las cuatro debe ser Z, así que Z se elimina de todas las casillas que ven todos los Z de entre ellas. Las pistas de sudokUI suelen mostrarlo como una casilla bivalor y un conjunto de tres casillas."}
- id: w-wing
  category: technique
  sudokui_specific: false
  see: [wing, bivalue-cell, strong-link]
  en: {term: W-wing, aliases: [], definition: "Two bivalue cells with the same digits XZ, joined by a strong link on X whose ends each see one of them. One of the two cells is Z, so Z is removed from every cell that sees both."}
  nb: {term: W-Wing, aliases: [], definition: "To toverdiruter med de samme tallene XZ, forbundet med en sterk lenke på X der hver ende ser én av dem. Én av de to rutene er Z, så Z fjernes fra alle ruter som ser begge."}
  es: {term: W-Wing, aliases: [], definition: "Dos casillas bivalor con los mismos números XZ, unidas por un enlace fuerte en X cuyos extremos ven cada uno a una de ellas. Una de las dos casillas es Z, así que Z se elimina de todas las casillas que ven ambas."}
- id: almost-locked-set
  category: logic
  sudokui_specific: false
  see: [locked-set, restricted-common-candidate, als-xz]
  en: {term: almost locked set, aliases: [ALS], definition: "N unsolved cells in one unit that hold exactly N+1 candidates between them. If any one of those digits is removed from all the cells, they become a locked set of the N digits that remain. A bivalue cell is the smallest ALS."}
  nb: {term: nesten låst mengde, aliases: [ALS], definition: "N uløste ruter i én enhet som til sammen har nøyaktig N+1 kandidater. Fjernes ett av disse tallene fra alle rutene, blir de en låst mengde av de N tallene som er igjen. En toverdirute er den minste ALS-en."}
  es: {term: conjunto casi bloqueado, aliases: [ALS], definition: "N casillas sin resolver de una unidad que tienen entre ellas exactamente N+1 candidatos. Si se elimina cualquiera de esos números de todas las casillas, se convierten en un conjunto bloqueado de los N números restantes. Una casilla bivalor es el ALS más pequeño."}
- id: restricted-common-candidate
  category: logic
  sudokui_specific: false
  see: [almost-locked-set, locked-set, sees]
  en: {term: restricted common candidate, aliases: [RCC, restricted common], definition: "A digit shared by two almost locked sets, where all its cells in one see all its cells in the other, and none of them lies in cells the two sets share. It can be true in at most one set, and a set that loses it becomes a locked set."}
  nb: {term: begrenset felles kandidat, aliases: [RCC], definition: "Et tall som to nesten låste mengder har felles, der alle rutene med tallet i den ene ser alle rutene med tallet i den andre, og ingen av dem ligger i ruter som mengdene deler. Det kan være sant i høyst én av mengdene, og en mengde som mister det, blir en låst mengde."}
  es: {term: candidato común restringido, aliases: [RCC], definition: "Un número compartido por dos conjuntos casi bloqueados, en el que todas sus casillas en uno ven todas sus casillas en el otro, y ninguna está en casillas compartidas por ambos. Puede ser verdadero como mucho en uno de los conjuntos, y el conjunto que lo pierde se convierte en un conjunto bloqueado."}
- id: als-xz
  category: technique
  sudokui_specific: false
  see: [almost-locked-set, restricted-common-candidate]
  en: {term: ALS-XZ, aliases: [], definition: "Two almost locked sets joined by an RCC X and sharing another digit Z. One set becomes locked, so Z is removed from every cell that sees all the Zs in both. With two RCCs (doubly linked) both sets become locked."}
  nb: {term: ALS-XZ, aliases: [], definition: "To nesten låste mengder forbundet med en RCC X som også deler et annet tall Z. Én mengde blir låst, så Z fjernes fra alle ruter som ser alle Z-ene i begge. Med to RCC-er (dobbelt lenket) blir begge mengdene låst."}
  es: {term: ALS-XZ, aliases: [], definition: "Dos conjuntos casi bloqueados unidos por un RCC X que comparten otro número Z. Uno de los conjuntos queda bloqueado, así que Z se elimina de todas las casillas que ven todos los Z de ambos. Con dos RCC (doble enlace) ambos conjuntos quedan bloqueados."}
- id: als-xy-wing
  category: technique
  sudokui_specific: false
  see: [als-xz, almost-locked-set]
  en: {term: ALS-XY-wing, aliases: [], definition: "Three almost locked sets A, B and C, where A and C each share a different RCC with B, and A and C share a digit Z. Z is removed from every cell that sees all the Zs in A and C."}
  nb: {term: ALS-XY-Wing, aliases: [], definition: "Tre nesten låste mengder A, B og C, der A og C hver deler en ulik RCC med B, og A og C deler et tall Z. Z fjernes fra alle ruter som ser alle Z-ene i A og C."}
  es: {term: ALS-XY-Wing, aliases: [], definition: "Tres conjuntos casi bloqueados A, B y C, donde A y C comparten cada uno un RCC distinto con B, y A y C comparten un número Z. Z se elimina de todas las casillas que ven todos los Z de A y C."}
- id: death-blossom
  category: technique
  sudokui_specific: false
  see: [almost-locked-set, restricted-common-candidate]
  en: {term: death blossom, aliases: [], definition: "A stem cell whose every candidate is an RCC with its own almost locked set, the petals. Whichever candidate the stem takes, one petal becomes locked, so a digit Z common to all petals is removed from cells that see all their Zs."}
  nb: {term: Death blossom, aliases: [], definition: "En stammerute der hver kandidat er en RCC med sin egen nesten låste mengde, kronbladene. Uansett hvilken kandidat stammen får, blir ett kronblad låst, så et tall Z som alle kronbladene har, fjernes fra ruter som ser alle Z-ene deres."}
  es: {term: Death blossom, aliases: [], definition: "Una casilla tallo cuyos candidatos son cada uno un RCC con su propio conjunto casi bloqueado, los pétalos. Tome el tallo el candidato que tome, un pétalo queda bloqueado, así que un número Z común a todos los pétalos se elimina de las casillas que ven todos sus Z."}
- id: sue-de-coq
  category: technique
  sudokui_specific: false
  see: [intersection, almost-locked-set, locked-set]
  en: {term: Sue de Coq, aliases: [], definition: "Two or three cells of one intersection whose candidates split between a set in the rest of the box and a set in the rest of the line. Each part is locked, so its digits are removed from the rest of its unit."}
  nb: {term: Sue de Coq, aliases: [], definition: "To eller tre ruter i én skjæring der kandidatene fordeles mellom en mengde i resten av boksen og en mengde i resten av linjen. Hver del er låst, så tallene fjernes fra resten av sin enhet."}
  es: {term: Sue de Coq, aliases: [], definition: "Dos o tres casillas de una intersección cuyos candidatos se reparten entre un conjunto en el resto de la caja y otro en el resto de la línea. Cada parte queda bloqueada, así que sus números se eliminan del resto de su unidad."}
- id: template
  category: technique
  sudokui_specific: false
  see: [elimination, placement, exocet]
  en: {term: template, aliases: [pattern overlay, POM], definition: "One complete way to place a digit in all nine rows, columns and boxes that agrees with the current grid. A candidate found in no template is eliminated, and a cell found in every template takes the digit."}
  nb: {term: mal, aliases: [mønsteroverlegg, POM], definition: "En fullstendig måte å plassere et tall i alle ni rader, kolonner og bokser på som stemmer med det nåværende rutenettet. En kandidat som ikke finnes i noen mal, elimineres, og en rute som finnes i alle maler, får tallet."}
  es: {term: plantilla, aliases: [superposición de patrones, POM], definition: "Una forma completa de colocar un número en las nueve filas, columnas y cajas que concuerda con la cuadrícula actual. Un candidato que no aparece en ninguna plantilla se elimina, y una casilla que aparece en todas recibe el número."}
- id: exocet
  category: technique
  sudokui_specific: false
  see: [intersection, chute, template, elimination]
  en: {term: Exocet, aliases: [Junior Exocet, JE], definition: "Two base cells in one intersection, with three or four candidates between them, and two target cells in the other two boxes of their chute that do not see them. When every base digit is confined to at most two lines in the rest of the chute, the targets must take the same two digits as the base, so the targets lose every candidate the base cells lack."}
  nb: {term: Exocet, aliases: [Junior Exocet], definition: "To basisruter i én skjæring, med tre eller fire kandidater til sammen, og to målruter i de to andre boksene i boksrekken som ikke ser dem. Når hvert basistall er begrenset til høyst to linjer i resten av boksrekken, må målrutene få de samme to tallene som basen, så målrutene mister alle kandidater basisrutene mangler."}
  es: {term: Exocet, aliases: [Junior Exocet], definition: "Dos casillas base en una intersección, con tres o cuatro candidatos entre ellas, y dos casillas objetivo en las otras dos cajas de su franja que no las ven. Cuando cada número base está limitado a como mucho dos líneas en el resto de la franja, las casillas objetivo deben tomar los mismos dos números que la base, así que pierden todos los candidatos que no tienen las casillas base."}
- id: uniqueness
  category: logic
  sudokui_specific: false
  see: [unique-solution, deadly-pattern, unique-rectangle, bug]
  en: {term: uniqueness, aliases: [uniqueness technique], definition: "The fact that a proper puzzle has exactly one solution, used as a solving argument. Any candidate that would leave a deadly pattern, and so two solutions, is false."}
  nb: {term: entydighet, aliases: [], definition: "At en gyldig oppgave har nøyaktig én løsning, brukt som argument i løsningen. Enhver kandidat som ville etterlate et dødelig mønster, og dermed to løsninger, er usann."}
  es: {term: unicidad, aliases: [], definition: "El hecho de que un sudoku válido tiene exactamente una solución, usado como argumento de resolución. Cualquier candidato que dejaría un patrón mortal, y por tanto dos soluciones, es falso."}
- id: unique-solution
  category: rating
  sudokui_specific: false
  see: [uniqueness, given, brute-force]
  en: {term: unique solution, aliases: [], definition: "The one and only way to complete a proper sudoku from its givens. sudokUI checks that every puzzle it generates, and every puzzle you import or type in, has exactly one solution."}
  nb: {term: entydig løsning, aliases: [], definition: "Den ene og eneste måten å fullføre en gyldig sudoku fra de gitte tallene. sudokUI sjekker at alle oppgaver den lager, og alle oppgaver du importerer eller skriver inn, har nøyaktig én løsning."}
  es: {term: solución única, aliases: [], definition: "La única forma de completar un sudoku válido a partir de sus números dados. sudokUI comprueba que cada sudoku que genera, y cada sudoku que importas o escribes, tiene exactamente una solución."}
- id: deadly-pattern
  category: logic
  sudokui_specific: false
  see: [uniqueness, unique-rectangle, bug, given]
  en: {term: deadly pattern, aliases: [], definition: "A set of cells, none of them givens, whose digits could be swapped among themselves without breaking any rule. That would mean two solutions, so the solution of a proper puzzle never contains such a pattern."}
  nb: {term: dødelig mønster, aliases: [], definition: "En mengde ruter, ingen av dem gitte tall, der tallene kan byttes om innbyrdes uten å bryte noen regel. Det ville gi to løsninger, så løsningen på en gyldig oppgave inneholder aldri et slikt mønster."}
  es: {term: patrón mortal, aliases: [], definition: "Un conjunto de casillas, ninguna de ellas número dado, cuyos números podrían intercambiarse entre sí sin romper ninguna regla. Eso daría dos soluciones, así que la solución de un sudoku válido nunca contiene un patrón así."}
- id: unique-rectangle
  category: technique
  sudokui_specific: false
  see: [deadly-pattern, uniqueness, hidden-rectangle]
  en: {term: unique rectangle, aliases: [UR, uniqueness test], definition: "Four cells, none of them givens, in two rows, two columns and two boxes, sharing the same two candidates. With only those two digits in all four it would be a deadly pattern, so at least one extra candidate in the rectangle is true."}
  nb: {term: unikt rektangel, aliases: [UR], definition: "Fire ruter, ingen av dem gitte tall, i to rader, to kolonner og to bokser, med de samme to kandidatene. Med bare disse to tallene i alle fire ville det vært et dødelig mønster, så minst én ekstra kandidat i rektangelet er sann."}
  es: {term: rectángulo único, aliases: [UR], definition: "Cuatro casillas, ninguna de ellas número dado, en dos filas, dos columnas y dos cajas, que comparten los mismos dos candidatos. Con solo esos dos números en las cuatro sería un patrón mortal, así que al menos un candidato extra del rectángulo es verdadero."}
- id: hidden-rectangle
  category: technique
  sudokui_specific: false
  see: [unique-rectangle, conjugate-pair]
  en: {term: hidden rectangle, aliases: [HR], definition: "A unique rectangle found through conjugate pairs on its two digits rather than through bivalue cells. It removes one of the two digits from the corner opposite the conjugate pairs."}
  nb: {term: skjult rektangel, aliases: [HR], definition: "Et unikt rektangel som finnes gjennom konjugerte par på de to tallene, ikke gjennom toverdiruter. Det fjerner ett av de to tallene fra hjørnet overfor de konjugerte parene."}
  es: {term: rectángulo oculto, aliases: [HR], definition: "Un rectángulo único hallado mediante pares conjugados en sus dos números en lugar de casillas bivalor. Elimina uno de los dos números de la esquina opuesta a los pares conjugados."}
- id: avoidable-rectangle
  category: technique
  sudokui_specific: false
  see: [unique-rectangle, given]
  en: {term: avoidable rectangle, aliases: [AR], definition: "A rectangle in which some cells are already solved by you, not given, and the rest could complete a deadly pattern. The candidate that would complete it is false."}
  nb: {term: unngåelig rektangel, aliases: [AR], definition: "Et rektangel der noen ruter allerede er løst av deg, ikke gitt, og resten kunne fullført et dødelig mønster. Kandidaten som ville fullført det, er usann."}
  es: {term: rectángulo evitable, aliases: [AR], definition: "Un rectángulo en el que algunas casillas ya las has resuelto tú, no son números dados, y el resto podría completar un patrón mortal. El candidato que lo completaría es falso."}
- id: bug
  category: logic
  sudokui_specific: false
  see: [bivalue-cell, deadly-pattern, uniqueness, bug-plus-one]
  en: {term: BUG, aliases: [bivalue universal grave], definition: "A state where every unsolved cell has exactly two candidates and every candidate occurs exactly twice in each of its units. Such a state has no solution or more than one, so a proper puzzle can never reach it."}
  nb: {term: BUG, aliases: [bivalue universal grave], definition: "En tilstand der hver uløst rute har nøyaktig to kandidater og hver kandidat forekommer nøyaktig to ganger i hver av sine enheter. En slik tilstand har ingen eller flere løsninger, så en gyldig oppgave kan aldri havne der."}
  es: {term: BUG, aliases: [bivalue universal grave], definition: "Un estado en el que cada casilla sin resolver tiene exactamente dos candidatos y cada candidato aparece exactamente dos veces en cada una de sus unidades. Ese estado no tiene solución o tiene más de una, así que un sudoku válido nunca puede llegar a él."}
- id: bug-plus-one
  category: technique
  sudokui_specific: false
  see: [bug, bivalue-cell]
  en: {term: BUG+1, aliases: [], definition: "A BUG with one extra candidate in one cell. That candidate, the one that occurs three times in its units, must be true."}
  nb: {term: BUG+1, aliases: [], definition: "En BUG med én ekstra kandidat i én rute. Den kandidaten, den som forekommer tre ganger i sine enheter, må være sann."}
  es: {term: BUG+1, aliases: [], definition: "Un BUG con un candidato extra en una casilla. Ese candidato, el que aparece tres veces en sus unidades, debe ser verdadero."}
- id: technique
  category: rating
  sudokui_specific: false
  see: [rating, solve-path, technique-score]
  en: {term: technique, aliases: [strategy], definition: "A named pattern of logic that justifies a placement or an elimination, such as a hidden single or an X-wing. Each technique has a score that counts towards the rating."}
  nb: {term: teknikk, aliases: [strategi], definition: "Et navngitt logisk mønster som begrunner en plassering eller en eliminering, for eksempel en skjult singel eller en X-Wing. Hver teknikk har en poengverdi som teller med i poengsummen."}
  es: {term: técnica, aliases: [estrategia], definition: "Un patrón lógico con nombre que justifica una colocación o una eliminación, como un único oculto o un X-Wing. Cada técnica tiene una puntuación que cuenta para la puntuación total."}
- id: technique-score
  category: rating
  sudokui_specific: false
  see: [technique, rating, hodoku]
  en: {term: technique score, aliases: [step score], definition: "The fixed number of points a technique adds each time it is used. sudokUI uses HoDoKu's default scores, from 4 for a naked single up to 10000 for brute force."}
  nb: {term: teknikkpoeng, aliases: [], definition: "Det faste antallet poeng en teknikk legger til hver gang den brukes. sudokUI bruker HoDoKus standardpoeng, fra 4 for en naken singel til 10000 for prøving og feiling."}
  es: {term: puntuación de técnica, aliases: [], definition: "El número fijo de puntos que suma una técnica cada vez que se usa. sudokUI usa las puntuaciones por defecto de HoDoKu, desde 4 para un único desnudo hasta 10000 para la fuerza bruta."}
- id: solve-path
  category: rating
  sudokui_specific: false
  see: [technique, crux, rating, steps]
  en: {term: solve path, aliases: [solution path], definition: "The ordered list of steps that solves a puzzle. sudokUI builds it by trying techniques in a fixed order, roughly easiest first, and taking the first that works at every step, and shows it under Steps."}
  nb: {term: løsningssti, aliases: [], definition: "Den ordnede listen over steg som løser en oppgave. sudokUI lager den ved å prøve teknikkene i fast rekkefølge, omtrent fra lettest, og ta den første som virker i hvert steg, og viser den under Steg."}
  es: {term: ruta de resolución, aliases: [], definition: "La lista ordenada de pasos que resuelve un sudoku. sudokUI la construye probando las técnicas en un orden fijo, más o menos de la más fácil a la más difícil, y tomando la primera que funciona en cada paso, y la muestra en Pasos."}
- id: crux
  category: rating
  sudokui_specific: true
  see: [solve-path, technique, rating]
  en: {term: crux, aliases: [hardest step], definition: "The most expensive step of the solve path: the one whose technique has the highest score. sudokUI highlights it in the Steps list."}
  nb: {term: nøkkeltrinn, aliases: [], definition: "Det dyreste steget i løsningsstien, altså det der teknikken har høyest poengverdi. sudokUI uthever det i Steg-listen."}
  es: {term: paso clave, aliases: [], definition: "El paso más costoso de la ruta de resolución, es decir, aquel cuya técnica tiene la puntuación más alta. sudokUI lo resalta en la lista de Pasos."}
- id: rating
  category: rating
  sudokui_specific: false
  see: [solve-path, technique-score, difficulty-band, hodoku]
  en: {term: rating, aliases: [difficulty rating, puzzle score], definition: "A puzzle's difficulty as a number: the sum of the technique scores of every step along the solve path. Because scores and solving order follow HoDoKu, ratings can be compared with HoDoKu's."}
  nb: {term: poengsum, aliases: [], definition: "En oppgaves vanskelighet som et tall: summen av teknikkpoengene for hvert steg i løsningsstien. Fordi poeng og løsningsrekkefølge følger HoDoKu, kan poengsummene sammenlignes med HoDoKus."}
  es: {term: puntuación, aliases: [], definition: "La dificultad de un sudoku como número: la suma de las puntuaciones de técnica de cada paso de la ruta de resolución. Como las puntuaciones y el orden siguen a HoDoKu, se pueden comparar con las de HoDoKu."}
- id: difficulty-band
  category: rating
  sudokui_specific: true
  see: [rating, technique, hodoku, band]
  en: {term: difficulty band, aliases: [difficulty level, level], definition: "One of eight named levels of difficulty: Beginner, Easy, Medium, Tricky, Hard, Unfair, Extreme and Nightmare. A puzzle's band follows from its rating and from the hardest technique it needs. HoDoKu itself has five levels."}
  nb: {term: vanskelighetsgrad, aliases: [nivå], definition: "Ett av åtte navngitte vanskelighetsnivåer: Nybegynner, Lett, Middels, Lur, Vanskelig, Urettferdig, Ekstrem og Mareritt. En oppgaves grad følger av poengsummen og av den vanskeligste teknikken den krever. HoDoKu selv har fem nivåer."}
  es: {term: nivel de dificultad, aliases: [nivel], definition: "Uno de ocho niveles de dificultad con nombre: Principiante, Fácil, Medio, Engañoso, Difícil, Injusto, Extremo y Pesadilla. El nivel de un sudoku se deriva de su puntuación y de la técnica más difícil que necesita. HoDoKu tiene cinco niveles."}
- id: brute-force
  category: rating
  sudokui_specific: false
  see: [unique-solution, forcing-net, rating]
  en: {term: brute force, aliases: [backtracking, trial and error, guessing], definition: "Solving by trial and error: try a digit, carry on, and go back when a contradiction appears. In sudokUI it checks that a puzzle has a unique solution, and it is the solver's last resort, scored at 10000."}
  nb: {term: prøving og feiling, aliases: [brute force, gjetting], definition: "Å løse ved prøving og feiling: prøv et tall, fortsett, og gå tilbake når det oppstår en motsigelse. I sudokUI sjekker den at en oppgave har entydig løsning, og den er løserens siste utvei, med 10000 poeng."}
  es: {term: fuerza bruta, aliases: [ensayo y error, backtracking], definition: "Resolver por ensayo y error: probar un número, seguir y volver atrás cuando aparece una contradicción. En sudokUI comprueba que un sudoku tiene solución única, y es el último recurso del resolvedor, con 10000 puntos."}
- id: hodoku
  category: rating
  sudokui_specific: false
  see: [rating, difficulty-band, technique]
  en: {term: HoDoKu, aliases: [], definition: "A free, open source (GPLv3) sudoku program in Java by Bernhard Hobiger, known for its solver, technique guide and difficulty scores. sudokUI takes its technique scores and solving order from HoDoKu, so ratings can be compared."}
  nb: {term: HoDoKu, aliases: [], definition: "Et gratis sudokuprogram med åpen kildekode (GPLv3), skrevet i Java av Bernhard Hobiger, kjent for løseren, teknikkguiden og vanskelighetspoengene. sudokUI henter teknikkpoeng og løsningsrekkefølge fra HoDoKu, så poengsummene kan sammenlignes."}
  es: {term: HoDoKu, aliases: [], definition: "Un programa de sudoku gratuito y de código abierto (GPLv3) escrito en Java por Bernhard Hobiger, conocido por su resolvedor, su guía de técnicas y sus puntuaciones de dificultad. sudokUI toma de HoDoKu las puntuaciones de las técnicas y el orden de resolución, así que las puntuaciones se pueden comparar."}
```

## 6. Sample hint

**English (revised).** WXYZ-Wing: bivalue cell r7c4 (69) and the three cells r6c5, r7c5 and r8c5 in column 5, which hold 1689 between them. The 6 in r7c4 sees every 6 in the three cells. Either r7c4 is 9, or it is 6 and the three cells in column 5 must be 1, 8 and 9. At least one of the four cells is therefore 9, so 9 is removed from every other cell that sees all the 9s among them.

**Norsk (bokmål).** WXYZ-Wing: toverdiruten r7c4 (69) og de tre rutene r6c5, r7c5 og r8c5 i kolonne 5, som til sammen har 1689. 6-tallet i r7c4 ser alle 6-ene i de tre rutene. Enten er r7c4 lik 9, eller så er den 6, og da må de tre rutene i kolonne 5 være 1, 8 og 9. Minst én av de fire rutene er derfor 9, så 9 fjernes fra alle andre ruter som ser alle 9-ene blant dem.

**Español.** WXYZ-Wing: la casilla bivalor r7c4 (69) y las tres casillas r6c5, r7c5 y r8c5 de la columna 5, que tienen entre ellas 1689. El 6 de r7c4 ve todos los 6 de esas tres casillas. O r7c4 es 9, o es 6 y entonces las tres casillas de la columna 5 deben ser 1, 8 y 9. Por tanto, al menos una de las cuatro casillas es 9, así que se elimina el 9 de todas las demás casillas que ven todos los 9 de entre ellas.

## 7. Open questions and caveats

- **Scores outside HoDoKu.** HoDoKu does not implement WXYZ-wing, Exocet, Nishio or 3D Medusa. Any scores sudokUI gives them are its own, so the rating text should not claim HoDoKu compatibility for puzzles that use them.
- **Verify the HoDoKu defaults.** The 4 and 10000 endpoints come from the forum summary quoted above. The same forum reports Skyscraper 130, X-Wing 140 and Swordfish 150. Check every default score and the default solver order against HoDoKu 2.2's source (Options.java). Also confirm that forcing net really comes immediately before brute force in sudokUI.
- **Crux tie-break.** When several steps share the top score, decide which one is highlighted (first or last) and state it in the crux entry.
- **Check behaviour.** Confirm whether Check ignores corner marks.
- **Norwegian.** Attested sources (kryssordet.no, sudokupro.app/no and a Norwegian GitHub project) cover only the basic terms and the levels Lett, Middels and Vanskelig. I could not read Norwegian Wikipedia. The chain, fish and ALS vocabulary, and the bands Lur, Urettferdig and Mareritt, are coined and need review by a native speaker. sudokupro.app/no looks machine-translated, so its coinages are not evidence of community usage.
- **Spanish.**
  - Spain prefers "casilla" and "comprobar"; Latin America uses "celda" and "verificar". Spanish Wikipedia uses both "celdas" and "casillas".\[23\]\[24\]
  - "Pista" means both a given and a hint. The data block therefore uses "número dado" for givens and reserves "pista" for hints.

## 8. Sources

- HoDoKu manual and technique pages: hodoku.sourceforge.net, pages Introduction, Singles, Fish (general), Wings, Chains/Loops, Coloring, ALS, Last Resort, User Manual Chapters 3 and 4.
- New Sudoku Players' Forum (forum.enjoysudoku.com): "How is the difficulty of a Sudoku puzzle determined?", "Hodoku Rating Anomaly", the HoDoKu release thread, "exocet pattern in hardest puzzles", "Debunking Discontinuous Nice Loops".
- Sudopedia mirror (sudopedia.enjoysudoku.com): Nice Loop, Color Wrap, Color Trap. Sudopedia.org: Bivalue Universal Grave.
- SudokuWiki.org: WXYZ-Wing, XYZ-Wing, Alternating Inference Chains, AIC with Groups, Almost Locked Sets, BUG.
- Norwegian: kryssordet.no/guide/sudoku; sudokupro.app/no; matematikk.org/sudoku; huskerdu.no/sudoku; SNL (snl.no/sudoku).
- Spanish: es.wikipedia.org (Sudoku); wextensible.com (Fish); conclase.net; proyectodescartes.org; sudokupuzzle.org (Pares Desnudos); La Nación.

## Sources

1. [HoDoKu: Solving Techniques - Wings (XY-Wing, XYZ-Wing, W-Wing)](https://hodoku.sourceforge.net/en/tech_wings.php)
2. [HoDoKu: Solving Techniques - Fish (General Explanation) - X-Wing, Swordfish, Jellyfish](https://hodoku.sourceforge.net/en/tech_fishg.php)
3. [Solving Techniques - Chains and Loops - HoDoKu](https://hodoku.sourceforge.net/en/tech_chains.php)
4. [Debunking Discontinuous Nice Loops : Advanced solving techniques](http://forum.enjoysudoku.com/debunking-discontinuous-nice-loops-t34344.html)
5. [Solving Techniques - ALS (Almost Locked Sets) - HoDoKu](https://hodoku.sourceforge.net/en/tech_als.php)
6. [Sudoku Helper - HowTo for Sudoku solving technique almostLockedSets. Instructions and examples for the Sudoku solving technique almostLockedSets.](https://sudoku.ironmonger.com/howto/almostLockedSets/docs.tpl)
7. [WXYZ-Wing - SudokuWiki.org](https://www.sudokuwiki.org/WXYZ_wing)
8. [HoDoKu: User Manual (Chapter 3: Configuring the Solver)](https://hodoku.sourceforge.net/en/docs_solv.php)
9. [HoDoKu: User Manual (Chapter 4: Creating Sudokus)](https://hodoku.sourceforge.net/en/docs_cre.php)
10. [Hodoko rating system question : Software](http://forum.enjoysudoku.com/hodoko-rating-system-question-t38778.html)
11. [How is the difficulty of a Sudoku puzzle determined? : General](http://forum.enjoysudoku.com/how-is-the-difficulty-of-a-sudoku-puzzle-determined-t32249.html)
12. [HoDoKu: Solving Techniques - Introduction](https://hodoku.sourceforge.net/en/tech_intro.php)
13. [Sudoku Strategy: Essential Tips to Improve Your Puzzle Solving](https://www.247sudoku.com/news/sudoku-strategy-essential-tips-to-improve-solving/)
14. [HoDoKu: Solving Techniques - Singles (Hidden Single, Naked Single, Full House)](https://hodoku.sourceforge.net/en/tech_singles.php)
15. [HoDoKu: Solving Techniques - Coloring (Simple Colors, Multi Colors, Color Wrap, Color Trap)](https://hodoku.sourceforge.net/en/tech_col.php)
16. [Color Wrap - Sudopedia Mirror](http://sudopedia.enjoysudoku.com/Color_Wrap.html)
17. [Sudoku Exocet Strategy explained](https://www.taupierbw.be/SudokuCoach/SC_Exocet.shtml)
18. [Bivalue Universal Grave - Sudopedia.org](https://www.sudopedia.org/wiki/Bivalue_Universal_Grave)
19. [BUG+1](https://www.sudokuwiki.org/BUG)
20. [Kryssord på nett – gratis og uten registrering | Kryssordet.no](https://www.kryssordet.no/guide/sudoku)
21. [Sudoku: Fish. X-Wing, Swordfish y Jellyfish](https://www.wextensible.com/temas/sudoku/fish-xwing-swordfish-jellyfish.html)
22. [Sudoku: Tips og strategier](https://www.matematikk.org/sudoku/tips_0.html)
23. [Sudoku](https://es.m.wikipedia.org/wiki/Sudoku)
24. [Sudoku](https://es-academic.com/dic.nsf/eswiki/1112019)
