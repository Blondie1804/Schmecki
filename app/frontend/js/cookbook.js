/**
 * Meine Rezepte - Grid mit Suche, Filter-Chips und Sortierung.
 * Dient auch als Favoriten-Seite (nurFavoriten = true).
 */

import * as store from './store.js';
import { esc } from './ui.js';
import { rezeptGrid, bilderLaden, kartenVerdrahten } from './cards.js';

// Filterzustand überlebt einen Seitenwechsel - man kommt vom Rezept zurück
// und findet dieselbe Ansicht vor.
const zustand = {
  suche: '',
  tag: '',
  sortierung: 'neu',
};

const SORTIERUNGEN = [
  ['neu', 'Zuletzt hinzugefügt'],
  ['titel', 'Alphabetisch'],
  ['gekocht', 'Zuletzt gekocht'],
  ['bewertung', 'Beste Bewertung'],
  ['schnell', 'Schnellste zuerst'],
];

export async function zeichnen(ziel, nurFavoriten = false) {
  const alle = store.rezepte();
  const grundmenge = nurFavoriten ? alle.filter((r) => r.favorit) : alle;

  ziel.innerHTML = `
    <div class="seiten-kopf">
      <div>
        <h1>${nurFavoriten ? 'Favoriten' : 'Meine Rezepte'}</h1>
        <p class="unterzeile">${anzahlText(grundmenge.length, nurFavoriten)}</p>
      </div>
      <div class="suche" style="max-width:280px">
        <input type="search" id="kb-suche" placeholder="Rezepte suchen..."
               value="${esc(zustand.suche)}" autocomplete="off">
      </div>
    </div>

    <div class="reihe" style="margin-bottom:18px">
      <div class="chips" id="kb-chips">${chipsHtml(grundmenge)}</div>
      <select id="kb-sort" class="reihe-ende" style="width:auto;min-width:190px">
        ${SORTIERUNGEN.map(([wert, text]) =>
          `<option value="${wert}" ${zustand.sortierung === wert ? 'selected' : ''}>${text}</option>`).join('')}
      </select>
    </div>

    <div id="kb-ergebnis"></div>
  `;

  ergebnisZeichnen(ziel, grundmenge, nurFavoriten);
  verdrahten(ziel, grundmenge, nurFavoriten);
}

function anzahlText(anzahl, nurFavoriten) {
  if (anzahl === 0) return nurFavoriten ? 'Noch keine Favoriten' : 'Noch keine Rezepte';
  if (anzahl === 1) return '1 Rezept';
  return `${anzahl} Rezepte`;
}

function chipsHtml(grundmenge) {
  // Nur Tags anzeigen, die in der Grundmenge auch vorkommen
  const zaehler = new Map();
  for (const r of grundmenge) {
    for (const tag of r.tags || []) zaehler.set(tag, (zaehler.get(tag) || 0) + 1);
  }
  const tags = [...zaehler.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 9);

  return [
    `<button type="button" class="chip ${!zustand.tag ? 'aktiv' : ''}" data-tag="">Alle</button>`,
    ...tags.map(([tag, anzahl]) => `
      <button type="button" class="chip ${zustand.tag === tag ? 'aktiv' : ''}" data-tag="${esc(tag)}">
        ${esc(gross(tag))}<span class="chip-zahl">${anzahl}</span>
      </button>`),
  ].join('');
}

function gross(tag) {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function gefiltert(grundmenge) {
  let liste = [...grundmenge];

  if (zustand.tag) {
    liste = liste.filter((r) => (r.tags || []).includes(zustand.tag));
  }

  const suche = zustand.suche.trim().toLowerCase();
  if (suche) {
    liste = liste.filter((r) => {
      const heuhaufen = [
        r.titel,
        r.beschreibung,
        ...(r.tags || []),
        ...(r.zutaten || []).map((z) => z.name),
      ].join(' ').toLowerCase();
      return heuhaufen.includes(suche);
    });
  }

  const sortierer = {
    neu: (a, b) => (b.angelegt || '').localeCompare(a.angelegt || ''),
    titel: (a, b) => a.titel.localeCompare(b.titel, 'de'),
    gekocht: (a, b) => (b.gekocht || '').localeCompare(a.gekocht || ''),
    bewertung: (a, b) => (b.bewertung || 0) - (a.bewertung || 0),
    schnell: (a, b) => (a.zeit?.gesamt || 9999) - (b.zeit?.gesamt || 9999),
  };
  liste.sort(sortierer[zustand.sortierung] || sortierer.neu);

  return liste;
}

async function ergebnisZeichnen(ziel, grundmenge, nurFavoriten) {
  const box = ziel.querySelector('#kb-ergebnis');
  const treffer = gefiltert(grundmenge);

  if (!treffer.length) {
    box.innerHTML = leerHtml(grundmenge.length, nurFavoriten);
    return;
  }

  box.innerHTML = rezeptGrid(treffer);
  await bilderLaden(box);
}

function leerHtml(grundmengeAnzahl, nurFavoriten) {
  if (grundmengeAnzahl === 0) {
    return nurFavoriten
      ? `<div class="karte leer">
           <span class="leer-emoji">❤️</span>
           <h3>Noch keine Favoriten</h3>
           <p>Tippe auf das Herz an einer Rezeptkarte, dann landet das Rezept hier.</p>
           <a class="knopf-2" href="#/rezepte">Zu allen Rezepten</a>
         </div>`
      : `<div class="karte leer">
           <span class="leer-emoji">🍓</span>
           <h3>Dein Kochbuch ist noch leer</h3>
           <p>Der erste TikTok-Link füllt es. Oder tippe ein Rezept von Hand ein.</p>
           <button type="button" class="knopf" data-aktion="import">Rezept hinzufügen ✨</button>
         </div>`;
  }

  return `<div class="karte leer">
            <span class="leer-emoji">🔍</span>
            <h3>Nichts gefunden</h3>
            <p>Für diese Suche und Filter gibt es kein Rezept.</p>
            <button type="button" class="knopf-2" data-filter-weg>Filter zurücksetzen</button>
          </div>`;
}

function verdrahten(ziel, grundmenge, nurFavoriten) {
  const sucheEl = ziel.querySelector('#kb-suche');
  let timer;
  sucheEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      zustand.suche = sucheEl.value;
      ergebnisZeichnen(ziel, grundmenge, nurFavoriten);
    }, 160);
  });

  ziel.querySelector('#kb-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-tag]');
    if (!chip) return;
    zustand.tag = chip.dataset.tag;
    for (const c of ziel.querySelectorAll('#kb-chips .chip')) {
      c.classList.toggle('aktiv', c.dataset.tag === zustand.tag);
    }
    ergebnisZeichnen(ziel, grundmenge, nurFavoriten);
  });

  ziel.querySelector('#kb-sort').addEventListener('change', (e) => {
    zustand.sortierung = e.target.value;
    ergebnisZeichnen(ziel, grundmenge, nurFavoriten);
  });

  ziel.addEventListener('click', (e) => {
    if (!e.target.closest('[data-filter-weg]')) return;
    zustand.suche = '';
    zustand.tag = '';
    sucheEl.value = '';
    for (const c of ziel.querySelectorAll('#kb-chips .chip')) {
      c.classList.toggle('aktiv', c.dataset.tag === '');
    }
    ergebnisZeichnen(ziel, grundmenge, nurFavoriten);
  });

  // Auf der Favoritenseite verschwindet eine Karte, wenn das Herz ausgeht
  kartenVerdrahten(ziel, () => {
    if (nurFavoriten) zeichnen(ziel, true);
  });
}
