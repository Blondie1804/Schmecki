/**
 * Einkaufsliste.
 *
 * Nach Supermarktbereichen gruppiert, damit man nicht dreimal durch den Laden
 * läuft. Gleiche Zutaten aus verschiedenen Rezepten sind schon
 * zusammengerechnet - das passiert in ingredients.js beim Hinzufügen.
 */

import * as store from './store.js';
import * as zutatKram from './ingredients.js';
import { esc, toast, nachfragen, modalOeffnen, modalSchliessen, teilen } from './ui.js';

const zustand = { filter: 'alle' };

export function zeichnen(ziel) {
  const liste = store.liste();
  const offen = liste.filter((e) => !e.erledigt);
  const ausRezepten = liste.filter((e) => e.herkunft === 'rezept');
  const manuell = liste.filter((e) => e.herkunft === 'manuell');

  const sichtbar = {
    alle: liste,
    rezept: ausRezepten,
    manuell,
  }[zustand.filter] || liste;

  ziel.innerHTML = `
    <div class="seiten-kopf">
      <div>
        <h1>Einkaufsliste 🛒</h1>
        <p class="unterzeile">
          ${liste.length === 0 ? 'Noch nichts drauf' :
            `${offen.length} von ${liste.length} noch zu holen`}
        </p>
      </div>
      <div class="reihe">
        <button type="button" class="knopf-2" data-dazu>+ Hinzufügen</button>
        ${liste.length ? `<button type="button" class="ikon-knopf" data-mehr title="Mehr">⋯</button>` : ''}
      </div>
    </div>

    ${liste.length ? `
      <div class="chips" style="margin-bottom:20px">
        <button type="button" class="chip ${zustand.filter === 'alle' ? 'aktiv' : ''}" data-filter="alle">
          Alle<span class="chip-zahl">${liste.length}</span>
        </button>
        <button type="button" class="chip ${zustand.filter === 'rezept' ? 'aktiv' : ''}" data-filter="rezept">
          Aus Rezepten<span class="chip-zahl">${ausRezepten.length}</span>
        </button>
        <button type="button" class="chip ${zustand.filter === 'manuell' ? 'aktiv' : ''}" data-filter="manuell">
          Manuell<span class="chip-zahl">${manuell.length}</span>
        </button>
      </div>` : ''}

    ${sichtbar.length ? gruppenHtml(sichtbar) : leerHtml(liste.length)}
  `;

  verdrahten(ziel);
}

function gruppenHtml(sichtbar) {
  const gruppen = zutatKram.nachBereichen(sichtbar);

  return `<div class="liste-spalten">${gruppen.map((g) => `
    <div class="liste-gruppe">
      <h3>
        <span aria-hidden="true">${g.emoji}</span> ${g.name}
        <span class="anzahl">${g.eintraege.filter((e) => !e.erledigt).length}/${g.eintraege.length}</span>
      </h3>
      ${g.eintraege.map((e) => zeileHtml(e)).join('')}
    </div>`).join('')}</div>`;
}

function zeileHtml(e) {
  const menge = zutatKram.mengeMitEinheit(e.menge, e.einheit);
  const rezeptAnzahl = (e.rezeptIds || []).length;

  return `
    <div class="liste-zeile ${e.erledigt ? 'erledigt' : ''}" data-eintrag="${esc(e.id)}">
      <input type="checkbox" class="haken" ${e.erledigt ? 'checked' : ''}
             data-haken="${esc(e.id)}" aria-label="${esc(e.name)} abhaken">
      <span class="liste-text">
        <span class="liste-name">${esc(e.name)}</span>
        ${e.hinweis || rezeptAnzahl > 1 ? `
          <span class="liste-unter">
            ${e.hinweis ? esc(e.hinweis) : ''}
            ${e.hinweis && rezeptAnzahl > 1 ? ' · ' : ''}
            ${rezeptAnzahl > 1 ? `aus ${rezeptAnzahl} Rezepten` : ''}
          </span>` : ''}
      </span>
      <span class="liste-menge">${menge}</span>
      <button type="button" class="ikon-knopf" data-bearbeiten="${esc(e.id)}" title="Menge ändern">✏️</button>
      <button type="button" class="ikon-knopf" data-weg="${esc(e.id)}" title="Von der Liste">✕</button>
    </div>`;
}

function leerHtml(gesamt) {
  if (gesamt === 0) {
    return `
      <div class="karte leer">
        <span class="leer-emoji">🛒</span>
        <h3>Die Liste ist leer</h3>
        <p>Öffne ein Rezept und tippe auf "Zur Einkaufsliste" - oder trag von Hand ein, was fehlt.</p>
        <div class="reihe" style="justify-content:center">
          <button type="button" class="knopf" data-dazu>Etwas hinzufügen</button>
          <a class="knopf-2" href="#/rezepte">Zu den Rezepten</a>
        </div>
      </div>`;
  }
  return `
    <div class="karte leer">
      <span class="leer-emoji">🫙</span>
      <h3>In diesem Filter ist nichts</h3>
      <p>Probier einen anderen Filter.</p>
    </div>`;
}

// ---------------------------------------------------------------- Bedienung

function verdrahten(ziel) {
  const neu = () => zeichnen(ziel);

  for (const c of ziel.querySelectorAll('[data-filter]')) {
    c.addEventListener('click', () => {
      zustand.filter = c.dataset.filter;
      neu();
    });
  }

  // Abhaken - ohne Neuzeichnen, damit die Liste beim Einkaufen nicht springt
  ziel.addEventListener('change', (e) => {
    const haken = e.target.closest('[data-haken]');
    if (!haken) return;
    const eintrag = store.liste().find((x) => x.id === haken.dataset.haken);
    if (!eintrag) return;
    eintrag.erledigt = haken.checked;
    store.listeGeaendert();
    haken.closest('.liste-zeile')?.classList.toggle('erledigt', haken.checked);
    gruppenZaehlerAktualisieren(ziel);
  });

  ziel.addEventListener('click', async (e) => {
    const weg = e.target.closest('[data-weg]');
    if (weg) {
      const id = weg.dataset.weg;
      const liste = store.liste();
      const index = liste.findIndex((x) => x.id === id);
      if (index >= 0) {
        liste.splice(index, 1);
        store.listeGeaendert();
        neu();
      }
      return;
    }

    const bearbeiten = e.target.closest('[data-bearbeiten]');
    if (bearbeiten) {
      mengeAendernModal(bearbeiten.dataset.bearbeiten, neu);
      return;
    }

    if (e.target.closest('[data-dazu]')) {
      dazuModal(neu);
      return;
    }

    if (e.target.closest('[data-mehr]')) {
      mehrModal(neu);
    }
  });
}

function gruppenZaehlerAktualisieren(ziel) {
  // "3/7" pro Gruppe neu rechnen, ohne die ganze Seite anzufassen
  for (const gruppe of ziel.querySelectorAll('.liste-gruppe')) {
    const zeilen = [...gruppe.querySelectorAll('.liste-zeile')];
    const offen = zeilen.filter((z) => !z.classList.contains('erledigt')).length;
    const zaehler = gruppe.querySelector('.anzahl');
    if (zaehler) zaehler.textContent = `${offen}/${zeilen.length}`;
  }
}

function dazuModal(fertig) {
  const modal = modalOeffnen(`
    <h2>Auf die Liste</h2>
    <form id="dazu-form">
      <label class="feld-label" for="dazu-name">Was brauchst du?</label>
      <input type="text" id="dazu-name" placeholder="Zwiebeln" autocomplete="off">

      <div class="reihe" style="margin-top:14px;align-items:flex-end">
        <div style="flex:0 0 92px">
          <label class="feld-label" for="dazu-menge">Menge</label>
          <input type="number" id="dazu-menge" step="0.5" min="0" placeholder="3">
        </div>
        <div style="flex:1;min-width:120px">
          <label class="feld-label" for="dazu-einheit">Einheit</label>
          <select id="dazu-einheit">
            <option value="">ohne</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="l">l</option>
            <option value="el">EL</option>
            <option value="tl">TL</option>
            <option value="stück">Stück</option>
            <option value="zehe">Zehe</option>
            <option value="bund">Bund</option>
            <option value="dose">Dose</option>
            <option value="packung">Packung</option>
          </select>
        </div>
      </div>

      <div style="margin-top:14px">
        <label class="feld-label" for="dazu-bereich">Wo im Laden?</label>
        <select id="dazu-bereich">
          <option value="">automatisch erkennen</option>
          ${zutatKram.BEREICHE.map((b) => `<option value="${b.id}">${b.emoji} ${b.name}</option>`).join('')}
        </select>
      </div>

      <div class="reihe abstand-oben">
        <button type="button" class="knopf-2" data-modal-zu>Abbrechen</button>
        <button type="submit" class="knopf">Drauf damit</button>
      </div>
    </form>`);

  modal.querySelector('#dazu-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = modal.querySelector('#dazu-name').value.trim();
    if (!name) {
      modal.querySelector('#dazu-name').focus();
      return;
    }
    const mengeRoh = modal.querySelector('#dazu-menge').value;
    const bereichWahl = modal.querySelector('#dazu-bereich').value;

    const zutat = {
      name,
      menge: mengeRoh ? Number(mengeRoh) : null,
      einheit: modal.querySelector('#dazu-einheit').value,
      hinweis: '',
      bereich: bereichWahl || zutatKram.bereichRaten(name),
      skalierbar: true,
    };

    zutatKram.aufListe(store.liste(), zutat);
    store.listeGeaendert();
    modalSchliessen();
    toast(`${name} steht drauf`, '🛒');
    fertig();
  });
}

function mengeAendernModal(id, fertig) {
  const eintrag = store.liste().find((x) => x.id === id);
  if (!eintrag) return;

  const modal = modalOeffnen(`
    <h2>Ändern</h2>
    <form id="edit-form">
      <label class="feld-label" for="edit-name">Name</label>
      <input type="text" id="edit-name" value="${esc(eintrag.name)}">

      <div class="reihe" style="margin-top:14px;align-items:flex-end">
        <div style="flex:0 0 92px">
          <label class="feld-label" for="edit-menge">Menge</label>
          <input type="number" id="edit-menge" step="0.5" min="0"
                 value="${eintrag.menge ?? ''}">
        </div>
        <div style="flex:1">
          <label class="feld-label" for="edit-einheit">Einheit</label>
          <input type="text" id="edit-einheit" value="${esc(eintrag.einheit)}">
        </div>
      </div>

      <div style="margin-top:14px">
        <label class="feld-label" for="edit-bereich">Wo im Laden?</label>
        <select id="edit-bereich">
          ${zutatKram.BEREICHE.map((b) =>
            `<option value="${b.id}" ${eintrag.bereich === b.id ? 'selected' : ''}>${b.emoji} ${b.name}</option>`).join('')}
        </select>
      </div>

      <div class="reihe abstand-oben">
        <button type="button" class="knopf-2" data-modal-zu>Abbrechen</button>
        <button type="submit" class="knopf">Speichern</button>
      </div>
    </form>`);

  modal.querySelector('#edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const mengeRoh = modal.querySelector('#edit-menge').value;
    eintrag.name = modal.querySelector('#edit-name').value.trim() || eintrag.name;
    eintrag.menge = mengeRoh ? Number(mengeRoh) : null;
    eintrag.einheit = modal.querySelector('#edit-einheit').value.trim();
    eintrag.bereich = modal.querySelector('#edit-bereich').value;
    eintrag.schluessel = zutatKram.zutatSchluessel(eintrag.name);
    eintrag.familie = zutatKram.einheitFamilie(eintrag.einheit);
    store.listeGeaendert();
    modalSchliessen();
    fertig();
  });
}

function mehrModal(fertig) {
  const liste = store.liste();
  const erledigte = liste.filter((e) => e.erledigt).length;

  const modal = modalOeffnen(`
    <h2>Einkaufsliste</h2>
    <div style="display:grid;gap:9px;margin-top:14px">
      <button type="button" class="knopf-2" data-tun="teilen">📤 Liste teilen oder kopieren</button>
      <button type="button" class="knopf-2" data-tun="abgehakt" ${erledigte ? '' : 'disabled'}>
        🧹 Abgehakte entfernen${erledigte ? ` (${erledigte})` : ''}
      </button>
      <button type="button" class="knopf-2 knopf-gefahr" data-tun="alles">🗑️ Ganze Liste leeren</button>
    </div>`);

  modal.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tun]');
    if (!b) return;

    if (b.dataset.tun === 'teilen') {
      const art = await teilen({ titel: 'Einkaufsliste', text: listeAlsText() });
      if (art === 'kopiert') toast('Liste kopiert', '📋');
      modalSchliessen();
      return;
    }

    if (b.dataset.tun === 'abgehakt') {
      store.listeLeeren(true);
      modalSchliessen();
      toast('Abgehakte weg', '🧹');
      fertig();
      return;
    }

    modalSchliessen();
    const sicher = await nachfragen({
      titel: 'Ganze Liste leeren?',
      text: 'Alles verschwindet - auch das, was noch nicht abgehakt ist.',
      jaText: 'Ja, leeren',
      gefahr: true,
    });
    if (!sicher) return;
    store.listeLeeren(false);
    toast('Liste ist leer', '✨');
    fertig();
  });
}

/** Liste als Text - zum Verschicken oder Ausdrucken. */
function listeAlsText() {
  const gruppen = zutatKram.nachBereichen(store.liste());
  const zeilen = ['🛒 Einkaufsliste', ''];

  for (const g of gruppen) {
    zeilen.push(`${g.emoji} ${g.name.toUpperCase()}`);
    for (const e of g.eintraege) {
      const menge = zutatKram.mengeMitEinheit(e.menge, e.einheit);
      zeilen.push(`${e.erledigt ? '[x]' : '[ ]'} ${menge ? `${menge} ` : ''}${e.name}`);
    }
    zeilen.push('');
  }

  return zeilen.join('\n').trim();
}
