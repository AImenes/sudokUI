// Norwegian (bokmål) text of the Learn section: the glossary, the technique
// guide, the Intuition guide, How to solve, the rating, the landing pages
// and the interface strings. Keyed exactly like EN in ../learnLocale.ts; the terminology
// follows docs/glossary_input.md. tests/learnLocale.test.ts checks that
// every piece is here, in house style, with its placeholders and numbers.
import type { LearnLocale } from '../learnLocale';
import { COUNTS } from '../landing';
import { techNames, levels, categoryLabels } from './names.nb';

const nb: LearnLocale = {
  "techNames": techNames,
  "techDocs": {
    "FULL_HOUSE": {
      "what": "En rad, kolonne eller boks har åtte av sine ni ruter fylt ut, så nøyaktig én rute står tom.",
      "why": "En enhet må inneholde hvert tall fra 1 til 9 nøyaktig én gang, så det ene tallet som mangler blant de åtte utfylte rutene, plasseres i den tomme ruten.",
      "spot": "Se etter en rad, kolonne eller boks med åtte tall fylt inn, og finn ut hvilket tall fra 1 til 9 som mangler."
    },
    "NAKED_SINGLE": {
      "what": "En tom rute har nøyaktig én kandidat igjen: alle andre tall er utelukket for den ruten.",
      "why": "Hver rute må ha et tall, og her er åtte av de ni utelukket, så den ene gjenværende kandidaten plasseres i ruten.",
      "spot": "Se etter tomme ruter der raden, kolonnen og boksen til sammen allerede viser mange ulike tall, og sjekk om bare ett tall er igjen."
    },
    "HIDDEN_SINGLE": {
      "what": "I en rad, kolonne eller boks er et tall X kandidat i nøyaktig én rute, uansett hvilke andre kandidater den ruten har.",
      "why": "Hver enhet må inneholde X én gang, og bare én rute i denne enheten kan fortsatt få det, så X plasseres i den ruten.",
      "spot": "Ta ett tall om gangen, utelukk hver rute som ser en plassert forekomst av det, og se etter en enhet med én plass igjen."
    },
    "LOCKED_PAIR": {
      "what": "To ruter i samme boks og samme rad eller kolonne er begge toverdiruter med de samme to kandidatene, X og Y.",
      "why": "De to rutene må få X og Y i en eller annen rekkefølge, så ingen annen rute som ser begge, kan ha noen av de to tallene. X og Y elimineres fra alle andre ruter i boksen og i den felles raden eller kolonnen.",
      "spot": "Har to toverdiruter i en boks de samme kandidatene og deler en rad eller kolonne, ser du etter de tallene andre steder i begge enhetene."
    },
    "LOCKED_TRIPLE": {
      "what": "Tre tomme ruter i én boks som også deler en rad eller kolonne, har til sammen bare kandidatene X, Y og Z, selv om ingen rute trenger å ha alle tre.",
      "why": "Tre ruter som alle ser hverandre, trenger tre ulike tall, og bare X, Y og Z er tilgjengelige, så alle tre brukes der. X, Y og Z elimineres fra alle andre ruter i boksen og i den raden eller kolonnen.",
      "spot": "Sjekk de tre rutene der en boks krysser en rad eller kolonne: alle må være tomme og til sammen ha bare tre ulike kandidater."
    },
    "LOCKED_CANDIDATES_1": {
      "what": "Innenfor én boks ligger alle kandidatene for et tall X i samme rad eller samme kolonne, i to eller tre ruter.",
      "why": "Boksen må inneholde X, og alle plassene for det ligger i én rad eller kolonne, så den raden eller kolonnen må ha sin X inne i boksen. X elimineres fra rutene i den raden eller kolonnen utenfor boksen.",
      "spot": "Gå gjennom en boks tall for tall: når alle kandidatene for et tall deler en rad eller kolonne, følger du den raden eller kolonnen ut av boksen."
    },
    "LOCKED_CANDIDATES_2": {
      "what": "Innenfor én rad eller kolonne ligger alle kandidatene for et tall X inne i samme boks, i to eller tre ruter.",
      "why": "Raden eller kolonnen må inneholde X, og alle plassene for det ligger inne i én boks, så boksen må ha sin X i den raden eller kolonnen. X elimineres fra rutene i boksen utenfor den raden eller kolonnen.",
      "spot": "Gå gjennom en rad eller kolonne tall for tall: når alle kandidatene for et tall havner i én boks, sjekker du resten av den boksen."
    },
    "NAKED_PAIR": {
      "what": "To ruter i samme enhet som hver har nøyaktig de samme to kandidatene, X og Y, og ingenting annet.",
      "why": "Den ene ruten må få X og den andre Y, i en hvilken som helst rekkefølge, så ingen av tallene kan stå noe annet sted i en enhet som inneholder begge rutene. Fjern X og Y fra alle andre ruter i hver slik enhet.",
      "spot": "Finn to toverdiruter som ser hverandre og viser de samme to tallene, og se etter de tallene andre steder i hver enhet de deler."
    },
    "NAKED_TRIPLE": {
      "what": "Tre tomme ruter i samme enhet der kandidatene til sammen er nøyaktig tre tall, X, Y og Z, selv om ingen enkelt rute trenger å ha alle tre.",
      "why": "Tre ruter i én enhet trenger tre ulike tall, og bare X, Y og Z er tilgjengelige, så de rutene bruker opp alle tre. Fjern X, Y og Z fra alle andre ruter i hver enhet som inneholder alle de tre rutene.",
      "spot": "Samle rutene med bare to eller tre kandidater i én enhet, og test om tre av dem til sammen har bare tre tall."
    },
    "HIDDEN_PAIR": {
      "what": "To tall, X og Y, som begge fortsatt mangler i en enhet, og som i den enheten bare har plass i de samme to rutene.",
      "why": "Enheten trenger både X og Y, og bare disse to rutene kan ta dem, så den ene ruten må være X og den andre Y. Fjern alle kandidater unntatt X og Y fra begge rutene.",
      "spot": "Gå gjennom en enhet tall for tall, merk deg hvor hvert tall kan stå, og se etter to tall som er begrenset til de samme to rutene."
    },
    "HIDDEN_TRIPLE": {
      "what": "Tre tall som alle fortsatt mangler i en enhet, og der plassene deres i den enheten ligger innenfor de samme tre rutene, selv om et tall ikke trenger å forekomme i alle tre.",
      "why": "Enheten trenger alle tre tallene i tre ulike ruter, og bare disse tre rutene kan ta dem, så tallene fyller alle tre rutene. Fjern alle kandidater unntatt de tre tallene fra de tre rutene.",
      "spot": "List opp de mulige rutene for hvert tall som mangler i en enhet, og se etter tre tall der listene til sammen bare nevner tre ruter."
    },
    "NAKED_QUADRUPLE": {
      "what": "Fire tomme ruter i samme enhet der kandidatene til sammen er nøyaktig fire tall, selv om ingen enkelt rute trenger å ha alle fire.",
      "why": "Fire ruter i én enhet trenger fire ulike tall, og bare de fire er tilgjengelige, så rutene bruker opp alle sammen. Fjern de fire tallene fra alle andre ruter i den enheten.",
      "spot": "I en enhet med mange tomme ruter ser du etter fire ruter der kandidatene aldri går utenfor de samme fire tallene."
    },
    "HIDDEN_QUADRUPLE": {
      "what": "Fire tall som alle fortsatt mangler i en enhet, og der plassene deres i den enheten ligger innenfor de samme fire rutene, selv om et tall ikke trenger å forekomme i alle fire.",
      "why": "Enheten trenger alle fire tallene i fire ulike ruter, og bare disse fire rutene kan ta dem, så tallene fyller alle fire rutene. Fjern alle kandidater unntatt de fire tallene fra de fire rutene.",
      "spot": "I en enhet med mange tomme ruter finner du tall med høyst fire plasser, og sjekker om fire av dem passer innenfor de samme fire rutene."
    },
    "X_WING": {
      "what": "Tallet X har nøyaktig to kandidater i hver av to rader, og alle fire ligger i de samme to kolonnene, eller tilsvarende med rader og kolonner byttet om.",
      "why": "Hver rad plasserer X i en av de to kolonnene, og de to radene kan ikke ha X i samme kolonne, så hver kolonne får sin X fra disse fire rutene. Fjern X fra alle andre ruter i de kolonnene, eller i de radene i den ombyttede formen.",
      "spot": "Filtrer på ett tall og se etter to rader, eller to kolonner, med bare to kandidater hver, som til sammen danner hjørnene i et rektangel."
    },
    "SWORDFISH": {
      "what": "Tallet X har to eller tre kandidater i hver av tre rader, og alle ligger i de samme tre kolonnene, eller tilsvarende med rader og kolonner byttet om.",
      "why": "De tre radene plasserer X i hver sin av de tre kolonnene, så alle tre kolonnene får sin X fra disse radene. Fjern X fra alle andre ruter i de kolonnene, eller i de radene i den ombyttede formen.",
      "spot": "Filtrer på ett tall og finn tre rader der kandidatene til sammen dekker bare tre kolonner: en rad kan godt bruke bare to av dem."
    },
    "JELLYFISH": {
      "what": "Tallet X har to til fire kandidater i hver av fire rader, og alle ligger i de samme fire kolonnene, eller tilsvarende med rader og kolonner byttet om.",
      "why": "De fire radene plasserer X i hver sin av de fire kolonnene, så alle fire kolonnene får sin X fra disse radene. Fjern X fra alle andre ruter i de kolonnene, eller i de radene i den ombyttede formen.",
      "spot": "Filtrer på ett tall og finn fire rader der kandidatene til sammen dekker bare fire kolonner: en rad kan godt bruke bare to av dem."
    },
    "SQUIRMBAG": {
      "what": "Tallet X har to til fem kandidater i hver av fem rader, og alle ligger i de samme fem kolonnene, eller tilsvarende med rader og kolonner byttet om.",
      "why": "De fem radene plasserer X i hver sin av de fem kolonnene, så alle fem kolonnene får sin X fra disse radene. Fjern X fra alle andre ruter i de kolonnene, eller i de radene i den ombyttede formen.",
      "spot": "Se på kolonnene utenfor mønsteret: høyst fire trenger fortsatt X, og de danner mindre fisker eller singler som gir de samme elimineringene."
    },
    "WHALE": {
      "what": "Tallet X har to til seks kandidater i hver av seks rader, og alle ligger i de samme seks kolonnene, eller tilsvarende med rader og kolonner byttet om.",
      "why": "De seks radene plasserer X i hver sin av de seks kolonnene, så alle seks kolonnene får sin X fra disse radene. Fjern X fra alle andre ruter i de kolonnene, eller i de radene i den ombyttede formen.",
      "spot": "Se på kolonnene utenfor mønsteret: høyst tre trenger fortsatt X, og de danner mindre fisker eller singler som gir de samme elimineringene."
    },
    "LEVIATHAN": {
      "what": "Tallet X har to til sju kandidater i hver av sju rader, og alle ligger i de samme sju kolonnene, eller tilsvarende med rader og kolonner byttet om.",
      "why": "De sju radene plasserer X i hver sin av de sju kolonnene, så alle sju kolonnene får sin X fra disse radene. Fjern X fra alle andre ruter i de kolonnene, eller i de radene i den ombyttede formen.",
      "spot": "Se på kolonnene utenfor mønsteret: høyst to trenger fortsatt X, og de danner en X-Wing eller singler som gir de samme elimineringene."
    },
    "REMOTE_PAIR": {
      "what": "En kjede av minst fire toverdiruter som alle har de samme to kandidatene X og Y, der hver rute ser den neste.",
      "why": "To ruter som følger etter hverandre i kjeden, må være ulike, så kjeden veksler mellom X og Y. En rute utenfor kjeden som ser to kjederuter et odde antall steg fra hverandre, ser én X og én Y, så både X og Y fjernes fra den.",
      "spot": "Finn fire eller flere toverdiruter med de samme to kandidatene, koble sammen dem som ser hverandre, og fargelegg kjeden vekselvis med to farger."
    },
    "CHUTE_REMOTE_PAIR": {
      "what": "To toverdiruter med X og Y som ikke ser hverandre, i én boksrekke (tre bokser på linje), der de tre rutene i boksrekken som ikke ser noen av dem, ikke har X, verken løst eller som kandidat.",
      "why": "Boksen med de tre rutene må ha sin X i raden eller kolonnen til en av parrutene, og da blir den ruten Y. Y fjernes fra alle ruter som ser begge parrutene, og X også hvis de tre rutene heller ikke har Y.",
      "spot": "Se i hver boksrekke etter to like toverdiruter uten felles enhet, og sjekk så de tre rutene i boksrekken som ikke ser noen av dem, for X og for Y etter tur."
    },
    "BUG_PLUS_1": {
      "what": "Alle uløste ruter er toverdiruter, unntatt én med tre kandidater, og i hver enhet forekommer hver kandidat nøyaktig to ganger, unntatt X, som forekommer tre ganger i hver av den rutens enheter.",
      "why": "Uten X i den ruten ville rutenettet bestå av bare toverdiruter med hver kandidat to ganger per enhet, så enhver løsning ville ha en tvilling der hver rute bruker sin andre kandidat. Forutsatt at oppgaven har nøyaktig én løsning, plasseres X i den ruten.",
      "spot": "Når alle uløste ruter unntatt én er toverdiruter, finner du ruten med tre kandidater: den kandidaten som forekommer tre ganger i rutens rad, er X."
    },
    "SKYSCRAPER": {
      "what": "To rader (eller kolonner) har hver et konjugert par for tallet X; én ende av hvert par deler kolonne (eller rad), og de andre endene ser ikke hverandre.",
      "why": "De to endene som deler kolonne (eller rad), kan ikke begge være X, så minst én av de to andre endene må være X. X elimineres fra alle ruter utenfor mønsteret som ser begge disse endene.",
      "spot": "Velg et tall, finn to rader der det har nøyaktig to plasser, og sjekk om to av disse plassene står i samme kolonne."
    },
    "TWO_STRING_KITE": {
      "what": "En rad og en kolonne har hver et konjugert par for X, på fire ulike ruter; én ende av hvert par ligger i samme boks, og de andre endene ser ikke hverandre.",
      "why": "De to endene i den felles boksen kan ikke begge være X, så minst én av de to andre endene må være X. X elimineres fra alle ruter utenfor mønsteret som ser begge disse endene.",
      "spot": "Finn en boks der et konjugert par i en rad og et konjugert par i en kolonne har én ende hver, og sjekk ruten som ser begge de ytre endene."
    },
    "TURBOT_FISH": {
      "what": "Tallet X danner to konjugerte par på fire ulike ruter; en ende av det ene paret ser en ende av det andre, og de resterende endene ser ikke hverandre.",
      "why": "De to endene som ser hverandre, kan ikke begge være X, så minst én av de resterende endene må være X. X elimineres fra alle ruter utenfor mønsteret som ser begge de resterende endene.",
      "spot": "Skyscraper og 2-String Kite er spesialtilfeller; ellers ser du etter former der minst ett av de konjugerte parene ligger i en boks."
    },
    "EMPTY_RECTANGLE": {
      "what": "Kandidatene for X i en boks ligger bare i én rad og én kolonne; et konjugert par i en kolonne (eller rad) utenfor boksen har én ende i den raden (eller kolonnen).",
      "why": "Når enden ligger i raden, står X i boksen enten i den raden, og da blir den andre enden X, eller i kolonnen; derfor fjernes X fra alle ruter i den kolonnen utenfor boksen som ser den andre enden. Ellers bytter rad og kolonne plass.",
      "spot": "Se etter en boks der fire ruter som danner et rektangel, ikke har kandidaten X, så X står igjen langs én rad og én kolonne."
    },
    "W_WING": {
      "what": "To toverdiruter, begge med kandidatene X og Z, ser ikke hverandre; et konjugert par for X har én ende som ser den første ruten og én som ser den andre.",
      "why": "Én ende av det konjugerte paret må være X, så toverdiruten den ser, mister X og blir Z. Minst én av toverdirutene er derfor Z, så Z elimineres fra alle ruter utenfor mønsteret som ser begge toverdirutene.",
      "spot": "Finn to like toverdiruter som ikke ser hverandre, og se etter et konjugert par på ett av tallene deres som binder dem sammen."
    },
    "XY_WING": {
      "what": "En pivot, en toverdirute med kandidatene X og Y, ser to klyper som også er toverdiruter: den ene med kandidatene X og Z, den andre med kandidatene Y og Z.",
      "why": "Er pivoten X, må klypen med X være Z; er pivoten Y, må klypen med Y være Z. Minst én klype er derfor Z, så Z elimineres fra alle andre ruter som ser begge klypene.",
      "spot": "Ta utgangspunkt i en toverdirute og se gjennom toverdirutene den ser, etter to som deler tallene dens mellom seg og har ett nytt tall felles."
    },
    "XYZ_WING": {
      "what": "En pivot med nøyaktig tre kandidater, X, Y og Z, ser to klyper som er toverdiruter: den ene med kandidatene X og Z, den andre med kandidatene Y og Z.",
      "why": "Er pivoten X eller Y, må klypen med det tallet være Z; ellers er pivoten selv Z. Minst én av de tre rutene er derfor Z, så Z elimineres fra alle andre ruter som ser alle tre.",
      "spot": "Finn en rute med tre kandidater, og se i boksen og langs raden eller kolonnen dens etter to toverdiruter med ulike par av kandidatene dens."
    },
    "WXYZ_WING": {
      "what": "Tre ruter i én enhet har til sammen nøyaktig kandidatene W, X, Y og Z; en fjerde rute, en toverdirute med X og Z, ser hver av dem som har X.",
      "why": "Er toverdiruten X, mister de tre rutene X og må dele W, Y og Z mellom seg, så én av dem er Z; ellers er toverdiruten Z. Z elimineres fra alle andre ruter som ser alle rutene i mønsteret som har kandidaten Z.",
      "spot": "Se etter tre ruter i en enhet med fire kandidater til sammen, og deretter etter en fjerde rute i nærheten, en toverdirute med to av de tallene."
    },
    "UNIQUENESS_1": {
      "what": "Fire ruter som danner et rektangel i nøyaktig to bokser, der tre har bare X og Y, og den fjerde har X, Y og minst én annen kandidat.",
      "why": "Hvis den fjerde ruten var X eller Y, ville de fire rutene bare ha X og Y, og å bytte dem om ville gi en løsning til. Forutsatt at oppgaven har nøyaktig én løsning, fjernes X og Y fra den fjerde ruten.",
      "spot": "Se etter tre toverdiruter med de samme to kandidatene i tre hjørner av et rektangel som ligger i nøyaktig to bokser."
    },
    "UNIQUENESS_2": {
      "what": "Et rektangel i nøyaktig to bokser der to hjørner har bare X og Y, og de to andre har nøyaktig X, Y og Z hver.",
      "why": "Hvis ingen av disse to hjørnene var Z, ville rektangelet bare ha X og Y, og å bytte dem om ville gi en løsning til. Forutsatt at oppgaven har nøyaktig én løsning, er minst ett av dem Z, så Z fjernes fra alle andre ruter som ser begge.",
      "spot": "Finn to toverdiruter med samme par i et rektangel, og sjekk om begge de andre hjørnene har én og samme ekstra kandidat i tillegg."
    },
    "UNIQUENESS_3": {
      "what": "Et rektangel i nøyaktig to bokser: to hjørner har bare X og Y, de andre deler en enhet, og ekstrakandidatene deres og kandidatene i K andre ruter der utgjør til sammen K+1 tall.",
      "why": "Forutsatt at oppgaven har nøyaktig én løsning, får ett av hjørnene med ekstrakandidater et av ekstratallene, ellers kunne X og Y byttes om og gi en løsning til. Det hjørnet og de K rutene bruker opp de K+1 tallene, som fjernes fra de øvrige rutene i enheten utenfor rektangelet.",
      "spot": "Når de to hjørnene med ekstrakandidater deler en enhet, ser du der etter ruter der alle kandidatene er blant disse ekstratallene."
    },
    "UNIQUENESS_4": {
      "what": "Et rektangel i nøyaktig to bokser: to hjørner har bare X og Y, de to andre har også ekstrakandidater og er de eneste plassene for X i en enhet de deler.",
      "why": "Ett av de to hjørnene må være X. Hvis det andre var Y, ville rektangelet bare ha X og Y, og å bytte dem om ville gi en løsning til, så forutsatt at oppgaven har nøyaktig én løsning, fjernes Y fra begge hjørnene.",
      "spot": "Når du har funnet to hjørner som er toverdiruter, sjekker du om X eller Y har nøyaktig to plasser i en enhet som de to andre hjørnene deler."
    },
    "UNIQUENESS_5": {
      "what": "Et rektangel i nøyaktig to bokser der ett hjørne har bare X og Y, og de tre andre har nøyaktig X, Y og Z hver.",
      "why": "Hvis ingen av de tre var Z, ville rektangelet bare ha X og Y, og å bytte dem om ville gi en løsning til. Forutsatt at oppgaven har nøyaktig én løsning, er minst ett av dem Z, så Z fjernes fra andre ruter som ser alle tre.",
      "spot": "Start i en toverdirute og se etter et rektangel der de tre andre hjørnene hver viser samme par pluss én felles ekstra kandidat."
    },
    "UNIQUENESS_6": {
      "what": "Et rektangel i nøyaktig to bokser: to diagonalt motsatte hjørner har bare X og Y, de andre har også ekstrakandidater, og rektangelets to rader, eller to kolonner, har ingen annen X.",
      "why": "Hvis et hjørne med ekstrakandidater var X, ville resten av rektangelet bli tvunget til bare X og Y, og å bytte dem om ville gi en løsning til. Forutsatt at oppgaven har nøyaktig én løsning, fjernes X fra begge hjørnene med ekstrakandidater.",
      "spot": "Står toverdirutene i diagonalt motsatte hjørner, sjekker du om X eller Y danner et konjugert par inne i rektangelet i begge radene eller begge kolonnene."
    },
    "HIDDEN_RECTANGLE": {
      "what": "Et rektangel i nøyaktig to bokser med X og Y i alle hjørner, der ett hjørne ikke har noe annet, og der X i raden og kolonnen til hjørnet overfor bare har plass i rektangelets hjørner.",
      "why": "Hvis hjørnet overfor var Y, ville X bli tvunget inn i de to tilstøtende hjørnene og Y inn i toverdiruten, så X og Y kunne byttes om og gi en løsning til. Forutsatt at oppgaven har nøyaktig én løsning, fjernes Y fra hjørnet overfor.",
      "spot": "Ta utgangspunkt i en toverdirute og sjekk hjørnet overfor: ett av de to tallene må danne et konjugert par både i raden og i kolonnen til det hjørnet."
    },
    "AVOIDABLE_RECTANGLE_1": {
      "what": "Et rektangel i nøyaktig to bokser med tre løste hjørner, ingen av dem gitte tall: de to som ser det uløste hjørnet, er begge Y, og det overfor er X.",
      "why": "Hvis det uløste hjørnet var X, ville de fire rutene bare ha X og Y, og å bytte dem om ville gi en løsning til uten å endre noe gitt tall. Forutsatt at oppgaven har nøyaktig én løsning, fjernes X fra det hjørnet.",
      "spot": "Hold gitte tall og dine egne plasseringer visuelt atskilt, og se etter tre av plasseringene dine i et rektangel som bare bruker to tall."
    },
    "AVOIDABLE_RECTANGLE_2": {
      "what": "Et rektangel i nøyaktig to bokser: to hjørner i én rad eller kolonne er løst, men ikke gitte tall, og hvert uløste hjørne har bare Z og tallet i hjørnet diagonalt overfor.",
      "why": "Hvis ingen av de uløste hjørnene var Z, ville rektangelet ha to tall som kunne byttes om uten å røre et gitt tall, og det ville gi en løsning til. Forutsatt at oppgaven har nøyaktig én løsning, er ett av dem Z, så Z fjernes fra alle andre ruter som ser begge.",
      "spot": "Se etter to av dine egne plasseringer i én rad eller kolonne i et rektangel der de andre hjørnene er toverdiruter med én felles kandidat."
    },
    "EXTENDED_RECTANGLE": {
      "what": "Seks uløste ruter der to rader krysser tre kolonner, eller to kolonner krysser tre rader, i nøyaktig tre bokser, med tre tall pluss ekstrakandidater i én rute eller ett ekstra tall.",
      "why": "Uten ekstrakandidater kunne de to rutene i hver boks bytte verdier, og det ville gi en løsning til. Forutsatt at oppgaven har nøyaktig én løsning, mister ruten med ekstrakandidater de tre tallene, eller det ekstra tallet fjernes fra ruter utenfor mønsteret som ser alle mønsterrutene som har det.",
      "spot": "Se etter tre tall som går igjen i to rader eller to kolonner gjennom de samme tre boksene, med to ruter i hver boks."
    },
    "FINNED_X_WING": {
      "what": "To rader (eller kolonner) har kandidaten X i alle fire hjørnene av et rektangel, og de eneste andre kandidatene deres for X, finnene, ligger alle i boksen til ett av hjørnene.",
      "why": "Er ingen finne sann, fjerner en vanlig X-Wing X andre steder i kolonnene sine; er én finne sann, har boksen dens ingen annen X. Ruter i disse kolonnene som ligger i finneboksen, utenfor de to radene, mister X, og det samme gjelder med rader og kolonner byttet om.",
      "spot": "Se etter to rader eller kolonner som ville dannet en X-Wing om det ikke var for noen ekstra kandidater, som alle ligger i boksen til ett hjørne."
    },
    "SASHIMI_X_WING": {
      "what": "To rader (eller kolonner) har kandidaten X i tre hjørner av et rektangel, og de eneste andre kandidatene deres for X, finnene, ligger alle i boksen til hjørnet som mangler.",
      "why": "Er ingen finne sann, får begge kolonnene sin X fra de to radene; er én finne sann, har boksen dens ingen annen X. Ruter i disse kolonnene som ligger i finneboksen, utenfor de to radene, mister X, og det samme gjelder med rader og kolonner byttet om.",
      "spot": "Se etter en X-Wing der ett hjørne mangler, og der raden eller kolonnen med hullet har de andre kandidatene sine for X inne i boksen til hullet."
    },
    "FINNED_SWORDFISH": {
      "what": "Tre rader (eller kolonner) har kandidaten X bare i tre felles kolonner (eller rader) pluss finner, ekstra ruter som alle ligger i én boks, og hver rad har minst to kandidater som ikke er finner.",
      "why": "Er ingen finne sann, fjerner en vanlig Swordfish X andre steder i kolonnene sine; er én finne sann, har boksen dens ingen annen X. Ruter i disse kolonnene som ligger i finneboksen, utenfor de tre radene, mister X, og det samme gjelder med rader og kolonner byttet om.",
      "spot": "Når tre rader nesten danner en Swordfish, sjekk om alle de ekstra kandidatene for X ligger i én og samme boks, som en av de tre kolonnene krysser."
    },
    "SASHIMI_SWORDFISH": {
      "what": "Tre rader (eller kolonner) har kandidaten X bare i tre felles kolonner (eller rader) pluss finner, ekstra ruter i én boks, og en rad med finner har bare én kandidat som ikke er finne.",
      "why": "Er ingen finne sann, får alle tre kolonnene sin X fra de tre radene; er én finne sann, har boksen dens ingen annen X. Ruter i disse kolonnene som ligger i finneboksen, utenfor de tre radene, mister X, og det samme gjelder med rader og kolonner byttet om.",
      "spot": "Se etter en Swordfish der én rad har én enkelt kandidat som ikke er finne, pluss andre kandidater for X i én boks som en annen av Swordfish-kolonnene krysser."
    },
    "FINNED_JELLYFISH": {
      "what": "Fire rader (eller kolonner) har kandidaten X bare i fire felles kolonner (eller rader) pluss finner, ekstra ruter som alle ligger i én boks, og hver rad har minst to kandidater som ikke er finner.",
      "why": "Er ingen finne sann, fjerner en vanlig Jellyfish X andre steder i kolonnene sine; er én finne sann, har boksen dens ingen annen X. Ruter i disse kolonnene som ligger i finneboksen, utenfor de fire radene, mister X, og det samme gjelder med rader og kolonner byttet om.",
      "spot": "Finn fire rader der kandidatene for X passer i fire kolonner, bortsett fra noen få ekstra som alle ligger i én boks som en av de kolonnene krysser."
    },
    "SASHIMI_JELLYFISH": {
      "what": "Fire rader (eller kolonner) har kandidaten X bare i fire felles kolonner (eller rader) pluss finner, ekstra ruter i én boks, og en rad med finner har bare én kandidat som ikke er finne.",
      "why": "Er ingen finne sann, får alle fire kolonnene sin X fra de fire radene; er én finne sann, har boksen dens ingen annen X. Ruter i disse kolonnene som ligger i finneboksen, utenfor de fire radene, mister X, og det samme gjelder med rader og kolonner byttet om.",
      "spot": "Finn fire rader som passer i fire kolonner, der én rad har én enkelt kandidat som ikke er finne og de ekstra kandidatene ligger i én boks som en annen kolonne krysser."
    },
    "SUE_DE_COQ": {
      "what": "To eller tre ruter i en boks, i samme rad eller kolonne, har til sammen to kandidater mer enn antallet ruter; to toverdiruter, én et annet sted i hver av de to enhetene, deler fire av disse kandidatene mellom seg.",
      "why": "Med like mange ruter som kandidater plasserer mønsteret hver kandidat én gang. Kandidatene i toverdiruten i boksen fjernes fra resten av boksen, kandidatene i den andre toverdiruten fra resten av raden eller kolonnen, og eventuelle øvrige kandidater fra begge.",
      "spot": "Se etter to eller tre ruter med mange kandidater der en boks møter en rad eller kolonne, med en toverdirute et annet sted i hver av de to enhetene."
    },
    "SIMPLE_COLORS": {
      "what": "For ett tall X danner ruter som er forbundet gjennom konjugerte par, en klynge, som fargelegges med to farger slik at de to rutene i hvert konjugert par får motsatt farge.",
      "why": "Den ene fargen har X i alle sine ruter, den andre i ingen. Ser to ruter med samme farge hverandre, er den fargen usann, og X fjernes fra alle rutene dens; hver ufarget rute som ser ruter med begge farger, mister også X.",
      "spot": "Velg et tall, merk hver enhet der det har nøyaktig to plasser, og følg parene som deler en rute, for å bygge klyngen."
    },
    "MULTI_COLORS": {
      "what": "For ett tall X fargelegges to separate klynger av konjugerte par vekselvis, hver med sine egne to farger, og en rute i den ene klyngen ser en rute i den andre.",
      "why": "To farger som ser hverandre, kan ikke begge være sanne, så X fjernes fra hver rute utenfor begge klyngene som ser ruter med begge de to andre fargene. En farge som ser begge fargene i den andre klyngen, er usann: fjern X fra alle rutene dens.",
      "spot": "Fargelegg to separate klynger for samme tall med fire farger, og se så etter en enhet som har en farget rute fra hver klynge."
    },
    "MEDUSA_3D": {
      "what": "Kandidater for flere tall, forbundet gjennom konjugerte par eller ved å dele en toverdirute, danner en klynge som fargelegges vekselvis med to farger, slik at lenkede kandidater får motsatt farge.",
      "why": "Nøyaktig én farge er sann i sin helhet. En hel farge fjernes hvis den setter to tall i én rute, samme tall to ganger i én enhet, eller etterlater en rute uten kandidater; en ufarget kandidat fjernes hvis den er usann uansett hvilken farge som er sann.",
      "spot": "Begynn i en toverdirute og arbeid deg utover gjennom konjugerte par og andre toverdiruter, og fargelegg kandidatene vekselvis underveis."
    },
    "X_CHAIN": {
      "what": "Fire eller flere ruter med kandidaten X i en kjede der lenkene veksler mellom konjugerte par (sterke) og ruter som ser hverandre (svake), og som begynner og slutter med en sterk lenke.",
      "why": "Er den ene enden ikke X, tvinger de sterke lenkene fram X og de svake utelukker den, etter tur, til den andre enden blir X. Minst én ende er derfor X, så X fjernes fra hver rute utenfor kjeden som ser begge endene.",
      "spot": "Filtrer rutenettet på ett tall, merk de konjugerte parene for det, og koble parene ende mot ende der to av rutene deres ser hverandre."
    },
    "X_CYCLES": {
      "what": "En lukket sløyfe av ruter med kandidaten X, der lenkene veksler mellom sterke og svake hele veien rundt, eller overalt unntatt i én rute der to sterke eller to svake lenker møtes.",
      "why": "I en sløyfe som veksler hele veien rundt, har hver svak lenke X i den ene enden, så X fjernes fra ruter utenfor som ser begge endene av en svak lenke. Møtes to sterke lenker, plasseres X i den ruten, og møtes to svake lenker, fjernes X fra den.",
      "spot": "Tegn de konjugerte parene for ett tall, koble dem sammen der ruter ser hverandre, og sjekk om kjeden vender tilbake til ruten den startet i."
    },
    "GROUPED_X_CYCLES": {
      "what": "En X-Cycles-sløyfe der en gruppe på to eller tre X-kandidater i én boks og én rad eller kolonne virker som én rute, og gruppen er sann hvis minst én av dem er X.",
      "why": "Å se en gruppe betyr å se alle medlemmene. En sløyfe som veksler hele veien, fjerner X fra ruter utenfor som ser begge endene av en svak lenke; en node der to sterke lenker møtes, er sann, så ruter som ser den, mister X, og en node der to svake lenker møtes, mister X.",
      "spot": "Se etter en enhet der alle X-kandidatene ligger i en gruppe pluss én annen rute eller gruppe: de to endene er sterkt lenket."
    },
    "XY_CHAIN": {
      "what": "En kjede av toverdiruter der hver ser den neste og er knyttet til den med en felles kandidat som skifter i hver rute, slik at begge endene har en ubrukt kandidat Z.",
      "why": "Er den ene enden ikke Z, får den koblingskandidaten sin, og hver påfølgende rute tvinges til sin andre kandidat, helt til den andre enden blir Z. Minst én ende er Z, så Z fjernes fra hver rute utenfor kjeden som ser begge endene.",
      "spot": "Start i en toverdirute, anta at den ikke er Z, følg de tvungne tallene gjennom toverdiruter, og stopp når én av dem blir Z."
    },
    "TWINNED_XY_CHAIN": {
      "what": "Seks ruter der to rader krysser tre kolonner, eller omvendt, som til sammen har nøyaktig seks ulike tall som kandidater, og der mønsterrutene for hvert tall alle ser hverandre.",
      "why": "Hvert tall kan fylle høyst én mønsterrute, men seks ruter trenger seks tall, så hvert tall brukes nøyaktig én gang. Hvert av de seks tallene, X, fjernes fra hver rute utenfor mønsteret som ser alle mønsterrutene som har X.",
      "spot": "Finn tre toverdiruter i én rad eller kolonne som deler et tall, og let så i en parallell rad eller kolonne etter de tre andre rutene."
    },
    "NICE_LOOP": {
      "what": "En sløyfe av kandidater der lenkene veksler mellom sterke og svake, enten feilfritt hele veien rundt eller overalt unntatt i én kandidat der to sterke eller to svake lenker møtes.",
      "why": "Med feilfri veksling er én ende av hver svak lenke sann: deler endene en rute, fjernes rutens andre kandidater, ellers fjernes tallet deres fra ruter som ser begge. En kandidat der to sterke lenker møtes, plasseres, og en der to svake lenker møtes, elimineres.",
      "spot": "Følg vekslende lenker ut fra en toverdirute eller et konjugert par, og følg med på om kjeden vender tilbake og lenker seg til kandidaten den startet fra."
    },
    "GROUPED_NICE_LOOP": {
      "what": "En Nice Loop med minst én gruppenode: to eller tre ruter med kandidaten X i én boks og én rad eller kolonne, sann hvis minst én av dem blir X.",
      "why": "Med feilfri veksling er én ende av hver svak lenke sann, så enhver kandidat som er svakt lenket til begge endene, elimineres. En node der to sterke lenker møtes, er sann: en kandidat plasseres, og en gruppe fjerner X fra ruter utenfor som ser alle rutene i gruppen.",
      "spot": "Der de eneste plassene for X i en enhet er en gruppe pluss én annen rute eller gruppe, kan du bruke den sterke lenken til å forlenge en sløyfe."
    },
    "ALS_XZ": {
      "what": "To nesten låste mengder, hver innenfor én enhet og uten felles ruter, inneholder begge de to tallene X og Z, og hver X i den ene ser hver X i den andre.",
      "why": "X kan ikke plasseres i begge mengdene, så minst én av dem står igjen med like mange kandidater som ruter og må inneholde Z. Derfor fjernes Z fra hver rute utenfor begge mengdene som ser hver Z i begge mengdene.",
      "spot": "Begynn med små mengder som toverdiruter, finn to som deler to tall, og sjekk så om rutene med det ene tallet alle ser hverandre."
    },
    "ALS_XY_WING": {
      "what": "Tre nesten låste mengder uten felles ruter: hver X i hengselet ser hver X i den ene vingen, hver Y i hengselet ser hver Y i den andre, og begge vingene har et annet tall Z.",
      "why": "Hengselet kan mangle bare ett tall, så det får X eller Y, og det tallet fjernes fra den tilhørende vingen, som da blir en låst mengde som inneholder Z. Derfor fjernes Z fra hver rute utenfor alle tre mengdene som ser hver Z i begge vingene.",
      "spot": "Tenk deg en XY-Wing der rutene har vokst til mengder: finn et hengsel som er lenket til to vinger med ulike tall, og se så etter en felles Z."
    },
    "ALS_XY_CHAIN": {
      "what": "Fire nesten låste mengder danner en kjede: nabomengder deler et koblingstall der alle rutene med tallet ser hverandre, hver midtre mengde har ulike koblingstall på hver side, og begge endene har et annet tall Z.",
      "why": "Mangler den ene enden Z, blir den låst og plasserer koblingstallet sitt, som fjernes fra neste mengde, og slik videre til den andre enden må plassere Z. Derfor fjernes Z fra hver rute utenfor kjeden som ser hver Z i begge endene.",
      "spot": "Bygg kjeden ledd for ledd av små mengder som toverdiruter, og sjekk etter tre lenker om begge endene har en felles kandidat."
    },
    "AIC": {
      "what": "En kjede av kandidater, som kan blande ulike tall, der lenkene veksler mellom sterk, svak, sterk og så videre, og som begynner og slutter med en sterk lenke.",
      "why": "Er den ene enden usann, tvinger lenkene den andre til å være sann, så minst én ende er sann. Enhver kandidat som er svakt lenket til begge endene, elimineres, enten lenken går gjennom en felles rute eller gjennom samme tall i ruter som ser hverandre.",
      "spot": "Konjugerte par og toverdiruter gir de sterke lenkene: koble dem der to kandidater deler en rute, eller deler både tall og enhet."
    },
    "AIC_GROUPED": {
      "what": "En AIC med minst én gruppenode: to eller tre ruter med kandidaten X i én boks og én rad eller kolonne, sann hvis minst én av dem blir X.",
      "why": "En gruppe og en annen X-node er sterkt lenket når de til sammen er de eneste plassene for X i en enhet, og svakt lenket når alle rutene deres ser hverandre. Minst én ende av kjeden er sann, så enhver kandidat som er svakt lenket til begge endene, elimineres.",
      "spot": "Når en kjede stopper opp i en enhet med tre plasser for X, sjekk om to av dem danner en gruppe, så du får en sterk lenke igjen."
    },
    "AIC_ALS": {
      "what": "En AIC som bruker en ALS som sterk lenke mellom to av tallene i ALS-en: står X ingen steder i ALS-en, må Y stå et sted i den.",
      "why": "Uten X har ALS-en N kandidater for N ruter, så alle plasseres, også Y. Minst én ende er sann, så kandidater som er svakt lenket til begge, elimineres: et tall i ALS-en er svakt lenket til samme tall i ruter utenfor som ser alle ALS-rutene som har det.",
      "spot": "En toverdirute gir allerede en sterk lenke, så se deretter på to ruter i én enhet som har tre kandidater til sammen."
    },
    "DEATH_BLOSSOM": {
      "what": "Hver kandidat i en stammerute har sitt eget kronblad, en nesten låst mengde der den kandidaten bare finnes i ruter som ser stammen; hvert kronblad har Z, som stammen mangler.",
      "why": "Uansett hvilket tall stammen får, fjernes det fra kronbladet sitt, som da blir en låst mengde og må inneholde Z. Derfor fjernes Z fra hver rute utenfor stammen og kronbladene som ser hver Z i hvert kronblad.",
      "spot": "Start i en rute med to eller tre kandidater, og let så i nærheten etter én liten mengde per kandidat, som alle deler et annet tall."
    },
    "FRANKEN_X_WING": {
      "what": "To basisenheter (rader eller bokser) har ingen felles kandidat for X, og alle X-kandidatene deres ligger i to dekkenheter (kolonner eller bokser) uten felles kandidat, eller med rader og kolonner byttet om.",
      "why": "Hver basisenhet plasserer X én gang, i ulike ruter, og hver dekkenhet har plass til én X, så begge dekkenhetene får sin X fra basen. Fjern X fra hver rute i dekkenhetene som ligger utenfor basisenhetene.",
      "spot": "Filtrer på X og prøv to rader eller bokser mot to kolonner eller bokser: minst én av de fire enhetene må være en boks."
    },
    "FRANKEN_SWORDFISH": {
      "what": "Tre basisenheter (rader eller bokser) har ingen felles kandidat for X, og alle X-kandidatene deres ligger i tre dekkenheter (kolonner eller bokser) uten felles kandidat, eller med rader og kolonner byttet om.",
      "why": "Hver basisenhet plasserer X én gang, i ulike ruter, og hver dekkenhet har plass til én X, så alle tre dekkenhetene får sin X fra basen. Fjern X fra hver rute i dekkenhetene som ligger utenfor basisenhetene.",
      "spot": "Filtrer på X og prøv tre rader eller bokser mot tre kolonner eller bokser: minst én av de seks enhetene må være en boks."
    },
    "FIREWORKS": {
      "what": "Tre tall som mangler i både en rad og en kolonne, der kandidatene deres i de to enhetene, utenfor boksen der de krysser hverandre, alle står i én vingerute i hver.",
      "why": "Hvert tall står i en vinge, ellers står det inne i boksen for både raden og kolonnen, og det kan bare være ruten der de krysser hverandre. Tre tall fyller derfor disse tre rutene, som mister alle kandidater unntatt de tre tallene.",
      "spot": "Undersøk en rad og en kolonne som krysser hverandre i en boks, og se etter tall der kandidatene utenfor boksen står i én enkelt rute i hver av dem."
    },
    "TRIDAGON": {
      "what": "Fire bokser som danner et rektangel, har hver tre ruter på en diagonal, der én boks skrår motsatt vei av de tre andre; bare én rute, vokteren, har andre kandidater enn X, Y og Z.",
      "why": "Tolv slike ruter kan aldri alle fylles med X, Y og Z uten at et tall gjentas i en rad, kolonne eller boks. Vokteren må derfor få en av de andre kandidatene sine, og X, Y og Z elimineres fra den.",
      "spot": "Se etter fire bokser fulle av de samme tre kandidatene; diagonalene kan fortsette på motsatt side av boksen når de treffer kanten, og de går trinnvis mot høyre eller venstre nedover."
    },
    "SK_LOOP": {
      "what": "Fire løste ruter som danner et rektangel i fire bokser; radene og kolonnene deres inne i boksene gir åtte rutepar, som hvert har fire kandidater, to av dem felles med hvert av naboparene.",
      "why": "Nabopar deler en boks, rad eller kolonne, så hvert felles tall får plass bare én gang i de fire rutene deres. Åtte slike lenker fyller høyst seksten ruter, nøyaktig sløyfens størrelse, så hvert felles tall blir brukt og fjernes fra resten av den enheten.",
      "spot": "Se etter fire løste ruter som danner et rektangel over fire bokser, der raden og kolonnen til hver av dem ellers er uløst inne i boksen."
    },
    "ALIGNED_PAIR_EXCLUSION": {
      "what": "To ruter som ser hverandre, sammen med én eller flere nesten låste mengder, toverdiruter medregnet, der hver rute i mengdene ser begge de to rutene.",
      "why": "De to rutene kan ikke ha samme tall, og heller ikke to tall som begge er kandidater i én slik ALS, for da ville den få ett tall for lite. En kandidat i en av rutene elimineres når alle kombinasjonene med den andre rutens kandidater er utelukket.",
      "spot": "Velg to ruter i samme enhet med få kandidater, og se så etter toverdiruter eller små ALS-er som begge rutene ser."
    },
    "EXOCET": {
      "what": "Langs én rad eller kolonne har to basisruter i én boks til sammen tre eller fire kandidater; de to andre boksene som linjen går gjennom, har hver en målrute som verken ser basen eller den andre målruten.",
      "why": "Når hvert basistall som plasseres i en basisrute, også tvinges inn i en målrute, får målrutene de samme to tallene som basen. Målrutene mister alle kandidater som ikke er basistall, og basistall som ikke finnes i noen av målrutene, fjernes fra begge basisrutene.",
      "spot": "Start med to ruter i samme boks og samme rad eller kolonne som har tre eller fire kandidater, og følg så hvert tall for seg fra basen til målrutene."
    },
    "DOUBLE_EXOCET": {
      "what": "To gyldige Exocet-mønstre der basisparene ligger i ulike bokser i samme rad eller kolonne, og der hvert par har de samme fire kandidatene til sammen i sine to ruter.",
      "why": "De fire basisrutene ligger i samme rad eller kolonne og har bare disse fire kandidatene, så til sammen får de alle fire tallene. Disse tallene elimineres derfor fra alle andre ruter i raden eller kolonnen, i tillegg til elimineringene fra hver Exocet.",
      "spot": "Når du har funnet én Exocet, let i samme rad eller kolonne, i en annen boks, etter et nytt basispar med de samme fire kandidatene."
    },
    "PATTERN_OVERLAY": {
      "what": "Alle fullstendige mønstre for ett tall X listes opp: ni ruter, én i hver rad, kolonne og boks, som inneholder hver plassert X og ellers bare ruter med kandidaten X.",
      "why": "I løsningen danner de ni rutene med X nøyaktig ett av disse mønstrene. En kandidat X som ikke ligger i noe mønster, elimineres, og en tom rute som ligger i alle mønstrene, må være X.",
      "spot": "Velg et tall som allerede er plassert flere ganger og har få kandidater igjen, så bare en håndfull fullstendige mønstre gjenstår å skrive opp."
    },
    "FORCING_CHAIN": {
      "what": "Én antakelse, eller hver av flere antakelser som til sammen dekker alle tilfeller, for eksempel alle kandidatene i én rute, følges gjennom stegene den tvinger fram.",
      "why": "Én av flere antakelser som dekker alle tilfeller, må være sann, så enhver plassering eller eliminering som hver eneste av dem tvinger fram, er sikker. En antakelse som fører til en motsigelse, er usann: en kandidat som ble antatt sann, elimineres, og en som ble antatt usann, plasseres.",
      "spot": "Begynn der valget er minst, i en toverdirute eller et konjugert par, og noter hver gjennomgang i sin egen farge, så du kan sammenligne dem."
    },
    "DIGIT_FORCING_CHAIN": {
      "what": "Én kandidat følges begge veier, én gang antatt sann og én gang antatt usann, og hver gang plasseres de nakne og skjulte singlene som følger; så sammenlignes de to resultatene.",
      "why": "Kandidaten er enten sann eller usann, så det begge gjennomgangene er enige om, er sikkert: et tall som begge plasserer i samme rute, plasseres, og en kandidat som begge fjerner, elimineres. Ender gjennomgangen der kandidaten er antatt usann, i en motsigelse, plasseres kandidaten selv.",
      "spot": "Start med en kandidat i en toverdirute eller et konjugert par, for der tvinger også gjennomgangen der kandidaten er usann, fram en plassering med en gang."
    },
    "NISHIO_FORCING_CHAIN": {
      "what": "Én kandidat antas å være sann, og singlene den tvinger fram, ender i en motsigelse: en tom rute uten kandidater, eller en enhet uten plass til et tall den mangler.",
      "why": "Hver naken eller skjult singel i gjennomgangen er en sikker følge av antakelsen, så motsigelsen beviser at antakelsen er usann. Den antatte kandidaten elimineres, og ingenting annet fra gjennomgangen beholdes.",
      "spot": "Test en kandidat X der ruten ser flere toverdiruter som har X, for antar du at den er sann, blir hver av dem en naken singel."
    },
    "CELL_FORCING_CHAIN": {
      "what": "Hver kandidat i én rute antas etter tur å være sann, og hver gang plasseres de nakne og skjulte singlene som følger; så sammenlignes resultatene.",
      "why": "Ruten må få en av kandidatene sine, så én av gjennomgangene følger det sanne tilfellet. Et tall som hver gjennomgang plasserer i samme rute, plasseres, og en kandidat som hver gjennomgang fjerner, elimineres.",
      "spot": "Velg en rute med to eller tre kandidater som ser toverdiruter som deler disse kandidatene, så hver antakelse utløser en rekke singler."
    },
    "UNIT_FORCING_CHAIN": {
      "what": "Hver plass for et tall X i én enhet antas etter tur å være den riktige, og hver gang plasseres de nakne og skjulte singlene som følger; så sammenlignes resultatene.",
      "why": "X må stå et sted i enheten, så én av gjennomgangene følger det sanne tilfellet. Et tall som hver gjennomgang plasserer i samme rute, plasseres, og en kandidat som hver gjennomgang fjerner, elimineres.",
      "spot": "Start med et konjugert par, som bare trenger to gjennomganger, og prøv så tall som har tre plasser igjen i en enhet."
    },
    "FORCING_NET": {
      "what": "Én kandidat antas sann og følges gjennom låste kandidater og nakne og skjulte singler, der hvert steg kan bygge på flere tidligere steg, til det oppstår en motsigelse.",
      "why": "Hvert steg er en sikker følge av antakelsen, så en motsigelse, en tom rute uten kandidater eller en enhet uten plass til et tall, beviser at antakelsen er usann. Bare den antatte kandidaten elimineres.",
      "spot": "Når singlene stopper opp uten motsigelse, se etter et tall som i en enhet er begrenset til rutene der en boks krysser en rad eller kolonne."
    },
    "BRUTE_FORCE": {
      "what": "Ikke noe mønster i det hele tatt: tall prøves i de tomme rutene ett etter ett, med et skritt tilbake ved hver blindvei, til hele rutenettet er fylt.",
      "why": "Et rutenett som er fylt uten å bryte noen regel, er en løsning, og en gyldig oppgave har nøyaktig én. Et tall fra den løsningen plasseres i en tom rute, uten noe resonnement en spiller kan følge.",
      "spot": "Det er ingenting å se etter: må du gjette for hånd, velg en toverdirute og noter hvor gjetningen startet."
    }
  },
  "techAka": {
    "LOCKED_CANDIDATES_1": [
      "Pekende par",
      "Pekende trippel"
    ],
    "LOCKED_CANDIDATES_2": [
      "Boks-linje-reduksjon"
    ],
    "REMOTE_PAIR": [
      "Fjernpar"
    ],
    "SKYSCRAPER": [
      "Skyskraper"
    ],
    "EMPTY_RECTANGLE": [
      "Tomt rektangel"
    ],
    "SIMPLE_COLORS": [
      "fargelegging"
    ],
    "MULTI_COLORS": [
      "multifargelegging"
    ],
    "X_CHAIN": [
      "X-kjede"
    ],
    "XY_CHAIN": [
      "XY-kjede"
    ],
    "NICE_LOOP": [
      "kontinuerlig sløyfe",
      "diskontinuerlig sløyfe"
    ],
    "AIC": [
      "vekslende slutningskjede"
    ],
    "PATTERN_OVERLAY": [
      "mønsteroverlegg"
    ],
    "FORCING_CHAIN": [
      "tvangskjede"
    ],
    "FORCING_NET": [
      "tvangsnett"
    ],
    "BRUTE_FORCE": [
      "gjetting",
      "brute force"
    ]
  },
  "kin": {
    "FULL_HOUSE": [
      "naken og skjult singel på én gang"
    ],
    "NAKED_SINGLE": [
      "naken delmengde av størrelse én"
    ],
    "HIDDEN_SINGLE": [
      "1-fisk",
      "skjult delmengde av størrelse én"
    ],
    "LOCKED_PAIR": [
      "Naket par som rydder to enheter"
    ],
    "LOCKED_TRIPLE": [
      "Naken trippel som rydder to enheter"
    ],
    "LOCKED_CANDIDATES_1": [
      "1-fisk: fra boks til linje"
    ],
    "LOCKED_CANDIDATES_2": [
      "Boks-linje-reduksjon",
      "1-fisk: fra linje til boks"
    ],
    "NAKED_PAIR": [
      "motstykket til en skjult delmengde",
      "i en linje: X-Wing sett fra siden"
    ],
    "NAKED_TRIPLE": [
      "motstykket til en skjult delmengde",
      "i en linje: Swordfish sett fra siden"
    ],
    "NAKED_QUADRUPLE": [
      "motstykket til en skjult delmengde",
      "i en linje: Jellyfish sett fra siden"
    ],
    "HIDDEN_PAIR": [
      "motstykket til en naken delmengde",
      "i en linje: X-Wing sett fra siden"
    ],
    "HIDDEN_TRIPLE": [
      "motstykket til en naken delmengde",
      "i en linje: Swordfish sett fra siden"
    ],
    "HIDDEN_QUADRUPLE": [
      "motstykket til en naken delmengde",
      "i en linje: Jellyfish sett fra siden"
    ],
    "X_WING": [
      "2-fisk",
      "Naket par sett fra siden",
      "X-Cycle med 4 kandidater"
    ],
    "SWORDFISH": [
      "3-fisk",
      "Naken trippel sett fra siden"
    ],
    "JELLYFISH": [
      "4-fisk",
      "Naken kvartett sett fra siden"
    ],
    "SQUIRMBAG": [
      "5-fisk",
      "motstykket til en mindre fisk"
    ],
    "WHALE": [
      "6-fisk",
      "motstykket til en mindre fisk"
    ],
    "LEVIATHAN": [
      "7-fisk",
      "motstykket til en mindre fisk"
    ],
    "SKYSCRAPER": [
      "Turbot Fish-form",
      "X-Chain med 4 kandidater",
      "to Sashimi X-Wing"
    ],
    "TWO_STRING_KITE": [
      "Turbot Fish-form",
      "X-Chain med 4 kandidater"
    ],
    "TURBOT_FISH": [
      "X-Chain med 4 kandidater"
    ],
    "EMPTY_RECTANGLE": [
      "Grouped Nice Loop"
    ],
    "W_WING": [
      "en kort AIC, ikke bøyd"
    ],
    "XY_WING": [
      "Y-Wing",
      "bøyd trippel",
      "XY-Chain med 3 ruter"
    ],
    "XYZ_WING": [
      "bøyd trippel",
      "ALS-XZ"
    ],
    "WXYZ_WING": [
      "bøyd kvartett",
      "ALS-XZ"
    ],
    "SIMPLE_COLORS": [
      "alle X-Chains i én klynge"
    ],
    "MULTI_COLORS": [
      "X-Chains og sløyfer over to klynger"
    ],
    "MEDUSA_3D": [
      "fargelegging på tvers av alle tall"
    ],
    "REMOTE_PAIR": [
      "XY-Chain på ett enkelt tallpar"
    ],
    "X_CHAIN": [
      "AIC på ett tall"
    ],
    "X_CYCLES": [
      "Nice Loop på ett tall"
    ],
    "GROUPED_X_CYCLES": [
      "Grouped Nice Loop på ett tall"
    ],
    "XY_CHAIN": [
      "XY-Wing er tilfellet med 3 ruter"
    ],
    "NICE_LOOP": [
      "en AIC skrevet som en sløyfe"
    ],
    "AIC": [
      "samlebegrep for X- og XY-Chains"
    ],
    "ALS_XZ": [
      "ALS-kjede med to mengder",
      "VWXYZ-Wing er et spesialtilfelle"
    ],
    "ALS_XY_WING": [
      "XY-Wing bygd av mengder"
    ],
    "ALS_XY_CHAIN": [
      "XY-Chain bygd av mengder"
    ],
    "DEATH_BLOSSOM": [
      "Cell Forcing Chain gjennom mengder"
    ],
    "SUE_DE_COQ": [
      "Two-Sector Disjoint Subsets"
    ],
    "AVOIDABLE_RECTANGLE_1": [
      "Unikt rektangel med ruter du har løst"
    ],
    "AVOIDABLE_RECTANGLE_2": [
      "Unikt rektangel med ruter du har løst"
    ],
    "ALIGNED_PAIR_EXCLUSION": [
      "XYZ-Wing er et spesialtilfelle"
    ],
    "PATTERN_OVERLAY": [
      "alle mønstre for ett tall samtidig"
    ]
  },
  "categories": {
    "Singles": {
      "label": categoryLabels["Singles"],
      "note": "Grunnlaget i hver løsning: en rute med bare ett mulig tall, eller et tall med bare én mulig rute."
    },
    "Intersections": {
      "label": categoryLabels["Intersections"],
      "note": "Der en boks krysser en rad eller kolonne: når alle kandidatene for et tall i den ene enheten ligger i skjæringen, fjernes tallet fra resten av den andre enheten."
    },
    "Subsets": {
      "label": categoryLabels["Subsets"],
      "note": "N ruter som til sammen bare har N tall, låser disse tallene til seg, enten mønsteret ligger i dagen eller er skjult."
    },
    "Basic Fish": {
      "label": categoryLabels["Basic Fish"],
      "note": "Når et tall i N rader bare har plass i de samme N kolonnene (eller omvendt), fjernes tallet fra resten av de N kryssende linjene."
    },
    "Finned Fish": {
      "label": categoryLabels["Finned Fish"],
      "note": "En fisk med ekstra kandidater, finnen. Den virker fortsatt, men bare på ruter som også ser finnen."
    },
    "Complex Fish": {
      "label": categoryLabels["Complex Fish"],
      "note": "Fisk som bruker bokser i tillegg til rader og kolonner."
    },
    "Single Digit Patterns": {
      "label": categoryLabels["Single Digit Patterns"],
      "note": "Korte kjeder på ett enkelt tall, bygd av to sterke lenker forbundet med en svak."
    },
    "Wings": {
      "label": categoryLabels["Wings"],
      "note": "Noen få ruter der kandidatene garanterer at én av rutene har et bestemt tall. Derfor mister hver rute som ser alle sammen, det tallet."
    },
    "Uniqueness": {
      "label": categoryLabels["Uniqueness"],
      "note": "Mønstre som ville gi oppgaven to løsninger, og som derfor ikke kan forekomme i en oppgave som har nøyaktig én."
    },
    "Chains and Loops": {
      "label": categoryLabels["Chains and Loops"],
      "note": "Slutninger som føres videre langs sterke og svake lenker til de to endene avgjør noe."
    },
    "Coloring": {
      "label": categoryLabels["Coloring"],
      "note": "Kandidater forbundet med sterke lenker får to farger: den ene fargen er sann overalt, den andre usann overalt."
    },
    "Almost Locked Sets": {
      "label": categoryLabels["Almost Locked Sets"],
      "note": "Grupper av ruter som har én kandidat for mye til å være låst, satt opp mot hverandre."
    },
    "Miscellaneous": {
      "label": categoryLabels["Miscellaneous"],
      "note": "Sjeldne mønstre som ikke passer inn i noen annen familie."
    },
    "Last Resort": {
      "label": categoryLabels["Last Resort"],
      "note": "Metoder som bygger på prøving, for stillinger der det ikke er noe mønster igjen å finne."
    }
  },
  "levels": levels,
  "bandLeads": {
    "Beginner": "En rolig start",
    "Easy": "Avslappet",
    "Medium": "Notater hjelper",
    "Tricky": "Ett nytt triks",
    "Hard": "Flere mønstre samtidig",
    "Unfair": "Ekspertnivå",
    "Extreme": "Ekspertnivå og tidkrevende",
    "Nightmare": "Det vanskeligste som finnes"
  },
  "bandNotes": {
    "Beginner": "full house og lette singler",
    "Easy": "bare singler, men flere av dem",
    "Medium": "låste kandidater og delmengder",
    "Tricky": "en første fisk, wing eller kite",
    "Hard": "fisk, wings og mønstre i fleng",
    "Unfair": "kjeder, ALS og fisk med finner",
    "Extreme": "lange kjeder, fargelegging og forcing nets",
    "Nightmare": "forcing nets og Exocet"
  },
  "rating": {
    "summary": "sudokUI vurderer en oppgave ved å løse den slik et menneske ville gjort. I hvert steg tar sudokUI i bruk den letteste teknikken som gir framgang, og legger til teknikkens poeng. Summen er oppgavens poengsum.",
    "points": [
      {
        "title": "Letteste teknikk først",
        "text": "Teknikkene prøves i fast rekkefølge, fra singler opp til forcing nets, og den første som virker, blir brukt. Poengsummen måler derfor en løsningssti bygd av de letteste stegene som finnes, ikke den smarteste stien."
      },
      {
        "title": "Poeng som stemmer med HoDoKu",
        "text": "Poengene og søkerekkefølgen er standardverdiene fra HoDoKu, referanseverktøyet for sudokuanalyse, så poengsummene kan sammenlignes med HoDoKus. En naken singel koster 4, en X-Wing 140 og en Forcing Net 700. Teknikker som HoDoKu ikke kjenner, plasseres på poengskalaen like ved sine nærmeste slektninger."
      },
      {
        "title": "Åtte vanskelighetsgrader",
        "text": "Graden er den høyeste av to avlesninger: graden for den samlede poengsummen, og graden for den vanskeligste teknikken som trengs. En oppgave som trenger én enkelt fisk, wing eller kite, er minst Lur, og en som trenger flere, er minst Vanskelig."
      },
      {
        "title": "Vurder hvilken som helst oppgave",
        "text": "Importer en oppgave på 81 tegn, eller skriv den inn for hånd. sudokUI sjekker først at den har nøyaktig én løsning, og vurderer den så før du spiller."
      }
    ],
    "solveTimeNote": "Grove referansetider, hentet fra de typiske tidene som løsere på nettet oppgir, og fordelt slik løsetider fordeler seg: de fleste nær midten, med en lang hale bak. Grensen for verdensklasse er satt av løsere på mesterskapsnivå. Å skrive egne notater tar lengre tid enn autokandidater, og papir enda lengre, så hver måte å løse på har sin egen tabell. En oppgave øverst i sin grad tar lengre tid enn en nederst.",
    "modes": {
      "auto": "med autokandidater",
      "marks": "med egne notater",
      "paper": "på papir"
    }
  },
  "method": {
    "name": "Slik løser de beste",
    "title": "Hvordan løse sudoku som de beste | sudokUI",
    "description": "Sudokumestere fyller ikke inn kandidater først. De ser etter singler, merker bare sikre par og bruker tyngre teknikker i fast rekkefølge. Slik øver du på det.",
    "h1": "Slik spiller de beste sudokuløserne",
    "lead": "De raskeste løserne skriver nesten ingenting ned. De skanner brettet, merker bare det som er sikkert, og tyr til notater og vanskeligere teknikker bare når oppgaven tvinger dem til det. Rekkefølgen de jobber i, er rekkefølgen sudokUI lærer bort.",
    "sections": [
      {
        "heading": "Begynn uten å skrive noe",
        "paragraphs": [
          "Konkurranseløsere har plassert de ti første tallene før en nybegynner er ferdig med å skrive kandidater. De tar ett tall om gangen og leter etter det over hele rutenettet: der radene og kolonnene som allerede har tallet, bare lar én ledig rute stå igjen i en boks, er det en skjult singel, og tallet skrives inn der. Så neste tall. Dette kryssøket (cross-hatching på engelsk) finner det meste av en lett oppgave på egen hånd, og det virker på papir, på mobilen, overalt.",
          "Et fullt kandidatrutenett er det motsatte. Det tar minutter å skrive, det gjemmer de få notatene som betyr noe blant dusinvis som ikke gjør det, og hver plassering betyr at noe må viskes ut. De beste løserne begynner aldri der.",
          "En plassering avslutter ikke et søk, men starter et mindre. Hvert tall som plasseres, endrer sin rad, sin kolonne og sin boks, så den raske løseren ser der først: er tallet nå en singel i en naboboks, og har ruten som ble fylt, etterlatt en singel et sted i raden eller kolonnen sin? Først da fortsetter søket med neste tall. Det er først en hel runde fra 1 til 9 uten en eneste plassering som viser at singlene er brukt opp."
        ]
      },
      {
        "heading": "Merk bare par: Snyder-notasjon",
        "paragraphs": [
          "Når et tall har nøyaktig to plasser igjen i en boks, og ikke flere, skriver de det smått i hjørnet av begge rutene. Ingenting annet blir merket. Disse hjørneparene, oppkalt etter mesteren Thomas Snyder, som gjorde vanen kjent, er råmaterialet for neste fase: to hjørnenotater i én rad i en boks er et pekende par, to tall som deler de samme to rutene, er et skjult par, og to bokser der parene ligger på linje, er starten på en X-Wing.",
          "I sudokUI er modusen Hjørne laget for dette: hvert notat er knyttet til sitt tall, paret er fortsatt synlig når ruten er valgt, og hint resonnerer ut fra notatene dine, ikke fra et kandidatrutenett du aldri skrev."
        ]
      },
      {
        "heading": "Rekkefølgen oppgaven krever",
        "paragraphs": [
          "Singler først, til det ikke er flere igjen. Så boksparene: pekende og hevdende, som ikke koster noe når hjørnenotatene først er på plass. Så nakne og skjulte par og tripler i linjene. Først når alt dette er brukt opp, fyller de beste løserne inn de gjenværende kandidatene, og da for hele rutenettet på en gang, aldri rute for rute.",
          "Med kandidatene på plass blir søket bredere: X-Wing, Skyscraper og kite på ett tall, så XY-Wing og W-Wing på toverdiruter, og deretter kjeder. Dette er den samme rekkefølgen som løseren i sudokUI følger når den vurderer en oppgave. Derfor er teknikkguiden sortert slik, og derfor nevner et hint den letteste teknikken som virker, aldri en vanskeligere.",
          "Rekkefølgen er en stige du klatrer opp fra bunnen hver gang, ikke en rekke du går gjennom én gang. Etter hvert gjennombrudd på et høyere trinn, enten det er et pekende par, et skjult par eller en X-Wing, går du rett tilbake til singlene: én eliminering frigjør ofte en singel, og den singelen frigjør tre til. Ingen fortsetter å lete etter X-Wing mens det finnes en singel. Løseren gjør det på samme måte og begynner fra den letteste teknikken igjen etter hvert steg."
        ]
      },
      {
        "heading": "Ekspertoppgaver: kandidater, så lenker",
        "paragraphs": [
          "I oppgavene som nettsteder for eksperter publiserer, er åpningen den samme, men kort: singlene tar slutt tidlig. Derfra tenker de sterkeste løserne i lenker heller enn i navngitte mønstre. Et tall med to plasser i en enhet er en sterk lenke, og en toverdirute er en sterk lenke mellom to tall. Kjeder av sterke og svake lenker beviser elimineringer, og de navngitte teknikkene fra X-Wing og opp til den vekslende slutningskjeden (AIC) er alle spesialtilfeller av én og samme kjede. Fargelegging er samme idé, med maling i stedet for piler.",
          "Entydighetsmønstre er den andre snarveien for eksperter: en publisert oppgave har én løsning, så ethvert oppsett som ville tillate to, er utelukket, og familien av unike rektangler gjør det om til elimineringer på sekunder."
        ]
      },
      {
        "heading": "Fart er gjenkjenning",
        "paragraphs": [
          "Den raskeste løseren på en gitt vanskelighetsgrad er ikke den som skriver raskest, men den som ser mønsteret først. Mestere forteller at de ser en X-Wing slik en leser ser et ord, uten å stave seg gjennom det. Det kommer av repetisjon på akkurat det mønsteret, og det er det øvingsmodusen er til for: velg en teknikk, få en oppgave som trenger den uten noe vanskeligere i veien, og møt mønsteret som det aller neste trekket, igjen og igjen.",
          "To vaner holder tiden nede. Ikke ødelegg godt arbeid ved å fylle inn kandidater for tidlig, og ikke let etter en vanskelig teknikk mens en lett teknikk fortsatt er tilgjengelig. Sorteringen etter læringsverdi i guiden viser hvilke teknikker det lønner seg mest å øve på: de som trengs ofte, vektet etter hvor mye de koster."
        ]
      },
      {
        "heading": "Slik trener du på det her",
        "paragraphs": [
          "Nye spill starter med autokandidater slått av, slik en mester ville begynt; unntaket er en øvingsoppgave som hopper rett til teknikken sin. Bruk hjørnenotater til Snyder-par og la resten stå tomt. Når du står fast, viser Skann alle teknikker som virker i akkurat denne stillingen med dine egne notater, så du lærer hva du gikk glipp av, ikke hva et kandidatrutenett ville ha vist. Skann teller som hjelp, slik alt annet i Hjelp-boksen gjør: fullfør uten noe av det, så teller resultatet som løst uten hjelp."
        ]
      }
    ]
  },
  "landings": {
    "/daily-sudoku/": {
      "name": "Dagens sudoku",
      "title": "Dagens sudoku: samme gratis oppgave for alle | sudokUI",
      "description": "Én ny sudoku hver dag, den samme for alle spillere i hele verden. Gratis, uten konto og uten reklame. Løs dagens oppgave og sammenlign tider med venner.",
      "h1": "Dagens sudoku",
      "lead": "Én ny sudoku hver dag, den samme for alle spillere i hele verden. Løs den, og sammenlign tider med venner som har spilt nøyaktig det samme brettet.",
      "sections": [
        {
          "heading": "Slik virker det",
          "paragraphs": [
            "Det publiseres én oppgave for hver dag, det samme brettet for alle, uten noen konto. En ny åpner ved midnatt, din lokale tid. Når du er ferdig, kan du sende inn tiden din og se hvordan du ligger an mot alle andre som har spilt den: hvor mange som løste den, mediantiden, og hvor stor andel du var raskere enn."
          ]
        },
        {
          "heading": "Hvor vanskelig er den?",
          "paragraphs": [
            "Dagens oppgave er vanligvis Middels, Lur eller Vanskelig. Vanskelighetsgraden og poengsummen vises i topplinjen, som for alle andre oppgaver."
          ]
        },
        {
          "heading": "Et rettferdig kappløp",
          "paragraphs": [
            "Dagens oppgave starter med autokandidater slått av for alle. Fullfør uten noe fra Hjelp-boksen, som hint, sjekk eller autokandidater, så teller resultatet som løst uten hjelp.",
            "Når du er ferdig, kopierer knappen «Utfordre en venn» en melding med tiden din og en lenke som inneholder selve oppgaven."
          ]
        }
      ],
      "cta": "Spill dagens sudoku",
      "related": [
        "Slik vurderes vanskelighetsgraden",
        "Alle teknikkene forklart"
      ]
    },
    "/sudoku-solver/": {
      "name": "Sudokuløser",
      "title": "Gratis sudokuløser som forklarer hvert steg | sudokUI",
      "description": "Skriv inn en sudoku og se den løst steg for steg: hver teknikk navngitt, tegnet på brettet og forklart. Gratis og privat, og virker uten nett.",
      "h1": "En sudokuløser som forklarer hvert steg",
      "lead": "Skriv inn en hvilken som helst sudoku, så løser sudokUI den slik et menneske ville gjort: én navngitt teknikk om gangen, tegnet på brettet og forklart med ord.",
      "sections": [
        {
          "heading": "Legg inn oppgaven",
          "paragraphs": [
            "Velg Importer og lim inn oppgaven som 81 tegn (tall, med punktum eller nuller for tomme ruter), eller velg Ny og så Egendefinert, og skriv de gitte tallene inn på brettet. sudokUI sjekker at oppgaven har nøyaktig én løsning før den begynner."
          ]
        },
        {
          "heading": "Se hele løsningsstien",
          "paragraphs": [
            "Steg viser alle stegene i én fullstendig løsning, letteste teknikk først, med det dyreste steget markert som nøkkeltrinnet. Klikk på et steg for å sette brettet til stillingen rett før det."
          ]
        },
        {
          "heading": "Eller ta ett steg om gangen",
          "paragraphs": [
            "Hint nevner først neste teknikk, viser den så på brettet med en forklaring, og bruker den til slutt hvis du vil. Skann viser alle teknikker som virker i stillingen akkurat nå, ikke bare den letteste, og Sjekk markerer feil tall."
          ]
        },
        {
          "heading": `${COUNTS.implemented} teknikker, maskinkontrollert`,
          "paragraphs": [
            `Løseren kjenner ${COUNTS.implemented} teknikker, fra Naken singel til Exocet og Forcing Net. Hvert hint kontrolleres mot oppgavens riktige løsning før det vises.`
          ]
        },
        {
          "heading": "Privat og uten nett",
          "paragraphs": [
            "Alt kjører på enheten din. Det er ingen konto, ingen reklame og ingen opplasting, og appen virker videre uten nettforbindelse når den først er lastet inn."
          ]
        }
      ],
      "cta": "Åpne løseren",
      "puzzleBox": "Løs denne oppgaven",
      "related": [
        "Alle teknikkene forklart",
        "Slik vurderes vanskelighetsgraden"
      ]
    },
    "/hodoku/": {
      "name": "HoDoKu",
      "title": "Sudoku vurdert som i HoDoKu, rett i nettleseren | sudokUI",
      "description": "sudokUI vurderer og forklarer sudoku med HoDoKus poeng og søkerekkefølge, i alle nettlesere: mobil, nettbrett, Mac eller PC. Ingen installasjon, virker uten nett.",
      "h1": "HoDoKu-kompatibel poengsum, i nettleseren",
      "lead": "sudokUI vurderer og forklarer sudoku slik HoDoKu gjør, uten at du må installere noe. Den kjører i alle nettlesere, på mobil, nettbrett eller datamaskin, og virker videre uten nett.",
      "sections": [
        {
          "heading": "Hva HoDoKu er",
          "paragraphs": [
            "HoDoKu er et gratis program av Bernhard Hobiger for å lage, løse, øve på og analysere sudoku, skrevet i Java og utgitt under GPLv3. Katalogen over teknikker og poengene i HoDoKu ble en vanlig referanse for å vurdere hvor vanskelig en sudoku er. Den siste utgaven, versjon 2.2, er fra 2012."
          ]
        },
        {
          "heading": "Hva sudokUI har felles med HoDoKu",
          "paragraphs": [
            "sudokUI bruker HoDoKus standardpoeng for hver teknikk og standard søkerekkefølge, og vurderer en oppgave på samme måte: løs den med den første teknikken som virker i hvert steg, og legg sammen poengene.",
            "Poenggrensene for Lett (800), Middels (1000), Vanskelig (1600) og Urettferdig (1800) er også HoDoKus."
          ]
        },
        {
          "heading": "Hvor de skiller seg",
          "paragraphs": [
            "sudokUI er et uavhengig prosjekt og har ingen tilknytning til HoDoKu.",
            "Det legger til teknikker som HoDoKu ikke har, som 3D Medusa, Chute Remote Pair, Fireworks, Tridagon og Exocet, plassert på poengskalaen like ved sine nærmeste slektninger, og det utelater noen av HoDoKus sjeldneste, som mutantfisk og Kraken-fisk. I en oppgave som trenger en av disse, kan løsningsstien og poengsummen bli forskjellige.",
            "sudokUI har åtte vanskelighetsgrader der HoDoKu har fem: Nybegynner, Lur og Mareritt er lagt til."
          ]
        },
        {
          "heading": "Samme oppgave i begge",
          "paragraphs": [
            "En oppgave skrevet som 81 tegn virker i begge programmene. Lim den inn i Importer-dialogen i sudokUI for å se poengsummen, hele løsningsstien og alle teknikker som kan brukes i en hvilken som helst stilling."
          ]
        }
      ],
      "cta": "Åpne sudokUI",
      "related": [
        "Slik vurderes vanskelighetsgraden",
        "Poeng for hver teknikk",
        "HoDoKus egen nettside"
      ]
    }
  },
  "glossaryGroups": {
    "The board": "Brettet",
    "Notation": "Notasjon",
    "Basic logic": "Grunnleggende logikk",
    "Links and chains": "Lenker og kjeder",
    "Fish": "Fisk",
    "Wings and other patterns": "Wings og andre mønstre",
    "Uniqueness": "Entydighet",
    "Solving and rating": "Løsing og vurdering"
  },
  "glossary": {
    "cell": {
      "term": "rute",
      "aka": [
        "celle"
      ],
      "definition": "En av de 81 rutene i rutenettet. Den inneholder et gitt tall, et tall du har plassert, eller notater så lenge den er uløst."
    },
    "row": {
      "term": "rad",
      "aka": [],
      "definition": "En vannrett linje med ni ruter. Hvert tall fra 1 til 9 forekommer nøyaktig én gang i hver rad."
    },
    "column": {
      "term": "kolonne",
      "aka": [],
      "definition": "En loddrett linje med ni ruter. Hvert tall fra 1 til 9 forekommer nøyaktig én gang i hver kolonne."
    },
    "box": {
      "term": "boks",
      "aka": [
        "3×3-boks",
        "blokk",
        "region"
      ],
      "definition": "Et av de ni feltene på tre ganger tre ruter som er avgrenset med tykke streker. Hvert tall fra 1 til 9 forekommer nøyaktig én gang i hver boks. Boksene nummereres 1 til 9 fra øverst til venstre, rad for rad."
    },
    "unit": {
      "term": "enhet",
      "aka": [
        "hus",
        "gruppe"
      ],
      "definition": "En rad, en kolonne eller en boks, altså en gruppe på ni ruter som må inneholde hvert tall fra 1 til 9 nøyaktig én gang. Rutenettet har 27 enheter."
    },
    "line": {
      "term": "linje",
      "aka": [],
      "definition": "En rad eller en kolonne. Ordet brukes når en regel virker likt i begge retninger."
    },
    "band": {
      "term": "bånd",
      "aka": [
        "etasje"
      ],
      "definition": "Tre bokser side om side, som dekker tre tilstøtende rader. Rutenettet har tre bånd: øverst, i midten og nederst. Må ikke forveksles med vanskelighetsgrad."
    },
    "stack": {
      "term": "stabel",
      "aka": [
        "tårn"
      ],
      "definition": "Tre bokser over hverandre, som dekker tre tilstøtende kolonner. Rutenettet har tre stabler: til venstre, i midten og til høyre."
    },
    "chute": {
      "term": "boksrekke",
      "aka": [
        "chute"
      ],
      "definition": "Et bånd eller en stabel: tre bokser på linje, sammen med de tre radene eller kolonnene som går gjennom dem."
    },
    "intersection": {
      "term": "skjæring",
      "aka": [
        "minilinje",
        "minirad",
        "minikolonne"
      ],
      "definition": "De tre rutene som en boks har felles med en rad eller kolonne som krysser den. Låste kandidater virker på skjæringer, og en gruppenode ligger inne i én."
    },
    "peer": {
      "term": "nabo",
      "aka": [
        "partner"
      ],
      "definition": "En rute som deler rad, kolonne eller boks med en annen rute. Hver rute har 20 naboer, og ingen nabo kan ha samme tall som ruten selv."
    },
    "sees": {
      "term": "ser",
      "aka": [],
      "definition": "To ruter ser hverandre når de deler rad, kolonne eller boks, og da kan de ikke ha samme tall. To kandidater for samme tall ser hverandre når rutene deres gjør det."
    },
    "digit": {
      "term": "tall",
      "aka": [
        "siffer",
        "verdi"
      ],
      "definition": "Ett av de ni symbolene 1 til 9. Tallene er merkelapper, ikke mengder, så det trengs ingen regning."
    },
    "given": {
      "term": "gitt tall",
      "aka": [
        "ledetråd",
        "forhåndsutfylt tall"
      ],
      "definition": "Et tall som står i oppgaven fra starten. Gitte tall er alltid riktige og kan ikke endres."
    },
    "solution": {
      "term": "løsning",
      "aka": [],
      "definition": "Et helt utfylt rutenett som beholder alle gitte tall og følger regelen i alle 27 enheter."
    },
    "proper-puzzle": {
      "term": "gyldig oppgave",
      "aka": [],
      "definition": "En oppgave med nøyaktig én løsning. Entydighetsteknikker kan bare brukes på gyldige oppgaver."
    },
    "pencil-mark": {
      "term": "notat",
      "aka": [
        "blyantnotat"
      ],
      "definition": "Et lite tall du skriver i en rute som en påminnelse, vanligvis for å merke en kandidat. sudokUI har to plasseringer for notater: i hjørnet og i midten."
    },
    "pencil-mark-grid": {
      "term": "kandidatrutenett",
      "aka": [
        "PM",
        "notatrutenett"
      ],
      "definition": "Rutenettet med alle kandidater i alle uløste ruter skrevet inn. De fleste teknikker utover singler leses ut fra det."
    },
    "corner-mark": {
      "term": "hjørnenotat",
      "aka": [
        "Hjørne",
        "notat i hjørnet"
      ],
      "definition": "Et notat som står på tallets faste plass i et oppsett på tre ganger tre. Når ruten også har midtnotater, legges hjørnenotatene rundt kanten av ruten, sortert etter tall. Hjørne er en plassering, ikke en betydning, selv om Snyder-notasjon vanligvis skrives der."
    },
    "centre-mark": {
      "term": "midtnotat",
      "aka": [
        "Midten",
        "notat i midten"
      ],
      "definition": "Et notat som skrives midt i ruten, det vanlige stedet for en fullstendig liste over kandidater. Sjekk leser midtnotater som rutens gjenværende kandidater. Hint og Skann leser hjørnenotater og midtnotater likt, når du har sagt at notatene dine er de gjenværende kandidatene."
    },
    "snyder-notation": {
      "term": "Snyder-notasjon",
      "aka": [
        "Snyder-merking"
      ],
      "definition": "En merkemetode oppkalt etter Thomas Snyder: i hver boks merkes et tall bare hvis det har nøyaktig to mulige plasser der, selv om noen løsere også merker tre. Merkingen er ufullstendig, så et notat som mangler, betyr ikke at tallet er eliminert."
    },
    "cell-name": {
      "term": "rutenavn",
      "aka": [
        "r1c1-notasjon"
      ],
      "definition": "Adressen til en rute, skrevet som rad- og kolonnenummer talt fra øverst til venstre: r3c5 er ruten i rad 3, kolonne 5. Noen løsere slår sammen ruter, slik at r57c2 betyr r5c2 og r7c2. Hint i sudokUI navngir hver rute for seg."
    },
    "auto-candidates": {
      "term": "autokandidater",
      "aka": [
        "Auto",
        "automatiske kandidater"
      ],
      "definition": "Et verktøy i sudokUI som du slår på med knappen Autokandidater. Det regner ut kandidatene i alle uløste ruter og holder dem oppdatert. Nye spill starter med verktøyet slått av; en øvingsoppgave som hopper rett til teknikken sin, starter med det slått på."
    },
    "check": {
      "term": "Sjekk",
      "aka": [
        "Kontroller"
      ],
      "definition": "En knapp i sudokUI som sammenligner tallene du har plassert, med løsningen. Den sjekker også at hver rute med notater fortsatt har det riktige tallet blant dem: autokandidatene når de er på, ellers midtnotatene dine, og hjørnenotatene også når du har sagt at notatene dine er de gjenværende kandidatene. Feil vises i rødt."
    },
    "steps": {
      "term": "Steg",
      "aka": [],
      "definition": "Listen i sudokUI over hele løsningsstien fra starten av oppgaven, med nøkkeltrinnet markert. Klikker du på et steg, settes brettet til stillingen rett før det steget."
    },
    "candidate": {
      "term": "kandidat",
      "aka": [
        "mulighet"
      ],
      "definition": "Et tall som fortsatt er mulig i en uløst rute: ingen av rutens naboer har det, og ingen logikk har utelukket det. Når du løser, fjerner du kandidater til hver rute har én igjen."
    },
    "placement": {
      "term": "plassering",
      "aka": [],
      "definition": "Å skrive et tall inn i en rute som rutens endelige verdi. Et hint som ender i en plassering, har bevist at tallet må stå der."
    },
    "elimination": {
      "term": "eliminering",
      "aka": [
        "utelukking"
      ],
      "definition": "Å fjerne en kandidat fra en rute fordi logikken beviser at tallet ikke kan stå der. De fleste avanserte teknikker ender i elimineringer, ikke plasseringer."
    },
    "contradiction": {
      "term": "motsigelse",
      "aka": [
        "konflikt"
      ],
      "definition": "En tilstand som bryter reglene: en rute uten kandidater, et tall uten plass i en enhet, eller samme tall to ganger i en enhet. En antakelse som fører til en motsigelse, er usann."
    },
    "single": {
      "term": "singel",
      "aka": [],
      "definition": "En plassering som er tvunget fordi bare én mulighet er igjen: en rute med én kandidat (naken singel) eller et tall med én mulig rute i en enhet (skjult singel)."
    },
    "full-house": {
      "term": "full house",
      "aka": [
        "siste tall"
      ],
      "definition": "En enhet med bare én tom rute igjen, som må få det ene tallet enheten mangler. Det er den enkleste typen singel. Strengt tatt betyr navnet siste tall den siste tomme ruten i hele rutenettet."
    },
    "naked": {
      "term": "naken",
      "aka": [
        "nakne"
      ],
      "definition": "Beskriver et mønster i rutene: N ruter i én enhet har til sammen bare N kandidater. En naken singel er en rute med én kandidat; et naket par fjerner sine to tall fra enhetens andre ruter."
    },
    "hidden": {
      "term": "skjult",
      "aka": [
        "skjulte"
      ],
      "definition": "Beskriver et mønster i tallene: N tall i én enhet har bare N ruter å stå i. En skjult singel er et tall med én mulig rute; et skjult par fjerner alle andre kandidater fra sine to ruter."
    },
    "subset": {
      "term": "delmengde",
      "aka": [
        "par",
        "trippel",
        "kvartett"
      ],
      "definition": "N ruter i én enhet som til sammen må inneholde N tall, funnet som et naket eller et skjult mønster. Størrelsene to, tre og fire kalles par, trippel og kvartett."
    },
    "locked-set": {
      "term": "låst mengde",
      "aka": [
        "naken delmengde"
      ],
      "definition": "N uløste ruter i én enhet som til sammen har nøyaktig N kandidater. Disse tallene må fylle disse rutene, så de fjernes fra alle andre ruter i enheten. Låst par og Låst trippel fra HoDoKu er spesialtilfellet der mengden også ligger i én skjæring."
    },
    "locked-candidates": {
      "term": "låste kandidater",
      "aka": [],
      "definition": "Et tall som i én enhet bare kan stå i skjæringen med en annen enhet. Tallet må stå i skjæringen, så det fjernes fra resten av den andre enheten."
    },
    "pointing": {
      "term": "pekende",
      "aka": [
        "låste kandidater type 1",
        "pekende par",
        "pekende trippel"
      ],
      "definition": "Låste kandidater sett fra en boks: alle plassene for et tall i boksen ligger i én rad eller kolonne, så tallet fjernes fra resten av den raden eller kolonnen."
    },
    "claiming": {
      "term": "hevdende",
      "aka": [
        "låste kandidater type 2",
        "boks-linje-reduksjon"
      ],
      "definition": "Låste kandidater sett fra en linje: alle plassene for et tall i en rad eller kolonne ligger i én boks, så tallet fjernes fra resten av den boksen."
    },
    "bivalue-cell": {
      "term": "toverdirute",
      "aka": [],
      "definition": "En uløst rute med nøyaktig to kandidater. Nøyaktig én av dem er sann, så de to er forbundet med både en sterk og en svak lenke."
    },
    "conjugate-pair": {
      "term": "konjugert par",
      "aka": [],
      "definition": "De to eneste kandidatene for et tall i en enhet. Nøyaktig én er sann: er den ene usann, er den andre sann (sterk lenke), og er den ene sann, er den andre usann (svak lenke)."
    },
    "bilocation": {
      "term": "toplassering",
      "aka": [
        "bilokasjon"
      ],
      "definition": "Et tall som har nøyaktig to mulige ruter igjen i en enhet. De to kandidatene danner et konjugert par."
    },
    "link": {
      "term": "lenke",
      "aka": [
        "kobling"
      ],
      "definition": "En logisk forbindelse mellom to kandidater, eller mellom noder, som en kjede kan bruke. Lenker er sterke eller svake, og en sterk lenke kan også brukes som en svak."
    },
    "strong-link": {
      "term": "sterk lenke",
      "aka": [
        "sterk slutning"
      ],
      "definition": "En lenke mellom kandidatene A og B som betyr at hvis A er usann, er B sann, så minst én av dem er sann. Konjugerte par og toverdiruter gir sterke lenker."
    },
    "weak-link": {
      "term": "svak lenke",
      "aka": [
        "svak slutning"
      ],
      "definition": "En lenke mellom kandidatene A og B som betyr at hvis A er sann, er B usann, så høyst én av dem er sann. To kandidater i samme rute, eller for samme tall i samme enhet, er svakt lenket."
    },
    "inference": {
      "term": "slutning",
      "aka": [
        "inferens"
      ],
      "definition": "Ett steg i resonnementet fra én kandidat til den neste. En sterk slutning sier at hvis dette er usant, er det andre sant; en svak slutning sier at hvis dette er sant, er det andre usant."
    },
    "chain": {
      "term": "kjede",
      "aka": [],
      "definition": "En rekke noder forbundet med lenker, der hver slutning fører videre til den neste, slik at én tilstand i den første noden tvinger fram en tilstand i den siste."
    },
    "node": {
      "term": "node",
      "aka": [],
      "definition": "Ett ledd i en kjede. Vanligvis er det én kandidat, altså ett tall i én rute, men det kan også være en gruppenode eller en nesten låst mengde."
    },
    "aic": {
      "term": "AIC",
      "aka": [
        "vekslende slutningskjede",
        "alternating inference chain"
      ],
      "definition": "En kjede der lenkene veksler mellom sterke og svake, og som begynner og slutter med en sterk lenke. Minst én av de to endenodene er sann, så enhver kandidat som er svakt lenket til begge endene, elimineres."
    },
    "grouped-node": {
      "term": "gruppenode",
      "aka": [
        "gruppert node"
      ],
      "definition": "En node som består av de to eller tre kandidatene for ett tall i én skjæring. Den regnes som sann når en av rutene har tallet."
    },
    "nice-loop": {
      "term": "nice loop",
      "aka": [
        "sløyfe"
      ],
      "definition": "En kjede av vekslende sterke og svake lenker som lukker seg til en sløyfe ved å vende tilbake til utgangspunktet. Den er kontinuerlig hvis vekslingen holder hele veien rundt, og diskontinuerlig hvis den brytes i én node."
    },
    "continuous-loop": {
      "term": "kontinuerlig sløyfe",
      "aka": [
        "kontinuerlig nice loop",
        "AIC-sløyfe"
      ],
      "definition": "En nice loop der lenkene veksler uten brudd. Da har hver lenke i den, sterk eller svak, nøyaktig én sann ende, så enhver annen kandidat som er svakt lenket til begge endene av en hvilken som helst av lenkene, elimineres."
    },
    "discontinuous-loop": {
      "term": "diskontinuerlig sløyfe",
      "aka": [
        "diskontinuerlig nice loop"
      ],
      "definition": "En nice loop der vekslingen brytes i én node. To sterke lenker som møtes der, beviser at kandidaten er sann, og to svake lenker som møtes der, beviser at den er usann. Når en sterk lenke på ett tall og en svak lenke på et annet møtes i én rute, er tallet på den svake lenken usant der."
    },
    "x-cycle": {
      "term": "X-cycle",
      "aka": [
        "fishy cycle"
      ],
      "definition": "En nice loop på ett enkelt tall: en lukket kjede av sterke og svake lenker mellom de mulige rutene for tallet."
    },
    "x-chain": {
      "term": "X-chain",
      "aka": [
        "X-kjede"
      ],
      "definition": "En AIC på ett enkelt tall. Minst én ende er sann, så tallet fjernes fra alle ruter som ser begge endene."
    },
    "xy-chain": {
      "term": "XY-chain",
      "aka": [
        "XY-kjede"
      ],
      "definition": "En AIC som bare består av toverdiruter, med svake lenker mellom rutene på et felles tall. Hvis begge endene har tallet Z, fjernes Z fra alle ruter som ser begge endene."
    },
    "remote-pair": {
      "term": "remote pair",
      "aka": [
        "fjernpar"
      ],
      "definition": "En XY-chain med et like antall ruter som alle har de samme to tallene. Begge tallene fjernes fra alle ruter som ser begge endene."
    },
    "colouring": {
      "term": "fargelegging",
      "aka": [
        "Simple Colors"
      ],
      "definition": "Å gi kandidatene i en klynge to farger slik at endene av hvert konjugert par får ulik farge. Nøyaktig én farge er sann overalt: to kandidater med samme farge som ser hverandre, gjør den fargen usann (fargebrudd), og en kandidat utenfor som ser begge fargene, elimineres (fargefelle)."
    },
    "multi-colouring": {
      "term": "multifargelegging",
      "aka": [
        "Multi Colors"
      ],
      "definition": "Fargelegging av to separate klynger for ett tall. Hvis en farge i den ene klyngen ser begge fargene i den andre, er den usann; hvis en farge i den ene klyngen ser en farge i den andre, elimineres en kandidat som ser de to andre fargene."
    },
    "cluster": {
      "term": "klynge",
      "aka": [],
      "definition": "En mengde kandidater som er forbundet med hverandre gjennom konjugerte par (og i 3D Medusa også gjennom toverdiruter). Avgjøres én av dem, avgjøres alle, og derfor kan en klynge fargelegges med to farger."
    },
    "3d-medusa": {
      "term": "3D Medusa",
      "aka": [],
      "definition": "Fargelegging på tvers av flere tall, der kandidater forbindes gjennom både konjugerte par og toverdiruter. Reglene utvider fargebrudd og fargefelle til kandidater i samme rute."
    },
    "forcing-chain": {
      "term": "forcing chain",
      "aka": [
        "tvangskjede"
      ],
      "definition": "En teknikk som følger hvert tilfelle av en premiss, for eksempel hver kandidat i én rute, fram til konsekvensene. Det som gjelder i alle tilfeller, er sant, og et enkelt tilfelle som ender i en motsigelse, er usant."
    },
    "forcing-net": {
      "term": "forcing net",
      "aka": [
        "tvangsnett"
      ],
      "definition": "En forcing chain der resonnementet kan forgrene seg og gå sammen igjen, slik at én konklusjon kan bygge på flere tidligere konklusjoner samtidig. Det er den siste logiske teknikken sudokUI prøver før prøving og feiling."
    },
    "nishio": {
      "term": "Nishio",
      "aka": [
        "Nishio forcing chain"
      ],
      "definition": "En test av én kandidat: anta at den er sann og følg konsekvensene. Fører de til en motsigelse, er kandidaten usann og elimineres. I streng forstand følges bare det ene tallet; sudokUI følger singlene for alle tall."
    },
    "fish": {
      "term": "fisk",
      "aka": [
        "fiskemønster",
        "Squirmbag",
        "Whale",
        "Leviathan"
      ],
      "definition": "Et mønster på ett tall: N basismengder der alle kandidatene for tallet ligger innenfor N dekkmengder. Hver kandidat for tallet i dekkmengdene som ikke ligger i en basismengde, elimineres. Størrelse 2 til 7 heter X-Wing, Swordfish, Jellyfish, Squirmbag, Whale og Leviathan."
    },
    "x-wing": {
      "term": "X-Wing",
      "aka": [],
      "definition": "Den minste fisken: i to rader (eller kolonner) har et tall plass bare i de samme to kolonnene (eller radene), så det fjernes fra resten av disse. Til tross for navnet er det en fisk, ikke en wing."
    },
    "swordfish": {
      "term": "Swordfish",
      "aka": [],
      "definition": "En fisk av størrelse tre: i tre linjer har et tall plass bare i de samme tre kryssende linjene, så det fjernes fra resten av disse."
    },
    "jellyfish": {
      "term": "Jellyfish",
      "aka": [],
      "definition": "En fisk av størrelse fire: i fire linjer har et tall plass bare i de samme fire kryssende linjene, så det fjernes fra resten av disse."
    },
    "base-set": {
      "term": "basismengde",
      "aka": [
        "basisenhet",
        "basissektor"
      ],
      "definition": "En av de N enhetene som definerer en fisk. Ingen kandidat for tallet får ligge i to basismengder, selv om enhetene selv kan overlappe; en kandidat som gjør det, behandles som en endofinne. Hver basismengde må ha tallet nøyaktig én gang, og det gir N sanne ruter til sammen."
    },
    "cover-set": {
      "term": "dekkmengde",
      "aka": [
        "dekkenhet",
        "dekksektor"
      ],
      "definition": "En av de N enhetene som til sammen inneholder alle kandidatene i fiskens basismengder. Basismengdene trenger N sanne ruter, og hver dekkmengde tar bare én, så kandidatene for tallet i dekkmengdene som ligger utenfor basismengdene, elimineres."
    },
    "fin": {
      "term": "finne",
      "aka": [
        "eksofinne"
      ],
      "definition": "En basiskandidat i en fisk som ligger utenfor alle dekkmengder. Enten er én av finnene sann, eller så gjelder den vanlige fisken, så en fisk med finner eliminerer bare de kandidatene i dekkmengdene, utenfor basismengdene, som også ser alle finnene."
    },
    "finned-fish": {
      "term": "fisk med finner",
      "aka": [
        "finned fish",
        "Finned X-Wing",
        "Finned Swordfish"
      ],
      "definition": "En fisk med én eller flere finner. Den eliminerer bare de kandidatene som den vanlige fisken ville eliminert, og som også ser alle finnene."
    },
    "endo-fin": {
      "term": "endofinne",
      "aka": [],
      "definition": "En basiskandidat som ligger i to basismengder, noe som bare er mulig i franken- og mutantfisk. Den behandles som en finne, for hvis den var sann, ville basismengdene ha færre enn N sanne ruter."
    },
    "cannibalism": {
      "term": "kannibalisme",
      "aka": [
        "kannibalistisk fisk"
      ],
      "definition": "En basiskandidat som ligger i to dekkmengder, elimineres av sin egen fisk, for hvis den var sann, ville én dekkmengde ha tallet to ganger. I en fisk med finner må den også se alle finnene."
    },
    "sashimi": {
      "term": "Sashimi",
      "aka": [
        "sashimifisk"
      ],
      "definition": "En fisk med finner som uten finnene ikke ville vært en fullverdig fisk av sin størrelse, for eksempel fordi en basismengde bare ville hatt én kandidat igjen. Elimineringene følger samme regel som for alle fisker med finner."
    },
    "franken-fish": {
      "term": "Franken-fisk",
      "aka": [
        "Franken fish"
      ],
      "definition": "En fisk der bokser er tillatt blant basismengdene eller dekkmengdene. Bortsett fra boksene bruker den ene siden bare rader og den andre bare kolonner."
    },
    "mutant-fish": {
      "term": "mutantfisk",
      "aka": [
        "mutant fish"
      ],
      "definition": "En fisk der basismengdene eller dekkmengdene blander rader, kolonner og bokser fritt."
    },
    "kraken-fish": {
      "term": "Kraken-fisk",
      "aka": [
        "Kraken fish"
      ],
      "definition": "En fisk med finner kombinert med kjeder: en kandidat elimineres hvis den er usann både når den vanlige fisken gjelder og når en hvilken som helst av finnene er sann."
    },
    "turbot-fish": {
      "term": "Turbot fish",
      "aka": [
        "Turbot Fish"
      ],
      "definition": "En kjede på ett tall: to konjugerte par forbundet med en svak lenke. Tallet fjernes fra alle ruter som ser begge de frie endene. Skyscraper og Two-string kite er spesialtilfeller."
    },
    "skyscraper": {
      "term": "Skyscraper",
      "aka": [
        "skyskraper"
      ],
      "definition": "To parallelle konjugerte par for ett tall, i to rader eller to kolonner, med én ende av hvert i samme kryssende linje. Tallet fjernes fra ruter som ser begge de andre endene."
    },
    "two-string-kite": {
      "term": "Two-string kite",
      "aka": [
        "2-String Kite"
      ],
      "definition": "Et konjugert par i en rad og ett i en kolonne for samme tall, med én ende av hvert i samme boks. Tallet fjernes fra ruten som ser begge de andre endene."
    },
    "empty-rectangle": {
      "term": "Empty rectangle",
      "aka": [
        "ER",
        "tomt rektangel"
      ],
      "definition": "En boks der alle kandidatene for et tall ligger i én rad og én kolonne i boksen, kombinert med et konjugert par utenfor. Sammen virker de som en kjede som fjerner tallet fra én rute."
    },
    "wing": {
      "term": "wing",
      "aka": [
        "vinge"
      ],
      "definition": "Et lite mønster, som XY-Wing, XYZ-Wing, WXYZ-Wing eller W-Wing, som beviser at et tall Z må stå i én av noen få ruter. Z fjernes fra alle ruter som ser alle disse. X-Wing er en fisk, ikke en wing."
    },
    "pivot": {
      "term": "pivot",
      "aka": [
        "hengsel"
      ],
      "definition": "Midtruten i en XY-Wing eller XYZ-Wing, som ser begge klypene. I en XY-Wing har den XY; i en XYZ-Wing har den XYZ, så elimineringene må også se den."
    },
    "pincer": {
      "term": "klype",
      "aka": [
        "klyperute"
      ],
      "definition": "En av de to ytre rutene i en XY-Wing eller XYZ-Wing, som hver ser pivoten. Klypene har XZ og YZ."
    },
    "xy-wing": {
      "term": "XY-Wing",
      "aka": [
        "Y-Wing"
      ],
      "definition": "En toverdi-pivot XY som ser to toverdi-klyper XZ og YZ. Uansett hva pivoten blir, er én klype Z, så Z fjernes fra alle ruter som ser begge klypene."
    },
    "xyz-wing": {
      "term": "XYZ-Wing",
      "aka": [],
      "definition": "En XY-Wing der pivoten også har Z. Én av de tre rutene er Z, så Z fjernes bare fra ruter som ser pivoten og begge klypene."
    },
    "wxyz-wing": {
      "term": "WXYZ-Wing",
      "aka": [
        "bøyd kvartett"
      ],
      "definition": "Fire ruter med til sammen fire tall, der hvert tall unntatt Z er begrenset, altså at alle plassene for det ser hverandre. Da må én av de fire være Z, så Z fjernes fra alle ruter som ser alle Z-ene blant dem. sudokUI finner den som en toverdirute pluss en mengde på tre ruter."
    },
    "w-wing": {
      "term": "W-Wing",
      "aka": [],
      "definition": "To toverdiruter med de samme tallene XZ, forbundet med en sterk lenke på X der hver ende ser én av dem. Én av de to rutene er Z, så Z fjernes fra alle ruter som ser begge."
    },
    "almost-locked-set": {
      "term": "nesten låst mengde",
      "aka": [
        "ALS"
      ],
      "definition": "N uløste ruter i én enhet som til sammen har nøyaktig N+1 kandidater. Fjernes ett av disse tallene fra alle rutene, blir de en låst mengde av de N tallene som er igjen. En toverdirute er den minste ALS-en."
    },
    "restricted-common-candidate": {
      "term": "begrenset felles kandidat",
      "aka": [
        "RCC",
        "restricted common"
      ],
      "definition": "Et tall som to nesten låste mengder har felles, der alle rutene med tallet i den ene ser alle rutene med tallet i den andre, og ingen av dem ligger i ruter som mengdene deler. Det kan være sant i høyst én av mengdene, og en mengde som mister det, blir en låst mengde."
    },
    "als-xz": {
      "term": "ALS-XZ",
      "aka": [],
      "definition": "To nesten låste mengder som er forbundet med en RCC X, og som også har et annet tall Z felles. Én mengde blir låst, så Z fjernes fra alle ruter som ser alle Z-ene i begge. Med to RCC-er (dobbelt lenket) blir begge mengdene låst."
    },
    "als-xy-wing": {
      "term": "ALS-XY-Wing",
      "aka": [],
      "definition": "Tre nesten låste mengder A, B og C, der A og C hver har en RCC med B, og de to RCC-ene er ulike. A og C har dessuten et tall Z felles. Z fjernes fra alle ruter som ser alle Z-ene i A og C."
    },
    "death-blossom": {
      "term": "Death blossom",
      "aka": [
        "Death Blossom"
      ],
      "definition": "En stammerute der hver kandidat er en RCC med sin egen nesten låste mengde, kronbladene. Uansett hvilken kandidat stammen får, blir ett kronblad låst, så et tall Z som alle kronbladene har, fjernes fra ruter som ser alle Z-ene deres."
    },
    "sue-de-coq": {
      "term": "Sue de Coq",
      "aka": [],
      "definition": "To eller tre ruter i én skjæring der kandidatene fordeles mellom en mengde i resten av boksen og en mengde i resten av linjen. Hver del er låst, så tallene i hver del fjernes fra resten av enheten sin."
    },
    "template": {
      "term": "mal",
      "aka": [
        "mønsteroverlegg",
        "Pattern Overlay",
        "POM"
      ],
      "definition": "En fullstendig måte å plassere et tall på i alle ni rader, kolonner og bokser, som stemmer med det nåværende rutenettet. En kandidat som ikke finnes i noen mal, elimineres, og en rute som finnes i alle maler, får tallet."
    },
    "exocet": {
      "term": "Exocet",
      "aka": [
        "Junior Exocet",
        "JE"
      ],
      "definition": "To basisruter i én skjæring, med tre eller fire kandidater til sammen, og to målruter som ikke ser dem, i de to andre boksene i boksrekken. Når hvert basistall er begrenset til høyst to linjer i resten av boksrekken, må målrutene få de samme to tallene som basen, så målrutene mister alle kandidater som basisrutene ikke har."
    },
    "uniqueness": {
      "term": "entydighet",
      "aka": [
        "entydighetsteknikk"
      ],
      "definition": "At en gyldig oppgave har nøyaktig én løsning, brukt som argument når du løser. Enhver kandidat som ville etterlate et dødelig mønster, og dermed to løsninger, er usann."
    },
    "unique-solution": {
      "term": "entydig løsning",
      "aka": [],
      "definition": "Den ene og eneste måten å fullføre en gyldig sudoku fra de gitte tallene. sudokUI sjekker at alle oppgaver den lager, og alle oppgaver du importerer eller skriver inn, har nøyaktig én løsning."
    },
    "deadly-pattern": {
      "term": "dødelig mønster",
      "aka": [],
      "definition": "En mengde ruter, ingen av dem gitte tall, der tallene kunne byttes om innbyrdes uten å bryte noen regel. Det ville gi to løsninger, så løsningen på en gyldig oppgave inneholder aldri et slikt mønster."
    },
    "unique-rectangle": {
      "term": "unikt rektangel",
      "aka": [
        "UR",
        "entydighetstest"
      ],
      "definition": "Fire ruter, ingen av dem gitte tall, i to rader, to kolonner og to bokser, med de samme to kandidatene. Med bare disse to tallene i alle fire ville det vært et dødelig mønster, så minst én ekstra kandidat i rektangelet er sann."
    },
    "hidden-rectangle": {
      "term": "skjult rektangel",
      "aka": [
        "HR"
      ],
      "definition": "Et unikt rektangel som finnes gjennom konjugerte par på de to tallene, ikke gjennom toverdiruter. Det fjerner ett av de to tallene fra hjørnet overfor de konjugerte parene."
    },
    "avoidable-rectangle": {
      "term": "unngåelig rektangel",
      "aka": [
        "AR"
      ],
      "definition": "Et rektangel der noen ruter allerede er løst av deg, ikke gitt, og resten kunne fullført et dødelig mønster. Kandidaten som ville fullført det, er usann."
    },
    "bug": {
      "term": "BUG",
      "aka": [
        "bivalue universal grave"
      ],
      "definition": "En tilstand der hver uløst rute har nøyaktig to kandidater og hver kandidat forekommer nøyaktig to ganger i hver av sine enheter. En slik tilstand har ingen løsning eller mer enn én, så en gyldig oppgave kan aldri havne der."
    },
    "bug-plus-one": {
      "term": "BUG+1",
      "aka": [],
      "definition": "En BUG med én ekstra kandidat i én rute. Den kandidaten, den som forekommer tre ganger i sine enheter, må være sann."
    },
    "technique": {
      "term": "teknikk",
      "aka": [
        "strategi"
      ],
      "definition": "Et navngitt logisk mønster som begrunner en plassering eller en eliminering, for eksempel en skjult singel eller en X-Wing. Hver teknikk har teknikkpoeng som teller med i poengsummen."
    },
    "technique-score": {
      "term": "teknikkpoeng",
      "aka": [
        "stegpoeng"
      ],
      "definition": "Det faste antallet poeng en teknikk legger til hver gang den brukes. sudokUI bruker HoDoKus standardpoeng, fra 4 for en naken singel til 10 000 for prøving og feiling. Teknikker som HoDoKu ikke har, får poeng tett ved sine nærmeste slektninger."
    },
    "solve-path": {
      "term": "løsningssti",
      "aka": [
        "løsningsvei"
      ],
      "definition": "Den ordnede listen over stegene som løser en oppgave. sudokUI lager den ved å prøve teknikkene i en fast rekkefølge, omtrent de letteste først, og i hvert steg bruke den første som virker. Den vises under Steg."
    },
    "crux": {
      "term": "nøkkeltrinn",
      "aka": [
        "vanskeligste steg"
      ],
      "definition": "Det dyreste steget i løsningsstien: steget der teknikken har flest poeng, eller det første av dem hvis flere står likt. sudokUI markerer det i Steg-listen."
    },
    "rating": {
      "term": "poengsum",
      "aka": [
        "vurdering",
        "vanskelighetspoeng"
      ],
      "definition": "En oppgaves vanskelighet som et tall: summen av teknikkpoengene for hvert steg i løsningsstien. Fordi poengene og løsningsrekkefølgen følger HoDoKu, kan poengsummen sammenlignes med HoDoKus for oppgaver som bare krever teknikker HoDoKu også har."
    },
    "difficulty-band": {
      "term": "vanskelighetsgrad",
      "aka": [
        "vanskelighetsnivå",
        "nivå"
      ],
      "definition": "Ett av åtte navngitte vanskelighetsnivåer: Nybegynner, Lett, Middels, Lur, Vanskelig, Urettferdig, Ekstrem og Mareritt. En oppgaves grad følger av den samlede poengsummen og av de vanskeligste teknikkene den krever: ett steg i klassen Vanskelig gjør den minst Lur, to slike steg gjør den minst Vanskelig. HoDoKu selv har fem nivåer."
    },
    "brute-force": {
      "term": "prøving og feiling",
      "aka": [
        "brute force",
        "backtracking",
        "gjetting"
      ],
      "definition": "Å løse ved prøving og feiling: prøv et tall, fortsett, og gå tilbake når det oppstår en motsigelse. I sudokUI brukes metoden til å sjekke at en oppgave har entydig løsning, og den er løserens siste utvei, verdt 10 000 poeng."
    },
    "hodoku": {
      "term": "HoDoKu",
      "aka": [],
      "definition": "Et gratis sudokuprogram med åpen kildekode (GPLv3), skrevet i Java av Bernhard Hobiger, kjent for løseren, teknikkguiden og vanskelighetspoengene. sudokUI henter teknikkpoeng og løsningsrekkefølge fra HoDoKu, så poengsummene for oppgaver som bare krever HoDoKus teknikker, kan sammenlignes."
    }
  },
  "intuition": {
    "lead": "Katalogen i sudokUI har 80 navngitte teknikker. Under dem ligger tre ideer og ett løfte som oppgaven gir. Lær ideene, så blir hvert navn en ny form av noe du allerede kjenner. Hver idé blir forklart to ganger her: én gang skikkelig, og én gang slik du ville forklart den for en 12-åring.",
    "parts": {
      "rule": {
        "nav": "Regelen",
        "heading": "Den ene regelen",
        "intro": "Hver rad, kolonne og boks har hvert tall nøyaktig én gang. Alt annet følger av den ene setningen."
      },
      "locked": {
        "nav": "Låste mengder",
        "heading": "Låste mengder: ting som må passe inn",
        "intro": "Den første motoren. Når noen ting må passe inn på nøyaktig like mange steder, fyller de disse stedene helt, og ingenting annet kan stå der."
      },
      "almost": {
        "nav": "Nesten låst",
        "heading": "Nesten låst: én for mye",
        "intro": "Den andre motoren. En gruppe som er ett tall fra å være låst, er nesten like nyttig som en låst gruppe, fordi det som ødelegger den, må skje et sted du kan peke på."
      },
      "chains": {
        "nav": "Kjeder",
        "heading": "Kjeder: hvis ikke dette, så det",
        "intro": "Den tredje motoren, og paraplyen over de fleste av de andre. En kjede fører én slutning videre fra kandidat til kandidat, helt til de to endene er enige om noe."
      },
      "unique": {
        "nav": "Én løsning",
        "heading": "Løftet: én løsning",
        "intro": "En sidegren med sin egen logikk. En gyldig oppgave har nøyaktig én løsning, og selve det løftet er en ledetråd."
      },
      "sets": {
        "nav": "Under alt",
        "heading": "Under det hele",
        "intro": "De tre motorene viser seg å være én og samme telleidé, sett i ulike styrker."
      },
      "names": {
        "nav": "Navn og historie",
        "heading": "Hvorfor navnene er et rot",
        "intro": "Mange av disse navnene kommer fra nettforumer rundt 2005, før noen hadde samlet teknikkene i én teori. De festet seg fordi de var lette å huske og mye brukt, ikke fordi de var systematiske."
      },
      "fast": {
        "nav": "Bli rask",
        "heading": "Bli rask",
        "intro": "Når du vet hvilken idé et mønster hører til, blir dusinvis av navn til en håndfull vaner."
      }
    },
    "sections": {
      "two-facts": {
        "heading": "To fakta i én regel",
        "paragraphs": [
          "Nøyaktig én gang er to løfter. Minst én gang: har et tall bare to plasser igjen i en enhet, må det stå på en av dem. Høyst én gang: to kandidater for samme tall i ruter som ser hverandre, fordi de deler rad, kolonne eller boks, kan ikke begge være sanne. En rute gir de samme to løftene: den har minst ett tall, og høyst ett.",
          "Når nøyaktig to muligheter er igjen, to plasser for et tall i en enhet eller to kandidater i en rute, kaller løsere det første faktumet, minst én, for en sterk lenke, og det andre, høyst én, for en svak lenke. Nesten alle teknikkene på dette nettstedet, fra skjult singel til Forcing Net, kombinerer disse to faktaene til en kandidat er utelukket eller et tall er tvunget. Bare entydighetsteknikkene, lenger ned, legger til et eget faktum.",
          "Spørsmålet kan stilles på to måter. Spør en rute hvilke tall den fortsatt kan ha, eller spør et tall hvor det fortsatt kan stå i en enhet. Den første måten finner de nakne mønstrene, den andre de skjulte, og gode løsere veksler mellom dem uten å tenke over det."
        ],
        "eli12": "Tenk deg at en rad er et lag med ni spillere med draktnumrene 1 til 9, og at ingen to spillere har samme nummer. Hvis bare to spillere i det hele tatt kan ha nummer 7, har en av dem det. Og hvis én spiller har nummer 7, kan ingen andre på laget ha det. Det er hele spillet. Nesten alle smarte triks er disse to tankene, lenket sammen."
      },
      "singles": {
        "heading": "Singler: én ting, én plass",
        "paragraphs": [
          "En naken singel er en rute med én kandidat igjen: én plass, ett tall. En skjult singel er et tall med én plass igjen i en enhet. De er de minste låste mengdene som finnes, sett fra de to retningene: spør ruten, eller spør tallet. En Full House, den siste tomme ruten i en enhet, er begge deler på en gang."
        ],
        "eli12": "Alle stolene må fylles, og alle må sitte, én person på hver stol. Hvis det bare er én person som kan sitte på en stol, sitter den personen der. Hvis det bare er én stol en person kan ta, tar personen den. Det er samme idé, sett fra hver sin ende."
      },
      "subsets": {
        "heading": "Delmengder: to, tre eller fire om gangen",
        "paragraphs": [
          "Gjør singelen større. Hvis to ruter i en enhet bare kan ha de samme to tallene, blir de tallene brukt opp der, så ingen annen rute i enheten kan ha dem: et naket par. Hvis to tall bare kan stå i de samme to rutene i en enhet, er de rutene opptatt, så de kan ikke ha noe annet: et skjult par. Tripler og kvartetter virker på samme måte.",
          "Naken og skjult er to beskrivelser av samme faktum. I en enhet med sju tomme ruter overlater en naken trippel de fire andre rutene til de fire andre tallene, og de fire rutene er en skjult kvartett. Det er også derfor ingen trenger en naken eller skjult kvintett: den andre siden av den er alltid fire eller mindre."
        ],
        "eli12": "En rad har sju tomme stoler og sju personer som skal få plass, én på hver stol. Tre av stolene er så små at bare de samme tre personene passer i dem. De stolene ender opp med nøyaktig de tre personene, så de tre kan ikke sitte noe annet sted. Snu på det: de fire andre personene har nå bare de fire andre stolene igjen, så de stolene er reservert for dem. Én og samme sak, fortalt fra begge ender.",
        "caption": "Én rad, ett faktum. De tre blå rutene kan bare ha 1, 2 og 3: en naken trippel. Da har 4, 5, 6 og 7 bare de fire gullfargede rutene: en skjult kvartett. Begge beskrivelsene fjerner de samme røde kandidatene."
      },
      "intersections": {
        "heading": "Der en boks krysser en linje",
        "paragraphs": [
          "En boks og en rad har tre ruter felles. Hvis alle kandidatene for et tall i boksen ligger i denne skjæringen, vil boksen plassere tallet der, så resten av raden kan ikke ha det: låste kandidater (pekende). Bytt rollene, så får du låste kandidater (hevdende): en rad der alle kandidatene for et tall ligger inne i én boks, fjerner tallet fra resten av boksen. Kolonner virker på samme måte.",
          "Det er den minste låste mengden mellom to enheter: én enhet som er tvunget til å plassere tallet sitt inne i en annen. Et låst par er et naket par som ligger i skjæringen, så det fjerner de to tallene fra resten av begge enhetene på en gang."
        ],
        "eli12": "En boks trenger en 4-er, og de eneste plassene der den kan stå, ligger langs den øverste kanten av boksen. Den kanten er en del av en lang rad tvers over rutenettet, og den raden kan bare ha én 4-er, så boksens 4-er er radens 4-er. Resten av den lange raden kan ikke ha en 4-er. Det virker andre veien også: hvis de eneste plassene for en 4-er i en rad ligger inne i én boks, kan ikke resten av den boksen ha en 4-er."
      },
      "fish": {
        "heading": "Fisk: ett tall, mange rader",
        "paragraphs": [
          "Følg nå ett tall over hele rutenettet. Hvis tallet i to rader bare kan stå i de samme to kolonnene, bruker de to radene opp de to kolonnene, én hver, så ingen andre ruter i de kolonnene kan ha det tallet: en X-Wing. Tre rader i tre kolonner er en Swordfish, fire i fire en Jellyfish. I en Swordfish kan en rad ha to eller tre plasser; det som teller, er at alle plassene ligger i de samme tre kolonnene.",
          "Krymp en X-Wing til én rad og én kolonne, så får du en skjult singel: en rad der tallet bare passer i én kolonne. En skjult singel er altså egentlig en 1-fisk, en X-Wing en 2-fisk og en Swordfish en 3-fisk, og rader og kolonner kan bytte roller. Låste kandidater, pekende og hevdende, er også 1-fisk, med en boks på den ene siden. En fisk som er større enn fire, trengs aldri, fordi en fisk i fem rader alltid kommer sammen med en mindre fisk i kolonnene, akkurat som en naken kvintett kommer sammen med en skjult delmengde på fire eller færre."
        ],
        "eli12": "To rader trenger hver sin 5-er. I begge radene kan 5-eren bare stå i kolonne nummer to eller kolonne nummer åtte. Uansett hvordan det går, tar den ene raden kolonne to og den andre kolonne åtte, fordi en kolonne ikke kan ha to 5-ere. Begge kolonnene får altså 5-eren sin fra disse to radene, og alle de andre rutene i dem kan glemme 5."
      },
      "sideways": {
        "heading": "Samme triks, sett fra siden",
        "paragraphs": [
          "Tenk deg oppgaven som en kube der de tre retningene er rader, kolonner og tall. Det vanlige rutenettet viser rader mot kolonner. Snu kuben, så ser du rader mot tall i stedet. For ett tall skriver du opp, for hver rad, kolonnene der tallet fortsatt kan stå. Hver rad blir da en liten rute med kolonnenumre som kandidater, og de ni radene oppfører seg som en enhet: hvert kolonnenummer hører til nøyaktig én av dem.",
          "Nå er en X-Wing to slike ruter med de samme to kolonnenumrene: et naket par. En Swordfish er en naken trippel og en Jellyfish en naken kvartett. Snur du kuben en annen vei, viser den et naket par som et skjult par. Hver fisk i rader og kolonner som ikke har finne, er en delmengde i forkledning, og det samme gjelder hver delmengde i en rad eller kolonne; en delmengde inne i en boks, eller en fisk som bruker en boks, har ingen slik tvilling, fordi en boks ikke er en av kubens retninger."
        ],
        "eli12": "Ta ett kort for hver rad, og skriv på det plassene der en 5-er kan stå i den raden. To av kortene sier bare tredje og åttende kolonne. Hver av de radene trenger en 5-er, og ingen kolonne kan ta to, så til sammen bruker de opp begge kolonnene, og ingen andre kort kan bruke noen av dem. To kort som sitter fast med de samme to valgene, er bare et par, som to ruter som bare kan være 3 eller 8. En X-Wing er et par, sett fra siden.",
        "caption": "Til venstre: der 5 kan stå i et rutenett med en X-Wing i radene 2 og 7. Til høyre: de samme 5-erne ordnet etter rad, som ruter med kolonnenumre. Radene 2 og 7 har bare 3 og 8, et naket par, så ingen annen rad kan ha 5-eren sin i kolonne 3 eller 8."
      },
      "fins": {
        "heading": "Finner, og fisk med bokser",
        "paragraphs": [
          "En fisk med finner er en fisk med noen få ekstra kandidater, kalt finnen, samlet i én boks. Enten er fisken ekte, eller så har finnen tallet, så en rute i fiskens kolonner, utenfor radene dens, som ser hver eneste finnerute, mister tallet uansett. En Sashimi-fisk er en fisk med finner der raden med finnen, uten finnen, bare ville hatt én plass igjen. Franken-fisk lar bokser ta plassen til rader eller kolonner.",
          "Enten dette eller det: slik tenker kjeder, og de kommer senere. En fisk med finner er det første stedet på denne siden der en låst mengde og en kjede møtes."
        ],
        "eli12": "En fisk med finner er en X-Wing med ett rotete hjørne: én rad har en eller to ekstra plasser for 5-eren, alle i samme boks som et av hjørnene i den raden. Enten er den ryddige X-Wingen ekte, eller så står 5-eren på en av de ekstra plassene. En rute mister 5-eren sin på ordentlig bare hvis den mister den i begge historiene: den står i en av X-Wingens kolonner, utenfor de to radene, og ser hver eneste ekstra plass."
      },
      "als": {
        "heading": "Nesten låste mengder",
        "paragraphs": [
          "En nesten låst mengde er N ruter i én enhet som til sammen har N+1 tall. Ta bort ett hvilket som helst av disse tallene, så blir rutene låst til resten. Den minste er en enkelt toverdirute: én rute, to kandidater.",
          "Det gjør hver nesten låst mengde til en bryter. Viser ett av tallene seg å være umulig, blir mengden låst og plasserer alle de andre."
        ],
        "eli12": "Fire venner som sitter sammen, velger hver sin godbit fra en liste med fem, og alle velger forskjellig. Hvis det blir tomt for én av de fem, må de fire vennene ta de fire andre, én hver, så hver eneste av de fire godbitene blir valgt."
      },
      "bent": {
        "heading": "Bøyde delmengder: wingene",
        "paragraphs": [
          "Legg en naken trippel i én rad, så er den låst. Bøy den rundt et hjørne, slik at de tre rutene ligger i to enheter, så virker den nesten fortsatt. Det er en XY-Wing eller en XYZ-Wing: tre ruter, tre tall, bøyd. Fire ruter og fire tall gir en WXYZ-Wing, en bøyd kvartett, og fem gir en VWXYZ-Wing, en bøyd kvintett.",
          "Hvorfor det virker: i en bøyd delmengde har hvert tall unntatt ett kandidatene sine i ruter som alle ser hverandre, så det kan brukes høyst én gang. Bare ett tall, Z, kan komme mer enn én gang, fordi ikke alle rutene med Z ser hverandre. Uten Z ville rutene trenge like mange forskjellige tall som det er ruter, men ha ett tall færre å ta dem fra. Det er umulig, så Z står i mønsteret, og enhver rute som ser alle Z-ene i det, mister Z.",
          "XY-Wing og XYZ-Wing skiller seg bare i om midtruten, pivoten, også har Z. Gjør den det, må rutene som Z fjernes fra, også se pivoten."
        ],
        "eli12": "Fire venner tar én godbit hver, og ingen får ha samme godbit som noen de kan se. Det finnes bare fire sorter. Tre av sortene kan gå til høyst én venn hver, fordi alle som kanskje tar dem, kan se hverandre. Bare kjeks kan gå til to venner som sitter langt fra hverandre og ikke ser hverandre. Uten noen kjeks ville fire venner trenge fire forskjellige godbiter fra tre sorter. Så minst én av dem har kjeks, og ingen som kan se alle som kanskje tar kjeks, kan få kjeks selv.",
        "caption": "Øverst: en naken trippel i én rad. Nederst: de samme tre tallene bøyd rundt et hjørne, en XY-Wing. Den blå pivoten har 1 og 2 og ser begge de gullfargede klypene. Uansett hva pivoten blir, må én klype være 3, så de to rutene med en rød 3, som ser begge klypene, kan ikke være 3."
      },
      "als-xz": {
        "heading": "ALS-XZ: opphavet til alle de bøyde wingene",
        "paragraphs": [
          "Ta to nesten låste mengder uten noen felles rute, der begge har tallene X og Z. Hvis hver X i den første mengden ser hver X i den andre, kan høyst én av mengdene ha X, så minst én mengde må klare seg uten. En mengde uten X blir låst til de andre tallene sine, blant dem Z. Minst én av de to mengdene plasserer altså Z, og Z kan fjernes fra enhver rute som ser alle Z-ene i begge mengdene.",
          "Hver bøyd wing i katalogen er denne regelen, der den ene mengden er en enkelt toverdirute: en XY-Wing er en toverdirute pluss en mengde på to ruter, en WXYZ-Wing en toverdirute pluss en mengde på tre ruter. Derfor kaller noen guider, blant dem sudoku.coach, nå de større wingene bare ALS-XZ, og derfor finner sudokUI en wing på fem ruter med den formen under ALS-XZ.",
          "Ideen vokser videre derfra. ALS-XY-Wing er en XY-Wing der de tre rutene har vokst til mengder, Death Blossom gir hver kandidat i én rute en egen mengde, og Sue de Coq fordeler de tettpakkede rutene der en boks krysser en linje, mellom én mengde i resten av linjen og én i resten av boksen."
        ],
        "eli12": "Ingen får ha samme godbit som noen de kan se, og venner ved samme bord ser hverandre. To bord har hver sin liste med én godbit mer enn det sitter venner ved bordet, så et bord som mister en godbit, tar alle de andre. Begge listene har potetgull og sjokolade. Alle ved det ene bordet som kanskje spiser potetgull, kan se alle ved det andre bordet som kanskje gjør det, så høyst ett bord får potetgull. Et bord uten potetgull tar alt det andre, også sjokoladen. Derfor kan ingen som ser alle som kanskje spiser sjokolade, få sjokolade selv."
      },
      "w-wing": {
        "heading": "Ikke alle wingene er bøyde",
        "paragraphs": [
          "W-Wing har navnet felles med dem, men ikke ideen. Den består av to like toverdiruter forbundet med en sterk lenke på ett av tallene deres, og det gjør den til en kort kjede, ikke en større XYZ-Wing. W-en betyr ikke én bokstav til."
        ],
        "eli12": "To ruter kan hver bare være 1 eller 2. Et annet sted har en rad, kolonne eller boks bare to plasser igjen for 2, og hver av de to rutene ser hver sin av disse plassene. Hvis den første ruten er 2, kan ikke plassen den ser være det, så den andre plassen er 2-eren, og den andre ruten, som ser den, må være 1. Altså er én av de to rutene alltid 1, og en rute som ser begge, er det ikke."
      },
      "links": {
        "heading": "Sterke og svake lenker",
        "paragraphs": [
          "En sterk lenke forbinder to kandidater der minst én er sann: et tall med to plasser igjen i en enhet, eller en rute med to kandidater. En svak lenke forbinder to der høyst én er sann: to kandidater for samme tall som ser hverandre, eller to kandidater i samme rute. En kjede veksler mellom dem, og den begynner og slutter med en sterk lenke. Er den ene enden usann, er den neste sann, så den påfølgende er usann, og så videre.",
          "Når en kjede begynner og slutter på samme tall, er én av de to endene sann, så enhver rute som ser begge endene, mister det tallet. Når en kjede lukker seg til en sløyfe der lenkene veksler hele veien rundt, kan hver svak lenke i den fjerne egne kandidater."
        ],
        "eli12": "Hvert mulig tall i en rute er en lysbryter som er på hvis tallet er svaret. En sterk lenke er to brytere der minst én er på, og en svak lenke er to der høyst én er på. Sett dem etter hverandre, sterk, svak, sterk: er den første bryteren av, er den andre på, den tredje av og den fjerde på. Altså er den første eller den siste på, og hvis begge to er 6-ere, er en rute som ser begge endene, ikke 6."
      },
      "one-digit": {
        "heading": "Kjeder på ett tall: Kite, Skyscraper og Turbot Fish",
        "paragraphs": [
          "En kjede som følger ett tall, er en X-Chain. Den korteste nyttige formen er to sterke lenker forbundet med en svak, fire kandidater i alt, og formene har egne navn: Skyscraper når de to sterke lenkene går parallelt, 2-String Kite når den ene går langs en rad og den andre nedover en kolonne og de møtes i en boks, og Turbot Fish for de andre formene.",
          "En X-Wing er en slik kjede lukket til en sløyfe, og et Empty Rectangle deler kandidatene i én boks opp i en radgruppe og en kolonnegruppe, der minst én av dem har tallet. Lengre kjeder på ett tall er også X-Chains, og sløyfene er X-Cycles."
        ],
        "eli12": "En rad og en kolonne har hver bare to plasser for 4. Én plass fra hver ligger i samme boks, og de er to forskjellige ruter. Kall de to andre plassene endene. Finnes det en verden der ingen av endene er 4-eren? Da ville både raden og kolonnen lagt 4-eren sin i den boksen, i to forskjellige ruter, og en boks kan ikke ha to 4-ere. Den verdenen finnes ikke. Altså er minst én av endene 4-eren, og en rute som ser begge endene, kan ikke være det.",
        "caption": "En 2-String Kite på 4. Rad 2 har bare to plasser for 4, og det har kolonne 3 også; den gullfargede plassen i hver av dem ligger i boks 1. Hvis ingen av de blå endene var 4, ville begge de gullfargede rutene vært det, og en boks kan ikke ha to 4-ere. Altså er én ende 4, og den røde ruten, som ser begge endene, er det ikke."
      },
      "colouring": {
        "heading": "Fargelegging: to verdener",
        "paragraphs": [
          "Start i én kandidat for et tall, følg de sterke lenkene utover fra den, og fargelegg vekselvis i to farger. Alt du når fram til, er én klynge, og i den er den ene fargen helt sann og den andre helt usann; du vet bare ikke hvilken ennå. Hvis en farge ville satt tallet to ganger i en enhet, er den fargen usann. Hvis en rute ser begge fargene, mister den tallet uansett hvilken farge som vinner. En egen klynge trenger egne farger.",
          "Simple Colors ser på én hel klynge av sterke lenker på en gang, og finner derfor hver X-Chain som bare er bygd av lenkene i den klyngen. Multi Colors kobler sammen to klynger, og 3D Medusa fargelegger på tvers av alle tallene samtidig."
        ],
        "eli12": "Velg én plass der en 7-er kan stå, og mal den blå. Hver gang en rad, kolonne eller boks bare har to plasser for 7 og den ene er malt, maler du den andre i motsatt farge, så blått og gult bytter på. Fortsett til ingenting mer kan males. Da er enten alle de blå plassene 7 og ingen av de gule, eller omvendt. Enhver annen plass som kan se en blå og en gul, er ikke 7 uansett."
      },
      "pairs": {
        "heading": "Kjeder av par",
        "paragraphs": [
          "En toverdirute er en sterk lenke inne i en rute: er den ikke det ene tallet, er den det andre. Hopp fra en toverdirute til en annen toverdirute som ser den, gjennom et tall de har felles, og gå ut av hver rute med det andre tallet sitt: det er en XY-Chain. Versjonen med tre ruter er igjen XY-Wing, og slik kan ett mønster være en wing, en bøyd delmengde, to nesten låste mengder og en kjede på samme tid. En Remote Pair er en XY-Chain der alle rutene har de samme to tallene."
        ],
        "eli12": "En rekke dominobrikker har to tall hver, men viser bare det ene. Hver brikke har ett tall felles med brikken før og det andre tallet sitt felles med brikken etter, og naboer står i samme rad, kolonne eller boks, så de kan ikke begge vise tallet de har felles. Hvis den første skjuler det ytre tallet sitt, viser den det felles tallet, så den neste viser det andre tallet sitt, og slik fortsetter det nedover rekken. Altså vises ett av de ytre tallene, og hvis de to er like, er en rute som ser begge endene, ikke det tallet."
      },
      "aic": {
        "heading": "Én kjede som rommer dem alle",
        "paragraphs": [
          "En AIC (Alternating Inference Chain, vekslende slutningskjede) tillater alle slags lenker på en gang: ett tall langs en enhet, to tall i en rute, en gruppe kandidater i en boks, til og med en hel nesten låst mengde. De fleste navngitte mønstrene er korte AIC-er eller sløyfer, blant dem X-Wing, Skyscraper, XY-Wing, W-Wing og ALS-XZ. En Nice Loop er det samme, skrevet som en sløyfe.",
          "Forcing chains er siste steg før gjetting. Anta en kandidat og følg alle konsekvensene, og gjør så det samme for alternativene. Hvis alle grenene er enige om noe, er det sant, og hvis én gren ender i en motsigelse, var antakelsen den startet med, usann. De er kraftige, men det finnes ingen form å se etter, og derfor sparer sudokUI dem til de vanskeligste oppgavene."
        ],
        "eli12": "Detektivarbeid. En rute kan bare være 3 eller 5. Tenk deg at den er 3, og følg alt som må skje etterpå. Tenk deg så at den er 5, og følg det også. Hvis begge historiene ender med at den samme andre ruten er 9, er den ruten 9, uansett hva den første ruten blir. Det virker bare når historiene dekker hvert eneste tall den første ruten kan være."
      },
      "deadly": {
        "heading": "Dødelige mønstre",
        "paragraphs": [
          "Fire ruter i to rader, to kolonner og to bokser som bare kunne ha de samme to tallene, ville vært en felle: de to tallene kunne byttet plass, og begge versjonene ville passet. Det gir to løsninger, så en oppgave med én løsning havner aldri der. Hvis tre hjørner i rektangelet bare har 1 og 2 og det fjerde har 1, 2 og 5, må det fjerde være 5. Det er et unikt rektangel. BUG+1 bruker det samme løftet på en felle som dekker hele rutenettet, og de unngåelige rektanglene bruker det på rektangler der det blant hjørnene er tall du har plassert selv.",
          "Disse teknikkene er bare gyldige når oppgaven virkelig har én løsning. sudokUI godtar bare oppgaver som har det, så her er de alltid trygge."
        ],
        "eli12": "Fire tomme ruter ligger i hjørnene av et rektangel, i to rader, to kolonner og bare to bokser. Tre av dem kan bare være 1 eller 2. Hvis den fjerde også var 1 eller 2, kunne du byttet om alle 1-ere og 2-ere i de fire hjørnene, og oppgaven ville fortsatt gått opp: to svar. En god oppgave har bare ett, så det fjerde hjørnet er verken 1 eller 2.",
        "caption": "Et unikt rektangel. Tre blå hjørner har bare 1 og 2. Hvis det fjerde hjørnet også var 1 eller 2, kunne 1-erne og 2-erne bytte plass, og oppgaven ville hatt to løsninger. Derfor fjernes 1 og 2 der, og hjørnet er 5."
      },
      "truths": {
        "heading": "Sannheter og lenker",
        "paragraphs": [
          "Allan Barkers mengdelogikk beskriver nesten alt dette på en gang. En sannhet er en gruppe kandidater der nøyaktig én er sann: kandidatene i en rute, eller plassene for ett tall i en enhet. En lenke er en svak lenke strukket ut over en hel gruppe: av alle kandidatene i den er høyst én sann. Hvis N sannheter som ikke deler noen kandidat, dekkes av N lenker, bruker sannhetene opp hver eneste lenke, så alle andre kandidater i de lenkene er usanne. Denne ene regelen er hver låst mengde og hver fisk uten finne.",
          "Tillat én lenke mer enn det er sannheter, så får du kjedene, fiskene med finner og wingene, der en kandidat bare faller hvis den ligger i to av lenkene samtidig. De fleste teknikknavn er korte måter å si hvor sannhetene og lenkene ligger."
        ],
        "eli12": "Tre jobber trenger nøyaktig én hjelper hver, og bare tre hjelpere kan gjøre noen av dem i det hele tatt. Ingen hjelper kan ta to jobber. Derfor blir alle de tre hjelperne opptatt med disse jobbene, og ingen av dem er ledig for noe annet på listene sine."
      },
      "x-wing-first": {
        "heading": "X-Wing kom først",
        "paragraphs": [
          "Allerede i juni 2005 regnet en fast forumdeltaker X-Wing og Swordfish blant de få navnene som de fleste spillere var enige om, og ingen i den tråden kunne si hvem som hadde funnet på dem. Fisken med to rader var kjent og hadde fått navn før spillerne så at tre eller fire rader også virker, så familien ble navngitt rundt den: Swordfish, Jellyfish, og så Squirmbag, Whale og Leviathan for størrelser ingen trenger. Derfor er X-Wing en fisk og ikke en wing.",
          "Squirmbag var upopulært, og mot slutten av 2005 foreslo spillere Starfish i stedet. X-en står mest sannsynlig for den diagonale formen som de fire hjørnene danner. Star Wars-jageren og dobbeltdekkeren Fairey Swordfish er populære historier uten kjent kilde, så regn dem som folklore."
        ]
      },
      "letters": {
        "heading": "Bokstaver som teller tall",
        "paragraphs": [
          "I wingene teller bokstavene nesten antallet tall. XYZ-Wing, WXYZ-Wing og VWXYZ-Wing bruker tre, fire og fem tall, så som bøyde delmengder er de en trippel, en kvartett og en kvintett. XY-Wing bruker også tre tall og er en bøyd trippel, som XYZ-Wing, men bokstavene navngir bare de to tallene i pivoten. Y-Wing er ikke en annen eller nyere teknikk. Navnet oppsto i 2005 som en kortform for XY-Wing på forumene, og begge navnene er fortsatt i bruk. De større wingene, fra VWXYZ og oppover, har også navn, men de blir funnet som ALS-XZ, regelen de kommer fra, og noen guider bruker nå bare det navnet.",
          "W-Wing bryter mønsteret: den er en kjede, og W-en teller ingenting."
        ]
      },
      "shape-names": {
        "heading": "Navn som lærer bort",
        "paragraphs": [
          "Den 26. desember 2005 la en forumbruker ved navn Havard ut Skyscraper og 2-String Kite, og innrømmet samtidig at begge var Turbot Fish. En annen fast deltaker spurte hvorfor en teknikk som allerede fantes, trengte nye navn, og listet opp ti navn som allerede var i bruk for den samme familien. Havard svarte at navnene hjelper folk å huske mønsteret. Navnene som beskriver formen, vant, fordi de lærer bort bedre.",
          "Sue de Coq sies vanligvis å være oppkalt etter forumnavnet til spilleren som først la den ut, da under navnet Two-Sector Disjoint Subsets. Bob Hanson ga selv 3D Medusa navnet: en tredimensjonal visning fikk ham til å tenke på Medusa og håret hennes."
        ]
      },
      "history": {
        "heading": "Hvordan sudokuløsing endret seg",
        "paragraphs": [
          "Teknikkene kom som separate triks med separate navn, og teorien som binder dem sammen, kom senere. Den rekkefølgen er grunnen til at katalogen minner om en dyrehage."
        ],
        "points": [
          {
            "when": "Midten av 2005",
            "what": "X-Wing og Swordfish er allerede standardnavn, og fisk på opptil fem rader har navn på et programmererforum."
          },
          {
            "when": "Høsten 2005",
            "what": "Navnene er fortsatt ikke på plass: én spiller kaller hver fisk på tre eller flere rader en Swordfish, en annen sier at han fant X-Wing på egen hånd og kalte den et rektangel. Sue de Coq blir lagt ut som Two-Sector Disjoint Subsets."
          },
          {
            "when": "November 2005",
            "what": "BUG-prinsippet: hvis hver uløst rute har to kandidater og hver kandidat forekommer to ganger i hver enhet, kan rutenettet ikke ha nøyaktig én løsning."
          },
          {
            "when": "Desember 2005",
            "what": "Skyscraper og 2-String Kite får navnene sine. 3D Medusa, Bob Hansons fargelegging på tvers av alle tallene, er allerede et av navnene som er i bruk."
          },
          {
            "when": "Januar 2006",
            "what": "En fast forumdeltaker oppsummerer det spillerne har lagt merke til: XY-Wing er bare en kort forcing chain, og X-Wing og Turbot Fish er X-Cycles."
          },
          {
            "when": "Rundt 2006 og 2007",
            "what": "En forumguide om fisk tar for seg bokser (Franken- og mutantfisk) og Kraken-fisk, og Empty Rectangle er i bruk."
          },
          {
            "when": "Siden da",
            "what": "Samlende ideer tar over: nesten låste mengder viser at de bøyde wingene er én regel, mengdelogikk viser at fisk, delmengder og kjeder er én telleidé, og poengskalaen i Sudoku Explainer blir den felles målestokken for vanskelighet."
          }
        ]
      },
      "see": {
        "heading": "Vanskelig å se er ikke vanskelig å forstå",
        "paragraphs": [
          "Sudoku Explainer setter naket par til 3,0, X-Wing til 3,2 og skjult par til 3,4, selv om alle tre, i en rad eller kolonne, er ett og samme mønster sett fra ulike sider. Der får Turbot Fish 6,6, men andre guider, blant dem HoDoKu, lærer den bort tidlig. Slike poengsummer måler hvor vanskelig et mønster er å få øye på, ikke hvor dypt det er. Når du kjenner ideen, slutter et nytt mønster å være noe du må pugge, og blir noe kjent på et nytt sted.",
          "Let derfor etter ideer, ikke navn. Tell først: singler. Se så etter låste mengder: par og tripler i en enhet, et tall som er begrenset til skjæringen mellom en boks og en linje, ett tall som havner i de samme kolonnene i flere rader. Se deretter etter nesten låste mengder: en toverdirute er den minste nesten låste mengden og starten på hver wing og hver XY-Chain. Følg til slutt lenkene: et tall med to plasser i en enhet er en sterk lenke som venter på å bli en del av en kjede.",
          "Fanen Slik løser du viser hvordan de beste løserne ordner dette i praksis, og øvingsmodusen gir deg de fleste teknikkene, én om gangen, som det aller neste trekket."
        ],
        "eli12": "Du lærer ikke dusinvis av triks. Du lærer tre ideer og ett løfte: ting som må passe, ting som nesten passer, hvis ikke dette så det, og løftet om bare ett svar. Alt annet er de samme tingene i andre klær."
      }
    }
  },
  "strings": {
    "Search {n} techniques": "Søk blant {n} teknikker",
    "Search techniques": "Søk blant teknikkene",
    "Order of the list": "Rekkefølge i listen",
    "Technique families": "Teknikkfamilier",
    "No technique matches “{q}”.": "Ingen teknikk passer til «{q}».",
    "By family": "Etter familie",
    "Easiest first": "Letteste først",
    "Most often needed": "Trengs oftest",
    "Most often needed first": "De som trengs oftest, først",
    "Most worth learning": "Mest verdt å lære",
    "Most worth learning first": "De som er mest verdt å lære, først",
    "In the order the solver tries them: a technique is only needed once everything above it has run dry.": "I rekkefølgen løseren prøver dem i: en teknikk trengs først når alt over den er brukt opp.",
    "The techniques that turn up in the most puzzles sudokUI generates, whatever their difficulty.": "Teknikkene som dukker opp i flest av oppgavene sudokUI lager, uansett vanskelighetsgrad.",
    "How often a technique is needed, weighted by its rating cost. Difficulty and frequency are different things: a hard technique that turns up often repays the effort of learning it, and those come first.": "Hvor ofte en teknikk trengs, vektet etter poengverdien. Vanskelighet og hyppighet er to forskjellige ting: en vanskelig teknikk som dukker opp ofte, er verdt innsatsen det koster å lære den, og slike teknikker kommer først.",
    "Learn next": "Lær dette neste",
    "Learn next first": "Det du bør lære neste, først",
    "The techniques most worth learning that you have used least on your own. Every move you make is credited with the easiest technique that justifies it, and a technique you have played unaided moves down the list. Your play stays on this device.": "Teknikkene som er mest verdt å lære, og som du har brukt minst på egen hånd. Hvert trekk du gjør, godskrives den letteste teknikken som begrunner det, og en teknikk du har spilt uten hjelp, rykker ned på listen. Spillingen din blir på denne enheten.",
    "Your play: {n} unaided, {h} from hints": "Din spilling: {n} på egen hånd, {h} fra hint",
    "Added to a puzzle's rating each time the solver needs this technique": "Legges til en oppgaves poengsum hver gang løseren trenger denne teknikken",
    "Needed in {freq}": "Trengs i {freq}",
    "Never needed": "Trengs aldri",
    "Why it works": "Hvorfor den virker",
    "How to spot it": "Slik finner du den",
    "Needed in {freq} that sudokUI generates.": "Trengs i {freq} som sudokUI lager.",
    "Also called {list}.": "Kalles også {list}.",
    "Practice this technique": "Øv på denne teknikken",
    "Scan the running game for this technique (counts as assistance)": "Skann spillet du er i gang med etter denne teknikken (teller som hjelp)",
    "Is it on my board?": "Finnes den på brettet mitt?",
    "Open as a page ↗": "Åpne som egen side ↗",
    "Worked example": "Gjennomgått eksempel",
    "{name} example on a sudoku board": "Eksempel på {name} på et sudokubrett",
    "Puzzle: {credit}.": "Oppgave: {credit}.",
    "In this puzzle the position comes after harder steps.": "I denne oppgaven kommer stillingen etter vanskeligere steg.",
    "Open this position on the board": "Åpne denne stillingen på brettet",
    "The solver uses this on the hardest puzzles. It has no pattern to spot, so it is not offered in practice.": "Løseren bruker denne på de vanskeligste oppgavene. Den har ikke noe mønster å se etter, så den tilbys ikke i øvingsmodus.",
    "Implemented, but never needed: an easier technique always reaches the same result first.": "Implementert, men trengs aldri: en lettere teknikk kommer alltid fram til det samme resultatet først.",
    "Only ever needed in puzzles made by hand for it: none can be generated, so it is not offered in practice.": "Trengs bare i oppgaver laget for hånd for den: ingen kan genereres, så den tilbys ikke som øvelse.",
    "Not implemented in sudokUI: the chain engines already find everything it can.": "Ikke implementert i sudokUI: kjedemotorene finner allerede alt den kan finne.",
    "Glossary: {term}": "Ordliste: {term}",
    "The words sudoku solvers use, and that the hints in sudokUI use, each defined once.": "Ordene sudokuløsere bruker, og som hintene i sudokUI også bruker, definert én gang hver.",
    "See": "Se",
    "In English: {term}": "På engelsk: {term}",
    "Ideas on this page": "Ideer på denne siden",
    "Explain it like I'm 12": "Forklar det som om jeg var 12",
    "In the catalogue": "I katalogen",
    "How fast is fast?": "Hvor raskt er raskt?",
    "Slow": "Langsom",
    "Typical": "Typisk",
    "Fast": "Rask",
    "Expert": "Ekspert",
    "World class": "Verdensklasse",
    "above {n}": "over {n}",
    "up to {n}": "opptil {n}",
    "Slow is where the slowest fifth begins. Typical is the median solver. Fast is faster than four solvers in five, Expert faster than 99 in 100, World class faster than 999 in 1,000.": "Langsom er der den tregeste femtedelen begynner. Typisk er medianløseren. Rask er raskere enn fire av fem løsere, Ekspert raskere enn 99 av 100, Verdensklasse raskere enn 999 av 1 000.",
    "The app says where each of your solves lands.": "Appen viser hvor hver av løsetidene dine havner.",
    "fewer than 1 in {n} puzzles": "færre enn 1 av {n} oppgaver",
    "every puzzle": "alle oppgaver",
    "{p}% of puzzles": "{p} % av oppgavene",
    "1 in {n} puzzles": "1 av {n} oppgaver",
    "Where 5 can go": "Hvor 5 kan stå",
    "The same, by row": "Det samme, rad for rad",
    "row {n}": "rad {n}",
    "row": "rad",
    "columns": "kolonner",
    "Naked triple: three cells in one row": "Naken trippel: tre ruter i én rad",
    "Bent triple: an XY-Wing": "Bøyd trippel: en XY-Wing",
    "An X-Wing on 5, and the same 5s listed by row as a naked pair": "En X-Wing på 5, og de samme 5-erne listet rad for rad som et naket par",
    "A naked triple and a hidden quad in the same row": "En naken trippel og en skjult kvartett i samme rad",
    "A naked triple in one row, and the same three digits bent round a corner as an XY-Wing": "En naken trippel i én rad, og de samme tre tallene bøyd rundt et hjørne som en XY-Wing",
    "A 2-String Kite on 4": "En 2-String Kite på 4",
    "A Unique Rectangle in rows 1 and 2, columns 1 and 4": "Et unikt rektangel i radene 1 og 2 og kolonnene 1 og 4",
    "Techniques": "Teknikker",
    "Intuition": "Intuisjon",
    "Glossary": "Ordliste",
    "Rating": "Vurdering",
    "Play": "Spill",
    "Learn": "Lær",
    "Language": "Språk",
    "sudokUI is a free, open-source sudoku app: no ads, no account, works offline.": "sudokUI er en gratis sudokuapp med åpen kildekode: ingen reklame, ingen konto, og den virker uten nett.",
    "Play at sudokui.app": "Spill på sudokui.app",
    "Source on GitHub": "Kildekode på GitHub",
    "Difficulty rating": "Vanskelighetsgrad",
    "Sudoku techniques": "Sudokuteknikker",
    "{name}: sudoku technique explained": "{name} i sudoku: teknikken forklart",
    "{what} Why it works, how to spot it, and a puzzle to practise on.": "{what} Hvorfor den virker, hvordan du finner den, og en oppgave å øve på.",
    "How the {name} works in sudoku: the pattern, why it is valid and how to spot it. {level} technique, rating score {score}.": "Slik virker {name} i sudoku: mønsteret, hvorfor det holder, og hvordan du finner det. Teknikk på nivået {level}, {score} poeng.",
    "{name} in sudoku": "{name} i sudoku",
    "rating cost {score}": "koster {score} poeng",
    "also called {list}": "også kalt {list}",
    "how it fits": "hvordan den passer inn",
    "Step {n} of this puzzle's solution, found and verified by the sudokUI engine. Cells are named by row and column: r2c3 is row 2, column 3.": "Steg {n} i løsningen av denne oppgaven, funnet og kontrollert av motoren i sudokUI. Rutene navngis etter rad og kolonne: r2c3 er rad 2, kolonne 3.",
    "In this puzzle the position comes after steps harder than the technique itself.": "I denne oppgaven kommer stillingen etter steg som er vanskeligere enn selve teknikken.",
    "Play this puzzle from the start": "Spill denne oppgaven fra starten",
    "Open the guide in sudokUI": "Åpne guiden i sudokUI",
    "Practise it on a real puzzle.": "Øv på den i en ekte oppgave.",
    "sudokUI generates a puzzle that needs {name} and takes you straight to the position where it applies. Hints draw the pattern on the board and explain the step.": "sudokUI lager en oppgave som trenger {name}, og tar deg rett til stillingen der teknikken kan brukes. Hint tegner mønsteret på brettet og forklarer steget.",
    "Practice {name}": "Øv på {name}",
    "Open in the app's guide": "Åpne i appens guide",
    "In a puzzle's rating": "I en oppgaves poengsum",
    "Each time the solver needs {name}, the puzzle's difficulty rating grows by {score}. Its class is {level}.": "Hver gang løseren trenger {name}, øker oppgavens poengsum med {score}. Det er en teknikk i klassen {level}.",
    "It is needed in {freq} that sudokUI generates.": "Den trengs i {freq} som sudokUI lager.",
    "How the rating works": "Slik regnes poengsummen ut",
    "More {family}": "Flere teknikker: {family}",
    "Sudoku solving techniques: all {n} explained": "Teknikker for å løse sudoku: alle {n} forklart",
    "All {n} sudoku solving techniques explained in plain words, from Naked Single to Exocet, grouped by family. Practise each one free in the app.": "Alle {n} teknikker for å løse sudoku, forklart med enkle ord, fra Naken singel til Exocet, ordnet i familier. Øv gratis på hver av dem i appen.",
    "Sudoku solving techniques": "Teknikker for å løse sudoku",
    "All {n} solving techniques in sudokUI's catalogue, grouped by the idea behind them. Each one says what the pattern is, why it works and how to spot it.": "Alle {n} løsningsteknikker i katalogen til sudokUI, ordnet etter ideen bak dem. For hver av dem står det hva mønsteret er, hvorfor det virker, og hvordan du finner det.",
    "Play sudokUI": "Spill sudokUI",
    "How they fit together": "Slik henger de sammen",
    "How rating works": "Slik fungerer vurderingen",
    "Worth learning first": "Verdt å lære først",
    "How often a technique is needed, weighted by its rating cost, over the {sample} puzzles sudokUI has generated and rated. Difficulty and frequency are different things: a hard technique that turns up often repays the effort of learning it.": "Hvor ofte en teknikk trengs, vektet etter poengverdien, i de {sample} oppgavene sudokUI har laget og vurdert. Vanskelighet og hyppighet er to forskjellige ting: en vanskelig teknikk som dukker opp ofte, er verdt innsatsen det koster å lære den.",
    "{level}, needed in {freq}": "{level}, trengs i {freq}",
    "Sudoku glossary: every solving term explained": "Ordliste for sudoku: alle fagordene forklart",
    "Plain-English definitions of sudoku solving terms: candidates, strong and weak links, conjugate pairs, almost locked sets, fins, deadly patterns and more.": "Fagordene i sudoku forklart på enkel norsk: kandidater, sterke og svake lenker, konjugerte par, nesten låste mengder, finner, dødelige mønstre og mer.",
    "Sudoku glossary": "Ordliste for sudoku",
    "The words sudoku solvers use, and that sudokUI's hints use, each defined once and precisely.": "Ordene sudokuløsere bruker, og som hintene i sudokUI også bruker, definert presist og én gang hver.",
    "also {list}": "også {list}",
    "See the terms at work: {techniques}, or {play} and ask for a hint.": "Se begrepene i bruk: {techniques}, eller {play} og be om et hint.",
    "every technique explained": "alle teknikkene forklart",
    "play sudokUI": "spill sudokUI",
    "How sudoku techniques fit together": "Slik henger teknikkene i sudoku sammen",
    "Every sudoku technique comes down to three ideas: locked sets, almost locked sets and chains. Each one explained simply, plus where the names came from.": "Alle teknikker i sudoku bunner i tre ideer: låste mengder, nesten låste mengder og kjeder. Hver av dem forklart enkelt, og hvor navnene kommer fra.",
    "In the catalogue:": "I katalogen:",
    "Open in the app": "Åpne i appen",
    "All techniques": "Alle teknikker",
    "Sudoku difficulty rating: how hard is your puzzle?": "Vanskelighetsgrad i sudoku: hvor vanskelig er din?",
    "How sudoku difficulty is rated: HoDoKu-compatible technique scores, eight bands from Beginner to Nightmare and the full score table. Rate any puzzle free.": "Slik vurderes vanskelighet i sudoku: teknikkpoeng som i HoDoKu, åtte grader fra Nybegynner til Mareritt og hele poengtabellen. Vurder enhver oppgave gratis.",
    "Sudoku difficulty rating": "Vanskelighetsgrad i sudoku",
    "Rate your own sudoku": "Vurder din egen sudoku",
    "Rate this puzzle": "Vurder denne oppgaven",
    "Paste a puzzle: 81 characters, with 0 or . for empty cells": "Lim inn en oppgave: 81 tegn, med 0 eller . for tomme ruter",
    "This box needs JavaScript. You can also {open} and choose Import.": "Dette feltet krever JavaScript. Du kan også {open} og velge Importer.",
    "open sudokUI": "åpne sudokUI",
    "A puzzle needs exactly 81 cells. This one has {n}.": "En oppgave må ha nøyaktig 81 ruter. Denne har {n}.",
    "The puzzle opens in sudokUI with its rating and band in the top bar. Nothing is uploaded: the rating is computed on your own device. No string at hand? {open}, choose New, then Custom, and type the puzzle onto the board. See also {hodoku}.": "Oppgaven åpnes i sudokUI med poengsum og vanskelighetsgrad i topplinjen. Ingenting lastes opp: poengsummen regnes ut på din egen enhet. Har du ingen tegnstreng for hånden? {open}, velg Ny og så Egendefinert, og skriv oppgaven inn på brettet. Se også {hodoku}.",
    "Open sudokUI": "Åpne sudokUI",
    "how this compares with HoDoKu": "sammenligningen med HoDoKu",
    "The eight difficulty bands": "De åtte vanskelighetsgradene",
    "Band": "Grad",
    "Total score": "Samlet poengsum",
    "Typical techniques": "Typiske teknikker",
    "Score of every technique": "Poeng for hver teknikk",
    "The cost added to a puzzle's rating each time the solver needs the technique, and how many of the puzzles sudokUI generates need it at least once (measured on {sample} puzzles).": "Poengene som legges til en oppgaves poengsum hver gang løseren trenger teknikken, og hvor mange av oppgavene sudokUI lager som trenger den minst én gang (målt på {sample} oppgaver).",
    "Technique": "Teknikk",
    "Class": "Klasse",
    "Score": "Poeng",
    "Needed in": "Trengs i",
    "Every technique explained": "Alle teknikkene forklart",
    "How the difficulty rating works": "Slik vurderes vanskelighetsgraden"
  }
};

export default nb;
