/**
 * Food-Doodles und Platzhalterbilder.
 *
 * Handgezeichnete Deko als Inline-SVG - damit die App nicht wie ein Formular
 * aussieht. Alle Doodles erben ihre Farbe von currentColor, laufen also im
 * Dark Mode mit.
 */

const DOODLES = {
  herz: `<path d="M12 21s-7.5-4.7-9.3-9.2C1.2 8.1 3.4 4.5 7 4.5c2 0 3.6 1.1 4.5 2.6.9-1.5 2.5-2.6 4.5-2.6 3.6 0 5.8 3.6 4.3 7.3C19.5 16.3 12 21 12 21z"/>`,

  knoblauch: `<path d="M12 3c.6 1.4.4 2.3-.2 3.1M12 6c3.4 1 5.5 3.9 5.5 7.3 0 3.6-2.5 6.2-5.5 6.2s-5.5-2.6-5.5-6.2C6.5 9.9 8.6 7 12 6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12 6.5v13M9 8.2c-.8 1.7-1 3.4-.8 5.3M15 8.2c.8 1.7 1 3.4.8 5.3" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>`,

  tomate: `<circle cx="12" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 7V5M12 7c-1.6-1-3-1.2-4.3-.8M12 7c1.6-1 3-1.2 4.3-.8M9.5 11.5c-.7 1-1 2.1-.9 3.3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,

  kraeuter: `<path d="M12 21c0-5 1.5-9 5-12M12 21c0-4-1.3-7.5-4.2-10.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M14.5 11.5c1.8-.2 3.2-1.4 3.7-3.2-1.9-.3-3.5.5-4.3 2.1M9.5 13.5c-1.7-.3-3-1.5-3.4-3.2 1.8-.2 3.3.6 4 2.2M15.8 7.4c1.4-.7 2.2-2.1 2.1-3.7-1.7.4-2.9 1.6-3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,

  erdbeere: `<path d="M12 21c-3.6 0-6.5-3.1-6.5-6.4 0-2.6 2.9-5.1 6.5-5.1s6.5 2.5 6.5 5.1c0 3.3-2.9 6.4-6.5 6.4z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 9.5V6.5M9 7c1-1 2-1.5 3-1.5s2 .5 3 1.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="10" cy="14" r=".7"/><circle cx="14" cy="13.5" r=".7"/><circle cx="12" cy="16.5" r=".7"/>`,

  loeffel: `<path d="M14 10.5 6 20.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="16" cy="7.5" rx="3.4" ry="4.4" transform="rotate(35 16 7.5)" fill="none" stroke="currentColor" stroke-width="1.4"/>`,

  nudel: `<path d="M4 8c2.5-2 5-2 7.5 0s5 2 7.5 0M4 13c2.5-2 5-2 7.5 0s5 2 7.5 0M4 18c2.5-2 5-2 7.5 0s5 2 7.5 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,

  funke: `<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.2 6.2l3 3M14.8 14.8l3 3M17.8 6.2l-3 3M9.2 14.8l-3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
};

/**
 * Ein Doodle als SVG-Markup.
 * @param {string} name  Schlüssel aus DOODLES
 * @param {object} opt   { groesse, klasse }
 */
export function doodle(name, opt = {}) {
  const pfad = DOODLES[name];
  if (!pfad) return '';
  const groesse = opt.groesse || 24;
  const klasse = opt.klasse ? ` class="${opt.klasse}"` : '';
  return `<svg${klasse} width="${groesse}" height="${groesse}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${pfad}</svg>`;
}

/** Herzchen für Favoriten - gefüllt oder als Umriss. */
export function herz(gefuellt) {
  return gefuellt
    ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${DOODLES.herz}</svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${DOODLES.herz}</svg>`;
}

/**
 * Streut ein paar Doodles als Deko in eine Ecke.
 * Rein dekorativ, deshalb aria-hidden und pointer-events: none per CSS.
 */
export function dekoEcke(namen = ['knoblauch', 'tomate', 'kraeuter']) {
  return `<div class="deko" aria-hidden="true">${namen
    .map((n, i) => `<span class="deko-${i + 1}">${doodle(n, { groesse: 34 })}</span>`)
    .join('')}</div>`;
}

// ---------------------------------------------------------------- Platzhalterbild

/**
 * Passendes Emoji zum Rezept - für Rezepte ohne Foto.
 * Erst die Tags, dann der Titel, dann das Universal-Gedeck.
 */
const EMOJI_STICHWORTE = [
  [['pasta', 'nudel', 'spaghetti', 'carbonara', 'lasagne'], '🍝'],
  [['pizza', 'focaccia'], '🍕'],
  [['taco', 'burrito', 'quesadilla'], '🌮'],
  [['curry', 'dal', 'masala'], '🍛'],
  [['suppe', 'soup', 'ramen', 'eintopf', 'brühe'], '🍲'],
  [['salat', 'salad', 'bowl'], '🥗'],
  [['pancake', 'pfannkuchen', 'waffel', 'crepe'], '🥞'],
  [['kuchen', 'cake', 'torte', 'brownie', 'muffin', 'keks', 'cookie'], '🍰'],
  [['schoko', 'chocolate'], '🍫'],
  [['chili', 'bohnen', 'scharf'], '🌶️'],
  [['fisch', 'lachs', 'garnele', 'shrimp'], '🐟'],
  [['burger', 'sandwich', 'toast'], '🍔'],
  [['reis', 'rice', 'risotto'], '🍚'],
  [['kartoffel', 'pommes', 'gratin'], '🥔'],
  [['ei', 'omelett', 'frühstück'], '🍳'],
  [['brot', 'bread', 'brötchen'], '🍞'],
  [['smoothie', 'shake', 'drink'], '🥤'],
  [['avocado'], '🥑'],
  [['huhn', 'hähnchen', 'chicken', 'pute'], '🍗'],
  [['vegetarisch', 'vegan', 'veggie', 'gemüse'], '🥦'],
];

export function rezeptEmoji(rezept) {
  const heuhaufen = [
    ...(rezept.tags || []),
    (rezept.titel || '').toLowerCase(),
  ].join(' ');

  for (const [worte, emoji] of EMOJI_STICHWORTE) {
    if (worte.some((w) => heuhaufen.includes(w))) return emoji;
  }
  return '🍽️';
}

/**
 * Vier Farbstimmungen für Platzhalter, damit ein Grid ohne Fotos nicht
 * einfarbig aussieht. Die Wahl hängt am Titel, bleibt also stabil.
 */
const STIMMUNGEN = ['warm', 'rose', 'creme', 'beere'];

export function platzhalterStimmung(rezept) {
  const text = rezept.titel || rezept.id || '';
  let summe = 0;
  for (let i = 0; i < text.length; i++) summe += text.charCodeAt(i);
  return STIMMUNGEN[summe % STIMMUNGEN.length];
}

/** Markup für ein Rezeptbild - echtes Foto, wenn da, sonst Doodle-Platzhalter. */
export function bildMarkup(rezept, bildUrl, klasse = '') {
  if (bildUrl) {
    return `<img class="rezept-bild ${klasse}" src="${bildUrl}" alt="${escape(rezept.titel)}" loading="lazy">`;
  }
  const stimmung = platzhalterStimmung(rezept);
  return `
    <div class="rezept-bild platzhalter stimmung-${stimmung} ${klasse}" role="img" aria-label="${escape(rezept.titel)}">
      <span class="platzhalter-emoji">${rezeptEmoji(rezept)}</span>
      <span class="platzhalter-doodle">${doodle('kraeuter', { groesse: 40 })}</span>
      <span class="platzhalter-doodle zwei">${doodle('tomate', { groesse: 30 })}</span>
    </div>`;
}

/** Kleiner Helfer, damit Titel mit Anführungszeichen kein Markup zerlegen. */
function escape(text) {
  return (text || '').replace(/[&<>"']/g, (z) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[z]));
}
