/**
 * Zutaten-Mathematik: Einheiten, Portionen umrechnen, Einkaufsliste zusammenrechnen.
 *
 * Das ist die Stelle, an der die App entweder klug wirkt oder albern. "500 g Pasta"
 * bei doppelter Portion ist leicht. "1,5 Zwiebeln" und "2,4 Prisen Salz" sind der
 * Grund, warum es hier mehr Code gibt als man denkt.
 *
 * Reines Rechnen, kein DOM - damit man es zur Not in der Konsole durchprobieren kann.
 */

// ---------------------------------------------------------------- Einheiten

/**
 * Einheiten-Familien. Nur innerhalb einer Familie wird umgerechnet und
 * zusammengezaehlt.
 *
 * EL und TL bleiben absichtlich eigene Familien: beim Kochen zaehlt der Loeffel,
 * nicht die 15 ml. "3 EL Olivenoel" soll nicht als "45 ml" auf der Einkaufsliste
 * landen.
 */
const EINHEITEN = {
  g:         { familie: 'masse',   faktor: 1,    anzeige: 'g' },
  kg:        { familie: 'masse',   faktor: 1000, anzeige: 'kg' },
  ml:        { familie: 'volumen', faktor: 1,    anzeige: 'ml' },
  l:         { familie: 'volumen', faktor: 1000, anzeige: 'l' },
  el:        { familie: 'el',      faktor: 1,    anzeige: 'EL' },
  tl:        { familie: 'tl',      faktor: 1,    anzeige: 'TL' },
  stück:     { familie: 'stueck',  faktor: 1,    anzeige: 'Stück' },
  zehe:      { familie: 'zehe',    faktor: 1,    anzeige: 'Zehe' },
  bund:      { familie: 'bund',    faktor: 1,    anzeige: 'Bund' },
  dose:      { familie: 'dose',    faktor: 1,    anzeige: 'Dose' },
  packung:   { familie: 'packung', faktor: 1,    anzeige: 'Packung' },
  scheibe:   { familie: 'scheibe', faktor: 1,    anzeige: 'Scheibe' },
  prise:     { familie: 'prise',   faktor: 1,    anzeige: 'Prise' },
  handvoll:  { familie: 'handvoll',faktor: 1,    anzeige: 'Handvoll' },
  '':        { familie: 'stueck',  faktor: 1,    anzeige: '' },
};

/** Schreibweisen, die Claude oder Lisa tippen kann, auf unsere Einheiten mappen. */
const EINHEIT_ALIASE = {
  gramm: 'g', gr: 'g', 'g.': 'g',
  kilo: 'kg', kilogramm: 'kg',
  milliliter: 'ml', 'ml.': 'ml',
  liter: 'l', 'ltr': 'l',
  esslöffel: 'el', esslöffeln: 'el', tbsp: 'el', eßl: 'el',
  teelöffel: 'tl', teelöffeln: 'tl', tsp: 'tl',
  stk: 'stück', 'st.': 'stück', stueck: 'stück', pcs: 'stück',
  zehen: 'zehe', knoblauchzehe: 'zehe', knoblauchzehen: 'zehe',
  bünde: 'bund', bündel: 'bund',
  dosen: 'dose',
  packungen: 'packung', pck: 'packung', pkg: 'packung',
  scheiben: 'scheibe',
  prisen: 'prise',
  msp: 'prise', messerspitze: 'prise',
};

/** Einheiten, bei denen halbe Schritte sinnvoll sind und Kommazahlen albern wirken. */
const STUECKIG = new Set(['stueck', 'zehe', 'bund', 'dose', 'packung', 'scheibe', 'prise', 'handvoll', 'el', 'tl']);

/** Normalisiert eine Einheit auf unseren Schlüssel ('g', 'el', 'stück', ...). */
export function einheitNormalisieren(einheit) {
  const roh = (einheit || '').toString().trim().toLowerCase().replace(/\.$/, '');
  if (!roh) return '';
  if (EINHEITEN[roh]) return roh;
  if (EINHEIT_ALIASE[roh]) return EINHEIT_ALIASE[roh];
  // Unbekannte Einheit ("Stängel", "Blatt") behalten wir wie sie ist -
  // dann wird sie eben nur mit sich selbst zusammengezählt.
  return roh;
}

function einheitInfo(einheit) {
  const schluessel = einheitNormalisieren(einheit);
  return EINHEITEN[schluessel] || { familie: `frei:${schluessel}`, faktor: 1, anzeige: einheit || '' };
}

/**
 * Familie einer Einheit - nur innerhalb einer Familie wird zusammengerechnet.
 * Wird beim Bearbeiten eines Listeneintrags gebraucht.
 */
export function einheitFamilie(einheit) {
  return einheitInfo(einheit).familie;
}

// ---------------------------------------------------------------- Zahlen hübsch machen

const BRUECHE = [
  [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'],
];

/**
 * Zahl als Text - mit echten Bruchzeichen, weil "0.5 Zwiebel" niemand liest.
 * 0.5 -> "½", 1.5 -> "1½", 2.25 -> "2¼", 250 -> "250", 1.75 -> "1¾"
 */
export function mengeFormatieren(menge) {
  if (menge === null || menge === undefined || Number.isNaN(menge)) return '';

  const gerundet = Math.round(menge * 100) / 100;
  const ganz = Math.floor(gerundet);
  const rest = Math.round((gerundet - ganz) * 100) / 100;

  if (rest === 0) return String(ganz);

  for (const [wert, zeichen] of BRUECHE) {
    if (Math.abs(rest - wert) < 0.02) {
      return ganz === 0 ? zeichen : `${ganz}${zeichen}`;
    }
  }

  // Kein schöner Bruch - dann Dezimalzahl mit Komma
  return gerundet.toFixed(gerundet < 10 ? 1 : 0).replace('.', ',').replace(/,0$/, '');
}

/** "250 g", "½ Zwiebel", "3 Zehen" - Menge und Einheit zusammen. */
export function mengeMitEinheit(menge, einheit) {
  const info = einheitInfo(einheit);
  const zahl = mengeFormatieren(menge);

  if (!zahl) return info.anzeige || '';
  if (!info.anzeige) return zahl;

  // Mehrzahl bei stückigen Einheiten
  let anzeige = info.anzeige;
  if (menge > 1 && ['Zehe', 'Scheibe', 'Dose', 'Packung', 'Prise'].includes(anzeige)) {
    anzeige = { Zehe: 'Zehen', Scheibe: 'Scheiben', Dose: 'Dosen', Packung: 'Packungen', Prise: 'Prisen' }[anzeige];
  }

  return `${zahl} ${anzeige}`;
}

// ---------------------------------------------------------------- Portionen umrechnen

/**
 * Rundet eine skalierte Menge auf etwas, das man einkaufen und abmessen kann.
 *
 * Bei Gramm und Millilitern in Schritten, die zur Größenordnung passen: 37 g werden
 * 35 g, nicht 37,4 g. Bei Stücken auf halbe: aus 1,5 Zwiebeln werden nicht 1,47.
 */
function sinnvollRunden(menge, einheit) {
  if (menge <= 0) return 0;

  const familie = einheitInfo(einheit).familie;

  if (familie === 'masse' || familie === 'volumen') {
    const schluessel = einheitNormalisieren(einheit);
    if (schluessel === 'kg' || schluessel === 'l') {
      return Math.round(menge * 100) / 100;
    }
    if (menge < 10) return Math.round(menge * 2) / 2;
    if (menge < 100) return Math.round(menge / 5) * 5;
    if (menge < 1000) return Math.round(menge / 10) * 10;
    return Math.round(menge / 50) * 50;
  }

  if (STUECKIG.has(familie)) {
    // Auf halbe runden, aber nie auf null - eine halbe Zwiebel ist das Minimum
    return Math.max(0.5, Math.round(menge * 2) / 2);
  }

  return Math.round(menge * 10) / 10;
}

/**
 * Rechnet die Zutaten eines Rezepts auf eine andere Portionszahl um.
 *
 * Zutaten mit skalierbar:false (Salz, Pfeffer, "nach Geschmack") bleiben, wie
 * sie sind - doppelte Portion heißt nicht doppelt so viel Salz.
 */
export function zutatenSkalieren(zutaten, vonPortionen, aufPortionen) {
  const faktor = (aufPortionen || 1) / (vonPortionen || 1);

  return (zutaten || []).map((zutat) => {
    if (faktor === 1 || zutat.skalierbar === false || zutat.menge === null || zutat.menge === undefined) {
      return { ...zutat };
    }
    return { ...zutat, menge: sinnvollRunden(zutat.menge * faktor, zutat.einheit) };
  });
}

// ---------------------------------------------------------------- Zutaten vergleichen

/** Häufige Mehrzahl- und Synonym-Fälle, die eine reine Textgleichheit verpasst. */
const NAME_SYNONYME = {
  knoblauchzehe: 'knoblauch', knoblauchzehen: 'knoblauch',
  hackfleisch: 'hack', rinderhack: 'hack', hack: 'hack',
  zwiebeln: 'zwiebel', tomaten: 'tomate', kartoffeln: 'kartoffel',
  eier: 'ei', möhren: 'karotte', karotten: 'karotte', mohrrüben: 'karotte',
  champignons: 'champignon', paprikaschoten: 'paprika',
  parmesankäse: 'parmesan', schlagsahne: 'sahne', kochsahne: 'sahne',
  spaghetti: 'pasta', nudeln: 'pasta', penne: 'pasta', tagliatelle: 'pasta',
  olivenöl: 'olivenöl', pflanzenöl: 'öl', sonnenblumenöl: 'öl',
  petersilie: 'petersilie', basilikumblätter: 'basilikum',
};

/**
 * Vergleichsschlüssel für einen Zutatennamen.
 *
 * Wird an drei Stellen gebraucht: Einkaufsliste zusammenrechnen, Vorrat abgleichen,
 * Doppelte erkennen. Absichtlich konservativ - lieber zwei Einträge auf der Liste
 * als "Sahne" und "Sahnesteif" zusammengeworfen.
 */
export function zutatSchluessel(name) {
  let s = (name || '').toString().toLowerCase().trim();

  s = s.replace(/\(.*?\)/g, ' ');            // Klammern raus
  s = s.replace(/[.,;:!?"'`´]/g, ' ');
  s = s.replace(/\b(frisch|frische|frischer|frisches|gehackt|gehackte|gehackter|gemahlen|gemahlene|getrocknet|getrocknete|klein|große|großer|kleine|kleiner|ca|etwas|optional)\b/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  if (NAME_SYNONYME[s]) return NAME_SYNONYME[s];

  // Letzte Chance: Mehrzahl-Endung abschneiden (nur bei längeren Wörtern,
  // sonst wird aus "Ei" ein leerer String)
  if (s.length > 5) {
    for (const endung of ['nen', 'en', 'er', 'n', 's']) {
      if (s.endsWith(endung)) {
        const stamm = s.slice(0, -endung.length);
        if (NAME_SYNONYME[stamm]) return NAME_SYNONYME[stamm];
      }
    }
  }

  return s;
}

// ---------------------------------------------------------------- Supermarktbereiche

export const BEREICHE = [
  { id: 'obst-gemuese', name: 'Obst & Gemüse', emoji: '🥕' },
  { id: 'kuehlung',     name: 'Kühlung',       emoji: '🥛' },
  { id: 'fleisch-fisch',name: 'Fleisch & Fisch', emoji: '🥩' },
  { id: 'vorrat',       name: 'Vorrat',        emoji: '🍝' },
  { id: 'backen',       name: 'Backen',        emoji: '🧁' },
  { id: 'tiefkuehl',    name: 'Tiefkühl',      emoji: '🧊' },
  { id: 'getraenke',    name: 'Getränke',      emoji: '🥤' },
  { id: 'gewuerze',     name: 'Gewürze',       emoji: '🧂' },
  { id: 'sonstiges',    name: 'Sonstiges',     emoji: '🛒' },
];

const BEREICH_IDS = new Set(BEREICHE.map((b) => b.id));

/**
 * Stichwort-Zuordnung für alles, was Lisa selbst auf die Liste tippt.
 *
 * Bei importierten Rezepten kommt der Bereich von Claude; diese Map ist der
 * Rückfall für Handeingaben und für alte Rezepte ohne Bereich.
 */
const BEREICH_STICHWORTE = [
  ['obst-gemuese', ['zwiebel', 'knoblauch', 'tomate', 'paprika', 'karotte', 'kartoffel', 'salat', 'gurke', 'zucchini', 'aubergine', 'brokkoli', 'blumenkohl', 'spinat', 'lauch', 'porree', 'sellerie', 'ingwer', 'chili', 'zitrone', 'limette', 'apfel', 'banane', 'beere', 'erdbeer', 'himbeer', 'blaubeer', 'avocado', 'mango', 'birne', 'pilz', 'champignon', 'petersilie', 'basilikum', 'koriander', 'schnittlauch', 'dill', 'rosmarin', 'thymian', 'minze', 'rucola', 'kohl', 'bohne', 'erbse', 'mais', 'kürbis', 'radieschen', 'rettich', 'frühlingszwiebel']],
  ['kuehlung', ['sahne', 'milch', 'butter', 'joghurt', 'quark', 'schmand', 'creme fraiche', 'crème', 'parmesan', 'käse', 'mozzarella', 'feta', 'gouda', 'mascarpone', 'ricotta', 'ei', 'eier', 'hefe', 'blätterteig', 'pizzateig', 'tofu', 'halloumi', 'skyr', 'buttermilch', 'margarine']],
  ['fleisch-fisch', ['hack', 'hackfleisch', 'rind', 'schwein', 'hähnchen', 'huhn', 'pute', 'lamm', 'speck', 'bacon', 'schinken', 'salami', 'wurst', 'chorizo', 'lachs', 'thunfisch', 'garnele', 'shrimp', 'fisch', 'kabeljau', 'forelle', 'steak', 'filet']],
  ['vorrat', ['pasta', 'nudel', 'spaghetti', 'penne', 'reis', 'quinoa', 'couscous', 'bulgur', 'linsen', 'kichererbse', 'polenta', 'öl', 'olivenöl', 'essig', 'balsamico', 'passierte tomaten', 'tomatenmark', 'tomatensoße', 'kokosmilch', 'brühe', 'fond', 'sojasoße', 'senf', 'ketchup', 'mayonnaise', 'honig', 'erdnussbutter', 'thunfisch in', 'konserve', 'dose', 'gnocchi', 'tortilla', 'wrap', 'brot', 'toast', 'semmelbrösel', 'panko', 'nuss', 'mandel', 'walnuss', 'cashew', 'haferflocken', 'müsli']],
  ['backen', ['mehl', 'zucker', 'puderzucker', 'vanillezucker', 'backpulver', 'natron', 'hefe', 'schokolade', 'kakao', 'schokotropfen', 'kuvertüre', 'speisestärke', 'vanille', 'marzipan', 'kokosraspel', 'rosine']],
  ['tiefkuehl', ['tiefkühl', 'tk ', 'gefroren', 'eis', 'spinat gefroren', 'beerenmischung']],
  ['getraenke', ['wasser', 'sprudel', 'saft', 'wein', 'bier', 'cola', 'limonade', 'kaffee', 'tee', 'sekt', 'prosecco']],
  ['gewuerze', ['salz', 'pfeffer', 'paprikapulver', 'kreuzkümmel', 'kümmel', 'curry', 'zimt', 'muskat', 'oregano', 'chiliflocken', 'currypulver', 'garam masala', 'lorbeer', 'nelke', 'kardamom', 'gewürz', 'brühwürfel', 'hefeflocken']],
];

/** Findet den Supermarktbereich zu einem Zutatennamen. */
export function bereichRaten(name) {
  const s = (name || '').toLowerCase();
  for (const [bereich, stichworte] of BEREICH_STICHWORTE) {
    if (stichworte.some((wort) => s.includes(wort))) return bereich;
  }
  return 'sonstiges';
}

/** Bereich aus dem Rezept übernehmen, wenn er gültig ist - sonst raten. */
export function bereichBestimmen(zutat) {
  if (zutat && BEREICH_IDS.has(zutat.bereich)) return zutat.bereich;
  return bereichRaten(zutat?.name);
}

export function bereichInfo(id) {
  return BEREICHE.find((b) => b.id === id) || BEREICHE[BEREICHE.length - 1];
}

// ---------------------------------------------------------------- Einkaufsliste

/**
 * Legt eine Zutat auf die Einkaufsliste - und zählt sie mit dem zusammen,
 * was schon draufsteht.
 *
 * Aus "250 g Hackfleisch" (Rezept 1) und "400 g Hackfleisch" (Rezept 2) wird
 * ein Eintrag "650 g Hackfleisch". Passen die Einheiten nicht zusammen (250 g
 * Tomaten und 1 Dose Tomaten), bleiben es zwei Einträge - alles andere wäre
 * geraten.
 *
 * Zutaten ohne Menge sind der Sonderfall: "Basilikum nach Geschmack" und
 * "½ Bund Basilikum" sind im Laden dasselbe Kraut. Die landen zusammen, und die
 * konkrete Menge gewinnt - zwei Zeilen für dieselbe Sache wären beim Einkaufen
 * nur verwirrend.
 *
 * Mutiert die übergebene Liste und gibt sie zurück.
 */
export function aufListe(liste, zutat, quelle = {}) {
  const schluessel = zutatSchluessel(zutat.name);
  const familie = einheitInfo(zutat.einheit).familie;
  const bereich = bereichBestimmen(zutat);
  const neueMenge = zutat.menge ?? null;

  const gleicherName = liste.filter((e) => !e.erledigt && e.schluessel === schluessel);

  // Erste Wahl: gleiche Einheiten-Familie, dann lässt sich wirklich addieren.
  // Zweite Wahl: eine der beiden Seiten hat gar keine Menge.
  const passend =
    gleicherName.find((e) => e.familie === familie && e.menge !== null && neueMenge !== null)
    || gleicherName.find((e) => e.menge === null || neueMenge === null);

  if (passend) {
    if (passend.menge !== null && neueMenge !== null) {
      // In der Basiseinheit der Familie addieren, damit 1 kg + 500 g stimmt
      const basisAlt = passend.menge * (EINHEITEN[einheitNormalisieren(passend.einheit)]?.faktor ?? 1);
      const basisNeu = neueMenge * (EINHEITEN[einheitNormalisieren(zutat.einheit)]?.faktor ?? 1);
      const schoen = schoeneEinheit(basisAlt + basisNeu, familie);
      passend.menge = schoen.menge;
      passend.einheit = schoen.einheit;
    } else if (passend.menge === null && neueMenge !== null) {
      // Der Eintrag stand bisher ohne Menge da - die konkrete Angabe ist besser
      passend.menge = neueMenge;
      passend.einheit = zutat.einheit || '';
      passend.familie = familie;
    }

    if (quelle.rezeptId && !passend.rezeptIds.includes(quelle.rezeptId)) {
      passend.rezeptIds.push(quelle.rezeptId);
    }
    if (zutat.hinweis && !passend.hinweis) passend.hinweis = zutat.hinweis;
    return liste;
  }

  liste.push({
    id: `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: zutat.name,
    schluessel,
    menge: zutat.menge ?? null,
    einheit: zutat.einheit || '',
    familie,
    hinweis: zutat.hinweis || '',
    bereich,
    erledigt: false,
    herkunft: quelle.rezeptId ? 'rezept' : 'manuell',
    rezeptIds: quelle.rezeptId ? [quelle.rezeptId] : [],
    angelegt: new Date().toISOString(),
  });

  return liste;
}

/** 1500 g werden zu 1,5 kg - aber 800 g bleiben 800 g. */
function schoeneEinheit(basismenge, familie) {
  if (familie === 'masse') {
    return basismenge >= 1000
      ? { menge: Math.round((basismenge / 1000) * 100) / 100, einheit: 'kg' }
      : { menge: Math.round(basismenge * 10) / 10, einheit: 'g' };
  }
  if (familie === 'volumen') {
    return basismenge >= 1000
      ? { menge: Math.round((basismenge / 1000) * 100) / 100, einheit: 'l' }
      : { menge: Math.round(basismenge * 10) / 10, einheit: 'ml' };
  }
  const eintrag = Object.entries(EINHEITEN).find(([, info]) => info.familie === familie);
  return { menge: Math.round(basismenge * 10) / 10, einheit: eintrag ? eintrag[0] : '' };
}

/** Ein ganzes Rezept auf die Liste - mit den Mengen für die aktuelle Portionszahl. */
export function rezeptAufListe(liste, rezept, portionen = null) {
  const ziel = portionen || rezept.portionen;
  const zutaten = zutatenSkalieren(rezept.zutaten, rezept.portionenOriginal || rezept.portionen, ziel);
  for (const zutat of zutaten) {
    aufListe(liste, zutat, { rezeptId: rezept.id });
  }
  return liste;
}

/** Gruppiert die Liste nach Supermarktbereich, in der Reihenfolge von BEREICHE. */
export function nachBereichen(liste) {
  const gruppen = [];
  for (const bereich of BEREICHE) {
    const eintraege = liste.filter((e) => e.bereich === bereich.id);
    if (eintraege.length) {
      gruppen.push({ ...bereich, eintraege });
    }
  }
  return gruppen;
}

// ---------------------------------------------------------------- Vorrat

/**
 * Zutaten, die praktisch immer da sind. Die zählen beim Vorrats-Abgleich nicht
 * als "fehlt mir", sonst kann man nie etwas kochen.
 */
export const IMMER_DA = ['salz', 'pfeffer', 'wasser', 'öl', 'olivenöl', 'zucker'];

/**
 * Vergleicht ein Rezept mit dem Vorrat.
 *
 * Returns: { habe, brauche, fehlt: [Namen], vollstaendig }
 */
export function vorratsAbgleich(rezept, vorrat) {
  const vorhanden = new Set((vorrat || []).map((v) => zutatSchluessel(v.name)));
  const immerDa = new Set(IMMER_DA.map(zutatSchluessel));

  const relevant = (rezept.zutaten || []).filter((z) => !immerDa.has(zutatSchluessel(z.name)));
  const fehlt = relevant.filter((z) => !vorhanden.has(zutatSchluessel(z.name)));

  return {
    brauche: relevant.length,
    habe: relevant.length - fehlt.length,
    fehlt: fehlt.map((z) => z.name),
    vollstaendig: fehlt.length === 0 && relevant.length > 0,
  };
}
