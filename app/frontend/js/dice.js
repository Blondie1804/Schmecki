/**
 * "Was soll ich heute kochen?"
 *
 * Ein Knopf, ein Zufallsrezept, ein paar Filter. Die wichtigste Seite der App,
 * wenn man um 18:30 vor dem offenen Kühlschrank steht.
 */

import * as store from './store.js';
import { vorratsAbgleich } from './ingredients.js';
import { esc, zeitText, schwierigkeitText, toast } from './ui.js';
import { rezeptEmoji, dekoEcke } from './doodles.js';

const FILTER = [
  { id: 'schnell',   text: '⏱️ Unter 20 Min.',   passt: (r) => (r.zeit?.gesamt || 99) <= 20 },
  { id: 'einfach',   text: '😌 Wenig Aufwand',    passt: (r) => r.schwierigkeit === 'einfach' },
  { id: 'veggie',    text: '🥦 Vegetarisch',      passt: (r) => hatTag(r, ['vegetarisch', 'vegan', 'veggie']) },
  { id: 'protein',   text: '💪 High Protein',     passt: (r) => hatTag(r, ['high-protein', 'protein']) },
  { id: 'comfort',   text: '🫂 Comfort Food',     passt: (r) => hatTag(r, ['comfort-food', 'comfort']) },
  { id: 'suess',     text: '🍰 Süßes',            passt: (r) => hatTag(r, ['süß', 'suess', 'backen', 'dessert']) },
  { id: 'favorit',   text: '❤️ Nur Favoriten',    passt: (r) => r.favorit },
  { id: 'vorrat',    text: '🧄 Habe ich zuhause', passt: (r) => vorratsAbgleich(r, store.vorrat()).vollstaendig },
];

const WALZE_EMOJIS = ['🍝', '🌮', '🍛', '🥗', '🍕', '🥞', '🍲', '🍚', '🍰', '🌶️', '🍳', '🥑'];

// Zustand überlebt Seitenwechsel: Filter und letztes Ergebnis
const zustand = { aktive: new Set(), ergebnis: null };

function hatTag(r, gesuchte) {
  const tags = (r.tags || []).map((t) => t.toLowerCase());
  return gesuchte.some((g) => tags.includes(g));
}

export function zeichnen(ziel) {
  const rezepte = store.rezepte();
  const topf = kandidaten(rezepte);

  ziel.innerHTML = `
    <section class="wuerfel-buehne">
      ${dekoEcke(['tomate', 'kraeuter', 'erdbeere'])}
      <h1>Was soll ich heute kochen?</h1>
      <p class="leise">Lass dich überraschen.</p>

      <div class="walze" data-walze aria-hidden="true">${zustand.ergebnis ? rezeptEmoji(zustand.ergebnis) : '🎰'}</div>

      <div data-ergebnis-box>
        ${zustand.ergebnis ? ergebnisHtml(zustand.ergebnis) : `
          <p class="leise" style="max-width:34ch;margin:0 auto 20px">
            ${topf.length
              ? `${topf.length} ${topf.length === 1 ? 'Rezept passt' : 'Rezepte passen'} zu deinen Filtern.`
              : 'Mit diesen Filtern passt gerade nichts.'}
          </p>`}
      </div>

      <button type="button" class="knopf" data-wuerfeln ${topf.length ? '' : 'disabled'}>
        ${zustand.ergebnis ? 'Noch einmal würfeln 🎲' : 'Würfeln 🎲'}
      </button>
    </section>

    <section class="abschnitt">
      <h2>🔎 Eingrenzen</h2>
      <div class="chips">
        ${FILTER.map((f) => `
          <button type="button" class="chip ${zustand.aktive.has(f.id) ? 'aktiv' : ''}" data-f="${f.id}">
            ${f.text}
          </button>`).join('')}
        ${zustand.aktive.size ? '<button type="button" class="knopf-3" data-filter-weg>zurücksetzen</button>' : ''}
      </div>
      <p class="feld-hilfe">
        ${topf.length} von ${rezepte.length} Rezepten kommen in den Topf.
      </p>
    </section>
  `;

  verdrahten(ziel);
}

function kandidaten(rezepte) {
  const aktive = FILTER.filter((f) => zustand.aktive.has(f.id));
  return rezepte.filter((r) => aktive.every((f) => f.passt(r)));
}

function ergebnisHtml(r) {
  const abgleich = vorratsAbgleich(r, store.vorrat());

  return `
    <div class="wuerfel-ergebnis" data-oeffnen="${esc(r.id)}">
      <div class="vorspann">Heute gibt's...</div>
      <div class="gericht">${esc(r.titel)}</div>
      <div class="meta-reihe" style="justify-content:center;margin:0">
        ${r.zeit?.gesamt ? `<span class="meta">⏱️ ${zeitText(r.zeit.gesamt)}</span>` : ''}
        <span class="meta">⭐ ${schwierigkeitText(r.schwierigkeit)}</span>
        <span class="meta">🍽️ ${r.portionen}</span>
      </div>
      ${abgleich.brauche ? `
        <p class="klein leise" style="margin:10px 0 0">
          ${abgleich.vollstaendig
            ? '✅ Alles da, was du brauchst'
            : `🛒 Dir ${abgleich.fehlt.length === 1 ? 'fehlt' : 'fehlen'} noch: ${esc(abgleich.fehlt.slice(0, 4).join(', '))}${abgleich.fehlt.length > 4 ? ' …' : ''}`}
        </p>` : ''}
      <p class="klein leise" style="margin:8px 0 0">Tippen zum Öffnen</p>
    </div>`;
}

function verdrahten(ziel) {
  const neu = () => zeichnen(ziel);

  for (const c of ziel.querySelectorAll('[data-f]')) {
    c.addEventListener('click', () => {
      const id = c.dataset.f;
      if (zustand.aktive.has(id)) zustand.aktive.delete(id);
      else zustand.aktive.add(id);

      // Passt das alte Ergebnis noch zu den neuen Filtern?
      if (zustand.ergebnis && !kandidaten([zustand.ergebnis]).length) {
        zustand.ergebnis = null;
      }
      neu();
    });
  }

  ziel.querySelector('[data-filter-weg]')?.addEventListener('click', () => {
    zustand.aktive.clear();
    neu();
  });

  ziel.querySelector('[data-wuerfeln]').addEventListener('click', () => wuerfeln(ziel));

  ziel.addEventListener('click', (e) => {
    const auf = e.target.closest('[data-oeffnen]');
    if (auf) location.hash = `#/rezept/${auf.dataset.oeffnen}`;
  });
}

function wuerfeln(ziel) {
  const topf = kandidaten(store.rezepte());
  if (!topf.length) {
    toast('Mit diesen Filtern passt nichts', '🤷‍♀️');
    return;
  }

  // Nicht zweimal hintereinander dasselbe, wenn es Auswahl gibt
  const ohneLetztes = zustand.ergebnis && topf.length > 1
    ? topf.filter((r) => r.id !== zustand.ergebnis.id)
    : topf;
  const wahl = ohneLetztes[Math.floor(Math.random() * ohneLetztes.length)];

  const walze = ziel.querySelector('[data-walze]');
  const box = ziel.querySelector('[data-ergebnis-box]');
  const knopf = ziel.querySelector('[data-wuerfeln]');

  const schnell = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (schnell) {
    zustand.ergebnis = wahl;
    zeichnen(ziel);
    return;
  }

  // Slot-Machine: Emojis durchrattern lassen, dann landen
  walze.classList.add('dreht');
  knopf.disabled = true;
  box.innerHTML = '<p class="leise">Ich überlege...</p>';

  let schritte = 0;
  const takt = setInterval(() => {
    walze.textContent = WALZE_EMOJIS[Math.floor(Math.random() * WALZE_EMOJIS.length)];
    schritte++;
    if (schritte < 12) return;

    clearInterval(takt);
    walze.classList.remove('dreht');
    zustand.ergebnis = wahl;
    zeichnen(ziel);
  }, 85);
}
