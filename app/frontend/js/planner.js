/**
 * Wochenplan.
 *
 * Sieben Tage, je ein Mittag- und ein Abendessen. Rezepte kommen per Klick oder
 * per Drag & Drop aus der Schublade unten hinein. Am Ende macht ein Knopf die
 * Einkaufsliste für die ganze Woche.
 */

import * as store from './store.js';
import * as zutatKram from './ingredients.js';
import { esc, toast, nachfragen, modalOeffnen, modalSchliessen } from './ui.js';
import { rezeptEmoji } from './doodles.js';
import { montagVon, isoTag } from './recipe.js';

const TAG_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const SLOTS = [['mittag', 'Mittag'], ['abend', 'Abend']];

// Welche Woche gerade angezeigt wird (0 = diese, 1 = nächste, -1 = letzte)
let wochenVersatz = 0;

export function zeichnen(ziel) {
  const montag = montagVon();
  montag.setDate(montag.getDate() + wochenVersatz * 7);

  const tage = TAG_KURZ.map((kurz, i) => {
    const d = new Date(montag);
    d.setDate(d.getDate() + i);
    return { kurz, datum: d, iso: isoTag(d) };
  });

  const heuteIso = isoTag(new Date());
  const plan = store.plan();
  const rezepte = store.rezepte();

  const geplant = tage.reduce((summe, t) => summe + Object.keys(plan[t.iso] || {}).length, 0);

  ziel.innerHTML = `
    <div class="seiten-kopf">
      <div>
        <h1>Wochenplan 📅</h1>
        <p class="unterzeile">${zeitraumText(tage)} · ${geplant} ${geplant === 1 ? 'Essen' : 'Essen'} geplant</p>
      </div>
      <div class="plan-kopf">
        <button type="button" class="knopf-2" data-woche="0">Heute</button>
        <button type="button" class="ikon-knopf" data-woche="-1" aria-label="Woche zurück">‹</button>
        <button type="button" class="ikon-knopf" data-woche="1" aria-label="Woche vor">›</button>
      </div>
    </div>

    ${rezepte.length === 0 ? `
      <div class="karte leer">
        <span class="leer-emoji">📅</span>
        <h3>Ohne Rezepte kein Plan</h3>
        <p>Leg zuerst ein paar Rezepte an, dann kannst du die Woche füllen.</p>
        <button type="button" class="knopf" data-aktion="import">Rezept hinzufügen ✨</button>
      </div>` : `
      <div class="woche">
        ${tage.map((t) => tagHtml(t, plan[t.iso] || {}, t.iso === heuteIso)).join('')}
      </div>

      <div class="plan-fuss">
        <div>
          <strong>Einkaufsliste für diese Woche</strong>
          <div class="klein leise">Alle Zutaten der geplanten Rezepte, zusammengerechnet</div>
        </div>
        <div class="reihe">
          <button type="button" class="knopf-2" data-ueberrasch>🎲 Überrasch mich</button>
          <button type="button" class="knopf" data-woche-liste ${geplant ? '' : 'disabled'}>Liste erzeugen</button>
        </div>
      </div>

      <section class="abschnitt">
        <h2>🤏 Zieh ein Rezept in die Woche</h2>
        <div class="schublade">
          ${rezepte.map((r) => `
            <button type="button" class="schub-chip" draggable="true" data-zieh="${esc(r.id)}">
              <span aria-hidden="true">${rezeptEmoji(r)}</span>
              <span>${esc(r.titel)}</span>
            </button>`).join('')}
        </div>
        <p class="feld-hilfe">Auf dem Handy klappt es auch mit Tippen: leeres Feld antippen und Rezept auswählen.</p>
      </section>`}
  `;

  verdrahten(ziel, tage);
}

function zeitraumText(tage) {
  const von = tage[0].datum;
  const bis = tage[6].datum;
  const bisText = bis.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  // Innerhalb eines Monats reicht "19. – 25. August"
  const vonText = von.getMonth() === bis.getMonth()
    ? `${von.getDate()}.`
    : von.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return `${vonText} – ${bisText}`;
}

function tagHtml(tag, slots, istHeute) {
  return `
    <div class="tag-spalte ${istHeute ? 'heute' : ''}">
      <div class="tag-kopf">
        <div class="tag-name">${tag.kurz}</div>
        <div class="tag-datum">${tag.datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
      </div>
      <div class="slots">
        ${SLOTS.map(([slot, label]) => slotHtml(tag.iso, slot, label, slots[slot])).join('')}
      </div>
    </div>`;
}

function slotHtml(iso, slot, label, rezeptId) {
  const r = rezeptId ? store.rezept(rezeptId) : null;

  if (!r) {
    return `
      <button type="button" class="slot" data-slot="${iso}|${slot}">
        <span class="slot-label">${label}</span>
        <span class="leise" style="font-size:1.1rem">＋</span>
      </button>`;
  }

  return `
    <div class="slot belegt" data-slot="${iso}|${slot}" data-rezept-slot="${esc(r.id)}"
         draggable="true" role="button" tabindex="0">
      <span class="slot-label">${label}</span>
      <span class="slot-emoji" aria-hidden="true">${rezeptEmoji(r)}</span>
      <span class="slot-titel">${esc(r.titel)}</span>
      <button type="button" class="slot-weg" data-slot-weg="${iso}|${slot}" aria-label="Aus dem Plan nehmen">✕</button>
    </div>`;
}

// ---------------------------------------------------------------- Bedienung

function verdrahten(ziel, tage) {
  const neu = () => zeichnen(ziel);

  for (const b of ziel.querySelectorAll('[data-woche]')) {
    b.addEventListener('click', () => {
      const wert = Number(b.dataset.woche);
      wochenVersatz = wert === 0 ? 0 : wochenVersatz + wert;
      neu();
    });
  }

  ziel.addEventListener('click', (e) => {
    // Erst das ✕ prüfen, sonst öffnet der Slot-Klick das Rezept
    const weg = e.target.closest('[data-slot-weg]');
    if (weg) {
      e.stopPropagation();
      const [iso, slot] = weg.dataset.slotWeg.split('|');
      store.planSetzen(iso, slot, null);
      neu();
      return;
    }

    const belegt = e.target.closest('[data-rezept-slot]');
    if (belegt) {
      location.hash = `#/rezept/${belegt.dataset.rezeptSlot}`;
      return;
    }

    const leer = e.target.closest('.slot:not(.belegt)');
    if (leer) {
      rezeptWaehlenModal(leer.dataset.slot, neu);
      return;
    }

    if (e.target.closest('[data-ueberrasch]')) {
      ueberraschen(tage, neu);
      return;
    }

    if (e.target.closest('[data-woche-liste]')) {
      wochenListe(tage);
    }
  });

  ziehenVerdrahten(ziel, neu);
}

/** Drag & Drop: aus der Schublade in einen Slot, oder Slot zu Slot. */
function ziehenVerdrahten(ziel, neu) {
  let getragen = null; // { rezeptId, vonSlot }

  for (const chip of ziel.querySelectorAll('[data-zieh]')) {
    chip.addEventListener('dragstart', (e) => {
      getragen = { rezeptId: chip.dataset.zieh, vonSlot: null };
      chip.classList.add('zieht');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', chip.dataset.zieh);
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('zieht');
      getragen = null;
    });
  }

  for (const slot of ziel.querySelectorAll('.slot.belegt')) {
    slot.addEventListener('dragstart', (e) => {
      getragen = { rezeptId: slot.dataset.rezeptSlot, vonSlot: slot.dataset.slot };
      slot.classList.add('zieht');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', slot.dataset.rezeptSlot);
    });
    slot.addEventListener('dragend', () => {
      slot.classList.remove('zieht');
      getragen = null;
    });
  }

  for (const slot of ziel.querySelectorAll('.slot')) {
    slot.addEventListener('dragover', (e) => {
      if (!getragen) return;
      e.preventDefault();
      slot.classList.add('ueber');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('ueber'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('ueber');
      if (!getragen) return;

      const [iso, name] = slot.dataset.slot.split('|');

      // Aus einem anderen Slot? Dann dort raus (Verschieben, nicht Kopieren)
      if (getragen.vonSlot && getragen.vonSlot !== slot.dataset.slot) {
        const [altIso, altName] = getragen.vonSlot.split('|');
        store.planSetzen(altIso, altName, null);
      }

      store.planSetzen(iso, name, getragen.rezeptId);
      getragen = null;
      neu();
    });
  }
}

function rezeptWaehlenModal(slotSchluessel, fertig) {
  const [iso, slot] = slotSchluessel.split('|');
  const rezepte = store.rezepte();
  const datum = new Date(`${iso}T12:00:00`);

  const modal = modalOeffnen(`
    <h2>Was gibt's?</h2>
    <p class="leise klein">
      ${datum.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })},
      ${slot === 'mittag' ? 'Mittagessen' : 'Abendessen'}
    </p>
    <div class="suche" style="margin:16px 0 12px">
      <input type="search" id="plan-suche" placeholder="Rezept suchen..." autocomplete="off">
    </div>
    <div id="plan-treffer" class="plan-auswahl"></div>`);

  const trefferBox = modal.querySelector('#plan-treffer');
  const sucheEl = modal.querySelector('#plan-suche');

  const zeichnen2 = () => {
    const suche = sucheEl.value.trim().toLowerCase();
    const treffer = suche
      ? rezepte.filter((r) => r.titel.toLowerCase().includes(suche)
          || (r.tags || []).some((t) => t.includes(suche)))
      : rezepte;

    trefferBox.innerHTML = treffer.length
      ? treffer.map((r) => `
          <button type="button" class="auswahl-zeile" data-wahl="${esc(r.id)}">
            <span aria-hidden="true">${rezeptEmoji(r)}</span>
            <span class="auswahl-text">
              <span class="auswahl-titel">${esc(r.titel)}</span>
              <span class="klein leise">${r.zeit?.gesamt ? `${r.zeit.gesamt} Min.` : ''}</span>
            </span>
          </button>`).join('')
      : '<p class="leise mittig">Nichts gefunden.</p>';
  };

  zeichnen2();
  sucheEl.addEventListener('input', zeichnen2);

  trefferBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wahl]');
    if (!b) return;
    store.planSetzen(iso, slot, b.dataset.wahl);
    modalSchliessen();
    fertig();
  });
}

/** Füllt leere Abendessen der Woche mit zufälligen Rezepten. */
function ueberraschen(tage, fertig) {
  const rezepte = store.rezepte();
  if (!rezepte.length) return;

  const plan = store.plan();
  let gesetzt = 0;

  // Nicht dasselbe Rezept zweimal in der Woche, solange es Auswahl gibt
  const schonDrin = new Set();
  for (const t of tage) {
    for (const id of Object.values(plan[t.iso] || {})) schonDrin.add(id);
  }

  for (const t of tage) {
    if (plan[t.iso]?.abend) continue;

    const frei = rezepte.filter((r) => !schonDrin.has(r.id));
    const topf = frei.length ? frei : rezepte;
    const wahl = topf[Math.floor(Math.random() * topf.length)];

    store.planSetzen(t.iso, 'abend', wahl.id);
    schonDrin.add(wahl.id);
    gesetzt++;
  }

  if (gesetzt === 0) {
    toast('Die Woche ist schon voll', '😊');
  } else {
    toast(`${gesetzt} Abendessen gewürfelt`, '🎲');
  }
  fertig();
}

/** Alle geplanten Rezepte der Woche auf die Einkaufsliste. */
async function wochenListe(tage) {
  const plan = store.plan();
  const ids = [];
  for (const t of tage) {
    for (const id of Object.values(plan[t.iso] || {})) ids.push(id);
  }

  if (!ids.length) {
    toast('Für diese Woche ist nichts geplant', '🤷‍♀️');
    return;
  }

  const sicher = await nachfragen({
    titel: 'Einkaufsliste erzeugen?',
    text: `Die Zutaten von ${ids.length} geplanten Essen wandern auf die Einkaufsliste. Gleiche Zutaten werden zusammengerechnet.`,
    jaText: 'Los',
  });
  if (!sicher) return;

  const liste = store.liste();
  let zutaten = 0;
  for (const id of ids) {
    const r = store.rezept(id);
    if (!r) continue;
    zutatKram.rezeptAufListe(liste, r, r.portionen);
    zutaten += r.zutaten.length;
  }
  store.listeGeaendert();

  toast(`${zutaten} Zutaten auf der Liste`, '🛒');
  location.hash = '#/liste';
}
