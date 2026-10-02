// Spanish text of the Learn section: the glossary, the technique
// guide, the Intuition guide, How to solve, the rating and the interface
// strings. Keyed exactly like EN in ../learnLocale.ts; the terminology
// follows docs/glossary_input.md. tests/learnLocale.test.ts checks that
// every piece is here, in house style, with its placeholders and numbers.
import type { LearnLocale } from '../learnLocale';

const es: LearnLocale = {
  "techNames": {
    "NAKED_SINGLE": "Único desnudo",
    "HIDDEN_SINGLE": "Único oculto",
    "LOCKED_PAIR": "Par bloqueado",
    "LOCKED_TRIPLE": "Trío bloqueado",
    "LOCKED_CANDIDATES_1": "Candidatos bloqueados (puntero)",
    "LOCKED_CANDIDATES_2": "Candidatos bloqueados (reclamante)",
    "NAKED_PAIR": "Par desnudo",
    "NAKED_TRIPLE": "Trío desnudo",
    "HIDDEN_PAIR": "Par oculto",
    "HIDDEN_TRIPLE": "Trío oculto",
    "NAKED_QUADRUPLE": "Cuarteto desnudo",
    "HIDDEN_QUADRUPLE": "Cuarteto oculto",
    "UNIQUENESS_1": "Rectángulo único tipo 1",
    "UNIQUENESS_2": "Rectángulo único tipo 2",
    "UNIQUENESS_3": "Rectángulo único tipo 3",
    "UNIQUENESS_4": "Rectángulo único tipo 4",
    "UNIQUENESS_5": "Rectángulo único tipo 5",
    "UNIQUENESS_6": "Rectángulo único tipo 6",
    "HIDDEN_RECTANGLE": "Rectángulo oculto",
    "AVOIDABLE_RECTANGLE_1": "Rectángulo evitable tipo 1",
    "AVOIDABLE_RECTANGLE_2": "Rectángulo evitable tipo 2",
    "EXTENDED_RECTANGLE": "Rectángulo extendido",
    "BRUTE_FORCE": "Fuerza bruta"
  },
  "techDocs": {
    "FULL_HOUSE": {
      "what": "Una fila, columna o caja tiene ocho de sus nueve casillas llenas, así que queda exactamente una casilla vacía.",
      "why": "Una unidad debe contener cada número del 1 al 9 exactamente una vez, así que el único número que falta en las ocho casillas llenas se coloca en la casilla vacía.",
      "spot": "Busca una fila, columna o caja con ocho números ya colocados y averigua qué número del 1 al 9 falta."
    },
    "NAKED_SINGLE": {
      "what": "A una casilla vacía le queda exactamente un candidato, porque todos los demás números se han descartado para esa casilla.",
      "why": "Cada casilla debe contener un número, y aquí se han descartado ocho de los nueve, así que el único candidato que queda se coloca en la casilla.",
      "spot": "Busca casillas vacías cuya fila, columna y caja muestren ya entre todas muchos números distintos, y comprueba si solo queda un número."
    },
    "HIDDEN_SINGLE": {
      "what": "En una fila, columna o caja, un número X es candidato en exactamente una casilla, sean cuales sean los demás candidatos de esa casilla.",
      "why": "Cada unidad debe contener X una vez, y en esta unidad solo una casilla puede llevarlo todavía, así que X se coloca en esa casilla.",
      "spot": "Toma un número cada vez, descarta todas las casillas que ven ese número ya colocado y busca una unidad donde solo le quede un sitio."
    },
    "LOCKED_PAIR": {
      "what": "Dos casillas de la misma caja y de la misma fila o columna son casillas bivalor con los mismos dos candidatos, X e Y.",
      "why": "Esas dos casillas deben llevar X e Y en algún orden, así que ninguna otra casilla que vea ambas puede contener ninguno de los dos números. X e Y se eliminan de todas las demás casillas de la caja y de la fila o columna compartida.",
      "spot": "Si dos casillas bivalor de una caja tienen los mismos candidatos y comparten fila o columna, busca esos números en el resto de ambas unidades."
    },
    "LOCKED_TRIPLE": {
      "what": "Tres casillas vacías de una caja que además comparten fila o columna contienen entre ellas solo los candidatos X, Y y Z, aunque ninguna casilla necesita tener los tres.",
      "why": "Tres casillas que se ven todas entre sí necesitan tres números distintos, y solo están disponibles X, Y y Z, así que los tres se usan ahí. X, Y y Z se eliminan de todas las demás casillas de la caja y de esa fila o columna.",
      "spot": "Mira las tres casillas donde una caja cruza una fila o columna: todas deben estar vacías y tener entre ellas solo tres candidatos distintos."
    },
    "LOCKED_CANDIDATES_1": {
      "what": "Dentro de una caja, todos los candidatos de un número X están en la misma fila o en la misma columna, en dos o tres casillas.",
      "why": "La caja debe contener X, y todos sus sitios posibles están en una fila o columna, así que el X de esa fila o columna debe estar dentro de la caja. X se elimina de las casillas de esa fila o columna fuera de la caja.",
      "spot": "Recorre una caja número por número: cuando todos los candidatos de un número comparten fila o columna, sigue esa fila o columna fuera de la caja."
    },
    "LOCKED_CANDIDATES_2": {
      "what": "Dentro de una fila o columna, todos los candidatos de un número X están dentro de la misma caja, en dos o tres casillas.",
      "why": "La fila o columna debe contener X, y todos sus sitios posibles están dentro de una caja, así que el X de esa caja debe estar en esa fila o columna. X se elimina de las casillas de la caja fuera de esa fila o columna.",
      "spot": "Recorre una fila o columna número por número: cuando todos los candidatos de un número caen en una caja, mira el resto de esa caja."
    },
    "NAKED_PAIR": {
      "what": "Dos casillas de la misma unidad que tienen cada una exactamente los mismos dos candidatos, X e Y, y ningún otro.",
      "why": "Una casilla debe llevar X y la otra Y, en cualquier orden, así que ninguno de los dos números puede ir en otro sitio de una unidad que contenga ambas casillas. Elimina X e Y de todas las demás casillas de cada una de esas unidades.",
      "spot": "Encuentra dos casillas bivalor que se vean y muestren los mismos dos números, y busca esos números en el resto de cada unidad que compartan."
    },
    "NAKED_TRIPLE": {
      "what": "Tres casillas vacías de la misma unidad cuyos candidatos, tomados en conjunto, son exactamente tres números X, Y y Z, aunque ninguna casilla necesita tener los tres.",
      "why": "Tres casillas de una unidad necesitan tres números distintos, y solo están disponibles X, Y y Z, así que esas casillas se quedan con los tres. Elimina X, Y y Z de todas las demás casillas de cada unidad que contenga las tres casillas.",
      "spot": "En una unidad, reúne las casillas con solo dos o tres candidatos y comprueba si tres de ellas tienen entre todas solo tres números."
    },
    "HIDDEN_PAIR": {
      "what": "Dos números X e Y, ambos aún sin colocar en una unidad, cuyos únicos sitios posibles en esa unidad son las mismas dos casillas.",
      "why": "La unidad necesita tanto X como Y, y solo estas dos casillas pueden llevarlos, así que una casilla debe ser X y la otra Y. Elimina de ambas casillas todos los candidatos salvo X e Y.",
      "spot": "Recorre una unidad número por número, viendo dónde puede ir cada uno, y fíjate en dos números limitados a las mismas dos casillas."
    },
    "HIDDEN_TRIPLE": {
      "what": "Tres números, todos aún sin colocar en una unidad, cuyos sitios en esa unidad caen dentro de las mismas tres casillas, aunque un número no tiene por qué aparecer en las tres.",
      "why": "La unidad necesita los tres números en tres casillas distintas, y solo estas tres casillas pueden llevarlos, así que los números ocupan las tres casillas. Elimina de las tres casillas todos los candidatos salvo esos tres números.",
      "spot": "Para cada número que falta en una unidad, haz la lista de sus casillas posibles y busca tres números cuyas listas juntas solo nombren tres casillas."
    },
    "NAKED_QUADRUPLE": {
      "what": "Cuatro casillas vacías de la misma unidad cuyos candidatos, tomados en conjunto, son exactamente cuatro números, aunque ninguna casilla necesita tener los cuatro.",
      "why": "Cuatro casillas de una unidad necesitan cuatro números distintos, y solo están disponibles esos cuatro, así que las casillas se quedan con todos ellos. Elimina los cuatro números de todas las demás casillas de esa unidad.",
      "spot": "En una unidad con muchas casillas vacías, busca cuatro casillas cuyos candidatos nunca se salgan de los mismos cuatro números."
    },
    "HIDDEN_QUADRUPLE": {
      "what": "Cuatro números, todos aún sin colocar en una unidad, cuyos sitios en esa unidad caen dentro de las mismas cuatro casillas, aunque un número no tiene por qué aparecer en las cuatro.",
      "why": "La unidad necesita los cuatro números en cuatro casillas distintas, y solo estas cuatro casillas pueden llevarlos, así que los números ocupan las cuatro casillas. Elimina de las cuatro casillas todos los candidatos salvo esos cuatro números.",
      "spot": "En una unidad con muchas casillas vacías, busca números con cuatro sitios como mucho y comprueba si cuatro de ellos caben en las mismas cuatro casillas."
    },
    "X_WING": {
      "what": "El número X tiene exactamente dos candidatos en cada una de dos filas, y los cuatro están en las mismas dos columnas, o lo mismo con filas y columnas intercambiadas.",
      "why": "Cada fila coloca X en una de las dos columnas, y las dos filas no pueden compartir columna, así que cada columna obtiene su X de estas cuatro casillas. Elimina X de todas las demás casillas de esas columnas, o de esas filas en la forma intercambiada.",
      "spot": "Filtra por un número y busca dos filas, o dos columnas, cuyos dos únicos candidatos formen las esquinas de un rectángulo."
    },
    "SWORDFISH": {
      "what": "El número X tiene dos o tres candidatos en cada una de tres filas, todos en las mismas tres columnas, o lo mismo con filas y columnas intercambiadas.",
      "why": "Cada una de las tres filas coloca X en una columna distinta de las tres, así que las tres columnas obtienen su X de estas filas. Elimina X de todas las demás casillas de esas columnas, o de esas filas en la forma intercambiada.",
      "spot": "Filtra por un número y encuentra tres filas cuyos candidatos, juntos, ocupen solo tres columnas: una fila puede usar solo dos de ellas."
    },
    "JELLYFISH": {
      "what": "El número X tiene de dos a cuatro candidatos en cada una de cuatro filas, todos en las mismas cuatro columnas, o lo mismo con filas y columnas intercambiadas.",
      "why": "Cada una de las cuatro filas coloca X en una columna distinta de las cuatro, así que las cuatro columnas obtienen su X de estas filas. Elimina X de todas las demás casillas de esas columnas, o de esas filas en la forma intercambiada.",
      "spot": "Filtra por un número y encuentra cuatro filas cuyos candidatos, juntos, ocupen solo cuatro columnas: una fila puede usar solo dos de ellas."
    },
    "SQUIRMBAG": {
      "what": "El número X tiene de dos a cinco candidatos en cada una de cinco filas, todos en las mismas cinco columnas, o lo mismo con filas y columnas intercambiadas.",
      "why": "Cada una de las cinco filas coloca X en una columna distinta de las cinco, así que las cinco columnas obtienen su X de estas filas. Elimina X de todas las demás casillas de esas columnas, o de esas filas en la forma intercambiada.",
      "spot": "Mira las columnas fuera del patrón: como mucho cuatro necesitan aún X, y forman peces más pequeños o únicos que dan las mismas eliminaciones."
    },
    "WHALE": {
      "what": "El número X tiene de dos a seis candidatos en cada una de seis filas, todos en las mismas seis columnas, o lo mismo con filas y columnas intercambiadas.",
      "why": "Cada una de las seis filas coloca X en una columna distinta de las seis, así que las seis columnas obtienen su X de estas filas. Elimina X de todas las demás casillas de esas columnas, o de esas filas en la forma intercambiada.",
      "spot": "Mira las columnas fuera del patrón: como mucho tres necesitan aún X, y forman peces más pequeños o únicos que dan las mismas eliminaciones."
    },
    "LEVIATHAN": {
      "what": "El número X tiene de dos a siete candidatos en cada una de siete filas, todos en las mismas siete columnas, o lo mismo con filas y columnas intercambiadas.",
      "why": "Cada una de las siete filas coloca X en una columna distinta de las siete, así que las siete columnas obtienen su X de estas filas. Elimina X de todas las demás casillas de esas columnas, o de esas filas en la forma intercambiada.",
      "spot": "Mira las columnas fuera del patrón: como mucho dos necesitan aún X, y forman un X-Wing o únicos que dan las mismas eliminaciones."
    },
    "REMOTE_PAIR": {
      "what": "Una cadena de al menos cuatro casillas bivalor que tienen todas los mismos dos candidatos X e Y, en la que cada casilla ve la siguiente.",
      "why": "Dos casillas consecutivas de la cadena deben ser distintas, así que la cadena alterna entre X e Y. Una casilla fuera de la cadena que ve dos casillas de la cadena separadas por un número impar de pasos ve un X y un Y, así que se le eliminan tanto X como Y.",
      "spot": "Encuentra cuatro o más casillas bivalor con los mismos dos candidatos, une las que se ven entre sí y colorea la cadena alternando dos colores."
    },
    "CHUTE_REMOTE_PAIR": {
      "what": "Dos casillas bivalor con X e Y en una franja (tres cajas alineadas), que no se ven, donde las tres casillas de la franja que no ven ninguna de las dos no tienen X, ni colocado ni candidato.",
      "why": "La caja que contiene esas tres casillas debe tener su X en la fila o columna de una de las casillas del par, lo que hace que esa casilla sea Y. Se elimina Y de todas las casillas que ven ambas casillas del par, y también X si las tres casillas tampoco tienen Y.",
      "spot": "Busca en cada franja dos casillas bivalor idénticas sin unidad común, y comprueba X y luego Y en las tres casillas de la franja que no ven ninguna de las dos."
    },
    "BUG_PLUS_1": {
      "what": "Todas las casillas sin resolver son casillas bivalor salvo una con tres candidatos, y en cada unidad cada candidato aparece exactamente dos veces, salvo X, que aparece tres veces en cada una de las unidades de esa casilla.",
      "why": "Sin X en esa casilla, la cuadrícula solo tendría casillas bivalor, con cada candidato dos veces por unidad, así que cualquier solución tendría una gemela que usa el otro candidato de cada casilla. Suponiendo que el sudoku tenga exactamente una solución, X se coloca en esa casilla.",
      "spot": "Cuando todas las casillas sin resolver menos una son bivalor, busca la casilla con tres candidatos: el que aparece tres veces en su fila es X."
    },
    "SKYSCRAPER": {
      "what": "Dos filas (o columnas) tienen cada una un par conjugado del número X; un extremo de cada par está en la misma columna (o fila), y los otros extremos no se ven entre sí.",
      "why": "Los dos extremos que comparten columna (o fila) no pueden ser X a la vez, así que al menos uno de los otros dos extremos debe ser X. X se elimina de todas las casillas fuera del patrón que ven esos dos extremos.",
      "spot": "Elige un número, encuentra dos filas donde tenga exactamente dos sitios y comprueba si dos de esos sitios están en la misma columna."
    },
    "TWO_STRING_KITE": {
      "what": "Una fila y una columna tienen cada una un par conjugado de X, en cuatro casillas distintas; un extremo de cada par está en la misma caja, y los otros no se ven entre sí.",
      "why": "Los dos extremos de la caja compartida no pueden ser X a la vez, así que al menos uno de los otros dos extremos debe ser X. X se elimina de todas las casillas fuera del patrón que ven esos dos extremos.",
      "spot": "Encuentra una caja donde un par conjugado de fila y otro de columna tengan cada uno un extremo, y mira la casilla que ve los dos extremos lejanos."
    },
    "TURBOT_FISH": {
      "what": "El número X forma dos pares conjugados en cuatro casillas distintas; un extremo de un par ve un extremo del otro, y los extremos restantes no se ven entre sí.",
      "why": "Los dos extremos que se ven no pueden ser X a la vez, así que al menos uno de los extremos restantes debe ser X. X se elimina de todas las casillas fuera del patrón que ven los dos extremos restantes.",
      "spot": "Skyscraper y 2-String Kite son casos particulares; si no, busca formas en las que al menos uno de los pares conjugados esté en una caja."
    },
    "EMPTY_RECTANGLE": {
      "what": "Los candidatos de X en una caja están solo en una fila y una columna; un par conjugado de columna (o de fila) fuera de la caja tiene un extremo en esa fila (o columna).",
      "why": "Como un extremo está en la fila, el X de la caja está o bien en esa fila, y entonces el otro extremo es X, o bien en la columna; así que cualquier casilla de esa columna fuera de la caja que vea el otro extremo pierde X. En el otro caso, intercambia fila y columna.",
      "spot": "Busca una caja donde cuatro casillas que forman un rectángulo no tengan el candidato X, de modo que X quede solo en una fila y una columna."
    },
    "W_WING": {
      "what": "Dos casillas bivalor, ambas con los candidatos X y Z, no se ven; un par conjugado de X tiene un extremo que ve la primera y otro que ve la segunda.",
      "why": "Un extremo del par conjugado debe ser X, así que la casilla bivalor que ese extremo ve pierde X y pasa a ser Z. Por tanto, al menos una casilla bivalor es Z, y Z se elimina de todas las casillas fuera del patrón que ven ambas casillas bivalor.",
      "spot": "Encuentra dos casillas bivalor idénticas que no se vean y busca un par conjugado de uno de sus números que las una."
    },
    "XY_WING": {
      "what": "Una casilla pivote bivalor con los candidatos X e Y ve dos casillas pinza bivalor, una con los candidatos X y Z, y la otra con los candidatos Y y Z.",
      "why": "Si el pivote es X, la pinza con X pasa a ser Z; si el pivote es Y, la pinza con Y pasa a ser Z. Por tanto, al menos una pinza es Z, y Z se elimina de todas las demás casillas que ven ambas pinzas.",
      "spot": "Desde una casilla bivalor, busca, entre las casillas bivalor que ve, dos que se repartan sus números y compartan un número nuevo."
    },
    "XYZ_WING": {
      "what": "Una casilla pivote con exactamente tres candidatos X, Y y Z ve dos casillas pinza bivalor, una con los candidatos X y Z, y la otra con los candidatos Y y Z.",
      "why": "Si el pivote es X o Y, la pinza que tiene ese número pasa a ser Z; si no, el propio pivote es Z. Por tanto, al menos una de las tres casillas es Z, y Z se elimina de todas las demás casillas que ven las tres.",
      "spot": "Encuentra una casilla con tres candidatos y busca en su caja y en su fila o columna dos casillas bivalor con pares distintos de sus candidatos."
    },
    "WXYZ_WING": {
      "what": "Tres casillas de una unidad tienen entre ellas exactamente los candidatos W, X, Y y Z; una cuarta casilla, bivalor con X y Z, ve todas las que tienen X.",
      "why": "Si la casilla bivalor es X, las tres casillas pierden X y deben repartirse W, Y y Z, así que una de ellas es Z; si no, la casilla bivalor es Z. Z se elimina de todas las demás casillas que ven todas las casillas del patrón con el candidato Z.",
      "spot": "Busca tres casillas de una unidad con cuatro candidatos entre ellas y, después, una cuarta casilla cercana, bivalor, formada por dos de esos números."
    },
    "UNIQUENESS_1": {
      "what": "Cuatro casillas que forman un rectángulo en exactamente dos cajas, donde tres contienen solo X e Y y la cuarta contiene X, Y y al menos otro candidato.",
      "why": "Si la cuarta casilla fuera X o Y, las cuatro casillas contendrían solo X e Y, e intercambiarlos daría una segunda solución. Suponiendo que el sudoku tenga exactamente una solución, X e Y se eliminan de la cuarta casilla.",
      "spot": "Busca tres casillas bivalor con los mismos dos candidatos en tres esquinas de un rectángulo que esté en exactamente dos cajas."
    },
    "UNIQUENESS_2": {
      "what": "Un rectángulo en exactamente dos cajas donde dos esquinas contienen solo X e Y y las otras dos contienen cada una exactamente X, Y y Z.",
      "why": "Si ninguna de esas dos esquinas fuera Z, el rectángulo contendría solo X e Y, e intercambiarlos daría una segunda solución. Suponiendo que el sudoku tenga exactamente una solución, al menos una es Z, así que Z se elimina de todas las demás casillas que ven ambas.",
      "spot": "Encuentra dos casillas bivalor con el mismo par en un rectángulo y comprueba si las dos esquinas restantes añaden un solo candidato extra, el mismo en ambas."
    },
    "UNIQUENESS_3": {
      "what": "Un rectángulo en exactamente dos cajas: dos esquinas contienen solo X e Y, las otras comparten una unidad, y sus extras junto con los candidatos de otras K casillas de esa unidad reúnen K+1 números en total.",
      "why": "Suponiendo que el sudoku tenga exactamente una solución, una de esas esquinas toma un extra, porque si no, intercambiar X e Y daría una segunda solución. Esa esquina y las K casillas ocupan los K+1 números, que se eliminan de las demás casillas de esa unidad fuera del rectángulo.",
      "spot": "Cuando las dos esquinas con extras comparten una unidad, busca en ella casillas cuyos candidatos estén todos entre esos extras."
    },
    "UNIQUENESS_4": {
      "what": "Un rectángulo en exactamente dos cajas: dos esquinas contienen solo X e Y, y las otras dos también tienen extras y son los únicos sitios para X en una unidad que comparten.",
      "why": "Una de esas dos esquinas debe ser X. Si la otra fuera Y, el rectángulo contendría solo X e Y, e intercambiarlos daría una segunda solución, así que, suponiendo que el sudoku tenga exactamente una solución, se elimina Y de ambas esquinas.",
      "spot": "Tras encontrar dos esquinas bivalor, comprueba si X o Y tiene exactamente dos sitios en una unidad que compartan las otras dos esquinas."
    },
    "UNIQUENESS_5": {
      "what": "Un rectángulo en exactamente dos cajas donde una esquina contiene solo X e Y y las otras tres contienen cada una exactamente X, Y y Z.",
      "why": "Si ninguna de las tres fuera Z, el rectángulo contendría solo X e Y, e intercambiarlos daría una segunda solución. Suponiendo que el sudoku tenga exactamente una solución, al menos una es Z, así que Z se elimina de las demás casillas que ven las tres.",
      "spot": "Parte de una casilla bivalor y busca un rectángulo cuyas otras tres esquinas muestren cada una el mismo par más un candidato extra común."
    },
    "UNIQUENESS_6": {
      "what": "Un rectángulo en exactamente dos cajas: dos esquinas opuestas contienen solo X e Y, las otras también tienen extras, y sus dos filas, o sus dos columnas, no tienen ningún otro X.",
      "why": "Si una esquina con extras fuera X, el resto del rectángulo quedaría forzado a solo X e Y, e intercambiarlos daría una segunda solución. Suponiendo que el sudoku tenga exactamente una solución, X se elimina de las dos esquinas con extras.",
      "spot": "Con las esquinas bivalor en diagonal, comprueba si X o Y forma un par conjugado dentro del rectángulo en ambas filas o en ambas columnas."
    },
    "HIDDEN_RECTANGLE": {
      "what": "Un rectángulo en exactamente dos cajas con X e Y en cada esquina, una de ellas sin otros candidatos, y X limitado a esquinas del rectángulo en la fila y la columna de la esquina opuesta.",
      "why": "Si la esquina opuesta fuera Y, X quedaría forzado en las dos esquinas contiguas e Y en la casilla bivalor, y X e Y podrían intercambiarse para dar una segunda solución. Suponiendo que el sudoku tenga exactamente una solución, se elimina Y de la esquina opuesta.",
      "spot": "Desde una casilla bivalor, mira la esquina opuesta: uno de los dos números debe formar un par conjugado tanto en la fila como en la columna de esa esquina."
    },
    "AVOIDABLE_RECTANGLE_1": {
      "what": "Un rectángulo en exactamente dos cajas con tres esquinas resueltas, ninguna de ellas número dado: las dos que ven la esquina sin resolver son ambas Y, y la opuesta a ella es X.",
      "why": "Si la esquina sin resolver fuera X, las cuatro casillas contendrían solo X e Y, e intercambiarlos daría una segunda solución sin cambiar ningún número dado. Suponiendo que el sudoku tenga exactamente una solución, X se elimina de esa esquina.",
      "spot": "Haz que los números dados y los que colocas tú se distingan a simple vista, y busca tres de tus colocaciones en un rectángulo con solo dos números."
    },
    "AVOIDABLE_RECTANGLE_2": {
      "what": "Un rectángulo en exactamente dos cajas: dos esquinas de una fila o columna están resueltas, no son números dados, y cada esquina sin resolver contiene solo Z y el número de la esquina opuesta en diagonal.",
      "why": "Si ninguna esquina sin resolver fuera Z, el rectángulo contendría dos números que podrían intercambiarse sin tocar ningún número dado, lo que daría una segunda solución. Suponiendo que el sudoku tenga exactamente una solución, una de ellas es Z, así que Z se elimina de todas las demás casillas que ven ambas.",
      "spot": "Busca dos de tus propias colocaciones en una fila o columna de un rectángulo cuyas esquinas restantes sean casillas bivalor con un candidato común."
    },
    "EXTENDED_RECTANGLE": {
      "what": "Seis casillas sin resolver donde dos filas cruzan tres columnas, o dos columnas cruzan tres filas, en exactamente tres cajas, con tres números más los extras de una casilla o un número extra.",
      "why": "Sin extras, las dos casillas de cada caja podrían intercambiar sus números y dar una segunda solución. Suponiendo que el sudoku tenga exactamente una solución, la casilla con extras pierde los tres números, o el número extra se elimina de las casillas externas que ven todas las casillas del patrón que lo contienen.",
      "spot": "Busca tres números que se repitan en dos filas o columnas que atraviesan las mismas tres cajas, con un par de casillas por caja."
    },
    "FINNED_X_WING": {
      "what": "Dos filas (o columnas) tienen el candidato X en las cuatro esquinas de un rectángulo, y sus demás candidatos para X, las aletas, están todos en la caja de una de las esquinas.",
      "why": "Si ninguna aleta es verdadera, un X-Wing simple elimina X del resto de sus columnas; si alguna lo es, en su caja no puede haber otro X. Las casillas de esas columnas que están en la caja de las aletas, fuera de las dos filas, pierden X, y lo mismo con filas y columnas intercambiadas.",
      "spot": "Busca dos filas o columnas que formarían un X-Wing de no ser por unos candidatos extra, todos dentro de la caja de una esquina."
    },
    "SASHIMI_X_WING": {
      "what": "Dos filas (o columnas) tienen el candidato X en tres esquinas de un rectángulo, y sus demás candidatos para X, las aletas, están todos en la caja de la esquina que falta.",
      "why": "Si ninguna aleta es verdadera, las dos columnas reciben su X de las dos filas; si alguna lo es, en su caja no puede haber otro X. Las casillas de esas columnas que están en la caja de las aletas, fuera de las dos filas, pierden X, y lo mismo con filas y columnas intercambiadas.",
      "spot": "Busca un X-Wing al que le falte una esquina, donde la fila o columna del hueco tenga sus demás candidatos para X dentro de la caja del hueco."
    },
    "FINNED_SWORDFISH": {
      "what": "Tres filas (o columnas) solo tienen el candidato X en tres columnas (o filas) comunes y en las aletas, casillas extra situadas todas en una caja, con al menos dos candidatos que no son aletas en cada fila.",
      "why": "Si ninguna aleta es verdadera, un Swordfish simple elimina X del resto de sus columnas; si alguna lo es, en su caja no puede haber otro X. Las casillas de esas columnas que están en la caja de las aletas, fuera de las tres filas, pierden X, y lo mismo con filas y columnas intercambiadas.",
      "spot": "Cuando tres filas casi formen un Swordfish, comprueba si todos los candidatos extra para X están en una misma caja atravesada por una de sus tres columnas."
    },
    "SASHIMI_SWORDFISH": {
      "what": "Tres filas (o columnas) solo tienen el candidato X en tres columnas (o filas) comunes y en las aletas, casillas extra situadas en una caja, y una fila con aletas tiene un solo candidato que no es aleta.",
      "why": "Si ninguna aleta es verdadera, las tres columnas reciben su X de las tres filas; si alguna lo es, en su caja no puede haber otro X. Las casillas de esas columnas que están en la caja de las aletas, fuera de las tres filas, pierden X, y lo mismo con filas y columnas intercambiadas.",
      "spot": "Busca un Swordfish en el que una fila tenga un solo candidato que no es aleta y además otros candidatos para X en una caja atravesada por otra columna del Swordfish."
    },
    "FINNED_JELLYFISH": {
      "what": "Cuatro filas (o columnas) solo tienen el candidato X en cuatro columnas (o filas) comunes y en las aletas, casillas extra situadas todas en una caja, con al menos dos candidatos que no son aletas en cada fila.",
      "why": "Si ninguna aleta es verdadera, un Jellyfish simple elimina X del resto de sus columnas; si alguna lo es, en su caja no puede haber otro X. Las casillas de esas columnas que están en la caja de las aletas, fuera de las cuatro filas, pierden X, y lo mismo con filas y columnas intercambiadas.",
      "spot": "Busca cuatro filas cuyos candidatos para X quepan en cuatro columnas salvo unos pocos extra, todos en una caja atravesada por una de esas columnas."
    },
    "SASHIMI_JELLYFISH": {
      "what": "Cuatro filas (o columnas) solo tienen el candidato X en cuatro columnas (o filas) comunes y en las aletas, casillas extra situadas en una caja, y una fila con aletas tiene un solo candidato que no es aleta.",
      "why": "Si ninguna aleta es verdadera, las cuatro columnas reciben su X de las cuatro filas; si alguna lo es, en su caja no puede haber otro X. Las casillas de esas columnas que están en la caja de las aletas, fuera de las cuatro filas, pierden X, y lo mismo con filas y columnas intercambiadas.",
      "spot": "Busca cuatro filas que encajen en cuatro columnas, donde una fila tenga un solo candidato que no es aleta y sus extras estén en una caja atravesada por otra columna."
    },
    "SUE_DE_COQ": {
      "what": "Dos o tres casillas de una caja, en una misma fila o columna, tienen dos candidatos más que casillas; dos casillas bivalor, una en otra parte de cada unidad, se reparten cuatro de esos candidatos.",
      "why": "Con tantas casillas como candidatos, el patrón coloca cada candidato una vez. Los candidatos de la casilla bivalor de la caja se eliminan del resto de la caja; los de la otra casilla bivalor, del resto de la fila o columna; y cualquier candidato restante, del resto de ambas.",
      "spot": "Busca dos o tres casillas con muchos candidatos donde una caja se cruza con una fila o columna, con una casilla bivalor en otra parte de cada una de esas unidades."
    },
    "SIMPLE_COLORS": {
      "what": "Para un número X, las casillas unidas por pares conjugados forman un clúster, que se colorea con dos colores de modo que las dos casillas de cada par conjugado tengan colores opuestos.",
      "why": "Un color tiene X en todas sus casillas y el otro en ninguna. Si dos casillas de un mismo color se ven, ese color es falso y X se elimina de todas sus casillas; cualquier casilla sin color que vea casillas de ambos colores también pierde X.",
      "spot": "Elige un número, marca cada unidad donde tenga exactamente dos posiciones y sigue los pares que comparten una casilla para formar el clúster."
    },
    "MULTI_COLORS": {
      "what": "Para un número X, dos clústeres separados de pares conjugados se colorean cada uno de forma alterna con sus propios dos colores, y una casilla de uno ve una casilla del otro.",
      "why": "Dos colores que se ven no pueden ser verdaderos a la vez, así que X se elimina de cualquier casilla fuera de ambos clústeres que vea casillas de los dos colores restantes. Un color que ve los dos colores del otro clúster es falso: elimina X de todas sus casillas.",
      "spot": "Colorea con cuatro colores dos clústeres separados del mismo número y luego busca una unidad que contenga una casilla coloreada de cada clúster."
    },
    "MEDUSA_3D": {
      "what": "Candidatos de varios números, unidos por pares conjugados o por compartir una casilla bivalor, forman un clúster coloreado de forma alterna con dos colores, de modo que los candidatos enlazados tengan colores opuestos.",
      "why": "Exactamente un color es verdadero por completo. Un color entero se elimina si pone dos números en una casilla o un número dos veces en una unidad, o si deja una casilla sin candidatos; un candidato sin color se elimina si es falso sea cual sea el color verdadero.",
      "spot": "Empieza en una casilla bivalor y extiéndete hacia fuera por pares conjugados y otras casillas bivalor, coloreando los candidatos de forma alterna sobre la marcha."
    },
    "X_CHAIN": {
      "what": "Cuatro o más casillas con el candidato X en una cadena cuyos enlaces alternan entre pares conjugados (fuertes) y casillas que se ven (débiles), y que empieza y termina con un enlace fuerte.",
      "why": "Si un extremo no es X, los enlaces fuertes fuerzan X y los débiles lo prohíben, alternándose, hasta que el otro extremo es X. Por tanto, al menos un extremo es X, así que X se elimina de todas las casillas fuera de la cadena que ven ambos extremos.",
      "spot": "Filtra la cuadrícula por un número, marca sus pares conjugados y une los pares por sus extremos allí donde dos de sus casillas se ven."
    },
    "X_CYCLES": {
      "what": "Un bucle cerrado de casillas con el candidato X cuyos enlaces alternan entre fuertes y débiles en toda la vuelta, o en toda salvo en una casilla donde se juntan dos enlaces fuertes o dos débiles.",
      "why": "En un bucle que alterna por completo, cada enlace débil tiene X en uno de sus extremos, así que X se elimina de las casillas de fuera que ven ambos extremos de un mismo enlace débil. Dos enlaces fuertes que se juntan colocan X en esa casilla, y dos enlaces débiles que se juntan eliminan X de ella.",
      "spot": "Dibuja los pares conjugados de un número, únelos donde sus casillas se ven y comprueba si la cadena vuelve a su casilla de partida."
    },
    "GROUPED_X_CYCLES": {
      "what": "Un bucle X-Cycle en el que un grupo de dos o tres candidatos X, en una caja y en una fila o columna, actúa como una sola casilla: es verdadero si cualquiera de sus miembros es X.",
      "why": "Ver un grupo significa ver todos sus miembros. Un bucle que alterna por completo elimina X de las casillas de fuera que ven ambos extremos de un enlace débil; un nodo donde se juntan dos enlaces fuertes es verdadero, así que las casillas que lo ven pierden X; y uno donde se juntan dos enlaces débiles pierde X.",
      "spot": "Busca una unidad cuyos candidatos X estén todos en un grupo más otra casilla u otro grupo: esos dos extremos tienen un enlace fuerte."
    },
    "XY_CHAIN": {
      "what": "Una cadena de casillas bivalor en la que cada una ve la siguiente y se une a ella por un candidato común que cambia en cada casilla, y que deja un candidato sin usar, Z, en ambos extremos.",
      "why": "Si un extremo no es Z, toma su candidato de unión, lo que obliga a cada casilla siguiente a tomar su otro candidato hasta que el extremo opuesto es Z. Al menos un extremo es Z, así que Z se elimina de todas las casillas fuera de la cadena que ven ambos extremos.",
      "spot": "Empieza en una casilla bivalor, supón que no es Z, sigue los números forzados por las casillas bivalor y detente cuando una sea Z."
    },
    "TWINNED_XY_CHAIN": {
      "what": "Seis casillas donde dos filas cruzan tres columnas, o al revés, que tienen entre todas exactamente seis números distintos como candidatos, y en las que, para cada número, las casillas que lo contienen se ven todas entre sí.",
      "why": "Cada número puede ocupar como mucho una casilla del patrón, pero seis casillas necesitan seis números, así que cada número se usa exactamente una vez. Cualquiera de los seis números, X, se elimina de todas las casillas fuera del patrón que ven todas las casillas del patrón que contienen X.",
      "spot": "Busca tres casillas bivalor en una fila o columna que compartan un número y luego comprueba si una fila o columna paralela contiene las otras tres casillas."
    },
    "NICE_LOOP": {
      "what": "Un bucle de candidatos cuyos enlaces alternan entre fuertes y débiles, o bien perfectamente en toda la vuelta, o bien en todas partes salvo en un candidato donde se juntan dos enlaces fuertes o dos débiles.",
      "why": "Con alternancia perfecta, un extremo de cada enlace débil es verdadero: si ambos extremos comparten casilla, se eliminan los demás candidatos de esa casilla; si no, su número se elimina de las casillas que ven ambos. Un candidato donde se juntan dos enlaces fuertes se coloca, y uno donde se juntan dos débiles se elimina.",
      "spot": "Sigue enlaces alternos desde una casilla bivalor o un par conjugado y fíjate en si la cadena vuelve para enlazarse con su candidato de partida."
    },
    "GROUPED_NICE_LOOP": {
      "what": "Un Nice Loop con al menos un nodo agrupado, formado por dos o tres casillas con el candidato X en una caja y en una fila o columna, que es verdadero si cualquiera de ellas es X.",
      "why": "Con alternancia perfecta, un extremo de cada enlace débil es verdadero, lo que elimina cualquier candidato enlazado débilmente con sus dos extremos. Un nodo donde se juntan dos enlaces fuertes es verdadero: si es un candidato, se coloca; si es un grupo, elimina X de las casillas de fuera que ven todas sus casillas.",
      "spot": "Cuando las únicas posiciones de X en una unidad sean un grupo más otra casilla u otro grupo, usa ese enlace fuerte para alargar un bucle."
    },
    "ALS_XZ": {
      "what": "Dos conjuntos casi bloqueados, cada uno dentro de una unidad y sin casillas en común, contienen ambos dos números, X y Z, y cada X de uno ve cada X del otro.",
      "why": "X no puede ir en los dos conjuntos a la vez, así que al menos a uno le quedan tantos candidatos como casillas y debe contener Z. Por eso Z se elimina de todas las casillas fuera de ambos conjuntos que ven todos los Z de los dos conjuntos.",
      "spot": "Empieza con conjuntos pequeños, como las casillas bivalor, encuentra dos que compartan dos números y luego comprueba si las casillas de uno de esos números se ven todas entre sí."
    },
    "ALS_XY_WING": {
      "what": "Tres conjuntos casi bloqueados que no se solapan: cada X de la bisagra ve cada X de un ala, cada Y de la bisagra ve cada Y de la otra, y ambas alas contienen otro número Z.",
      "why": "A la bisagra solo le puede faltar un número, así que contiene X o Y, lo que elimina ese número del ala correspondiente, que se convierte en un conjunto bloqueado que contiene Z. Por eso Z se elimina de cualquier casilla fuera de los tres conjuntos que vea todos los Z de ambas alas.",
      "spot": "Imagina un XY-Wing cuyas casillas se han convertido en conjuntos: encuentra una bisagra unida a dos alas por números distintos y luego busca un Z común."
    },
    "ALS_XY_CHAIN": {
      "what": "Cuatro conjuntos casi bloqueados forman una cadena: los conjuntos contiguos comparten un número de unión cuyas casillas se ven todas entre sí, cada conjunto intermedio usa dos números de unión distintos, y ambos extremos contienen otro número Z.",
      "why": "Si un extremo no tiene Z, queda bloqueado y coloca su número de unión, lo que elimina ese número del conjunto siguiente, y así sucesivamente hasta que el extremo opuesto debe colocar Z. Por eso Z se elimina de cualquier casilla fuera de la cadena que vea todos los Z de ambos extremos.",
      "spot": "Construye la cadena enlace a enlace con conjuntos pequeños, como las casillas bivalor, y tras tres enlaces comprueba si ambos extremos comparten un candidato."
    },
    "AIC": {
      "what": "Una cadena de candidatos, que puede mezclar números, cuyos enlaces alternan fuerte, débil, fuerte y así sucesivamente, y que empieza y termina con un enlace fuerte.",
      "why": "Si un extremo es falso, los enlaces obligan a que el otro sea verdadero, así que al menos un extremo es verdadero. Se elimina cualquier candidato enlazado débilmente con ambos extremos, ya sea por compartir casilla o por ser el mismo número en casillas que se ven.",
      "spot": "Los pares conjugados y las casillas bivalor dan los enlaces fuertes: únelos donde dos candidatos compartan casilla, o compartan número y unidad."
    },
    "AIC_GROUPED": {
      "what": "Una AIC con al menos un nodo agrupado, formado por dos o tres casillas con el candidato X en una caja y en una fila o columna, que es verdadero si cualquiera de ellas es X.",
      "why": "Un grupo y otro nodo de X tienen un enlace fuerte cuando juntos son las únicas posiciones de X en una unidad, y un enlace débil cuando todas sus casillas se ven entre sí. Al menos un extremo de la cadena es verdadero, así que se elimina cualquier candidato enlazado débilmente con ambos extremos.",
      "spot": "Cuando una cadena se atasque en una unidad con tres posiciones para X, comprueba si dos de ellas forman un grupo, lo que recupera un enlace fuerte."
    },
    "AIC_ALS": {
      "what": "Una AIC que usa un ALS como enlace fuerte entre dos de sus números: si X no está en ningún lugar del ALS, Y tiene que estar en alguna parte de él.",
      "why": "Sin X, el ALS tiene N candidatos para N casillas, así que se colocan todos, Y incluido. Al menos un extremo es verdadero, lo que elimina los candidatos enlazados débilmente con ambos: un número del ALS tiene un enlace débil con ese número en las casillas de fuera que ven todas las casillas del ALS que lo contienen.",
      "spot": "Una casilla bivalor ya da un enlace fuerte, así que fíjate después en dos casillas de una unidad que tengan entre las dos tres candidatos."
    },
    "DEATH_BLOSSOM": {
      "what": "Cada candidato de una casilla tallo tiene su propio pétalo, un conjunto casi bloqueado que solo contiene ese candidato en casillas que ven el tallo; cada pétalo contiene Z, que el tallo no tiene.",
      "why": "Tome el tallo el número que tome, ese número se elimina de su pétalo, que se convierte en un conjunto bloqueado y debe contener Z. Por eso Z se elimina de cualquier casilla fuera del tallo y los pétalos que vea todos los Z de todos los pétalos.",
      "spot": "Empieza en una casilla con dos o tres candidatos y luego busca cerca un conjunto pequeño por cada candidato, todos con algún otro número en común."
    },
    "FRANKEN_X_WING": {
      "what": "Dos unidades base (filas o cajas) sin candidatos para X en común tienen todos sus candidatos X en dos unidades de cobertura (columnas o cajas) que tampoco comparten ninguno, o lo mismo con filas y columnas intercambiadas.",
      "why": "Cada unidad base coloca X una vez, en casillas distintas, y cada unidad de cobertura solo admite un X, así que las dos unidades de cobertura reciben el suyo de la base. Elimina X de todas las casillas de las unidades de cobertura que están fuera de las unidades base.",
      "spot": "Filtra por X y compara dos filas o cajas con dos columnas o cajas: al menos una de las cuatro unidades tiene que ser una caja."
    },
    "FRANKEN_SWORDFISH": {
      "what": "Tres unidades base (filas o cajas) sin candidatos para X en común tienen todos sus candidatos X en tres unidades de cobertura (columnas o cajas) que tampoco comparten ninguno, o lo mismo con filas y columnas intercambiadas.",
      "why": "Cada unidad base coloca X una vez, en casillas distintas, y cada unidad de cobertura solo admite un X, así que las tres unidades de cobertura reciben el suyo de la base. Elimina X de todas las casillas de las unidades de cobertura que están fuera de las unidades base.",
      "spot": "Filtra por X y compara tres filas o cajas con tres columnas o cajas: al menos una de las seis unidades tiene que ser una caja."
    },
    "FIREWORKS": {
      "what": "Tres números que faltan en una fila y en una columna y cuyos candidatos en esas dos unidades, fuera de la caja donde se cruzan, están todos en una única casilla ala de cada una.",
      "why": "Cada número está en un ala o, si no, dentro de la caja tanto en la fila como en la columna, y eso solo puede ser la casilla donde se cruzan. Por tanto, tres números ocupan estas tres casillas, que pierden todos los candidatos salvo esos tres números.",
      "spot": "Revisa una fila y una columna que se cruzan en una caja en busca de números cuyos candidatos fuera de esa caja estén en una sola casilla de cada una."
    },
    "TRIDAGON": {
      "what": "Cuatro cajas que forman un rectángulo tienen cada una tres casillas en diagonal, con una caja inclinada en sentido contrario a las otras tres; solo una casilla, la guardiana, tiene candidatos además de X, Y y Z.",
      "why": "Doce casillas así nunca pueden rellenarse todas con X, Y y Z sin repetir un número en alguna fila, columna o caja. Por eso la guardiana debe tomar uno de sus otros candidatos, y X, Y y Z se eliminan de ella.",
      "spot": "Busca cuatro cajas llenas de los mismos tres candidatos; las diagonales pueden dar la vuelta por el borde de la caja, avanzando a la derecha o a la izquierda según bajan."
    },
    "SK_LOOP": {
      "what": "Cuatro casillas resueltas que forman un rectángulo en cuatro cajas; sus filas y columnas dentro de esas cajas dan ocho parejas de casillas, cada una con cuatro candidatos, dos compartidos con cada pareja contigua.",
      "why": "Las parejas contiguas comparten una caja, fila o columna, así que cada número compartido solo cabe una vez en sus cuatro casillas. Ocho enlaces así llenan como mucho dieciséis casillas, justo el tamaño del bucle, así que cada número compartido se usa y se elimina del resto de esa unidad.",
      "spot": "Busca cuatro casillas resueltas que formen un rectángulo en cuatro cajas, cada una con las demás casillas de su fila y su columna dentro de la caja aún sin resolver."
    },
    "ALIGNED_PAIR_EXCLUSION": {
      "what": "Dos casillas que se ven, junto con uno o más conjuntos casi bloqueados, casillas bivalor incluidas, en los que todas las casillas ven a ambas.",
      "why": "Las dos casillas no pueden tener el mismo número, ni dos números que sean ambos candidatos de uno de esos ALS, porque le faltaría un número. Un candidato de cualquiera de las dos casillas se elimina cuando todas sus combinaciones con los candidatos de la otra casilla quedan descartadas.",
      "spot": "Elige dos casillas de la misma unidad con pocos candidatos y luego busca casillas bivalor o ALS pequeños que ambas casillas vean."
    },
    "EXOCET": {
      "what": "En una fila o columna, dos casillas base de una misma caja tienen entre ambas tres o cuatro candidatos; cada una de sus otras dos cajas tiene una casilla objetivo que no ve ninguna casilla base ni el otro objetivo.",
      "why": "Cuando cada número base, una vez colocado en una casilla base, queda forzado también en un objetivo, los objetivos contienen los dos números de la base. Los objetivos pierden todo candidato que no sea un número base, y los números base que no aparecen en ninguno de los dos objetivos se eliminan de las dos casillas base.",
      "spot": "Empieza por dos casillas de una misma caja y fila o columna con tres o cuatro candidatos, y luego sigue cada número por separado desde la base hasta los objetivos."
    },
    "DOUBLE_EXOCET": {
      "what": "Dos Exocets válidos cuyas parejas base están en cajas distintas de la misma fila o columna, y cada pareja tiene entre sus dos casillas los mismos cuatro candidatos.",
      "why": "Las cuatro casillas base comparten una fila o columna y solo tienen esos cuatro candidatos, así que entre todas toman los cuatro números. Por tanto, esos números se eliminan de todas las demás casillas de esa fila o columna, además de las eliminaciones propias de cada Exocet.",
      "spot": "Después de encontrar un Exocet, busca en otra caja de la misma fila o columna una segunda pareja base con los mismos cuatro candidatos."
    },
    "PATTERN_OVERLAY": {
      "what": "Se enumeran todos los patrones completos de un número X: nueve casillas, una en cada fila, columna y caja, que incluyen todos los X ya colocados y, por lo demás, solo casillas con el candidato X.",
      "why": "En la solución, las nueve casillas que contienen X forman exactamente uno de estos patrones. Un candidato X que no está en ningún patrón se elimina, y una casilla vacía que está en todos los patrones tiene que ser X.",
      "spot": "Elige un número que ya esté colocado varias veces y al que le queden pocos candidatos, para que solo haya que escribir un puñado de patrones completos."
    },
    "FORCING_CHAIN": {
      "what": "Se sigue una suposición, o cada una de un conjunto de suposiciones que cubre todos los casos, como todos los candidatos de una casilla, a través de los pasos que fuerza.",
      "why": "Una de las suposiciones de un conjunto que cubre todos los casos tiene que ser verdadera, así que cualquier colocación o eliminación que fuercen todas ellas es segura. Una suposición que lleva a una contradicción es falsa: un candidato supuesto verdadero se elimina, y uno supuesto falso se coloca.",
      "spot": "Empieza donde haya menos opciones, una casilla bivalor o un par conjugado, y anota cada recorrido con su propio color para compararlos."
    },
    "DIGIT_FORCING_CHAIN": {
      "what": "Se sigue un candidato en los dos sentidos, una vez suponiéndolo verdadero y otra falso, colocando cada vez los únicos desnudos y ocultos que resultan, y se comparan los dos resultados.",
      "why": "El candidato es verdadero o falso, así que todo aquello en lo que coinciden ambos recorridos es seguro: un número que los dos colocan en la misma casilla se coloca, y un candidato que los dos quitan se elimina. Si el recorrido en que se supone falso acaba en una contradicción, se coloca el propio candidato.",
      "spot": "Empieza por un candidato de una casilla bivalor o de un par conjugado, porque ahí el recorrido en que es falso también fuerza una colocación inmediata."
    },
    "NISHIO_FORCING_CHAIN": {
      "what": "Se supone que un candidato es verdadero, y los únicos que fuerza acaban en una contradicción: una casilla vacía sin candidatos, o una unidad sin sitio para un número que le falta.",
      "why": "Cada único desnudo u oculto del recorrido es una consecuencia segura de la suposición, así que la contradicción demuestra que la suposición es falsa. Se elimina el candidato supuesto, y no se conserva nada más del recorrido.",
      "spot": "Prueba un candidato X cuya casilla vea varias casillas bivalor que contengan X, porque suponerlo verdadero convierte cada una de ellas en un único desnudo."
    },
    "CELL_FORCING_CHAIN": {
      "what": "Se supone verdadero, por turnos, cada candidato de una casilla, colocando cada vez los únicos desnudos y ocultos que resultan, y se comparan los resultados.",
      "why": "La casilla tiene que contener uno de sus candidatos, así que uno de los recorridos sigue el caso verdadero. Un número que todos los recorridos colocan en la misma casilla se coloca, y un candidato que todos quitan se elimina.",
      "spot": "Elige una casilla con dos o tres candidatos que vea casillas bivalor que compartan esos candidatos, para que cada suposición desencadene una serie de únicos."
    },
    "UNIT_FORCING_CHAIN": {
      "what": "Se supone verdadera, por turnos, cada posición de un número X en una unidad, colocando cada vez los únicos desnudos y ocultos que resultan, y se comparan los resultados.",
      "why": "X tiene que ir en algún lugar de la unidad, así que uno de los recorridos sigue el caso verdadero. Un número que todos los recorridos colocan en la misma casilla se coloca, y un candidato que todos quitan se elimina.",
      "spot": "Empieza con un par conjugado, que solo necesita dos recorridos, y luego prueba números a los que les queden tres posiciones en una unidad."
    },
    "FORCING_NET": {
      "what": "Se supone que un candidato es verdadero y se sigue a través de candidatos bloqueados además de únicos desnudos y ocultos, donde cualquier paso puede apoyarse en varios anteriores, hasta que aparece una contradicción.",
      "why": "Cada paso es una consecuencia segura de la suposición, así que una contradicción, sea una casilla vacía sin candidatos o una unidad sin sitio para un número, demuestra que la suposición es falsa. Solo se elimina el candidato supuesto.",
      "spot": "Cuando los únicos se atasquen sin llegar a una contradicción, busca un número que en alguna unidad esté limitado a las casillas donde una caja se cruza con una fila o columna."
    },
    "BRUTE_FORCE": {
      "what": "Sin ningún patrón: se prueban números en las casillas vacías uno tras otro, retrocediendo en cada callejón sin salida, hasta llenar toda la cuadrícula.",
      "why": "Una cuadrícula llena sin romper ninguna regla es una solución, y un sudoku válido tiene exactamente una. Se coloca en una casilla vacía un número de esa solución, sin ningún razonamiento que un jugador pueda seguir.",
      "spot": "No hay nada que buscar: si tienes que adivinar a mano, elige una casilla bivalor y apunta desde dónde empezaste a adivinar."
    }
  },
  "techAka": {
    "FULL_HOUSE": [
      "Último número",
      "Última casilla libre"
    ],
    "NAKED_SINGLE": [
      "Candidato único",
      "Último número posible"
    ],
    "HIDDEN_SINGLE": [
      "Última casilla restante"
    ],
    "LOCKED_CANDIDATES_1": [
      "Par puntero",
      "Trío puntero"
    ],
    "LOCKED_CANDIDATES_2": [
      "Reducción caja-línea"
    ],
    "NAKED_PAIR": [
      "Pareja desnuda"
    ],
    "HIDDEN_PAIR": [
      "Pareja oculta"
    ],
    "X_WING": [
      "Ala X"
    ],
    "SWORDFISH": [
      "Pez espada"
    ],
    "REMOTE_PAIR": [
      "Par remoto"
    ],
    "SKYSCRAPER": [
      "Rascacielos"
    ],
    "TWO_STRING_KITE": [
      "Cometa de dos cuerdas"
    ],
    "EMPTY_RECTANGLE": [
      "Rectángulo vacío"
    ],
    "FINNED_X_WING": [
      "X-Wing con aletas"
    ],
    "SASHIMI_X_WING": [
      "X-Wing sashimi"
    ],
    "FINNED_SWORDFISH": [
      "Swordfish con aletas"
    ],
    "SASHIMI_SWORDFISH": [
      "Swordfish sashimi"
    ],
    "FINNED_JELLYFISH": [
      "Jellyfish con aletas"
    ],
    "SASHIMI_JELLYFISH": [
      "Jellyfish sashimi"
    ],
    "SIMPLE_COLORS": [
      "coloreado",
      "coloreado simple"
    ],
    "MULTI_COLORS": [
      "coloreado múltiple"
    ],
    "MEDUSA_3D": [
      "Medusa 3D"
    ],
    "X_CHAIN": [
      "cadena X"
    ],
    "X_CYCLES": [
      "ciclo X"
    ],
    "XY_CHAIN": [
      "cadena XY"
    ],
    "NICE_LOOP": [
      "bucle continuo",
      "bucle discontinuo"
    ],
    "AIC": [
      "cadena de inferencias alternas"
    ],
    "PATTERN_OVERLAY": [
      "superposición de patrones",
      "plantillas"
    ],
    "FORCING_CHAIN": [
      "cadena forzada"
    ],
    "FORCING_NET": [
      "red forzada"
    ],
    "BRUTE_FORCE": [
      "ensayo y error",
      "prueba y error"
    ]
  },
  "kin": {
    "FULL_HOUSE": [
      "único desnudo y oculto a la vez"
    ],
    "NAKED_SINGLE": [
      "subconjunto desnudo de tamaño uno"
    ],
    "HIDDEN_SINGLE": [
      "pez de tamaño 1",
      "subconjunto oculto de tamaño uno"
    ],
    "LOCKED_PAIR": [
      "Par desnudo que limpia dos unidades"
    ],
    "LOCKED_TRIPLE": [
      "Trío desnudo que limpia dos unidades"
    ],
    "LOCKED_CANDIDATES_1": [
      "pez de tamaño 1: caja sobre línea"
    ],
    "LOCKED_CANDIDATES_2": [
      "Reducción caja-línea",
      "pez de tamaño 1: línea sobre caja"
    ],
    "NAKED_PAIR": [
      "la otra cara de un subconjunto oculto",
      "en una línea: X-Wing visto de lado"
    ],
    "NAKED_TRIPLE": [
      "la otra cara de un subconjunto oculto",
      "en una línea: Swordfish visto de lado"
    ],
    "NAKED_QUADRUPLE": [
      "la otra cara de un subconjunto oculto",
      "en una línea: Jellyfish visto de lado"
    ],
    "HIDDEN_PAIR": [
      "la otra cara de un subconjunto desnudo",
      "en una línea: X-Wing visto de lado"
    ],
    "HIDDEN_TRIPLE": [
      "la otra cara de un subconjunto desnudo",
      "en una línea: Swordfish visto de lado"
    ],
    "HIDDEN_QUADRUPLE": [
      "la otra cara de un subconjunto desnudo",
      "en una línea: Jellyfish visto de lado"
    ],
    "X_WING": [
      "pez de tamaño 2",
      "Par desnudo visto de lado",
      "X-Cycle de 4 candidatos"
    ],
    "SWORDFISH": [
      "pez de tamaño 3",
      "Trío desnudo visto de lado"
    ],
    "JELLYFISH": [
      "pez de tamaño 4",
      "Cuarteto desnudo visto de lado"
    ],
    "SQUIRMBAG": [
      "pez de tamaño 5",
      "la otra cara de un pez menor"
    ],
    "WHALE": [
      "pez de tamaño 6",
      "la otra cara de un pez menor"
    ],
    "LEVIATHAN": [
      "pez de tamaño 7",
      "la otra cara de un pez menor"
    ],
    "SKYSCRAPER": [
      "forma de Turbot Fish",
      "X-Chain de 4 candidatos",
      "dos Sashimi X-Wings"
    ],
    "TWO_STRING_KITE": [
      "forma de Turbot Fish",
      "X-Chain de 4 candidatos"
    ],
    "TURBOT_FISH": [
      "X-Chain de 4 candidatos"
    ],
    "EMPTY_RECTANGLE": [
      "Grouped Nice Loop"
    ],
    "W_WING": [
      "una AIC corta, no un subconjunto doblado"
    ],
    "XY_WING": [
      "Y-Wing",
      "trío doblado",
      "XY-Chain de 3 casillas"
    ],
    "XYZ_WING": [
      "trío doblado",
      "ALS-XZ"
    ],
    "WXYZ_WING": [
      "cuarteto doblado",
      "ALS-XZ"
    ],
    "SIMPLE_COLORS": [
      "todas las X-Chains de un clúster"
    ],
    "MULTI_COLORS": [
      "X-Chains y bucles entre dos clústeres"
    ],
    "MEDUSA_3D": [
      "coloreado que abarca todos los números"
    ],
    "REMOTE_PAIR": [
      "XY-Chain de un solo par"
    ],
    "X_CHAIN": [
      "AIC de un solo número"
    ],
    "X_CYCLES": [
      "Nice Loop de un solo número"
    ],
    "GROUPED_X_CYCLES": [
      "Grouped Nice Loop de un solo número"
    ],
    "XY_CHAIN": [
      "XY-Wing: el caso de 3 casillas"
    ],
    "NICE_LOOP": [
      "una AIC escrita como bucle"
    ],
    "AIC": [
      "engloba las X-Chains y las XY-Chains"
    ],
    "ALS_XZ": [
      "cadena de ALS de dos conjuntos",
      "el VWXYZ-Wing es un caso particular"
    ],
    "ALS_XY_WING": [
      "XY-Wing hecho de conjuntos"
    ],
    "ALS_XY_CHAIN": [
      "XY-Chain hecha de conjuntos"
    ],
    "DEATH_BLOSSOM": [
      "Cell Forcing Chain a través de conjuntos"
    ],
    "SUE_DE_COQ": [
      "Two-Sector Disjoint Subsets"
    ],
    "AVOIDABLE_RECTANGLE_1": [
      "Rectángulo único con casillas resueltas por ti"
    ],
    "AVOIDABLE_RECTANGLE_2": [
      "Rectángulo único con casillas resueltas por ti"
    ],
    "ALIGNED_PAIR_EXCLUSION": [
      "el XYZ-Wing es un caso particular"
    ],
    "PATTERN_OVERLAY": [
      "todos los patrones de un número simultáneamente"
    ]
  },
  "categories": {
    "Singles": {
      "label": "Únicos",
      "note": "La base de toda resolución: una casilla con un solo número posible, o un número con una sola casilla posible."
    },
    "Intersections": {
      "label": "Intersecciones",
      "note": "Donde una caja cruza una fila o una columna: si los candidatos de un número quedan confinados a la intersección, ese número se elimina del resto de la otra unidad."
    },
    "Subsets": {
      "label": "Subconjuntos",
      "note": "N casillas que entre todas solo admiten N números dejan esos números bloqueados en ellas, tanto si el patrón está a la vista como si está oculto."
    },
    "Basic Fish": {
      "label": "Peces básicos",
      "note": "Un número cuyas posiciones en N filas caen en las mismas N columnas (o al revés), lo que lo elimina del resto de esas líneas."
    },
    "Finned Fish": {
      "label": "Peces con aletas",
      "note": "Un pez con candidatos de más: la aleta. Sigue funcionando, pero solo en las casillas que también ven la aleta."
    },
    "Complex Fish": {
      "label": "Peces complejos",
      "note": "Peces que usan cajas además de filas y columnas."
    },
    "Single Digit Patterns": {
      "label": "Patrones de un solo número",
      "note": "Cadenas cortas sobre un solo número, formadas por dos enlaces fuertes unidos por uno débil."
    },
    "Wings": {
      "label": "Wings",
      "note": "Unas pocas casillas cuyos candidatos garantizan que una de ellas contiene un número concreto, así que toda casilla que las vea a todas pierde ese número."
    },
    "Uniqueness": {
      "label": "Unicidad",
      "note": "Patrones que darían al sudoku dos soluciones y que, por eso, no pueden aparecer en un sudoku que tiene exactamente una."
    },
    "Chains and Loops": {
      "label": "Cadenas y bucles",
      "note": "Inferencias que se transmiten a lo largo de enlaces fuertes y débiles hasta que los dos extremos permiten concluir algo."
    },
    "Coloring": {
      "label": "Coloreado",
      "note": "Los candidatos unidos por enlaces fuertes reciben dos colores: un color es verdadero por completo y el otro, falso por completo."
    },
    "Almost Locked Sets": {
      "label": "Conjuntos casi bloqueados",
      "note": "Grupos de casillas a un solo candidato de quedar bloqueados, que se combinan unos con otros."
    },
    "Miscellaneous": {
      "label": "Varios",
      "note": "Patrones poco frecuentes que no encajan en ninguna otra familia."
    },
    "Last Resort": {
      "label": "Último recurso",
      "note": "Métodos basados en probar, para posiciones en las que ya no queda ningún patrón que encontrar."
    }
  },
  "levels": {
    "Beginner": "Principiante",
    "Easy": "Fácil",
    "Medium": "Medio",
    "Tricky": "Engañoso",
    "Hard": "Difícil",
    "Unfair": "Injusto",
    "Extreme": "Extremo",
    "Nightmare": "Pesadilla"
  },
  "bandLeads": {
    "Beginner": "Un comienzo suave",
    "Easy": "Tranquilo",
    "Medium": "Las anotaciones ayudan",
    "Tricky": "Un truco nuevo",
    "Hard": "Varios patrones a la vez",
    "Unfair": "Para expertos",
    "Extreme": "Para expertos, y largo",
    "Nightmare": "Lo más difícil que existe"
  },
  "bandNotes": {
    "Beginner": "full houses y únicos sencillos",
    "Easy": "solo únicos, pero más numerosos",
    "Medium": "candidatos bloqueados y subconjuntos",
    "Tricky": "un primer pez, wing o kite",
    "Hard": "peces, wings y patrones en abundancia",
    "Unfair": "cadenas, ALS y peces con aletas",
    "Extreme": "cadenas largas, coloreado y redes",
    "Nightmare": "redes forzadas y Exocets"
  },
  "rating": {
    "summary": "sudokUI puntúa un sudoku resolviéndolo como lo haría una persona. En cada paso usa la técnica más fácil que permite avanzar y suma la puntuación de esa técnica. El total es la puntuación del sudoku.",
    "points": [
      {
        "title": "La técnica más fácil, primero",
        "text": "Las técnicas se prueban en un orden fijo, desde los únicos hasta las redes forzadas, y se aplica la primera que funciona. Por eso la puntuación mide una ruta hecha con los pasos más fáciles disponibles, no la ruta más ingeniosa."
      },
      {
        "title": "Puntuaciones compatibles con HoDoKu",
        "text": "Las puntuaciones y el orden de búsqueda son los predeterminados de HoDoKu, el analizador de sudokus de referencia, así que las puntuaciones se pueden comparar con las de HoDoKu. Un Único desnudo cuesta 4; un X-Wing, 140; una Forcing Net, 700. Las técnicas que HoDoKu no conoce reciben una puntuación cercana a la de sus parientes más próximos."
      },
      {
        "title": "Ocho niveles de dificultad",
        "text": "El nivel es el más alto de dos lecturas: el nivel que corresponde a la puntuación total y el nivel de la técnica más difícil que se necesita. Un sudoku que necesita un solo pez, wing o kite es como mínimo Engañoso, y uno que necesita varios es como mínimo Difícil."
      },
      {
        "title": "Puntúa cualquier sudoku",
        "text": "Importa un sudoku de 81 caracteres o escríbelo a mano. sudokUI comprueba primero que tiene exactamente una solución y después lo puntúa, antes de que empieces a jugar."
      }
    ],
    "solveTimeNote": "Referencias aproximadas a partir de los tiempos típicos que comunican los jugadores en línea, repartidas como se reparten los tiempos de resolución: la mayoría cerca del centro y una larga cola detrás. La marca de Clase mundial la fijan los jugadores de campeonato. Escribir tus propias anotaciones lleva más tiempo que usar candidatos automáticos, y el papel, más todavía, así que cada forma de resolver tiene su propia tabla. Un sudoku en lo más alto de su nivel lleva más tiempo que uno en lo más bajo.",
    "modes": {
      "auto": "con candidatos automáticos",
      "marks": "con tus propias anotaciones",
      "paper": "en papel"
    }
  },
  "method": {
    "name": "Cómo resuelven los mejores",
    "title": "Cómo resolver un sudoku como los mejores | sudokUI",
    "description": "Los campeones de sudoku no empiezan rellenando candidatos: buscan únicos, anotan solo pares seguros y suben de dificultad en orden fijo. Cómo entrenarlo.",
    "h1": "Cómo resuelven el sudoku los mejores jugadores",
    "lead": "Los jugadores más rápidos casi no escriben nada. Recorren la cuadrícula con la vista, anotan solo lo que es seguro y recurren a las anotaciones y a técnicas más difíciles solo cuando el sudoku los obliga. El orden en que trabajan es el orden que enseña sudokUI.",
    "sections": [
      {
        "heading": "Empieza sin escribir nada",
        "paragraphs": [
          "Un jugador de competición coloca los diez primeros números antes de que un principiante haya terminado de escribir los candidatos. Toma un número cada vez y recorre la cuadrícula buscándolo: allí donde las filas y columnas en las que ya está dejan una sola casilla libre en una caja, hay un único oculto, y ahí lo coloca. Luego, el siguiente número. Este barrido cruzado resuelve por sí solo la mayor parte de un sudoku fácil, y funciona en papel, en el móvil, en cualquier sitio.",
          "Una cuadrícula completa de candidatos es justo lo contrario. Cuesta minutos escribirla, esconde las pocas anotaciones que importan entre docenas que no importan, y cada colocación obliga a borrar. Los mejores jugadores nunca empiezan por ahí.",
          "Una colocación no es el final de un barrido, sino el comienzo de otro más pequeño. Cada número colocado cambia su fila, su columna y su caja, así que el jugador rápido mira ahí primero: ¿ese número es ahora un único en una caja vecina? ¿La casilla que acaba de ocupar ha dejado un único en alguna de sus líneas? Solo entonces sigue el barrido con el siguiente número. Solo una pasada completa del 1 al 9 sin colocar nada indica que se han acabado los únicos."
        ]
      },
      {
        "heading": "Anota solo los pares: la notación Snyder",
        "paragraphs": [
          "Cuando a un número le quedan exactamente dos sitios en una caja, ni uno más, lo escriben pequeño en la esquina de las dos casillas. No se anota nada más. Estos pares de esquina, que llevan el nombre del campeón Thomas Snyder, quien hizo famosa la costumbre, son la materia prima de la siguiente etapa: dos notas de esquina en una misma fila de una caja forman un par puntero, dos números que comparten las mismas dos casillas forman un par oculto, y dos cajas cuyos pares se alinean son el comienzo de un X-Wing.",
          "En sudokUI, el modo Esquina está pensado para esto: cada nota va en el sitio fijo de su número, el par sigue visible cuando seleccionas la casilla, y las pistas razonan a partir de tus anotaciones, no de una cuadrícula de candidatos que nunca escribiste."
        ]
      },
      {
        "heading": "El orden que pide el sudoku",
        "paragraphs": [
          "Primero los únicos, hasta que no quede ninguno. Después los pares de caja, punteros y reclamantes, que no cuestan nada una vez puestas las notas de esquina. Luego los pares y tríos desnudos y ocultos en las líneas. Solo cuando todo eso se ha agotado rellenan los mejores jugadores los candidatos que faltan, y los rellenan en toda la cuadrícula a la vez, nunca casilla por casilla.",
          "Con los candidatos puestos, la búsqueda se amplía: X-Wings, Skyscrapers y kites sobre un solo número; después, XY-Wings y W-Wings sobre casillas bivalor; después, cadenas. Es el mismo orden que sigue el resolvedor de sudokUI cuando puntúa un sudoku, y por eso la guía de técnicas está ordenada así y una pista nombra la técnica más fácil que funciona, nunca una más difícil.",
          "El orden es una escalera que se sube desde abajo cada vez, no una secuencia que se recorre una sola vez. Tras cualquier éxito en un peldaño más alto, sea un par puntero, un par oculto o un X-Wing, vuelve directamente a los únicos: una eliminación suele liberar un único, y ese único libera tres más. Nadie sigue buscando X-Wings mientras hay un único disponible. El resolvedor trabaja igual: después de cada paso vuelve a empezar por la técnica más fácil."
        ]
      },
      {
        "heading": "Sudokus para expertos: candidatos y después enlaces",
        "paragraphs": [
          "En los sudokus que publican las webs para expertos, la apertura es la misma, pero corta: los únicos se acaban pronto. A partir de ahí, los jugadores más fuertes piensan en enlaces más que en patrones con nombre. Un número con dos sitios en una unidad es un enlace fuerte; una casilla bivalor es un enlace fuerte entre dos números. Las cadenas de enlaces fuertes y débiles demuestran eliminaciones, y las técnicas con nombre, desde el X-Wing hasta la cadena de inferencias alternas, son todas casos particulares de una misma cadena. El coloreado es la misma idea, con pintura en lugar de flechas.",
          "Los patrones de unicidad son el otro atajo de los expertos: un sudoku publicado tiene una sola solución, así que cualquier disposición que permitiera dos está prohibida, y la familia del rectángulo único convierte eso en eliminaciones en cuestión de segundos."
        ]
      },
      {
        "heading": "La velocidad es reconocimiento",
        "paragraphs": [
          "El jugador más rápido en una dificultad dada no es el que escribe más deprisa, sino el que ve antes el patrón. Los campeones cuentan que ven un X-Wing como un lector ve una palabra, sin deletrearla. Eso se consigue repitiendo ese patrón concreto, y para eso está el modo de práctica: elige una técnica, recibe un sudoku que la necesita sin nada más difícil por medio, y encuentra el patrón como tu siguiente jugada, una y otra vez.",
          "Dos hábitos mantienen bajos los tiempos. No deshagas el buen trabajo rellenando candidatos demasiado pronto, y no busques una técnica difícil mientras todavía haya una fácil disponible. En la guía, el orden «Las que más vale aprender» muestra qué técnicas compensa más practicar: las que se necesitan a menudo, ponderadas por lo que cuestan."
        ]
      },
      {
        "heading": "Cómo entrenarlo aquí",
        "paragraphs": [
          "Todas las partidas empiezan con los candidatos automáticos desactivados, como empezaría un campeón. Usa las notas de esquina para los pares Snyder y deja el resto en blanco. Cuando te atasques, Explorar muestra todas las técnicas que funcionan en esa posición exacta con tus propias anotaciones, así que aprendes lo que se te pasó y no lo que habría mostrado una cuadrícula de candidatos. Si terminas sin usar Pista, Revisar ni Autocandidatos, la partida cuenta como resuelta sin ayuda."
        ]
      }
    ]
  },
  "glossaryGroups": {
    "The board": "El tablero",
    "Notation": "Notación",
    "Basic logic": "Lógica básica",
    "Links and chains": "Enlaces y cadenas",
    "Fish": "Peces",
    "Wings and other patterns": "Wings y otros patrones",
    "Uniqueness": "Unicidad",
    "Solving and rating": "Resolución y puntuación"
  },
  "glossary": {
    "cell": {
      "term": "casilla",
      "aka": [
        "celda"
      ],
      "definition": "Una de las 81 casillas de la cuadrícula. Contiene un número dado, un número que has colocado o, mientras no está resuelta, anotaciones."
    },
    "row": {
      "term": "fila",
      "aka": [],
      "definition": "Una línea horizontal de nueve casillas. Cada número del 1 al 9 aparece exactamente una vez en cada fila."
    },
    "column": {
      "term": "columna",
      "aka": [],
      "definition": "Una línea vertical de nueve casillas. Cada número del 1 al 9 aparece exactamente una vez en cada columna."
    },
    "box": {
      "term": "caja",
      "aka": [
        "región",
        "bloque",
        "subcuadrícula"
      ],
      "definition": "Uno de los nueve cuadrados de tres por tres casillas delimitados por líneas gruesas. Cada número del 1 al 9 aparece exactamente una vez en cada caja. Las cajas se numeran del 1 al 9 desde la esquina superior izquierda, fila por fila."
    },
    "unit": {
      "term": "unidad",
      "aka": [
        "casa",
        "grupo"
      ],
      "definition": "Una fila, una columna o una caja, es decir, cualquier grupo de nueve casillas que debe contener cada número del 1 al 9 exactamente una vez. La cuadrícula tiene 27 unidades."
    },
    "line": {
      "term": "línea",
      "aka": [],
      "definition": "Una fila o una columna. Esta palabra se usa cuando una regla funciona igual en las dos direcciones."
    },
    "band": {
      "term": "banda",
      "aka": [
        "piso"
      ],
      "definition": "Tres cajas una al lado de otra, que cubren tres filas contiguas. La cuadrícula tiene tres bandas: superior, central e inferior. No debe confundirse con un nivel de dificultad, que en inglés se llama difficulty band."
    },
    "stack": {
      "term": "pila",
      "aka": [
        "torre"
      ],
      "definition": "Tres cajas una encima de otra, que cubren tres columnas contiguas. La cuadrícula tiene tres pilas: izquierda, central y derecha."
    },
    "chute": {
      "term": "franja",
      "aka": [
        "chute"
      ],
      "definition": "Una banda o una pila, es decir, tres cajas en línea junto con las tres filas o columnas que las atraviesan."
    },
    "intersection": {
      "term": "intersección",
      "aka": [
        "minilínea",
        "minifila",
        "minicolumna",
        "intersección caja-línea"
      ],
      "definition": "Las tres casillas que una caja comparte con una fila o columna que la cruza. Los candidatos bloqueados actúan sobre intersecciones, y un nodo agrupado está dentro de una."
    },
    "peer": {
      "term": "vecina",
      "aka": [
        "compañera"
      ],
      "definition": "Una casilla que comparte fila, columna o caja con otra casilla. Cada casilla tiene 20 vecinas, y ninguna de ellas puede contener el mismo número que la propia casilla."
    },
    "sees": {
      "term": "ve",
      "aka": [
        "se ven"
      ],
      "definition": "Dos casillas se ven cuando comparten fila, columna o caja, así que no pueden contener el mismo número. Dos candidatos del mismo número se ven cuando sus casillas se ven."
    },
    "digit": {
      "term": "número",
      "aka": [
        "dígito",
        "cifra",
        "valor"
      ],
      "definition": "Uno de los nueve símbolos del 1 al 9. Los números son etiquetas, no cantidades, así que no hay que hacer ninguna cuenta."
    },
    "given": {
      "term": "número dado",
      "aka": [
        "número inicial"
      ],
      "definition": "Un número impreso en el sudoku desde el principio. Los números dados siempre son correctos y no se pueden cambiar."
    },
    "solution": {
      "term": "solución",
      "aka": [],
      "definition": "Una cuadrícula completamente rellena que conserva todos los números dados y cumple la regla en las 27 unidades."
    },
    "proper-puzzle": {
      "term": "sudoku válido",
      "aka": [
        "sudoku bien planteado"
      ],
      "definition": "Un sudoku con exactamente una solución. Las técnicas de unicidad solo son válidas en sudokus válidos."
    },
    "pencil-mark": {
      "term": "anotación",
      "aka": [
        "nota",
        "marca de lápiz"
      ],
      "definition": "Un número pequeño escrito en una casilla como nota, normalmente para registrar un candidato. sudokUI tiene dos posiciones para las anotaciones: esquina y centro."
    },
    "pencil-mark-grid": {
      "term": "cuadrícula de candidatos",
      "aka": [
        "cuadrícula de anotaciones",
        "PM"
      ],
      "definition": "La cuadrícula con todos los candidatos de todas las casillas sin resolver anotados. La mayoría de las técnicas que van más allá de los únicos se leen en ella."
    },
    "corner-mark": {
      "term": "nota de esquina",
      "aka": [
        "anotación de esquina",
        "Esquina"
      ],
      "definition": "Una anotación que se dibuja en el lugar fijo de su número dentro de una disposición de tres por tres; cuando la casilla también tiene notas centrales, las notas de esquina se colocan alrededor de su borde en orden numérico. Esquina es una posición, no un significado, aunque la notación Snyder suele ir ahí."
    },
    "centre-mark": {
      "term": "nota central",
      "aka": [
        "anotación central",
        "Centro"
      ],
      "definition": "Una anotación escrita en el centro de la casilla, el lugar habitual para la lista completa de candidatos. El botón Revisar toma las notas centrales como los candidatos que le quedan a la casilla; las pistas y Explorar leen igual las notas de esquina y las centrales, una vez que hayas indicado que tus anotaciones son tus candidatos restantes."
    },
    "snyder-notation": {
      "term": "notación Snyder",
      "aka": [
        "notas Snyder"
      ],
      "definition": "Un método de anotación que debe su nombre a Thomas Snyder: en cada caja solo se anota un número si tiene exactamente dos posiciones posibles en ella, aunque algunos jugadores también anotan los que tienen tres. Las anotaciones son parciales, así que la falta de una anotación no significa que el número esté eliminado."
    },
    "cell-name": {
      "term": "nombre de casilla",
      "aka": [
        "notación r1c1"
      ],
      "definition": "La dirección de una casilla, escrita con sus números de fila y columna contados desde la esquina superior izquierda: r3c5 es la casilla de la fila 3, columna 5. Algunos jugadores combinan casillas, de modo que r57c2 significa r5c2 y r7c2; las pistas de sudokUI nombran cada casilla por separado."
    },
    "auto-candidates": {
      "term": "candidatos automáticos",
      "aka": [
        "Autocandidatos",
        "Auto"
      ],
      "definition": "Una herramienta de sudokUI que se activa con el botón Autocandidatos: calcula los candidatos de cada casilla sin resolver y los mantiene al día. Las partidas nuevas empiezan con ella desactivada; un sudoku de práctica que salta directamente a su técnica empieza con ella activada."
    },
    "check": {
      "term": "Revisar",
      "aka": [
        "Comprobar",
        "Verificar"
      ],
      "definition": "Un botón de sudokUI que compara los números que has colocado con la solución y comprueba que cada casilla anotada todavía incluye su número correcto. Para ello usa los candidatos automáticos si están activados; si no, tus notas centrales, y también tus notas de esquina una vez que hayas indicado que tus anotaciones son tus candidatos restantes. Los errores se marcan en rojo."
    },
    "steps": {
      "term": "Pasos",
      "aka": [],
      "definition": "La lista de sudokUI con toda la ruta de resolución desde el principio del sudoku, con el paso clave marcado. Al pulsar un paso, el tablero pasa a la posición justo anterior a ese paso."
    },
    "candidate": {
      "term": "candidato",
      "aka": [
        "posibilidad"
      ],
      "definition": "Un número que todavía es posible en una casilla sin resolver: ninguna vecina de la casilla lo contiene y ninguna lógica lo ha descartado. Al resolver se eliminan candidatos hasta que a cada casilla le quede uno."
    },
    "placement": {
      "term": "colocación",
      "aka": [],
      "definition": "Escribir un número en una casilla como su valor definitivo. Una pista que termina en una colocación ha demostrado que el número debe ir ahí."
    },
    "elimination": {
      "term": "eliminación",
      "aka": [
        "descarte"
      ],
      "definition": "Quitar un candidato de una casilla porque la lógica demuestra que el número no puede ir ahí. La mayoría de las técnicas avanzadas terminan en eliminaciones, no en colocaciones."
    },
    "contradiction": {
      "term": "contradicción",
      "aka": [
        "conflicto"
      ],
      "definition": "Un estado que rompe las reglas: una casilla sin candidatos, un número sin sitio en una unidad o el mismo número dos veces en una unidad. Una suposición que lleva a una contradicción es falsa."
    },
    "single": {
      "term": "único",
      "aka": [
        "single"
      ],
      "definition": "Una colocación forzada porque solo queda una posibilidad: una casilla con un solo candidato (único desnudo) o un número con una sola casilla posible en una unidad (único oculto)."
    },
    "full-house": {
      "term": "full house",
      "aka": [
        "último número"
      ],
      "definition": "Una unidad a la que solo le queda una casilla vacía, que debe llevar el único número que le falta a la unidad. Es el tipo de único más sencillo; en sentido estricto, último número se refiere a la última casilla vacía de toda la cuadrícula."
    },
    "naked": {
      "term": "desnudo",
      "aka": [],
      "definition": "Describe un patrón que se encuentra en las casillas: N casillas de una unidad tienen entre todas solo N candidatos. Un único desnudo es una casilla con un solo candidato; un par desnudo elimina sus dos números de las demás casillas de la unidad."
    },
    "hidden": {
      "term": "oculto",
      "aka": [],
      "definition": "Describe un patrón que se encuentra en los números: N números de una unidad solo tienen N casillas donde ir. Un único oculto es un número con una sola casilla posible; un par oculto elimina todos los demás candidatos de sus dos casillas."
    },
    "subset": {
      "term": "subconjunto",
      "aka": [
        "par",
        "pareja",
        "trío",
        "cuarteto"
      ],
      "definition": "N casillas de una unidad que deben contener entre todas N números, y que se encuentran como un patrón desnudo o uno oculto. Los tamaños dos, tres y cuatro se llaman par, trío y cuarteto."
    },
    "locked-set": {
      "term": "conjunto bloqueado",
      "aka": [
        "subconjunto desnudo"
      ],
      "definition": "N casillas sin resolver de una unidad que tienen entre todas exactamente N candidatos. Esos números deben ocupar esas casillas, así que se eliminan de todas las demás casillas de la unidad. El Par bloqueado y el Trío bloqueado de HoDoKu (Locked Pair y Locked Triple) son el caso particular que además está dentro de una sola intersección."
    },
    "locked-candidates": {
      "term": "candidatos bloqueados",
      "aka": [
        "reducción por intersección"
      ],
      "definition": "Un número cuyas casillas posibles en una unidad están todas dentro de su intersección con una segunda unidad. El número debe ir en la intersección, así que se elimina del resto de la segunda unidad."
    },
    "pointing": {
      "term": "puntero",
      "aka": [
        "candidatos bloqueados tipo 1",
        "par puntero",
        "trío puntero"
      ],
      "definition": "Candidatos bloqueados que parten de una caja: todas las posiciones de un número en la caja están en una sola fila o columna, así que el número se elimina del resto de esa fila o columna."
    },
    "claiming": {
      "term": "reclamante",
      "aka": [
        "candidatos bloqueados tipo 2",
        "reducción caja-línea"
      ],
      "definition": "Candidatos bloqueados que parten de una línea: todas las posiciones de un número en una fila o columna están en una sola caja, así que el número se elimina del resto de esa caja."
    },
    "bivalue-cell": {
      "term": "casilla bivalor",
      "aka": [],
      "definition": "Una casilla sin resolver con exactamente dos candidatos. Exactamente uno de ellos es verdadero, así que los dos están unidos a la vez por un enlace fuerte y por un enlace débil."
    },
    "conjugate-pair": {
      "term": "par conjugado",
      "aka": [],
      "definition": "Los dos únicos candidatos de un número en una unidad. Exactamente uno es verdadero: si uno es falso, el otro es verdadero (enlace fuerte), y si uno es verdadero, el otro es falso (enlace débil)."
    },
    "bilocation": {
      "term": "bilocación",
      "aka": [],
      "definition": "Un número al que le quedan exactamente dos casillas posibles en una unidad. Esos dos candidatos forman un par conjugado."
    },
    "link": {
      "term": "enlace",
      "aka": [
        "vínculo"
      ],
      "definition": "Una relación lógica entre dos candidatos, o entre nodos, que una cadena puede usar. Los enlaces son fuertes o débiles, y un enlace fuerte también puede usarse como débil."
    },
    "strong-link": {
      "term": "enlace fuerte",
      "aka": [
        "inferencia fuerte"
      ],
      "definition": "Un enlace entre los candidatos A y B que significa que si A es falso, B es verdadero, así que al menos uno de los dos es verdadero. Los pares conjugados y las casillas bivalor dan enlaces fuertes."
    },
    "weak-link": {
      "term": "enlace débil",
      "aka": [
        "inferencia débil"
      ],
      "definition": "Un enlace entre los candidatos A y B que significa que si A es verdadero, B es falso, así que como mucho uno de los dos es verdadero. Dos candidatos de una misma casilla, o de un mismo número en una misma unidad, están enlazados débilmente."
    },
    "inference": {
      "term": "inferencia",
      "aka": [],
      "definition": "Un paso de razonamiento de un candidato al siguiente. Una inferencia fuerte dice que si esto es falso, aquello es verdadero; una inferencia débil dice que si esto es verdadero, aquello es falso."
    },
    "chain": {
      "term": "cadena",
      "aka": [],
      "definition": "Una sucesión de nodos unidos por enlaces, donde cada inferencia lleva a la siguiente, de modo que un estado del primer nodo fuerza un estado del último."
    },
    "node": {
      "term": "nodo",
      "aka": [],
      "definition": "Un elemento de una cadena. Normalmente es un solo candidato, es decir, un número en una casilla, pero también puede ser un nodo agrupado o un conjunto casi bloqueado."
    },
    "aic": {
      "term": "AIC",
      "aka": [
        "cadena de inferencias alternas",
        "alternating inference chain"
      ],
      "definition": "Una cadena cuyos enlaces alternan entre fuertes y débiles, y que empieza y termina con un enlace fuerte. Al menos uno de sus dos nodos extremos es verdadero, así que se elimina cualquier candidato enlazado débilmente con ambos extremos."
    },
    "grouped-node": {
      "term": "nodo agrupado",
      "aka": [
        "nodo de grupo"
      ],
      "definition": "Un nodo formado por los dos o tres candidatos de un número dentro de una intersección. Cuenta como verdadero cuando cualquiera de sus casillas contiene el número."
    },
    "nice-loop": {
      "term": "nice loop",
      "aka": [
        "bucle"
      ],
      "definition": "Una cadena de enlaces fuertes y débiles alternos que se cierra en un bucle al volver a su punto de partida. Es continuo si la alternancia se mantiene en toda la vuelta, y discontinuo si se rompe en un nodo."
    },
    "continuous-loop": {
      "term": "bucle continuo",
      "aka": [
        "nice loop continuo",
        "bucle AIC"
      ],
      "definition": "Un nice loop cuyos enlaces alternan sin interrupción. Entonces cada enlace, fuerte o débil, tiene exactamente un extremo verdadero, así que se elimina cualquier otro candidato enlazado débilmente con ambos extremos de cualquiera de sus enlaces."
    },
    "discontinuous-loop": {
      "term": "bucle discontinuo",
      "aka": [
        "nice loop discontinuo"
      ],
      "definition": "Un nice loop cuya alternancia se rompe en un nodo. Si ahí se encuentran dos enlaces fuertes, ese candidato es verdadero; si se encuentran dos enlaces débiles, es falso. Cuando un enlace fuerte de un número y uno débil de otro se encuentran en una casilla, el número del enlace débil es falso en esa casilla."
    },
    "x-cycle": {
      "term": "X-cycle",
      "aka": [
        "ciclo X"
      ],
      "definition": "Un nice loop de un solo número: una cadena cerrada de enlaces fuertes y débiles entre las casillas posibles de un número."
    },
    "x-chain": {
      "term": "X-chain",
      "aka": [
        "cadena X"
      ],
      "definition": "Una AIC de un solo número. Al menos un extremo es verdadero, así que el número se elimina de todas las casillas que ven ambos extremos."
    },
    "xy-chain": {
      "term": "XY-chain",
      "aka": [
        "cadena XY"
      ],
      "definition": "Una AIC formada solo por casillas bivalor, con enlaces débiles entre casillas sobre un número que comparten. Si ambos extremos tienen el número Z, Z se elimina de todas las casillas que ven ambos extremos."
    },
    "remote-pair": {
      "term": "remote pair",
      "aka": [
        "par remoto"
      ],
      "definition": "Una XY-chain con una cantidad par de casillas que tienen todas los mismos dos números. Ambos números se eliminan de todas las casillas que ven ambos extremos."
    },
    "colouring": {
      "term": "coloreado",
      "aka": [
        "Simple Colors",
        "coloreado simple",
        "coloración"
      ],
      "definition": "Dar dos colores a los candidatos de un clúster de modo que los extremos de cada par conjugado tengan colores distintos. Exactamente un color es verdadero en todas partes: dos candidatos del mismo color que se ven hacen falso ese color (color wrap), y un candidato de fuera que ve ambos colores se elimina (color trap)."
    },
    "multi-colouring": {
      "term": "coloreado múltiple",
      "aka": [
        "Multi Colors"
      ],
      "definition": "Coloreado de dos clústeres separados de un mismo número. Si un color de un clúster ve ambos colores del otro, ese color es falso; si un color de un clúster y uno del otro se ven entre sí, se elimina cualquier candidato que vea los otros dos colores."
    },
    "cluster": {
      "term": "clúster",
      "aka": [],
      "definition": "Un conjunto de candidatos conectados entre sí por pares conjugados (y, en 3D Medusa, por casillas bivalor). Al decidir uno se deciden todos, y por eso un clúster puede colorearse con dos colores."
    },
    "3d-medusa": {
      "term": "3D Medusa",
      "aka": [],
      "definition": "Coloreado a través de varios números, que une candidatos tanto por pares conjugados como por casillas bivalor. Sus reglas extienden el color wrap y el color trap a candidatos de la misma casilla."
    },
    "forcing-chain": {
      "term": "cadena forzada",
      "aka": [
        "forcing chain"
      ],
      "definition": "Una técnica que sigue cada caso de una premisa, como cada candidato de una casilla, hasta sus consecuencias. Lo que se cumple en todos los casos es verdadero, y cualquier caso que por sí solo acabe en contradicción es falso."
    },
    "forcing-net": {
      "term": "red forzada",
      "aka": [
        "forcing net"
      ],
      "definition": "Una cadena forzada cuyo razonamiento puede ramificarse y volver a unirse, de modo que una conclusión puede depender de varias anteriores a la vez. Es la última técnica lógica que sudokUI prueba antes de la fuerza bruta."
    },
    "nishio": {
      "term": "Nishio",
      "aka": [
        "cadena forzada Nishio",
        "Nishio forcing chain"
      ],
      "definition": "Una prueba de un candidato: se supone que es verdadero y se siguen las consecuencias. Si llevan a una contradicción, el candidato es falso y se elimina. En sentido estricto solo se sigue ese número; sudokUI sigue los únicos de todos los números."
    },
    "fish": {
      "term": "pez",
      "aka": [
        "fish",
        "Squirmbag",
        "Whale",
        "Leviathan"
      ],
      "definition": "Un patrón de un solo número: N conjuntos base cuyos candidatos de ese número están todos dentro de N conjuntos de cobertura. Se elimina todo candidato del número que esté en los conjuntos de cobertura pero no en un conjunto base. Los tamaños 2 a 7 son X-Wing, Swordfish, Jellyfish, Squirmbag, Whale y Leviathan."
    },
    "x-wing": {
      "term": "X-Wing",
      "aka": [
        "ala X"
      ],
      "definition": "El pez más pequeño: en dos filas (o columnas) un número solo tiene sitio en las mismas dos columnas (o filas), así que se elimina del resto de esas columnas (o filas). A pesar del nombre es un pez, no un wing."
    },
    "swordfish": {
      "term": "Swordfish",
      "aka": [
        "pez espada"
      ],
      "definition": "Un pez de tamaño tres: en tres líneas, un número solo tiene sitio dentro de las mismas tres líneas transversales, así que se elimina del resto de esas tres líneas transversales."
    },
    "jellyfish": {
      "term": "Jellyfish",
      "aka": [],
      "definition": "Un pez de tamaño cuatro: en cuatro líneas, un número solo tiene sitio dentro de las mismas cuatro líneas transversales, así que se elimina del resto de esas cuatro líneas transversales."
    },
    "base-set": {
      "term": "conjunto base",
      "aka": [
        "unidad base",
        "sector base"
      ],
      "definition": "Una de las N unidades que definen un pez. Ningún candidato del número puede estar en dos conjuntos base, aunque las unidades sí pueden solaparse; un candidato que lo esté se trata como aleta interna. Cada conjunto base debe contener el número exactamente una vez, lo que da N casillas verdaderas en total."
    },
    "cover-set": {
      "term": "conjunto de cobertura",
      "aka": [
        "unidad de cobertura",
        "sector de cobertura"
      ],
      "definition": "Una de las N unidades que juntas contienen todos los candidatos de los conjuntos base de un pez. Los conjuntos base necesitan N casillas verdaderas y cada conjunto de cobertura solo puede tener una, así que los candidatos de cobertura que están fuera de los conjuntos base pierden el número."
    },
    "fin": {
      "term": "aleta",
      "aka": [
        "aleta externa",
        "exo fin"
      ],
      "definition": "Un candidato base de un pez que está fuera de todos los conjuntos de cobertura. O una de las aletas es verdadera o se cumple el pez simple, así que un pez con aletas solo elimina los candidatos de cobertura de fuera de los conjuntos base que además ven todas las aletas."
    },
    "finned-fish": {
      "term": "pez con aletas",
      "aka": [
        "finned fish",
        "X-Wing con aletas",
        "Swordfish con aletas"
      ],
      "definition": "Un pez con una o más aletas. Sus eliminaciones son las eliminaciones del pez simple que además ven todas las aletas."
    },
    "endo-fin": {
      "term": "aleta interna",
      "aka": [
        "endo fin"
      ],
      "definition": "Un candidato base que está en dos conjuntos base, algo posible solo en peces Franken y mutantes. Se trata como una aleta, porque si fuera verdadero los conjuntos base tendrían menos de N casillas verdaderas."
    },
    "cannibalism": {
      "term": "canibalismo",
      "aka": [
        "pez caníbal"
      ],
      "definition": "Un candidato base que está en dos conjuntos de cobertura es eliminado por su propio pez, porque si fuera verdadero un conjunto de cobertura tendría el número dos veces. En un pez con aletas, además debe ver todas las aletas."
    },
    "sashimi": {
      "term": "Sashimi",
      "aka": [
        "pez sashimi"
      ],
      "definition": "Un pez con aletas que sin sus aletas no sería un pez completo de su tamaño, por ejemplo porque a un conjunto base solo le quedaría un candidato. Las eliminaciones siguen la misma regla que en cualquier pez con aletas."
    },
    "franken-fish": {
      "term": "pez Franken",
      "aka": [
        "franken fish"
      ],
      "definition": "Un pez en el que se permiten cajas entre los conjuntos base o entre los de cobertura. Aparte de las cajas, un lado usa solo filas y el otro solo columnas."
    },
    "mutant-fish": {
      "term": "pez mutante",
      "aka": [
        "mutant fish"
      ],
      "definition": "Un pez cuyos conjuntos base o de cobertura mezclan filas, columnas y cajas de cualquier forma."
    },
    "kraken-fish": {
      "term": "pez Kraken",
      "aka": [
        "kraken fish"
      ],
      "definition": "Un pez con aletas combinado con cadenas: se elimina un candidato si es falso cuando se cumple el pez simple y también cuando es verdadera cualquiera de las aletas."
    },
    "turbot-fish": {
      "term": "Turbot fish",
      "aka": [],
      "definition": "Una cadena de un solo número formada por dos pares conjugados unidos por un enlace débil. El número se elimina de todas las casillas que ven ambos extremos libres. Skyscraper y Two-string kite son casos particulares."
    },
    "skyscraper": {
      "term": "Skyscraper",
      "aka": [
        "rascacielos"
      ],
      "definition": "Dos pares conjugados paralelos de un número, en dos filas o en dos columnas, con un extremo de cada uno en la misma línea transversal. El número se elimina de las casillas que ven los otros dos extremos."
    },
    "two-string-kite": {
      "term": "Two-string kite",
      "aka": [
        "2-String Kite",
        "cometa de dos cuerdas"
      ],
      "definition": "Un par conjugado en una fila y otro en una columna para el mismo número, con un extremo de cada uno en la misma caja. El número se elimina de la casilla que ve los otros dos extremos."
    },
    "empty-rectangle": {
      "term": "Empty rectangle",
      "aka": [
        "rectángulo vacío",
        "ER"
      ],
      "definition": "Una caja cuyos candidatos de un número están todos en una fila y una columna de la caja, combinada con un par conjugado fuera de ella. Juntos actúan como una cadena que elimina el número de una casilla."
    },
    "wing": {
      "term": "wing",
      "aka": [
        "ala"
      ],
      "definition": "Un patrón pequeño, como el XY-Wing, el XYZ-Wing, el WXYZ-Wing o el W-Wing, que demuestra que un número Z debe ir en una de unas pocas casillas. Z se elimina de todas las casillas que las ven todas. El X-Wing es un pez, no un wing."
    },
    "pivot": {
      "term": "pivote",
      "aka": [
        "bisagra"
      ],
      "definition": "La casilla central de un XY-Wing o de un XYZ-Wing, que ve ambas pinzas. En un XY-Wing contiene XY; en un XYZ-Wing contiene XYZ, así que las eliminaciones también deben verla."
    },
    "pincer": {
      "term": "pinza",
      "aka": [
        "casilla pinza"
      ],
      "definition": "Una de las dos casillas exteriores de un XY-Wing o de un XYZ-Wing, cada una de las cuales ve el pivote. Las pinzas contienen XZ e YZ."
    },
    "xy-wing": {
      "term": "XY-Wing",
      "aka": [
        "Y-Wing"
      ],
      "definition": "Un pivote bivalor XY que ve dos pinzas bivalor XZ e YZ. Sea cual sea el valor del pivote, una de las pinzas es Z, así que Z se elimina de todas las casillas que ven ambas pinzas."
    },
    "xyz-wing": {
      "term": "XYZ-Wing",
      "aka": [],
      "definition": "Un XY-Wing cuyo pivote también contiene Z. Una de las tres casillas es Z, así que Z solo se elimina de las casillas que ven el pivote y ambas pinzas."
    },
    "wxyz-wing": {
      "term": "WXYZ-Wing",
      "aka": [
        "cuarteto doblado"
      ],
      "definition": "Cuatro casillas con cuatro números entre todas, en las que cada número salvo Z está restringido, es decir, todas sus posiciones se ven entre sí. Entonces una de las cuatro debe ser Z, así que Z se elimina de todas las casillas que ven todos los candidatos Z de esas cuatro. sudokUI lo encuentra como una casilla bivalor más un conjunto de tres casillas."
    },
    "w-wing": {
      "term": "W-Wing",
      "aka": [],
      "definition": "Dos casillas bivalor con los mismos números XZ, unidas por un enlace fuerte en X cuyos extremos ven cada uno a una de ellas. Una de las dos casillas es Z, así que Z se elimina de todas las casillas que ven ambas."
    },
    "almost-locked-set": {
      "term": "conjunto casi bloqueado",
      "aka": [
        "ALS"
      ],
      "definition": "N casillas sin resolver de una unidad que tienen entre todas exactamente N+1 candidatos. Si uno cualquiera de esos números se elimina de todas las casillas, se convierten en un conjunto bloqueado de los N números restantes. Una casilla bivalor es el ALS más pequeño."
    },
    "restricted-common-candidate": {
      "term": "candidato común restringido",
      "aka": [
        "RCC",
        "común restringido"
      ],
      "definition": "Un número compartido por dos conjuntos casi bloqueados, en el que todas sus casillas en uno ven todas sus casillas en el otro, y ninguna de ellas está en casillas que compartan los dos conjuntos. Puede ser verdadero como mucho en uno de los conjuntos, y el conjunto que lo pierde se convierte en un conjunto bloqueado."
    },
    "als-xz": {
      "term": "ALS-XZ",
      "aka": [],
      "definition": "Dos conjuntos casi bloqueados unidos por un RCC X que además comparten otro número Z. Uno de los conjuntos queda bloqueado, así que Z se elimina de todas las casillas que ven todos los candidatos Z de ambos. Con dos RCC (doble enlace), ambos conjuntos quedan bloqueados."
    },
    "als-xy-wing": {
      "term": "ALS-XY-Wing",
      "aka": [],
      "definition": "Tres conjuntos casi bloqueados A, B y C, donde A y C comparten cada uno un RCC distinto con B, y A y C comparten un número Z. Z se elimina de todas las casillas que ven todos los candidatos Z de A y C."
    },
    "death-blossom": {
      "term": "Death blossom",
      "aka": [],
      "definition": "Una casilla tallo cuyos candidatos son, cada uno, un RCC con su propio conjunto casi bloqueado: los pétalos. Tome el tallo el candidato que tome, un pétalo queda bloqueado, así que un número Z común a todos los pétalos se elimina de las casillas que ven todos sus candidatos Z."
    },
    "sue-de-coq": {
      "term": "Sue de Coq",
      "aka": [],
      "definition": "Dos o tres casillas de una intersección cuyos candidatos se reparten entre un conjunto en el resto de la caja y otro en el resto de la línea. Cada parte queda bloqueada, así que sus números se eliminan del resto de su unidad."
    },
    "template": {
      "term": "plantilla",
      "aka": [
        "superposición de patrones",
        "Pattern Overlay",
        "POM"
      ],
      "definition": "Una forma completa de colocar un número en las nueve filas, columnas y cajas que concuerda con la cuadrícula actual. Un candidato que no aparece en ninguna plantilla se elimina, y una casilla que aparece en todas las plantillas recibe el número."
    },
    "exocet": {
      "term": "Exocet",
      "aka": [
        "Junior Exocet",
        "JE"
      ],
      "definition": "Dos casillas base en una intersección, con tres o cuatro candidatos entre ellas, y dos casillas objetivo en las otras dos cajas de su franja que no las ven. Cuando cada número base está limitado a como mucho dos líneas en el resto de la franja, las casillas objetivo deben tomar los mismos dos números que la base, así que pierden todos los candidatos que no tienen las casillas base."
    },
    "uniqueness": {
      "term": "unicidad",
      "aka": [
        "técnica de unicidad"
      ],
      "definition": "El hecho de que un sudoku válido tenga exactamente una solución, usado como argumento de resolución. Cualquier candidato que dejaría un patrón mortal, y por tanto dos soluciones, es falso."
    },
    "unique-solution": {
      "term": "solución única",
      "aka": [],
      "definition": "La única forma de completar un sudoku válido a partir de sus números dados. sudokUI comprueba que cada sudoku que genera, y cada sudoku que importas o escribes, tiene exactamente una solución."
    },
    "deadly-pattern": {
      "term": "patrón mortal",
      "aka": [],
      "definition": "Un conjunto de casillas, ninguna de ellas con un número dado, cuyos números podrían intercambiarse entre sí sin romper ninguna regla. Eso daría dos soluciones, así que la solución de un sudoku válido nunca contiene un patrón así."
    },
    "unique-rectangle": {
      "term": "rectángulo único",
      "aka": [
        "UR",
        "prueba de unicidad"
      ],
      "definition": "Cuatro casillas, ninguna de ellas con un número dado, en dos filas, dos columnas y dos cajas, que comparten los mismos dos candidatos. Con solo esos dos números en las cuatro sería un patrón mortal, así que al menos un candidato extra del rectángulo es verdadero."
    },
    "hidden-rectangle": {
      "term": "rectángulo oculto",
      "aka": [
        "HR"
      ],
      "definition": "Un rectángulo único que se encuentra mediante pares conjugados en sus dos números y no mediante casillas bivalor. Elimina uno de los dos números de la esquina opuesta a los pares conjugados."
    },
    "avoidable-rectangle": {
      "term": "rectángulo evitable",
      "aka": [
        "AR"
      ],
      "definition": "Un rectángulo en el que algunas casillas ya las has resuelto tú, no son números dados, y el resto podría completar un patrón mortal. El candidato que lo completaría es falso."
    },
    "bug": {
      "term": "BUG",
      "aka": [
        "bivalue universal grave"
      ],
      "definition": "Un estado en el que cada casilla sin resolver tiene exactamente dos candidatos y cada candidato aparece exactamente dos veces en cada una de sus unidades. Ese estado no tiene solución o tiene más de una, así que un sudoku válido nunca puede llegar a él."
    },
    "bug-plus-one": {
      "term": "BUG+1",
      "aka": [],
      "definition": "Un BUG con un candidato extra en una casilla. Ese candidato, el que aparece tres veces en sus unidades, debe ser verdadero."
    },
    "technique": {
      "term": "técnica",
      "aka": [
        "estrategia"
      ],
      "definition": "Un patrón lógico con nombre que justifica una colocación o una eliminación, como un único oculto o un X-Wing. Cada técnica tiene una puntuación que cuenta para la puntuación del sudoku."
    },
    "technique-score": {
      "term": "puntuación de técnica",
      "aka": [
        "puntuación de paso"
      ],
      "definition": "El número fijo de puntos que suma una técnica cada vez que se usa. sudokUI usa las puntuaciones por defecto de HoDoKu, desde 4 para un único desnudo hasta 10000 para la fuerza bruta, y a las técnicas que HoDoKu no tiene les da una puntuación cercana a la de sus técnicas más afines."
    },
    "solve-path": {
      "term": "ruta de resolución",
      "aka": [
        "camino de resolución"
      ],
      "definition": "La lista ordenada de pasos que resuelve un sudoku. sudokUI la construye probando las técnicas en un orden fijo, más o menos de la más fácil a la más difícil, y aplicando en cada paso la primera que funciona. La muestra en Pasos."
    },
    "crux": {
      "term": "paso clave",
      "aka": [
        "paso más difícil"
      ],
      "definition": "El paso más costoso de la ruta de resolución: aquel cuya técnica tiene la puntuación más alta o, si hay empate, el primero de ellos. sudokUI lo marca en la lista de Pasos."
    },
    "rating": {
      "term": "puntuación",
      "aka": [
        "puntuación de dificultad",
        "puntuación del sudoku"
      ],
      "definition": "La dificultad de un sudoku expresada como número: la suma de las puntuaciones de técnica de cada paso de la ruta de resolución. Como las puntuaciones y el orden de resolución siguen a HoDoKu, las puntuaciones se pueden comparar con las de HoDoKu en los sudokus que solo necesitan técnicas que HoDoKu también tiene."
    },
    "difficulty-band": {
      "term": "nivel de dificultad",
      "aka": [
        "nivel",
        "grado de dificultad"
      ],
      "definition": "Uno de los ocho niveles de dificultad con nombre: Principiante, Fácil, Medio, Engañoso, Difícil, Injusto, Extremo y Pesadilla. El nivel de un sudoku depende de su puntuación total y de las técnicas más difíciles que necesita: un paso de clase Difícil lo convierte como mínimo en Engañoso, y dos pasos así, como mínimo en Difícil. El propio HoDoKu tiene cinco niveles."
    },
    "brute-force": {
      "term": "fuerza bruta",
      "aka": [
        "ensayo y error",
        "backtracking",
        "prueba y error"
      ],
      "definition": "Resolver por ensayo y error: probar un número, seguir y volver atrás cuando aparece una contradicción. En sudokUI sirve para comprobar que un sudoku tiene solución única, y es el último recurso del resolvedor, con una puntuación de 10000."
    },
    "hodoku": {
      "term": "HoDoKu",
      "aka": [],
      "definition": "Un programa de sudoku gratuito y de código abierto (GPLv3) escrito en Java por Bernhard Hobiger, conocido por su resolvedor, su guía de técnicas y sus puntuaciones de dificultad. sudokUI toma de HoDoKu las puntuaciones de las técnicas y el orden de resolución, así que, en los sudokus que solo necesitan técnicas de HoDoKu, las puntuaciones se pueden comparar con las suyas."
    }
  },
  "intuition": {
    "lead": "El catálogo de sudokUI recoge 80 técnicas. Por debajo de todas ellas hay tres ideas y una promesa que hace el propio sudoku. Aprende las ideas y cada nombre se convertirá en una forma nueva de algo que ya conoces. Aquí cada idea se explica dos veces: una con rigor, y otra como se la explicarías a un niño de 12 años.",
    "parts": {
      "rule": {
        "nav": "La regla",
        "heading": "La única regla",
        "intro": "Cada fila, cada columna y cada caja contiene cada número exactamente una vez. Todo lo demás se deduce de esa frase."
      },
      "locked": {
        "nav": "Conjuntos bloqueados",
        "heading": "Conjuntos bloqueados: lo que tiene que caber",
        "intro": "El primer motor. Cuando varias cosas tienen que caber en exactamente tantos sitios como cosas hay, ocupan esos sitios por completo, y ahí no puede ir nada más."
      },
      "almost": {
        "nav": "Casi bloqueados",
        "heading": "Casi bloqueados: uno de más",
        "intro": "El segundo motor. Un grupo al que solo le sobra un número para estar bloqueado es casi tan útil como uno bloqueado, porque lo que le impide bloquearse tiene que ocurrir en un sitio que puedes señalar."
      },
      "chains": {
        "nav": "Cadenas",
        "heading": "Cadenas: si no es esto, es aquello",
        "intro": "El tercer motor, y el paraguas bajo el que caben la mayoría de los demás. Una cadena pasa una inferencia de candidato en candidato hasta que sus dos extremos coinciden en algo."
      },
      "unique": {
        "nav": "Una solución",
        "heading": "La promesa: una sola solución",
        "intro": "Una rama aparte, con su propia lógica. Un sudoku válido tiene exactamente una solución, y esa promesa es en sí misma un indicio."
      },
      "sets": {
        "nav": "En el fondo",
        "heading": "Lo que hay debajo de todo",
        "intro": "Los tres motores resultan ser una sola idea de recuento, vista con distinta fuerza."
      },
      "names": {
        "nav": "Nombres e historia",
        "heading": "Por qué los nombres son un lío",
        "intro": "Muchos de estos nombres vienen de foros de internet de hacia 2005, antes de que nadie uniera las técnicas en una sola teoría. Se quedaron porque eran fáciles de recordar y se usaban mucho, no porque fueran sistemáticos."
      },
      "fast": {
        "nav": "Ganar velocidad",
        "heading": "Ganar velocidad",
        "intro": "Saber a qué idea pertenece un patrón es lo que convierte decenas de nombres en un puñado de hábitos."
      }
    },
    "sections": {
      "two-facts": {
        "heading": "Dos hechos en una regla",
        "paragraphs": [
          "Exactamente una vez son dos promesas. Al menos una vez: si a un número solo le quedan dos sitios en una unidad, va en uno de ellos. Como mucho una vez: dos candidatos del mismo número en casillas que se ven, porque comparten fila, columna o caja, no pueden ser verdaderos los dos. Una casilla hace las mismas dos promesas: contiene al menos un número, y como mucho uno.",
          "Cuando quedan exactamente dos opciones, dos sitios para un número en una unidad o dos candidatos en una casilla, al primer tipo de hecho, el de al menos una vez, se le llama enlace fuerte; el segundo tipo, el de como mucho una vez, es un enlace débil. Casi todas las técnicas de este sitio, desde el Único oculto hasta la Forcing Net, combinan estos dos hechos hasta descartar un candidato o forzar un número. Solo las técnicas de unicidad añaden un hecho propio, como verás más abajo.",
          "Hay dos maneras de hacer la pregunta. Pregúntale a una casilla qué números puede contener todavía, o pregúntale a un número dónde puede ir todavía dentro de una unidad. La primera manera encuentra los patrones desnudos; la segunda, los ocultos, y los buenos jugadores pasan de una a otra sin pensarlo."
        ],
        "eli12": "Imagina que una fila es un equipo de nueve jugadores con las camisetas del 1 al 9, y que no hay dos jugadores con la misma camiseta. Si solo dos jugadores pueden llevar la camiseta del 7, uno de ellos la lleva. Además, si un jugador lleva la camiseta del 7, nadie más del equipo puede llevarla. En eso consiste todo el juego. Casi todos los trucos ingeniosos son esas dos ideas, encadenadas una tras otra."
      },
      "singles": {
        "heading": "Únicos: una cosa, un sitio",
        "paragraphs": [
          "Un Único desnudo es una casilla a la que le queda un solo candidato: un sitio, un número. Un Único oculto es un número al que le queda un solo sitio en una unidad. Son los conjuntos bloqueados más pequeños que existen, vistos desde las dos direcciones: pregúntale a la casilla o pregúntale al número. Un Full House, la última casilla vacía de una unidad, es las dos cosas a la vez."
        ],
        "eli12": "Hay que ocupar todos los asientos y todo el mundo tiene que sentarse, una persona por asiento. Si en un asiento solo se puede sentar una persona, esa persona se sienta ahí. Si una persona solo tiene un asiento posible, se sienta en él. Es la misma idea vista desde lados opuestos."
      },
      "subsets": {
        "heading": "Subconjuntos: dos, tres o cuatro a la vez",
        "paragraphs": [
          "Ahora amplía la idea del único. Si dos casillas de una unidad solo pueden contener los mismos dos números, esos números se gastan ahí, así que ninguna otra casilla de la unidad puede tenerlos: es un Par desnudo. Si dos números solo pueden ir en las mismas dos casillas de una unidad, esas casillas quedan ocupadas, así que no pueden contener nada más: es un Par oculto. Los tríos y los cuartetos funcionan igual.",
          "Desnudo y oculto son dos descripciones de un mismo hecho. En una unidad con siete casillas vacías, un trío desnudo deja las otras cuatro casillas para los otros cuatro números, y esas cuatro casillas son un cuarteto oculto. Por eso tampoco hace falta nunca un quinteto desnudo u oculto: su otra cara siempre es de cuatro o menos."
        ],
        "eli12": "Una fila tiene siete sillas vacías y siete personas que aún tienen que sentarse, una por silla. Tres de las sillas son tan pequeñas que en ellas solo caben las mismas tres personas. Esas sillas acabarán ocupadas exactamente por esas tres personas, así que esas tres no pueden sentarse en ningún otro sitio. Míralo al revés: a las otras cuatro personas ya solo les quedan las otras cuatro sillas, así que esas sillas ya tienen dueño. Un solo hecho, contado desde los dos lados.",
        "caption": "Una fila, un hecho. Las tres casillas azules solo pueden contener 1, 2 y 3: un trío desnudo. Así, al 4, el 5, el 6 y el 7 solo les quedan las cuatro casillas doradas: un cuarteto oculto. Las dos descripciones eliminan los mismos candidatos rojos."
      },
      "intersections": {
        "heading": "Donde una caja se cruza con una línea",
        "paragraphs": [
          "Una caja y una fila comparten tres casillas. Si todos los candidatos de un número en la caja están en esa intersección, la caja colocará el número ahí, así que el resto de la fila no puede tenerlo: son los Candidatos bloqueados (puntero). Si intercambias los papeles, tienes los Candidatos bloqueados (reclamante): una fila cuyos candidatos para un número están todos dentro de una caja elimina ese número del resto de la caja. Con las columnas funciona igual.",
          "Es el conjunto bloqueado más pequeño entre dos unidades: una unidad obligada a colocar su número dentro de otra. Un Par bloqueado es un par desnudo situado en la intersección, así que sus dos números desaparecen del resto de ambas unidades a la vez."
        ],
        "eli12": "Una caja necesita un 4, y los únicos sitios donde puede ir están en su borde de arriba. Ese borde forma parte de una fila larga que cruza toda la cuadrícula, y esa fila solo puede tener un 4, así que el 4 de la caja es el 4 de esa fila. El resto de la fila larga no puede ser un 4. También funciona al revés: si los únicos sitios para un 4 en una fila están dentro de una caja, el resto de esa caja no puede ser un 4."
      },
      "fish": {
        "heading": "Peces: un número, muchas filas",
        "paragraphs": [
          "Ahora sigue un solo número por toda la cuadrícula. Si en dos filas el número solo puede ir en las mismas dos columnas, las dos filas se repartirán esas dos columnas, una cada una, así que ninguna otra casilla de esas columnas puede ser ese número: es un X-Wing. Tres filas en tres columnas es un Swordfish, y cuatro en cuatro, un Jellyfish. En un Swordfish una fila puede tener dos sitios o tres; lo que importa es que todos caigan en las mismas tres columnas.",
          "Reduce un X-Wing a una fila y una columna y obtienes un Único oculto: una fila donde el número solo cabe en una columna. Así que un Único oculto es en realidad un pez de tamaño 1, un X-Wing un pez de tamaño 2 y un Swordfish un pez de tamaño 3, y las filas y las columnas pueden intercambiar los papeles. Los Candidatos bloqueados, puntero y reclamante, también son peces de tamaño 1, con una caja en uno de los lados. Nunca hace falta un pez de más de cuatro, porque un pez en cinco filas siempre viene acompañado de otro más pequeño en las columnas, igual que un quinteto desnudo viene con un subconjunto oculto de cuatro o menos."
        ],
        "eli12": "Dos filas necesitan un 5 cada una. En las dos filas, el 5 solo puede ir en la segunda columna o en la octava. Salga como salga, una fila se queda con la segunda columna y la otra con la octava, porque una columna no puede tener dos 5. Así que las dos columnas reciben su 5 de estas dos filas, y todas las demás casillas de esas columnas pueden olvidarse del 5."
      },
      "sideways": {
        "heading": "El mismo truco, visto de lado",
        "paragraphs": [
          "Imagina el sudoku como un cubo cuyas tres direcciones son las filas, las columnas y los números. La cuadrícula habitual muestra filas frente a columnas. Gira el cubo y verás, en cambio, filas frente a números. Para un número concreto, anota para cada fila las columnas donde todavía puede ir. Cada fila se convierte en una pequeña casilla cuyos candidatos son números de columna, y las nueve filas se comportan como una unidad: cada número de columna pertenece exactamente a una de ellas.",
          "Ahora un X-Wing son dos de esas casillas con los mismos dos números de columna: un Par desnudo. Un Swordfish es un Trío desnudo, y un Jellyfish, un Cuarteto desnudo. Girado de otra manera, el cubo muestra un par desnudo como un par oculto. Todo pez de filas y columnas sin aleta es un subconjunto disfrazado, y todo subconjunto en una fila o columna también es un pez disfrazado; un subconjunto dentro de una caja, o un pez que usa una caja, no tiene ese gemelo, porque una caja no es una de las direcciones del cubo."
        ],
        "eli12": "Para cada fila, apunta en una tarjeta los sitios donde podría ir su 5. Dos tarjetas dicen solo la tercera columna y la octava. Cada una de esas filas necesita un 5 y ninguna columna puede aceptar dos, así que entre las dos ocupan ambas columnas, y ninguna otra tarjeta puede usar ninguna de ellas. Dos tarjetas que solo tienen las mismas dos opciones son simplemente un par, como dos casillas que solo pueden ser un 3 o un 8. El X-Wing es un par, visto de lado.",
        "caption": "Izquierda: dónde puede ir el 5 en una cuadrícula con un X-Wing en las filas 2 y 7. Derecha: los mismos 5 ordenados por fila, como casillas que contienen números de columna. Las filas 2 y 7 solo contienen 3 y 8, un par desnudo, así que ninguna otra fila puede poner su 5 en la columna 3 ni en la 8."
      },
      "fins": {
        "heading": "Aletas, y peces con cajas",
        "paragraphs": [
          "Un pez con aletas es un pez con unos pocos candidatos de más, la aleta, agrupados en una sola caja. O el pez es real o la aleta tiene el número, así que una casilla de las columnas del pez, fuera de sus filas, que vea todas las casillas de la aleta pierde el número en cualquier caso. Un pez Sashimi es un pez con aletas en el que a la fila de la aleta, sin su aleta, solo le quedaría un sitio. Los peces Franken permiten que las cajas hagan de filas o de columnas.",
          "O esto o aquello: así piensan las cadenas, y las cadenas vienen más adelante. Un pez con aletas es el primer sitio de esta página donde se encuentran un conjunto bloqueado y una cadena."
        ],
        "eli12": "Un pez con aletas es un X-Wing con una esquina desordenada: una fila tiene uno o dos sitios de más para el 5, todos en la misma caja que una de las esquinas de esa fila. O el X-Wing ordenado es de verdad, o el 5 está en esos sitios de más. Una casilla pierde su 5 con seguridad solo si lo pierde en las dos historias: está en una de las columnas del X-Wing, fuera de sus dos filas, y ve todos los sitios de más."
      },
      "als": {
        "heading": "Conjuntos casi bloqueados",
        "paragraphs": [
          "Un conjunto casi bloqueado son N casillas de una unidad que tienen entre todas N+1 números. Quita cualquiera de esos números y las casillas forman un conjunto bloqueado con los restantes. El más pequeño es una sola casilla bivalor: una casilla, dos candidatos.",
          "Eso convierte cada conjunto casi bloqueado en un interruptor. Si uno de sus números resulta imposible, el conjunto queda bloqueado y coloca todos los demás."
        ],
        "eli12": "Cuatro amigos sentados juntos eligen cada uno un snack distinto de una lista de cinco. Si se acaba uno de los cinco, los cuatro amigos tienen que quedarse con los otros cuatro, uno cada uno, así que esos cuatro snacks se eligen todos."
      },
      "bent": {
        "heading": "Subconjuntos doblados: los wings",
        "paragraphs": [
          "Pon un trío desnudo en una fila y queda bloqueado. Dóblalo por una esquina, de modo que las tres casillas queden en dos unidades, y casi sigue funcionando. Eso es un XY-Wing o un XYZ-Wing: tres casillas, tres números, doblados. Cuatro casillas y cuatro números forman un WXYZ-Wing, un cuarteto doblado, y cinco forman un VWXYZ-Wing, un quinteto doblado.",
          "Por qué funciona: en un subconjunto doblado, todos los números menos uno tienen sus candidatos en casillas que se ven todas entre sí, así que cada uno puede usarse como mucho una vez. Solo un número, Z, podría repetirse, porque sus casillas no se ven todas entre sí. Sin Z, las casillas necesitarían tantos números distintos como casillas hay, pero solo dispondrían de un número menos. Eso es imposible, así que Z está en el patrón, y cualquier casilla que vea todos los Z del patrón pierde Z.",
          "El XY-Wing y el XYZ-Wing solo se diferencian en si la casilla central, el pivote, también contiene Z. Si la contiene, las casillas de las que se elimina Z también tienen que ver el pivote."
        ],
        "eli12": "Cuatro amigos toman un snack cada uno, y nadie puede tener el mismo snack que alguien a quien ve. Solo hay cuatro tipos. Tres de los tipos pueden ir como mucho a un amigo cada uno, porque todos los que podrían tomarlos se ven entre sí. Solo las galletas podrían ir a dos amigos sentados separados. Sin galletas, cuatro amigos necesitarían cuatro snacks distintos de solo tres tipos. Así que alguien tiene una galleta, y quien pueda ver a todos los que podrían tomar galleta no puede tener ninguna.",
        "caption": "Arriba: un trío desnudo en una fila. Abajo: los mismos tres números doblados por una esquina, un XY-Wing. El pivote azul contiene 1 y 2 y ve las dos pinzas doradas. Sea cual sea el pivote, una pinza tiene que ser 3, así que las dos casillas con un 3 rojo, que ven ambas pinzas, no pueden ser 3."
      },
      "als-xz": {
        "heading": "ALS-XZ: el padre de todos los wings doblados",
        "paragraphs": [
          "Toma dos conjuntos casi bloqueados sin ninguna casilla en común, que contengan los dos los números X y Z. Si todos los X del primer conjunto ven todos los X del segundo, como mucho un conjunto puede tener X, así que al menos un conjunto se queda sin él. Un conjunto sin X queda bloqueado con sus otros números, Z entre ellos. Por tanto, al menos uno de los dos conjuntos coloca Z, y Z se puede eliminar de cualquier casilla que vea todos los Z de ambos conjuntos.",
          "Cada wing doblado del catálogo es esta regla con uno de los conjuntos formado por una sola casilla bivalor: un XY-Wing es una casilla bivalor más un conjunto de dos casillas, y un WXYZ-Wing, una casilla bivalor más un conjunto de tres casillas. Por eso algunas guías, sudoku.coach entre ellas, llaman ahora a los wings más grandes simplemente ALS-XZ, y por eso sudokUI encuentra un wing de cinco casillas con esa forma como ALS-XZ.",
          "A partir de ahí la idea crece. El ALS-XY-Wing es un XY-Wing cuyas tres casillas se han convertido en conjuntos, el Death Blossom le da a cada candidato de una casilla un conjunto propio, y el Sue de Coq reparte las casillas abarrotadas del cruce entre una caja y una línea: una parte va a un conjunto del resto de la línea y otra a un conjunto del resto de la caja."
        ],
        "eli12": "Nadie puede tener el mismo snack que alguien a quien ve, y los amigos de una misma mesa se ven entre sí. Hay dos mesas, y cada una tiene en su lista un snack más que amigos, así que una mesa que pierde un snack se queda con todos los demás. Las dos listas tienen patatas fritas y chocolate. Todos los que podrían comer patatas en una mesa pueden ver a todos los que podrían comerlas en la otra, así que como mucho una mesa recibe patatas. Una mesa sin patatas se queda con todo lo demás, chocolate incluido. Así que quien pueda ver a todos los que podrían comer chocolate, en las dos mesas, no puede tener chocolate."
      },
      "w-wing": {
        "heading": "No todos los wings están doblados",
        "paragraphs": [
          "El W-Wing comparte el nombre, pero no la idea. Son dos casillas bivalor idénticas unidas por un enlace fuerte en uno de sus números, lo que lo convierte en una cadena corta y no en un XYZ-Wing más grande. La W no significa una letra más."
        ],
        "eli12": "Hay dos casillas que solo pueden ser un 1 o un 2. En otra parte, una fila, una columna o una caja tiene solo dos sitios libres para el 2, y cada casilla ve uno distinto de ellos. Si la primera casilla es un 2, el sitio que ve no lo es, así que el otro sitio es el 2, y la segunda casilla, que lo ve, tiene que ser un 1. Así que una de las dos casillas siempre es un 1, y una casilla que vea las dos no puede serlo."
      },
      "links": {
        "heading": "Enlaces fuertes y débiles",
        "paragraphs": [
          "Un enlace fuerte une dos candidatos de los que al menos uno es verdadero: un número al que le quedan dos sitios en una unidad, o una casilla con dos candidatos. Un enlace débil une dos de los que como mucho uno es verdadero: dos candidatos de un mismo número que se ven, o dos candidatos de una misma casilla. Una cadena los alterna, y empieza y termina con un enlace fuerte. Si este extremo es falso, el siguiente es verdadero, así que el de después es falso, y así sucesivamente.",
          "Cuando una cadena empieza y termina en el mismo número, uno de sus dos extremos es verdadero, así que cualquier casilla que vea los dos extremos pierde ese número. Cuando una cadena se cierra en un bucle cuyos enlaces alternan en toda la vuelta, cada enlace débil del bucle puede eliminar candidatos por su cuenta."
        ],
        "eli12": "Cada número posible de una casilla es un interruptor de la luz, encendido si es la respuesta. Un enlace fuerte son dos interruptores con al menos uno encendido, y uno débil, dos con uno encendido como mucho. Colócalos uno tras otro: fuerte, débil, fuerte. Si el primero está apagado, el segundo está encendido, el tercero apagado y el cuarto encendido. Así que el primero o el último está encendido, y si los dos son un 6, una casilla que vea los dos extremos no es un 6."
      },
      "one-digit": {
        "heading": "Cadenas de un solo número: kites, skyscrapers y turbots",
        "paragraphs": [
          "Una cadena que sigue un solo número es una X-Chain. Su forma útil más corta son dos enlaces fuertes unidos por uno débil, cuatro candidatos en total, y sus formas tienen nombre propio: un Skyscraper cuando los dos enlaces fuertes son paralelos, un 2-String Kite cuando uno va a lo largo de una fila y el otro a lo largo de una columna y se encuentran en una caja, y un Turbot Fish para las demás formas.",
          "Un X-Wing es esa cadena cerrada en un bucle, y un Empty Rectangle divide los candidatos de una caja en un grupo de fila y un grupo de columna, de los que al menos uno contiene el número. Las cadenas más largas de un solo número también son X-Chains, y los bucles son X-Cycles."
        ],
        "eli12": "Una fila y una columna tienen cada una solo dos sitios para el 4. Un sitio de cada una está en la misma caja, y son dos casillas distintas; a los otros dos llámalos los extremos. Imagina que ninguno de los extremos fuera el 4. Entonces la fila y la columna pondrían las dos su 4 en esa caja, en dos casillas distintas, y una caja no puede tener dos 4. Eso es imposible. Así que al menos un extremo es el 4, y una casilla que vea los dos extremos no puede serlo.",
        "caption": "Un 2-String Kite en el 4. La fila 2 solo tiene dos sitios para el 4, y la columna 3 también; la casilla dorada de cada una está en la caja 1. Si ninguno de los extremos azules fuera 4, las dos casillas doradas lo serían, y una caja no puede tener dos 4. Así que un extremo es 4, y la casilla roja, que ve los dos extremos, no lo es."
      },
      "colouring": {
        "heading": "Coloreado: dos mundos",
        "paragraphs": [
          "Empieza por un candidato de un número y sigue sus enlaces fuertes hacia fuera, coloreando alternativamente con dos colores. Todo lo que alcances es un clúster, y en él un color es verdadero por completo y el otro falso por completo; solo que todavía no sabes cuál. Si un color pusiera el número dos veces en una unidad, ese color es falso. Si una casilla ve los dos colores, pierde el número gane el color que gane. Un clúster separado necesita sus propios colores.",
          "Simple Colors muestra de una sola vez un clúster entero de enlaces fuertes, así que encuentra todas las X-Chains construidas solo con los enlaces de ese clúster. Multi Colors une dos clústeres, y 3D Medusa colorea a través de todos los números a la vez."
        ],
        "eli12": "Elige un sitio donde podría ir un 7 y píntalo de azul. Cada vez que una fila, una columna o una caja tenga solo dos sitios para el 7 y uno esté pintado, pinta el otro del color contrario, de modo que el azul y el dorado se van turnando. Sigue hasta que no puedas pintar nada más. Ahora, o todos los sitios azules son un 7 y ninguno dorado lo es, o al revés. Cualquier otro sitio que pueda ver uno azul y uno dorado no es un 7, pase lo que pase."
      },
      "pairs": {
        "heading": "Cadenas de pares",
        "paragraphs": [
          "Una casilla bivalor es un enlace fuerte dentro de una casilla: si no es un número, es el otro. Salta de una casilla bivalor a otra casilla bivalor que la vea, a través de un número que compartan, y sal de cada casilla por su otro número: eso es una XY-Chain. Su versión de tres casillas vuelve a ser el XY-Wing, y así un mismo patrón puede ser a la vez un wing, un subconjunto doblado, un par de conjuntos casi bloqueados y una cadena. Un Remote Pair es una XY-Chain cuyas casillas tienen todas los mismos dos números."
        ],
        "eli12": "Imagina una hilera de fichas de dominó: cada una tiene dos números y solo enseña uno. Cada ficha comparte un número con la anterior y el otro con la siguiente, y las vecinas están en la misma fila, columna o caja, así que no pueden enseñar las dos el número que comparten. Si la primera esconde su número exterior, enseña el compartido, así que la segunda enseña su otro número, y así hasta el final de la hilera. Así que uno de los dos números exteriores se ve, y si los dos coinciden, una casilla que vea los dos extremos no es ese número."
      },
      "aic": {
        "heading": "Una cadena para unirlas a todas",
        "paragraphs": [
          "Una AIC, o cadena de inferencias alternas, admite todos los tipos de enlace a la vez: un número a lo largo de una unidad, dos números en una casilla, un grupo de candidatos en una caja, incluso un conjunto casi bloqueado entero. La mayoría de los patrones con nombre son AIC cortas o bucles: entre ellos, el X-Wing, el Skyscraper, el XY-Wing, el W-Wing y el ALS-XZ. Un Nice Loop es lo mismo escrito como bucle.",
          "Las cadenas forzadas son el último paso antes de adivinar. Supón un candidato y sigue todas sus consecuencias, y luego haz lo mismo con las alternativas. Si todas las ramas coinciden en algo, eso es verdadero, y si una rama acaba en una contradicción, la suposición de la que partía era falsa. Son potentes, pero no tienen una forma que buscar, y por eso sudokUI las reserva para los sudokus más difíciles."
        ],
        "eli12": "Trabajo de detective. Una casilla solo puede ser un 3 o un 5. Supón que es un 3 y sigue todo lo que tiene que pasar después. Luego supón que es un 5 y síguelo también. Si en las dos historias la misma otra casilla acaba siendo un 9, esa casilla es un 9, sea cual sea al final el número de la primera. Solo funciona cuando las historias cubren todos los números que podría ser la primera casilla."
      },
      "deadly": {
        "heading": "Patrones mortales",
        "paragraphs": [
          "Cuatro casillas en dos filas, dos columnas y dos cajas que solo pudieran contener los mismos dos números serían una trampa: los dos números podrían intercambiar sus posiciones y las dos versiones encajarían. Eso son dos soluciones, así que un sudoku con una sola solución nunca acaba así. Si tres esquinas del rectángulo solo contienen 1 y 2 y la cuarta contiene 1, 2 y 5, la cuarta tiene que ser 5. Eso es un Rectángulo único. El BUG+1 usa la misma promesa con una trampa que cubre toda la cuadrícula, y los Rectángulos evitables, con rectángulos cuyas esquinas incluyen números que has colocado tú.",
          "Estas técnicas solo son válidas cuando el sudoku tiene de verdad una sola solución. sudokUI solo acepta sudokus que la tienen, así que aquí siempre son seguras."
        ],
        "eli12": "Cuatro casillas vacías ocupan las esquinas de un rectángulo, en dos filas, dos columnas y solo dos cajas. Tres de ellas solo pueden ser un 1 o un 2. Si la cuarta también fuera un 1 o un 2, podrías intercambiar los 1 y los 2 de las cuatro esquinas y el sudoku seguiría funcionando: dos respuestas. Un buen sudoku solo tiene una, así que la cuarta esquina no es ni un 1 ni un 2.",
        "caption": "Un Rectángulo único. Tres esquinas azules solo contienen 1 y 2. Si la cuarta esquina también fuera 1 o 2, los 1 y los 2 podrían intercambiarse y el sudoku tendría dos soluciones. Así que su 1 y su 2 se eliminan, y es 5."
      },
      "truths": {
        "heading": "Verdades y enlaces",
        "paragraphs": [
          "La lógica de conjuntos de Allan Barker lo describe casi todo de una vez. Una verdad es un grupo de candidatos de los que exactamente uno es verdadero: los candidatos de una casilla, o los sitios de un número en una unidad. Un enlace es un enlace débil extendido a todo un grupo: de todos sus candidatos, como mucho uno es verdadero. Si N verdades que no comparten ningún candidato están cubiertas por N enlaces, las verdades ocupan todos los enlaces, así que cualquier otro candidato de esos enlaces es falso. Todos los conjuntos bloqueados y todos los peces sin aleta son esa única regla.",
          "Permite que haya un enlace más que verdades y obtienes las cadenas, los peces con aletas y los wings, en los que un candidato cae solo si está en dos de los enlaces a la vez. La mayoría de los nombres de técnicas son formas breves de decir dónde están las verdades y los enlaces."
        ],
        "eli12": "Tres tareas necesitan exactamente un ayudante cada una, y solo hay tres ayudantes capaces de hacer alguna de ellas. Ningún ayudante puede encargarse de dos tareas. Así que los tres ayudantes acaban ocupados con estas tareas, y ninguno queda libre para nada más de su lista."
      },
      "x-wing-first": {
        "heading": "Primero fue el X-Wing",
        "paragraphs": [
          "Ya en junio de 2005, un habitual de un foro contaba X-Wing y Swordfish entre los pocos nombres en los que estaban de acuerdo la mayoría de los jugadores, y nadie en aquel hilo sabía decir quién los había acuñado. El pez de dos filas ya se conocía y tenía nombre antes de que los jugadores vieran que con tres o cuatro filas también funciona, así que la familia se bautizó a partir de él: Swordfish, Jellyfish, y después Squirmbag, Whale y Leviathan para tamaños que nadie necesita. Por eso el X-Wing es un pez y no un wing.",
          "Squirmbag no gustaba, y hacia finales de 2005 los jugadores proponían Starfish en su lugar. Lo más probable es que la X represente la forma diagonal de las cuatro esquinas. El caza de Star Wars y el biplano Fairey Swordfish son historias populares sin una fuente conocida, así que tómalas como folclore."
        ]
      },
      "letters": {
        "heading": "Letras que cuentan números",
        "paragraphs": [
          "En los wings, las letras casi cuentan números. El XYZ-Wing, el WXYZ-Wing y el VWXYZ-Wing usan tres, cuatro y cinco números, así que como subconjuntos doblados son un trío, un cuarteto y un quinteto. El XY-Wing también usa tres números, un trío doblado como el XYZ-Wing, pero sus letras solo nombran los dos de su pivote. El Y-Wing no es una técnica distinta ni más nueva. Nació en 2005 como abreviatura de XY-Wing en los foros, y los dos nombres se siguen usando. Los wings más grandes, de VWXYZ en adelante, también tienen nombre, pero se encuentran como ALS-XZ, la regla de la que vienen, y algunas guías ya solo usan ese nombre.",
          "El W-Wing se sale de la norma: es una cadena, y su W no cuenta nada."
        ]
      },
      "shape-names": {
        "heading": "Nombres que enseñan",
        "paragraphs": [
          "El 26 de diciembre de 2005, un usuario llamado Havard publicó en un foro el Skyscraper y el 2-String Kite, aunque admitía que los dos eran Turbot Fish. Otro habitual preguntó por qué una técnica que ya existía necesitaba nombres nuevos, y enumeró diez nombres que ya se usaban para la misma familia. Havard respondió que los nombres ayudan a recordar el patrón. Ganaron los nombres que describen formas, porque enseñan mejor.",
          "Se suele decir que el Sue de Coq debe su nombre al apodo en el foro del jugador que lo publicó por primera vez, como Two-Sector Disjoint Subsets. A 3D Medusa le puso el nombre el propio Bob Hanson: una vista tridimensional le hizo pensar en Medusa y su cabellera."
        ]
      },
      "history": {
        "heading": "Cómo cambió la forma de resolver",
        "paragraphs": [
          "Las técnicas llegaron como trucos sueltos con nombres sueltos, y la teoría que las une vino después. Ese orden es la razón de que el catálogo parezca un zoológico."
        ],
        "points": [
          {
            "when": "Mediados de 2005",
            "what": "X-Wing y Swordfish ya son nombres habituales, y en un foro de programadores tienen nombre los peces de hasta cinco filas."
          },
          {
            "when": "Otoño de 2005",
            "what": "Los nombres aún no están asentados: un jugador llama Swordfish a todo pez de tres o más filas, y otro dice que encontró el X-Wing por su cuenta y lo llamó rectángulo. El Sue de Coq se publica como Two-Sector Disjoint Subsets."
          },
          {
            "when": "Noviembre de 2005",
            "what": "El principio BUG: si cada casilla sin resolver tiene dos candidatos y cada candidato aparece dos veces en cada unidad, la cuadrícula no puede tener exactamente una solución."
          },
          {
            "when": "Diciembre de 2005",
            "what": "El Skyscraper y el 2-String Kite reciben su nombre. 3D Medusa, el coloreado de Bob Hanson a través de todos los números, ya es uno de los nombres en uso."
          },
          {
            "when": "Enero de 2006",
            "what": "Un habitual de un foro resume lo que los jugadores venían notando: el XY-Wing no es más que una cadena forzada corta, y el X-Wing y el Turbot Fish son X-Cycles."
          },
          {
            "when": "Hacia 2006 y 2007",
            "what": "Una guía de peces publicada en un foro trata las cajas (peces Franken y mutantes) y los peces Kraken, y el Empty Rectangle está en uso."
          },
          {
            "when": "Desde entonces",
            "what": "Se imponen las ideas que unifican: los conjuntos casi bloqueados muestran que los wings doblados son una sola regla, la lógica de conjuntos muestra que los peces, los subconjuntos y las cadenas son una sola idea de recuento, y la puntuación de Sudoku Explainer se convierte en la vara de medir común de la dificultad."
          }
        ]
      },
      "see": {
        "heading": "Difícil de ver no es difícil de entender",
        "paragraphs": [
          "Sudoku Explainer puntúa el Par desnudo con 3,0, el X-Wing con 3,2 y el Par oculto con 3,4, aunque en una fila o columna los tres son un mismo patrón visto desde lados distintos. Al Turbot Fish le da 6,6, y aun así otras guías, HoDoKu entre ellas, lo enseñan pronto. Las puntuaciones miden lo difícil que es ver un patrón, no lo profundo que es. Cuando conoces la idea, un patrón nuevo deja de ser algo que memorizar y se convierte en algo conocido en un sitio nuevo.",
          "Así que recorre la cuadrícula por ideas, no por nombres. Primero cuenta: únicos. Luego busca bloqueos: pares y tríos en una unidad, un número encerrado en la intersección de una caja y una línea, un número que se alinea en las mismas columnas a lo largo de varias filas. Luego busca casi bloqueos: las casillas bivalor son el conjunto casi bloqueado más pequeño y el punto de partida de todo wing y de toda XY-Chain. Luego sigue los enlaces: un número con dos sitios en una unidad es un enlace fuerte esperando a que lo encadenen.",
          "La pestaña Cómo resolver muestra el orden que siguen en realidad los mejores jugadores, y el modo de práctica te pone delante la mayoría de las técnicas, de una en una, justo como tu siguiente jugada."
        ],
        "eli12": "No aprendes decenas de trucos. Aprendes tres ideas y una promesa: cosas que tienen que caber, cosas que casi caben, «si no es esto, es aquello» y la promesa de que solo hay una respuesta. Todo lo demás es eso mismo, vestido con otra ropa."
      }
    }
  },
  "strings": {
    "Search {n} techniques": "Buscar entre {n} técnicas",
    "Search techniques": "Buscar técnicas",
    "Order of the list": "Orden de la lista",
    "Technique families": "Familias de técnicas",
    "No technique matches “{q}”.": "Ninguna técnica coincide con «{q}».",
    "By family": "Por familia",
    "Easiest first": "Las más fáciles primero",
    "Most often needed": "Las que más se necesitan",
    "Most often needed first": "Primero las que más se necesitan",
    "Most worth learning": "Las que más vale aprender",
    "Most worth learning first": "Primero las que más vale aprender",
    "In the order the solver tries them: a technique is only needed once everything above it has run dry.": "En el orden en que las prueba el resolvedor: una técnica solo hace falta cuando todas las anteriores ya no dan más de sí.",
    "The techniques that turn up in the most puzzles sudokUI generates, whatever their difficulty.": "Las técnicas que aparecen con más frecuencia en los sudokus que genera sudokUI, sea cual sea su dificultad.",
    "How often a technique is needed, weighted by its rating cost. Difficulty and frequency are different things: a hard technique that turns up often repays the effort of learning it, and those come first.": "Con qué frecuencia se necesita una técnica, ponderada por lo que suma a la puntuación. Dificultad y frecuencia son cosas distintas: una técnica difícil que aparece a menudo compensa el esfuerzo de aprenderla, y esas van primero.",
    "Added to a puzzle's rating each time the solver needs this technique": "Se suma a la puntuación de un sudoku cada vez que el resolvedor necesita esta técnica",
    "Needed in {freq}": "Se necesita en {freq}",
    "Never needed": "Nunca se necesita",
    "Why it works": "Por qué funciona",
    "How to spot it": "Cómo detectarla",
    "Needed in {freq} that sudokUI generates.": "Se necesita en {freq} que genera sudokUI.",
    "Also called {list}.": "Otros nombres: {list}.",
    "Practice this technique": "Practicar esta técnica",
    "Scan the running game for this technique (counts as assistance)": "Buscar esta técnica en la partida en curso (cuenta como ayuda)",
    "Is it on my board?": "¿Está en mi tablero?",
    "Open as a page ↗": "Abrir como página ↗",
    "Worked example": "Ejemplo resuelto",
    "{name} example on a sudoku board": "Ejemplo de {name} en un tablero de sudoku",
    "Puzzle: {credit}.": "Sudoku: {credit}.",
    "In this puzzle the position comes after harder steps.": "En este sudoku, la posición llega después de pasos más difíciles.",
    "Open this position on the board": "Abrir esta posición en el tablero",
    "The solver uses this on the hardest puzzles. It has no pattern to spot, so it is not offered in practice.": "El resolvedor la usa en los sudokus más difíciles. No tiene ningún patrón que detectar, así que no se ofrece en el modo de práctica.",
    "Implemented, but never needed: an easier technique always reaches the same result first.": "Implementada, pero nunca necesaria: una técnica más fácil siempre llega antes al mismo resultado.",
    "Only ever needed in puzzles made by hand for it: none can be generated, so it is not offered in practice.": "Solo hace falta en sudokus construidos a mano para ella: no se puede generar ninguno, así que no se ofrece para practicar.",
    "Not implemented in sudokUI: the chain engines already find everything it can.": "No implementada en sudokUI: los motores de cadenas ya encuentran todo lo que ella podría encontrar.",
    "Glossary: {term}": "Glosario: {term}",
    "The words sudoku solvers use, and that the hints in sudokUI use, each defined once.": "Las palabras que usan los jugadores de sudoku y las pistas de sudokUI, cada una definida una sola vez.",
    "See": "Véase",
    "In English: {term}": "En inglés: {term}",
    "Ideas on this page": "Ideas de esta página",
    "Explain it like I'm 12": "Explícamelo como si tuviera 12 años",
    "In the catalogue": "En el catálogo",
    "How fast is fast?": "¿Qué se considera rápido?",
    "Slow": "Lento",
    "Typical": "Típico",
    "Fast": "Rápido",
    "Expert": "Experto",
    "World class": "Clase mundial",
    "above {n}": "más de {n}",
    "up to {n}": "hasta {n}",
    "Slow is where the slowest fifth begins. Typical is the median solver. Fast is faster than four solvers in five, Expert faster than 99 in 100, World class faster than 999 in 1,000.": "Lento marca dónde empieza la quinta parte más lenta. Típico es la mediana de los jugadores. Rápido es más rápido que cuatro de cada cinco jugadores; Experto, más rápido que 99 de cada 100; Clase mundial, más rápido que 999 de cada 1000.",
    "The app says where each of your solves lands.": "La app te dice dónde queda cada uno de tus tiempos.",
    "fewer than 1 in {n} puzzles": "menos de 1 de cada {n} sudokus",
    "every puzzle": "todos los sudokus",
    "{p}% of puzzles": "el {p}% de los sudokus",
    "1 in {n} puzzles": "1 de cada {n} sudokus",
    "Where 5 can go": "Dónde puede ir el 5",
    "The same, by row": "Lo mismo, por filas",
    "row {n}": "fila {n}",
    "row": "fila",
    "columns": "columnas",
    "Naked triple: three cells in one row": "Trío desnudo: tres casillas en una fila",
    "Bent triple: an XY-Wing": "Trío doblado: un XY-Wing",
    "An X-Wing on 5, and the same 5s listed by row as a naked pair": "Un X-Wing en el 5, y esos mismos 5 listados por filas como un par desnudo",
    "A naked triple and a hidden quad in the same row": "Un trío desnudo y un cuarteto oculto en la misma fila",
    "A naked triple in one row, and the same three digits bent round a corner as an XY-Wing": "Un trío desnudo en una fila, y los mismos tres números doblados en una esquina como un XY-Wing",
    "A 2-String Kite on 4": "Un 2-String Kite en el 4",
    "A Unique Rectangle in rows 1 and 2, columns 1 and 4": "Un rectángulo único en las filas 1 y 2 y las columnas 1 y 4",
    "Techniques": "Técnicas",
    "Intuition": "Intuición",
    "Glossary": "Glosario",
    "Rating": "Dificultad",
    "Play": "Jugar",
    "Learn": "Aprender",
    "Language": "Idioma",
    "sudokUI is a free, open-source sudoku app: no ads, no account, works offline.": "sudokUI es una app de sudoku gratuita y de código abierto: sin anuncios, sin cuenta y funciona sin conexión.",
    "Play at sudokui.app": "Juega en sudokui.app",
    "Source on GitHub": "Código fuente en GitHub",
    "Difficulty rating": "Puntuación de dificultad",
    "Sudoku techniques": "Técnicas de sudoku",
    "{name}: sudoku technique explained": "{name}: técnica de sudoku explicada",
    "{what} Why it works, how to spot it, and a puzzle to practise on.": "{what} Por qué funciona, cómo detectarla y un sudoku para practicarla.",
    "How the {name} works in sudoku: the pattern, why it is valid and how to spot it. {level} technique, rating score {score}.": "Cómo funciona {name} en el sudoku: el patrón, por qué es válido y cómo detectarlo. Técnica de nivel {level}, puntuación {score}.",
    "{name} in sudoku": "{name} en el sudoku",
    "rating cost {score}": "suma {score} puntos",
    "also called {list}": "otros nombres: {list}",
    "how it fits": "cómo encaja",
    "Step {n} of this puzzle's solution, found and verified by the sudokUI engine. Cells are named by row and column: r2c3 is row 2, column 3.": "Paso {n} de la solución de este sudoku, encontrado y verificado por el motor de sudokUI. Las casillas se nombran por fila y columna: r2c3 es la casilla de la fila 2, columna 3.",
    "In this puzzle the position comes after steps harder than the technique itself.": "En este sudoku, la posición llega después de pasos más difíciles que la propia técnica.",
    "Play this puzzle from the start": "Juega este sudoku desde el principio",
    "Open the guide in sudokUI": "Abre la guía en sudokUI",
    "Practise it on a real puzzle.": "Practícala en un sudoku real.",
    "sudokUI generates a puzzle that needs {name} and takes you straight to the position where it applies. Hints draw the pattern on the board and explain the step.": "sudokUI genera un sudoku que necesita {name} y te lleva directamente a la posición donde se aplica. Las pistas dibujan el patrón en el tablero y explican el paso.",
    "Practice {name}": "Practica {name}",
    "Open in the app's guide": "Ábrela en la guía de la app",
    "In a puzzle's rating": "En la puntuación de un sudoku",
    "Each time the solver needs {name}, the puzzle's difficulty rating grows by {score}. Its class is {level}.": "Cada vez que el resolvedor necesita {name}, la puntuación de dificultad del sudoku aumenta en {score}. Es una técnica de nivel {level}.",
    "It is needed in {freq} that sudokUI generates.": "Se necesita en {freq} que genera sudokUI.",
    "How the rating works": "Cómo funciona la puntuación",
    "More {family}": "Otras técnicas de la familia: {family}",
    "Sudoku solving techniques: all {n} explained": "Técnicas de sudoku: las {n} explicadas una a una",
    "All {n} sudoku solving techniques explained in plain words, from Naked Single to Exocet, grouped by family. Practise each one free in the app.": "Las {n} técnicas para resolver sudokus explicadas con sencillez, del Único desnudo al Exocet y agrupadas por familias. Practica cada una gratis en la app.",
    "Sudoku solving techniques": "Técnicas para resolver sudokus",
    "All {n} solving techniques in sudokUI's catalogue, grouped by the idea behind them. Each one says what the pattern is, why it works and how to spot it.": "Las {n} técnicas de resolución del catálogo de sudokUI, agrupadas según la idea en la que se basan. Cada una explica cuál es el patrón, por qué funciona y cómo detectarlo.",
    "Play sudokUI": "Juega en sudokUI",
    "How they fit together": "Cómo encajan entre sí",
    "How rating works": "Cómo funciona la puntuación",
    "Worth learning first": "Qué aprender primero",
    "How often a technique is needed, weighted by its rating cost, over the {sample} puzzles sudokUI has generated and rated. Difficulty and frequency are different things: a hard technique that turns up often repays the effort of learning it.": "Con qué frecuencia se necesita cada técnica, ponderada por lo que suma a la puntuación, en los {sample} sudokus que sudokUI ha generado y puntuado. Dificultad y frecuencia son cosas distintas: una técnica difícil que aparece a menudo compensa el esfuerzo de aprenderla.",
    "{level}, needed in {freq}": "{level}, se necesita en {freq}",
    "Sudoku glossary: every solving term explained": "Glosario de sudoku: todos los términos explicados",
    "Plain-English definitions of sudoku solving terms: candidates, strong and weak links, conjugate pairs, almost locked sets, fins, deadly patterns and more.": "Definiciones sencillas de los términos del sudoku: candidatos, enlaces fuertes y débiles, pares conjugados, conjuntos casi bloqueados, aletas y más.",
    "Sudoku glossary": "Glosario de sudoku",
    "The words sudoku solvers use, and that sudokUI's hints use, each defined once and precisely.": "Las palabras que usan los jugadores de sudoku y las pistas de sudokUI, cada una definida una sola vez y con precisión.",
    "also {list}": "también {list}",
    "See the terms at work: {techniques}, or {play} and ask for a hint.": "Mira los términos en acción: {techniques}, o {play} y pide una pista.",
    "every technique explained": "todas las técnicas explicadas",
    "play sudokUI": "juega en sudokUI",
    "How sudoku techniques fit together": "Cómo encajan las técnicas de sudoku",
    "Every sudoku technique comes down to three ideas: locked sets, almost locked sets and chains. Each one explained simply, plus where the names came from.": "Toda técnica de sudoku se reduce a tres ideas: conjuntos bloqueados, casi bloqueados y cadenas. Cada una explicada con sencillez, y el origen de los nombres.",
    "In the catalogue:": "En el catálogo:",
    "Open in the app": "Abrir en la app",
    "All techniques": "Todas las técnicas",
    "Sudoku difficulty rating: how hard is your puzzle?": "Dificultad del sudoku: ¿qué nivel tiene el tuyo?",
    "How sudoku difficulty is rated: HoDoKu-compatible technique scores, eight bands from Beginner to Nightmare and the full score table. Rate any puzzle free.": "Cómo se mide la dificultad del sudoku: puntuaciones compatibles con HoDoKu, ocho niveles de Principiante a Pesadilla y la tabla completa. Puntúa el tuyo gratis.",
    "Sudoku difficulty rating": "Puntuación de dificultad del sudoku",
    "Rate your own sudoku": "Puntúa tu propio sudoku",
    "Rate this puzzle": "Puntuar este sudoku",
    "Paste a puzzle: 81 characters, with 0 or . for empty cells": "Pega un sudoku: 81 caracteres, con 0 o . para las casillas vacías",
    "This box needs JavaScript. You can also {open} and choose Import.": "Este cuadro necesita JavaScript. También puedes {open} y elegir Importar.",
    "open sudokUI": "abrir sudokUI",
    "A puzzle needs exactly 81 cells. This one has {n}.": "Un sudoku necesita exactamente 81 casillas. Este tiene {n}.",
    "The puzzle opens in sudokUI with its rating and band in the top bar. Nothing is uploaded: the rating is computed on your own device. No string at hand? {open}, choose New, then Custom, and type the puzzle onto the board. See also {hodoku}.": "El sudoku se abre en sudokUI con su puntuación y su nivel en la barra superior. No se sube nada: la puntuación se calcula en tu propio dispositivo. ¿No tienes el sudoku en texto? {open}, elige Nuevo y luego Personalizado, y escribe el sudoku en el tablero. Consulta también {hodoku}.",
    "Open sudokUI": "Abre sudokUI",
    "how this compares with HoDoKu": "cómo se compara con HoDoKu",
    "The eight difficulty bands": "Los ocho niveles de dificultad",
    "Band": "Nivel",
    "Total score": "Puntuación total",
    "Typical techniques": "Técnicas típicas",
    "Score of every technique": "Puntuación de cada técnica",
    "The cost added to a puzzle's rating each time the solver needs the technique, and how many of the puzzles sudokUI generates need it at least once (measured on {sample} puzzles).": "Lo que suma cada técnica a la puntuación de un sudoku cada vez que el resolvedor la necesita, y cuántos de los sudokus que genera sudokUI la necesitan al menos una vez (medido en {sample} sudokus).",
    "Technique": "Técnica",
    "Class": "Nivel",
    "Score": "Puntuación",
    "Needed in": "Se necesita en",
    "Every technique explained": "Todas las técnicas explicadas",
    "How the difficulty rating works": "Cómo funciona la puntuación de dificultad"
  }
};

export default es;
