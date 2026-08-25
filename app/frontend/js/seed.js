/**
 * Beispielrezepte für den ersten Start.
 *
 * Zwei Gründe: eine leere App ist keine schöne Begrüßung, und ohne API-Key
 * lässt sich damit alles ausprobieren - Portionsrechner, Einkaufsliste,
 * Wochenplan, Würfeln, Vorrat.
 *
 * Löschbar wie jedes andere Rezept. Sie kommen nicht wieder.
 */

const jetzt = new Date().toISOString();

function rezept(id, titel, felder) {
  return {
    id,
    titel,
    bildKey: null,
    favorit: false,
    bewertung: null,
    eigeneNotizen: '',
    wiederKochen: null,
    angelegt: jetzt,
    gekocht: null,
    unsicherheiten: [],
    notizen: '',
    quelle: { art: 'beispiel', url: '', creator: '', caption: '' },
    ...felder,
    portionenOriginal: felder.portionen,
  };
}

export const SEED_REZEPTE = [
  rezept('r_seed_pasta', 'Creamy Garlic Pasta', {
    beschreibung: 'Cremige Knoblauch-Pasta mit Parmesan und frischer Petersilie. Schnell gemacht und unglaublich lecker.',
    portionen: 2,
    zeit: { gesamt: 25, vorbereitung: 5, kochen: 20 },
    schwierigkeit: 'einfach',
    tags: ['pasta', 'schnell', 'vegetarisch', 'comfort-food'],
    favorit: true,
    zutaten: [
      { name: 'Pasta', menge: 250, einheit: 'g', hinweis: 'z. B. Spaghetti', bereich: 'vorrat', skalierbar: true },
      { name: 'Sahne', menge: 200, einheit: 'ml', hinweis: '', bereich: 'kuehlung', skalierbar: true },
      { name: 'Knoblauch', menge: 3, einheit: 'zehe', hinweis: 'fein gehackt', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Parmesan', menge: 50, einheit: 'g', hinweis: 'frisch gerieben', bereich: 'kuehlung', skalierbar: true },
      { name: 'Olivenöl', menge: 2, einheit: 'el', hinweis: '', bereich: 'vorrat', skalierbar: false },
      { name: 'Salz', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'gewuerze', skalierbar: false },
      { name: 'Pfeffer', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'gewuerze', skalierbar: false },
      { name: 'Petersilie', menge: 0.5, einheit: 'bund', hinweis: 'frisch', bereich: 'obst-gemuese', skalierbar: true },
    ],
    schritte: [
      { text: 'Pasta in reichlich Salzwasser al dente kochen. Eine Tasse Kochwasser aufbewahren, bevor du abgießt.', minuten: 10, temperatur: null },
      { text: 'Olivenöl in einer großen Pfanne erhitzen und den Knoblauch bei mittlerer Hitze zwei Minuten anschwitzen. Er soll duften, nicht braun werden.', minuten: 2, temperatur: 'mittlere Hitze' },
      { text: 'Sahne dazugießen und fünf Minuten leicht einkochen lassen. Parmesan einrühren, bis die Soße glatt ist.', minuten: 5, temperatur: null },
      { text: 'Pasta in die Pfanne geben und mischen. Mit dem Kochwasser die Soße auf die richtige Konsistenz bringen.', minuten: 2, temperatur: null },
      { text: 'Mit Salz und Pfeffer abschmecken, Petersilie darüber. Sofort essen.', minuten: null, temperatur: null },
    ],
    notizen: 'Das Kochwasser ist der Trick - dadurch klebt die Soße an der Pasta statt am Teller.',
  }),

  rezept('r_seed_onepot', 'One Pot Tomaten Pasta', {
    beschreibung: 'Alles in einen Topf, einmal umrühren, zwanzig Minuten später Abendessen. Die Pasta kocht in der Soße mit.',
    portionen: 2,
    zeit: { gesamt: 20, vorbereitung: 5, kochen: 15 },
    schwierigkeit: 'einfach',
    tags: ['pasta', 'schnell', 'one-pot', 'vegetarisch'],
    zutaten: [
      { name: 'Pasta', menge: 250, einheit: 'g', hinweis: 'z. B. Penne', bereich: 'vorrat', skalierbar: true },
      { name: 'Passierte Tomaten', menge: 400, einheit: 'g', hinweis: '', bereich: 'vorrat', skalierbar: true },
      { name: 'Zwiebel', menge: 1, einheit: '', hinweis: 'gewürfelt', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Knoblauch', menge: 2, einheit: 'zehe', hinweis: '', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Gemüsebrühe', menge: 400, einheit: 'ml', hinweis: '', bereich: 'vorrat', skalierbar: true },
      { name: 'Olivenöl', menge: 1, einheit: 'el', hinweis: '', bereich: 'vorrat', skalierbar: false },
      { name: 'Oregano', menge: 1, einheit: 'tl', hinweis: 'getrocknet', bereich: 'gewuerze', skalierbar: false },
      { name: 'Parmesan', menge: 40, einheit: 'g', hinweis: 'zum Servieren', bereich: 'kuehlung', skalierbar: true },
      { name: 'Basilikum', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'obst-gemuese', skalierbar: false },
    ],
    schritte: [
      { text: 'Zwiebel und Knoblauch im Öl in einem weiten Topf drei Minuten anschwitzen.', minuten: 3, temperatur: 'mittlere Hitze' },
      { text: 'Pasta, passierte Tomaten, Brühe und Oregano dazu. Alles einmal umrühren, sodass die Pasta bedeckt ist.', minuten: null, temperatur: null },
      { text: 'Ohne Deckel bei mittlerer Hitze zwölf Minuten köcheln lassen. Alle drei Minuten umrühren, damit nichts ansetzt.', minuten: 12, temperatur: 'mittlere Hitze' },
      { text: 'Vom Herd nehmen, zwei Minuten ruhen lassen - die Soße zieht nach. Mit Parmesan und Basilikum servieren.', minuten: 2, temperatur: null },
    ],
    notizen: 'Wenn die Soße zu dick wird, einfach einen Schluck Wasser nachgeben.',
  }),

  rezept('r_seed_chili', 'Chili sin Carne', {
    beschreibung: 'Herzhaftes Chili mit Bohnen und Linsen statt Hackfleisch. Am zweiten Tag noch besser.',
    portionen: 4,
    zeit: { gesamt: 35, vorbereitung: 10, kochen: 25 },
    schwierigkeit: 'mittel',
    tags: ['vegetarisch', 'high-protein', 'comfort-food', 'meal-prep'],
    favorit: true,
    zutaten: [
      { name: 'Kidneybohnen', menge: 1, einheit: 'dose', hinweis: '400 g, abgetropft', bereich: 'vorrat', skalierbar: true },
      { name: 'Mais', menge: 1, einheit: 'dose', hinweis: '300 g, abgetropft', bereich: 'vorrat', skalierbar: true },
      { name: 'Rote Linsen', menge: 100, einheit: 'g', hinweis: '', bereich: 'vorrat', skalierbar: true },
      { name: 'Gehackte Tomaten', menge: 800, einheit: 'g', hinweis: '2 Dosen', bereich: 'vorrat', skalierbar: true },
      { name: 'Zwiebel', menge: 2, einheit: '', hinweis: 'gewürfelt', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Paprika', menge: 2, einheit: '', hinweis: 'rot, gewürfelt', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Knoblauch', menge: 3, einheit: 'zehe', hinweis: '', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Tomatenmark', menge: 2, einheit: 'el', hinweis: '', bereich: 'vorrat', skalierbar: true },
      { name: 'Gemüsebrühe', menge: 300, einheit: 'ml', hinweis: '', bereich: 'vorrat', skalierbar: true },
      { name: 'Kreuzkümmel', menge: 2, einheit: 'tl', hinweis: 'gemahlen', bereich: 'gewuerze', skalierbar: false },
      { name: 'Paprikapulver', menge: 1, einheit: 'el', hinweis: 'geräuchert', bereich: 'gewuerze', skalierbar: false },
      { name: 'Chiliflocken', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'gewuerze', skalierbar: false },
      { name: 'Olivenöl', menge: 2, einheit: 'el', hinweis: '', bereich: 'vorrat', skalierbar: false },
    ],
    schritte: [
      { text: 'Zwiebeln, Paprika und Knoblauch im Öl fünf Minuten anbraten, bis die Zwiebeln glasig sind.', minuten: 5, temperatur: 'mittlere Hitze' },
      { text: 'Tomatenmark, Kreuzkümmel und Paprikapulver dazu und eine Minute mitrösten. Das nimmt dem Tomatenmark die Säure.', minuten: 1, temperatur: null },
      { text: 'Linsen, gehackte Tomaten und Brühe einrühren, aufkochen und zwanzig Minuten bei kleiner Hitze köcheln lassen.', minuten: 20, temperatur: 'kleine Hitze' },
      { text: 'Bohnen und Mais unterrühren und fünf Minuten mitziehen lassen. Mit Salz, Pfeffer und Chiliflocken abschmecken.', minuten: 5, temperatur: null },
    ],
    notizen: 'Ein Löffel Schmand oder ein Stück dunkle Schokolade am Ende macht es runder.',
  }),

  rezept('r_seed_pancakes', 'Pancake Stack', {
    beschreibung: 'Fluffige amerikanische Pancakes, gestapelt. Sonntagsfrühstück in zwanzig Minuten.',
    portionen: 2,
    zeit: { gesamt: 20, vorbereitung: 5, kochen: 15 },
    schwierigkeit: 'einfach',
    tags: ['süß', 'frühstück', 'schnell', 'vegetarisch'],
    zutaten: [
      { name: 'Mehl', menge: 200, einheit: 'g', hinweis: '', bereich: 'backen', skalierbar: true },
      { name: 'Milch', menge: 250, einheit: 'ml', hinweis: '', bereich: 'kuehlung', skalierbar: true },
      { name: 'Ei', menge: 2, einheit: '', hinweis: '', bereich: 'kuehlung', skalierbar: true },
      { name: 'Zucker', menge: 2, einheit: 'el', hinweis: '', bereich: 'backen', skalierbar: true },
      { name: 'Backpulver', menge: 2, einheit: 'tl', hinweis: '', bereich: 'backen', skalierbar: true },
      { name: 'Butter', menge: 30, einheit: 'g', hinweis: 'geschmolzen, plus etwas für die Pfanne', bereich: 'kuehlung', skalierbar: true },
      { name: 'Salz', menge: 1, einheit: 'prise', hinweis: '', bereich: 'gewuerze', skalierbar: false },
      { name: 'Ahornsirup', menge: null, einheit: '', hinweis: 'zum Servieren', bereich: 'vorrat', skalierbar: false },
      { name: 'Beeren', menge: 150, einheit: 'g', hinweis: 'frisch oder gefroren', bereich: 'obst-gemuese', skalierbar: true },
    ],
    schritte: [
      { text: 'Mehl, Zucker, Backpulver und Salz in einer Schüssel mischen.', minuten: null, temperatur: null },
      { text: 'Milch, Eier und geschmolzene Butter verquirlen und zu den trockenen Zutaten geben. Nur so lange rühren, bis kein Mehl mehr trocken ist - kleine Klümpchen dürfen bleiben.', minuten: 2, temperatur: null },
      { text: 'Teig fünf Minuten ruhen lassen. In dieser Zeit fängt das Backpulver an zu arbeiten.', minuten: 5, temperatur: null },
      { text: 'In einer beschichteten Pfanne bei mittlerer Hitze portionsweise ausbacken: etwa zwei Minuten, bis Blasen aufsteigen, dann wenden und eine Minute fertig backen.', minuten: 12, temperatur: 'mittlere Hitze' },
      { text: 'Stapeln, Beeren darauf, Sirup drüber.', minuten: null, temperatur: null },
    ],
    notizen: 'Nicht zu heiß backen, sonst sind sie außen dunkel und innen roh.',
  }),

  rezept('r_seed_schokokuchen', 'Schoko-Bananen-Kuchen', {
    beschreibung: 'Saftiger Schokokuchen, der reife Bananen sinnvoll verwertet. Ohne Mixer machbar.',
    portionen: 12,
    zeit: { gesamt: 60, vorbereitung: 15, kochen: 45 },
    schwierigkeit: 'mittel',
    tags: ['süß', 'backen', 'schoko', 'vegetarisch'],
    zutaten: [
      { name: 'Bananen', menge: 3, einheit: '', hinweis: 'sehr reif', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Mehl', menge: 250, einheit: 'g', hinweis: '', bereich: 'backen', skalierbar: true },
      { name: 'Zucker', menge: 150, einheit: 'g', hinweis: '', bereich: 'backen', skalierbar: true },
      { name: 'Kakao', menge: 40, einheit: 'g', hinweis: 'ungesüßt', bereich: 'backen', skalierbar: true },
      { name: 'Butter', menge: 150, einheit: 'g', hinweis: 'weich', bereich: 'kuehlung', skalierbar: true },
      { name: 'Ei', menge: 3, einheit: '', hinweis: '', bereich: 'kuehlung', skalierbar: true },
      { name: 'Backpulver', menge: 2, einheit: 'tl', hinweis: '', bereich: 'backen', skalierbar: true },
      { name: 'Schokotropfen', menge: 100, einheit: 'g', hinweis: 'zartbitter', bereich: 'backen', skalierbar: true },
      { name: 'Salz', menge: 1, einheit: 'prise', hinweis: '', bereich: 'gewuerze', skalierbar: false },
    ],
    schritte: [
      { text: 'Ofen auf 180 °C Ober-/Unterhitze vorheizen und eine Kastenform fetten.', minuten: null, temperatur: '180 °C Ober-/Unterhitze' },
      { text: 'Bananen mit einer Gabel zu Mus zerdrücken.', minuten: 3, temperatur: null },
      { text: 'Butter und Zucker hell und schaumig rühren, Eier einzeln unterrühren, dann das Bananenmus.', minuten: 5, temperatur: null },
      { text: 'Mehl, Kakao, Backpulver und Salz mischen und unterheben. Zum Schluss die Schokotropfen.', minuten: 3, temperatur: null },
      { text: 'In die Form füllen und 45 Minuten backen. Stäbchenprobe: es darf feucht sein, aber nicht flüssig.', minuten: 45, temperatur: '180 °C' },
      { text: 'In der Form abkühlen lassen, dann stürzen.', minuten: null, temperatur: null },
    ],
    notizen: 'Je brauner die Bananen, desto besser. Schwarze Schalen sind hier ein Qualitätsmerkmal.',
  }),

  rezept('r_seed_avocadopasta', 'Avocado Pasta', {
    beschreibung: 'Kalte Avocado-Limetten-Soße auf warmer Pasta. Fünfzehn Minuten, kein Kochen außer der Nudeln.',
    portionen: 2,
    zeit: { gesamt: 15, vorbereitung: 10, kochen: 10 },
    schwierigkeit: 'einfach',
    tags: ['pasta', 'schnell', 'vegetarisch', 'frisch'],
    zutaten: [
      { name: 'Pasta', menge: 250, einheit: 'g', hinweis: 'z. B. Linguine', bereich: 'vorrat', skalierbar: true },
      { name: 'Avocado', menge: 2, einheit: '', hinweis: 'reif', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Limette', menge: 1, einheit: '', hinweis: 'Saft', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Knoblauch', menge: 1, einheit: 'zehe', hinweis: '', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Basilikum', menge: 0.5, einheit: 'bund', hinweis: 'frisch', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Olivenöl', menge: 3, einheit: 'el', hinweis: '', bereich: 'vorrat', skalierbar: false },
      { name: 'Parmesan', menge: 30, einheit: 'g', hinweis: 'optional', bereich: 'kuehlung', skalierbar: true },
      { name: 'Salz', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'gewuerze', skalierbar: false },
      { name: 'Pfeffer', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'gewuerze', skalierbar: false },
    ],
    schritte: [
      { text: 'Pasta in Salzwasser al dente kochen, eine halbe Tasse Kochwasser abnehmen.', minuten: 10, temperatur: null },
      { text: 'Avocado, Limettensaft, Knoblauch, Basilikum und Olivenöl im Mixer oder mit der Gabel zu einer Creme verarbeiten.', minuten: 4, temperatur: null },
      { text: 'Abgetropfte Pasta mit der Creme mischen, mit dem Kochwasser cremig rühren.', minuten: 1, temperatur: null },
      { text: 'Salzen, pfeffern, Parmesan darüber. Am besten sofort essen - die Soße verfärbt sich sonst.', minuten: null, temperatur: null },
    ],
    notizen: 'Ohne Parmesan ist das Rezept vegan.',
  }),

  rezept('r_seed_lachs', 'Ofenlachs mit Gemüse', {
    beschreibung: 'Ein Blech, zwei Handgriffe: Lachs und Gemüse zusammen in den Ofen.',
    portionen: 2,
    zeit: { gesamt: 35, vorbereitung: 10, kochen: 25 },
    schwierigkeit: 'einfach',
    tags: ['high-protein', 'fisch', 'ofen', 'gesund'],
    zutaten: [
      { name: 'Lachsfilet', menge: 2, einheit: '', hinweis: 'je ca. 150 g', bereich: 'fleisch-fisch', skalierbar: true },
      { name: 'Zucchini', menge: 1, einheit: '', hinweis: 'in Scheiben', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Kirschtomaten', menge: 250, einheit: 'g', hinweis: '', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Kartoffeln', menge: 400, einheit: 'g', hinweis: 'in Spalten', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Zitrone', menge: 1, einheit: '', hinweis: 'in Scheiben', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Olivenöl', menge: 3, einheit: 'el', hinweis: '', bereich: 'vorrat', skalierbar: false },
      { name: 'Rosmarin', menge: 2, einheit: '', hinweis: 'Zweige', bereich: 'obst-gemuese', skalierbar: false },
      { name: 'Salz', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'gewuerze', skalierbar: false },
      { name: 'Pfeffer', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'gewuerze', skalierbar: false },
    ],
    schritte: [
      { text: 'Ofen auf 200 °C Umluft vorheizen.', minuten: null, temperatur: '200 °C Umluft' },
      { text: 'Kartoffelspalten mit zwei Esslöffeln Öl, Salz und Rosmarin mischen und auf dem Blech fünfzehn Minuten vorbacken.', minuten: 15, temperatur: '200 °C Umluft' },
      { text: 'Zucchini und Tomaten dazugeben, Lachs darauf setzen, mit dem restlichen Öl bestreichen, salzen und pfeffern. Zitronenscheiben obendrauf.', minuten: 5, temperatur: null },
      { text: 'Weitere zwölf bis fünfzehn Minuten backen, bis der Lachs innen glasig ist.', minuten: 14, temperatur: '200 °C Umluft' },
    ],
    notizen: 'Der Lachs ist fertig, wenn er sich mit der Gabel in Segmente teilen lässt.',
  }),

  rezept('r_seed_bowl', 'Veggie Bowl', {
    beschreibung: 'Bunte Schüssel mit Kichererbsen, Quinoa und Joghurt-Dressing. Gut vorzubereiten.',
    portionen: 2,
    zeit: { gesamt: 20, vorbereitung: 10, kochen: 15 },
    schwierigkeit: 'einfach',
    tags: ['vegetarisch', 'high-protein', 'bowl', 'meal-prep'],
    zutaten: [
      { name: 'Quinoa', menge: 150, einheit: 'g', hinweis: '', bereich: 'vorrat', skalierbar: true },
      { name: 'Kichererbsen', menge: 1, einheit: 'dose', hinweis: '400 g, abgetropft', bereich: 'vorrat', skalierbar: true },
      { name: 'Gurke', menge: 0.5, einheit: '', hinweis: 'gewürfelt', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Kirschtomaten', menge: 150, einheit: 'g', hinweis: 'halbiert', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Rotkohl', menge: 100, einheit: 'g', hinweis: 'fein gehobelt', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Joghurt', menge: 150, einheit: 'g', hinweis: 'griechisch', bereich: 'kuehlung', skalierbar: true },
      { name: 'Zitrone', menge: 0.5, einheit: '', hinweis: 'Saft', bereich: 'obst-gemuese', skalierbar: true },
      { name: 'Olivenöl', menge: 2, einheit: 'el', hinweis: '', bereich: 'vorrat', skalierbar: false },
      { name: 'Paprikapulver', menge: 1, einheit: 'tl', hinweis: 'geräuchert', bereich: 'gewuerze', skalierbar: false },
      { name: 'Salz', menge: null, einheit: '', hinweis: 'nach Geschmack', bereich: 'gewuerze', skalierbar: false },
    ],
    schritte: [
      { text: 'Quinoa nach Packungsanweisung in Salzwasser garen, etwa fünfzehn Minuten, dann abkühlen lassen.', minuten: 15, temperatur: null },
      { text: 'Kichererbsen mit einem Esslöffel Öl und dem Paprikapulver in der Pfanne fünf Minuten rösten, bis sie knuspern.', minuten: 5, temperatur: 'mittlere Hitze' },
      { text: 'Joghurt mit Zitronensaft, dem restlichen Öl und Salz zu einem Dressing verrühren.', minuten: 2, temperatur: null },
      { text: 'Alles in zwei Schüsseln anrichten, Dressing darüber.', minuten: null, temperatur: null },
    ],
    notizen: 'Hält sich zwei Tage im Kühlschrank, wenn das Dressing separat bleibt.',
  }),
];

/**
 * Was am Anfang im Vorratsschrank steht.
 *
 * Bewusst das übliche Grundsortiment - damit der Abgleich auf der Vorratsseite
 * beim ersten Öffnen etwas zu zeigen hat und nicht "da fehlt alles" meldet.
 */
export const SEED_VORRAT = [
  'Pasta', 'Reis', 'Mehl', 'Zucker',
  'Ei', 'Milch', 'Butter', 'Sahne', 'Parmesan',
  'Zwiebel', 'Knoblauch', 'Tomate',
];
