/**
 * Startseite: das TikTok-Feld, ein paar Abkürzungen und die letzten Rezepte.
 */

import * as store from './store.js';
import { esc } from './ui.js';
import { dekoEcke, rezeptEmoji } from './doodles.js';
import { rezeptGrid, bilderLaden, kartenVerdrahten } from './cards.js';
import { importOeffnen } from './importer.js';

export async function zeichnen(ziel) {
  const rezepte = store.rezepte();
  const offeneListe = store.liste().filter((e) => !e.erledigt).length;
  const beispiele = rezepte.slice(0, 4);
  const neueste = rezepte.slice(0, 8);

  ziel.innerHTML = `
    <section class="hero">
      ${dekoEcke(['erdbeere', 'kraeuter', 'tomate'])}

      <div class="hero-links">
        <h1>Aus TikTok<br>wird Rezeptliebe</h1>
        <p class="hero-text">
          Füge einen TikTok-Link ein und lass dir das Rezept und die Einkaufsliste zaubern.
        </p>

        <form class="import-zeile" id="hero-form">
          <input type="text" id="hero-link" placeholder="TikTok-Link hier einfügen..."
                 autocomplete="off" spellcheck="false" inputmode="url">
          <button type="submit" class="knopf">Rezept zaubern ✨</button>
        </form>

        <p class="hero-hinweis">
          Kein Link zur Hand? Du kannst ein Rezept auch
          <a href="#" data-hero-tab="text">als Text einfügen</a> oder
          <a href="#" data-hero-tab="video">ein Video hochladen</a>.
        </p>

        ${beispiele.length ? `
          <div class="beispiel-reihe">
            <span class="label">Oder schau dir eines an:</span>
            ${beispiele.map((r) => `
              <button type="button" class="beispiel-kachel stimmung-${stimmung(r)}"
                      data-rezept="${esc(r.id)}" title="${esc(r.titel)}">
                <span aria-hidden="true">${rezeptEmoji(r)}</span>
                <span class="nur-lesegeraet">${esc(r.titel)}</span>
              </button>`).join('')}
          </div>` : ''}
      </div>

      <div class="hero-rechts">
        <div class="telefon" aria-hidden="true">
          <div class="telefon-schirm">
            <span class="telefon-titel">creamy<br>garlic pasta</span>
            <span class="telefon-teller">🍝</span>
            <span class="telefon-leiste">
              <span>🏠</span><span>🔍</span><span>➕</span><span>💬</span><span>👤</span>
            </span>
          </div>
        </div>
      </div>
    </section>

    <div class="schnell-reihe">
      <button type="button" class="schnell-karte" data-gehe="#/wuerfeln">
        <span class="gross" aria-hidden="true">🎲</span>
        <span>
          <span class="titel">Was koche ich heute?</span>
          <span class="unter">Lass dich überraschen</span>
        </span>
      </button>
      <button type="button" class="schnell-karte" data-gehe="#/liste">
        <span class="gross" aria-hidden="true">🛒</span>
        <span>
          <span class="titel">Einkaufsliste</span>
          <span class="unter">${offeneListe ? `${offeneListe} Sachen offen` : 'Alles abgehakt'}</span>
        </span>
      </button>
      <button type="button" class="schnell-karte" data-gehe="#/plan">
        <span class="gross" aria-hidden="true">📅</span>
        <span>
          <span class="titel">Wochenplan</span>
          <span class="unter">${geplanteWoche()} Essen geplant</span>
        </span>
      </button>
      <button type="button" class="schnell-karte" data-gehe="#/vorrat">
        <span class="gross" aria-hidden="true">🧄</span>
        <span>
          <span class="titel">Vorrat</span>
          <span class="unter">Was kann ich damit kochen?</span>
        </span>
      </button>
    </div>

    ${neueste.length ? `
      <section class="abschnitt">
        <h2>📖 Zuletzt hinzugefügt
          <a class="knopf-3 reihe-ende" href="#/rezepte">Alle ansehen →</a>
        </h2>
        ${rezeptGrid(neueste)}
      </section>` : `
      <section class="abschnitt">
        <div class="karte leer">
          <span class="leer-emoji">🍓</span>
          <h3>Noch keine Rezepte</h3>
          <p>Füge oben einen TikTok-Link ein - oder tippe ein Rezept von Hand ein.</p>
          <button type="button" class="knopf" data-aktion="import">Erstes Rezept anlegen ✨</button>
        </div>
      </section>`}
  `;

  verdrahten(ziel);
  await bilderLaden(ziel);
}

function stimmung(r) {
  // gleiche Logik wie beim Platzhalterbild, nur für die kleine Kachel
  const text = r.titel || r.id || '';
  let summe = 0;
  for (let i = 0; i < text.length; i++) summe += text.charCodeAt(i);
  return ['warm', 'rose', 'creme', 'beere'][summe % 4];
}

function geplanteWoche() {
  const plan = store.plan();
  let anzahl = 0;
  for (const tag of Object.values(plan)) anzahl += Object.keys(tag).length;
  return anzahl;
}

function verdrahten(ziel) {
  ziel.querySelector('#hero-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const link = ziel.querySelector('#hero-link').value.trim();
    importOeffnen({ tab: 'link', link });
  });

  for (const a of ziel.querySelectorAll('[data-hero-tab]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      importOeffnen({ tab: a.dataset.heroTab });
    });
  }

  for (const b of ziel.querySelectorAll('[data-gehe]')) {
    b.addEventListener('click', () => {
      location.hash = b.dataset.gehe;
    });
  }

  kartenVerdrahten(ziel);
}
