/**
 * Die Rezeptkarte - einmal gebaut, überall benutzt (Kochbuch, Favoriten,
 * Startseite, Wochenplan-Auswahl).
 *
 * Bilder liegen in IndexedDB und lassen sich nicht synchron lesen. Deshalb wird
 * die Karte erst mit Doodle-Platzhalter gezeichnet und das Foto danach
 * nachgeschoben - das ist schneller als auf die Datenbank zu warten und es
 * flackert nicht, weil die Platzhalter dieselbe Größe haben.
 */

import * as store from './store.js';
import { esc, zeitText } from './ui.js';
import { bildMarkup, herz, rezeptEmoji } from './doodles.js';

/** HTML einer Rezeptkarte (Karte plus Herz-Knopf darüber). */
export function rezeptKarte(r, opt = {}) {
  const zeit = zeitText(r.zeit?.gesamt);

  return `
    <div class="karte-huelle">
      <button type="button" class="rezept-karte ${opt.ziehbar ? 'zieh-quelle' : ''}"
              data-rezept="${esc(r.id)}"
              ${opt.ziehbar ? 'draggable="true"' : ''}>
        <span class="bild-halter" data-bild-key="${esc(r.bildKey || '')}">
          ${bildMarkup(r, null)}
        </span>
        <span class="rezept-karte-text">
          <span class="rezept-karte-titel">${esc(r.titel)}</span>
          <span class="rezept-karte-fuss">
            <span>${zeit || '&nbsp;'}</span>
          </span>
        </span>
      </button>
      <button type="button" class="herz-knopf ${r.favorit ? 'gefuellt' : ''}"
              data-herz="${esc(r.id)}"
              aria-label="${r.favorit ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}">
        ${herz(r.favorit)}
      </button>
    </div>`;
}

/** Ein Grid aus Karten. */
export function rezeptGrid(rezepte, opt = {}) {
  if (!rezepte.length) return '';
  return `<div class="rezept-grid">${rezepte.map((r) => rezeptKarte(r, opt)).join('')}</div>`;
}

/**
 * Schiebt die echten Fotos in die Platzhalter nach.
 * Wird nach jedem Zeichnen aufgerufen; ohne Bild passiert nichts.
 */
export async function bilderLaden(wurzel) {
  const halter = [...wurzel.querySelectorAll('[data-bild-key]')].filter((h) => h.dataset.bildKey);

  await Promise.all(halter.map(async (h) => {
    const url = await store.bildUrl(h.dataset.bildKey);
    if (!url) return;
    const alt = h.querySelector('[role=img]')?.getAttribute('aria-label') || '';
    h.innerHTML = `<img class="rezept-bild" src="${url}" alt="${esc(alt)}" loading="lazy">`;
  }));
}

/**
 * Klicks auf Karten: Karte öffnet das Rezept, das Herz schaltet den Favoriten.
 * @param {HTMLElement} wurzel
 * @param {Function} beiAenderung  wird nach einem Favoriten-Klick aufgerufen
 */
export function kartenVerdrahten(wurzel, beiAenderung) {
  wurzel.addEventListener('click', (e) => {
    const herzEl = e.target.closest('[data-herz]');
    if (herzEl) {
      e.preventDefault();
      e.stopPropagation();
      favoritKlick(herzEl, beiAenderung);
      return;
    }

    const karte = e.target.closest('[data-rezept]');
    if (karte && !karte.dataset.keinLink) {
      location.hash = `#/rezept/${karte.dataset.rezept}`;
    }
  });

}

function favoritKlick(herzEl, beiAenderung) {
  const id = herzEl.dataset.herz;
  const jetztFavorit = store.favoritUmschalten(id);

  herzEl.classList.toggle('gefuellt', jetztFavorit);
  herzEl.innerHTML = herz(jetztFavorit);
  herzEl.setAttribute('aria-label', jetztFavorit ? 'Aus Favoriten entfernen' : 'Zu Favoriten');

  if (jetztFavorit) {
    herzEl.classList.add('pop');
    setTimeout(() => herzEl.classList.remove('pop'), 450);
  }

  beiAenderung?.(id, jetztFavorit);
}

/** Kleine Zeile für Listen und Slots: Emoji + Titel. */
export function rezeptZeile(r) {
  return `<span class="slot-emoji" aria-hidden="true">${rezeptEmoji(r)}</span>
          <span class="slot-titel">${esc(r.titel)}</span>`;
}
