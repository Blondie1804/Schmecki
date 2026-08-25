/**
 * Vorratsschrank.
 *
 * Was ist zuhause - und was kann ich damit kochen? Der Abgleich ignoriert
 * Salz, Pfeffer, Öl und Wasser, sonst wäre nie etwas kochbar (siehe IMMER_DA
 * in ingredients.js).
 */

import * as store from './store.js';
import { vorratsAbgleich, IMMER_DA } from './ingredients.js';
import { esc, toast, zeitText } from './ui.js';
import { rezeptEmoji } from './doodles.js';

/** Vorschläge fürs schnelle Antippen - das Übliche, das man daheim hat. */
const VORSCHLAEGE = [
  'Pasta', 'Reis', 'Ei', 'Milch', 'Butter', 'Sahne', 'Parmesan', 'Käse', 'Joghurt',
  'Zwiebel', 'Knoblauch', 'Tomate', 'Kartoffel', 'Karotte', 'Paprika', 'Zucchini',
  'Mehl', 'Zucker', 'Hackfleisch', 'Hähnchen', 'Linsen', 'Kichererbsen', 'Mais',
  'Passierte Tomaten', 'Tomatenmark', 'Gemüsebrühe', 'Basilikum', 'Petersilie',
];

export function zeichnen(ziel) {
  const vorrat = store.vorrat();
  const rezepte = store.rezepte();

  const bewertet = rezepte
    .map((r) => ({ r, ...vorratsAbgleich(r, vorrat) }))
    .filter((x) => x.brauche > 0)
    .sort((a, b) => a.fehlt.length - b.fehlt.length || b.habe - a.habe);

  // Bis zu drei fehlende Zutaten gelten noch als "fast" - das ist ein
  // Einkaufszettel, kein Grund, das Rezept zu verwerfen.
  const komplett = bewertet.filter((x) => x.vollstaendig);
  const fastKomplett = bewertet.filter((x) => !x.vollstaendig && x.fehlt.length <= 3);

  const offeneVorschlaege = VORSCHLAEGE.filter(
    (v) => !vorrat.some((x) => x.name.toLowerCase() === v.toLowerCase()),
  ).slice(0, 12);

  ziel.innerHTML = `
    <div class="seiten-kopf">
      <div>
        <h1>Vorrat 🧄</h1>
        <p class="unterzeile">
          ${vorrat.length ? `${vorrat.length} ${vorrat.length === 1 ? 'Sache' : 'Sachen'} zuhause` : 'Noch nichts eingetragen'}
        </p>
      </div>
    </div>

    <div class="karte">
      <form class="reihe" id="vorrat-form" style="gap:9px">
        <input type="text" id="vorrat-name" placeholder="Was hast du da? z. B. Sahne"
               autocomplete="off" style="flex:1;min-width:170px">
        <button type="submit" class="knopf">Hinzufügen</button>
      </form>

      ${vorrat.length ? `
        <div class="vorrat-wolke" style="margin-top:18px">
          ${vorrat.map((v) => `
            <span class="vorrat-pille">
              ${esc(v.name)}
              <button type="button" data-vorrat-weg="${esc(v.id)}" aria-label="${esc(v.name)} entfernen">✕</button>
            </span>`).join('')}
        </div>
        <button type="button" class="knopf-3 knopf-gefahr" data-vorrat-leeren style="margin-top:14px">
          Schrank leeren
        </button>` : `
        <p class="leise klein" style="margin-top:14px">
          Trag ein, was da ist. Schmecki sagt dir dann, was daraus geht.
        </p>`}

      ${offeneVorschlaege.length ? `
        <div style="margin-top:18px">
          <p class="feld-label">Schnell antippen</p>
          <div class="chips">
            ${offeneVorschlaege.map((v) => `
              <button type="button" class="chip" data-vorschlag="${esc(v)}">+ ${esc(v)}</button>`).join('')}
          </div>
        </div>` : ''}

      <p class="feld-hilfe" style="margin-top:16px">
        ${IMMER_DA.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(', ')}
        zählen immer als vorhanden - die musst du nicht eintragen.
      </p>
    </div>

    <section class="abschnitt">
      <h2>✨ Was kann ich damit kochen?</h2>

      ${!rezepte.length ? `
        <div class="karte leer">
          <span class="leer-emoji">📖</span>
          <h3>Noch keine Rezepte</h3>
          <p>Der Abgleich braucht Rezepte zum Vergleichen.</p>
          <button type="button" class="knopf" data-aktion="import">Rezept hinzufügen ✨</button>
        </div>`
      : !vorrat.length ? `
        <div class="karte leer">
          <span class="leer-emoji">🧺</span>
          <h3>Der Schrank ist leer</h3>
          <p>Trag oben ein, was du zuhause hast.</p>
        </div>`
      : `
        ${komplett.length ? `
          <h3 style="margin-top:6px">Sofort kochbar</h3>
          ${komplett.map((x) => trefferHtml(x)).join('')}` : ''}

        ${fastKomplett.length ? `
          <h3 style="margin-top:22px">Fast - da fehlt nicht viel</h3>
          ${fastKomplett.map((x) => trefferHtml(x)).join('')}` : ''}

        ${!komplett.length && !fastKomplett.length ? `
          <div class="karte leer">
            <span class="leer-emoji">🛒</span>
            <h3>Da fehlt noch zu viel</h3>
            <p>Für keins deiner Rezepte reicht der Vorrat. Trag mehr ein - oder geh einkaufen.</p>
            <a class="knopf-2" href="#/liste">Zur Einkaufsliste</a>
          </div>` : ''}

        ${bewertet.length > komplett.length + fastKomplett.length ? `
          <p class="feld-hilfe" style="margin-top:18px">
            Bei ${bewertet.length - komplett.length - fastKomplett.length} weiteren Rezepten fehlen mehr als drei Zutaten.
          </p>` : ''}
      `}
    </section>
  `;

  verdrahten(ziel);
}

function trefferHtml(x) {
  const anteil = Math.round((x.habe / x.brauche) * 100);

  return `
    <button type="button" class="treffer-karte ${x.vollstaendig ? 'komplett' : ''}" data-oeffnen="${esc(x.r.id)}">
      <span class="emoji" aria-hidden="true">${rezeptEmoji(x.r)}</span>
      <span class="treffer-text">
        <span class="treffer-titel">${esc(x.r.titel)}</span>
        <span class="treffer-unter">
          ${x.habe}/${x.brauche} Zutaten
          ${x.r.zeit?.gesamt ? ` · ${zeitText(x.r.zeit.gesamt)}` : ''}
          ${x.fehlt.length ? ` · 🛒 ${x.fehlt.length === 1 ? 'dir fehlt nur' : 'dir fehlen'} ${esc(x.fehlt.slice(0, 3).join(', '))}` : ''}
        </span>
        <span class="treffer-balken"><i style="width:${anteil}%"></i></span>
      </span>
      <span aria-hidden="true" class="leise">→</span>
    </button>`;
}

function verdrahten(ziel) {
  const neu = () => zeichnen(ziel);

  ziel.querySelector('#vorrat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const feld = ziel.querySelector('#vorrat-name');
    const name = feld.value.trim();
    if (!name) return;

    if (store.vorratHinzufuegen(name)) {
      feld.value = '';
      neu();
    } else {
      toast('Das steht schon im Schrank', '😊');
      feld.select();
    }
  });

  ziel.addEventListener('click', (e) => {
    const weg = e.target.closest('[data-vorrat-weg]');
    if (weg) {
      store.vorratEntfernen(weg.dataset.vorratWeg);
      neu();
      return;
    }

    const vorschlag = e.target.closest('[data-vorschlag]');
    if (vorschlag) {
      store.vorratHinzufuegen(vorschlag.dataset.vorschlag);
      neu();
      return;
    }

    if (e.target.closest('[data-vorrat-leeren]')) {
      for (const v of [...store.vorrat()]) store.vorratEntfernen(v.id);
      toast('Schrank ist leer', '🧺');
      neu();
      return;
    }

    const auf = e.target.closest('[data-oeffnen]');
    if (auf) location.hash = `#/rezept/${auf.dataset.oeffnen}`;
  });
}
