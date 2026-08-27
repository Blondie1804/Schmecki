/**
 * Die Rezeptansicht - das Herzstück.
 *
 * Portionsrechner, Zutaten zum Abhaken, Schritte, eigene Notizen, Bewertung
 * und die Knöpfe: Favorit, Einkaufsliste, Einplanen, Teilen, Drucken.
 */

import * as store from './store.js';
import * as zutatKram from './ingredients.js';
import { esc, zeitText, schwierigkeitText, toast, nachfragen, teilen, dateiWaehlen, modalOeffnen, modalSchliessen } from './ui.js';
import { bildMarkup, herz, rezeptEmoji } from './doodles.js';

export async function zeichnen(ziel, id) {
  const r = store.rezept(id);

  if (!r) {
    ziel.innerHTML = `
      <div class="leer">
        <span class="leer-emoji">🤔</span>
        <h3>Dieses Rezept ist nicht da</h3>
        <p>Vielleicht wurde es gelöscht.</p>
        <a class="knopf" href="#/rezepte">Zu meinen Rezepten</a>
      </div>`;
    return;
  }

  const basis = r.portionenOriginal || r.portionen;
  const zutaten = zutatKram.zutatenSkalieren(r.zutaten, basis, r.portionen);
  const skaliert = r.portionen !== basis;

  ziel.innerHTML = `
    <article class="rezept-ansicht">
      <a class="knopf-3" href="#/rezepte">← Zurück</a>

      <div class="rezept-hero">
        <span class="bild-halter" data-bild-key="${esc(r.bildKey || '')}">
          ${bildMarkup(r, null)}
        </span>
        <div class="rezept-hero-aktionen">
          <button type="button" class="ikon-knopf" data-bild-tauschen title="Bild ändern">🖼️</button>
          <button type="button" class="ikon-knopf herz-gross ${r.favorit ? 'gefuellt' : ''}"
                  data-favorit aria-label="${r.favorit ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}">
            ${herz(r.favorit)}
          </button>
        </div>
      </div>

      <h1 class="rezept-titel">${esc(r.titel)}</h1>

      <div class="meta-reihe">
        ${r.zeit?.gesamt ? `<span class="meta">⏱️ ${zeitText(r.zeit.gesamt)}</span><span class="trenner">•</span>` : ''}
        <span class="meta">⭐ ${schwierigkeitText(r.schwierigkeit)}</span>
        <span class="trenner">•</span>
        <span class="meta">🍽️ ${r.portionen} ${r.portionen === 1 ? 'Portion' : 'Portionen'}</span>
        ${r.gekocht ? `<span class="trenner">•</span><span class="meta">🍳 schon gekocht</span>` : ''}
      </div>

      ${quelleHtml(r)}

      ${r.beschreibung ? `<p>${esc(r.beschreibung)}</p>` : ''}

      ${r.unsicherheiten?.length ? `
        <div class="hinweis-box">
          <span aria-hidden="true">🤏</span>
          <div>
            <strong>Das war im Video nicht ganz eindeutig:</strong>
            <ul>${r.unsicherheiten.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>
          </div>
        </div>` : ''}

      <div class="aktions-reihe">
        <button type="button" class="knopf" data-auf-liste>🛒 Zur Einkaufsliste</button>
        <button type="button" class="knopf-2" data-einplanen>📅 Einplanen</button>
        <button type="button" class="knopf-2" data-gekocht>${r.gekocht ? '🍳 Nochmal gekocht' : '🍳 Gekocht!'}</button>
        <button type="button" class="knopf-3" data-teilen>📤 Teilen</button>
        <button type="button" class="knopf-3" data-drucken>🖨️ Drucken</button>
      </div>

      <section class="abschnitt">
        <h2>🥕 Zutaten</h2>

        <div class="portionen-box">
          <div>
            <strong>Portionen</strong>
            ${skaliert ? `<div class="klein leise">umgerechnet von ${basis}</div>` : ''}
          </div>
          <div class="zaehler">
            <button type="button" data-portionen="-1" ${r.portionen <= 1 ? 'disabled' : ''} aria-label="Weniger">−</button>
            <span class="wert">${r.portionen}</span>
            <button type="button" data-portionen="1" ${r.portionen >= 50 ? 'disabled' : ''} aria-label="Mehr">+</button>
            ${skaliert ? `<button type="button" class="knopf-3" data-portionen-reset style="margin-left:8px">Zurücksetzen</button>` : ''}
          </div>
        </div>

        <div class="karte">
          <ul class="zutaten-liste">
            ${zutaten.map((z, i) => `
              <li>
                <input type="checkbox" class="haken" id="z${i}">
                <span class="menge">${zutatKram.mengeMitEinheit(z.menge, z.einheit) || '&nbsp;'}</span>
                <label class="name" for="z${i}">
                  ${esc(z.name)}
                  ${z.hinweis ? `<span class="hinweis"> (${esc(z.hinweis)})</span>` : ''}
                </label>
              </li>`).join('')}
          </ul>
        </div>
      </section>

      <section class="abschnitt">
        <h2>👩‍🍳 So geht's</h2>
        <div class="karte">
          <ol class="schritte-liste">
            ${r.schritte.map((s) => `
              <li>
                <span class="nummer" aria-hidden="true"></span>
                <div>
                  <div>${esc(s.text)}</div>
                  ${(s.minuten || s.temperatur) ? `
                    <div class="schritt-meta">
                      ${s.minuten ? `<span>⏱️ ${zeitText(s.minuten)}</span>` : ''}
                      ${s.temperatur ? `<span>🌡️ ${esc(s.temperatur)}</span>` : ''}
                    </div>` : ''}
                </div>
              </li>`).join('')}
          </ol>
        </div>
      </section>

      ${r.notizen ? `
        <div class="hinweis-box gut">
          <span aria-hidden="true">💡</span>
          <div><strong>Tipp aus dem Video:</strong> ${esc(r.notizen)}</div>
        </div>` : ''}

      ${r.tags?.length ? `
        <div class="chips" style="margin-top:16px">
          ${r.tags.map((t) => `<a class="tag" href="#/rezepte" data-tag-link="${esc(t)}">#${esc(t)}</a>`).join('')}
        </div>` : ''}

      <section class="abschnitt">
        <h2>📝 Meine Notizen</h2>
        <div class="karte">
          <div class="reihe" style="margin-bottom:14px">
            <span><strong>Meine Bewertung</strong></span>
            <span class="sterne" data-sterne>
              ${[1, 2, 3, 4, 5].map((n) =>
                `<button type="button" class="${(r.bewertung || 0) >= n ? 'an' : ''}" data-stern="${n}"
                         aria-label="${n} von 5 Sternen">⭐</button>`).join('')}
            </span>
            ${r.bewertung ? `<button type="button" class="knopf-3" data-stern="0">zurücksetzen</button>` : ''}
          </div>

          <div class="reihe" style="margin-bottom:14px">
            <span><strong>Würde ich wieder kochen</strong></span>
            <button type="button" class="chip ${r.wiederKochen === true ? 'aktiv' : ''}" data-wieder="ja">Ja 😍</button>
            <button type="button" class="chip ${r.wiederKochen === false ? 'aktiv' : ''}" data-wieder="nein">Eher nicht 😅</button>
          </div>

          <label class="feld-label" for="eigene-notizen">Was ich nächstes Mal anders mache</label>
          <textarea id="eigene-notizen" placeholder="Mehr Knoblauch. Immer mehr Knoblauch."
                    style="min-height:90px">${esc(r.eigeneNotizen)}</textarea>
          <p class="feld-hilfe" data-notiz-status>Wird automatisch gespeichert.</p>
        </div>
      </section>

      <div class="reihe abstand-oben" style="justify-content:flex-end">
        <button type="button" class="knopf-3 knopf-gefahr" data-loeschen>🗑️ Rezept löschen</button>
      </div>
    </article>`;

  await bildNachladen(ziel, r);
  verdrahten(ziel, r);
}

function quelleHtml(r) {
  const q = r.quelle || {};
  if (q.art === 'beispiel') {
    return `<div class="quelle-zeile"><span aria-hidden="true">🍓</span>
              <span>Beispielrezept von Schmecki - du kannst es bearbeiten oder löschen.</span>
            </div>`;
  }
  if (q.art === 'foto') {
    return `<div class="quelle-zeile"><span aria-hidden="true">📸</span>
              <span>Von einem Foto abgelesen${q.caption ? ` · dein Hinweis: „${esc(q.caption)}"` : ''}</span>
            </div>`;
  }

  if (!q.url && !q.creator) return '';

  return `
    <div class="quelle-zeile">
      <span aria-hidden="true">${q.art === 'video' ? '🎬' : q.art === 'tiktok' ? '🎵' : '✍️'}</span>
      <span>
        ${q.creator ? `Von <strong>${esc(q.creator)}</strong>` : 'Selbst eingetippt'}
        ${q.url ? ` · <a href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">Original ansehen ↗</a>` : ''}
      </span>
    </div>`;
}

async function bildNachladen(ziel, r) {
  if (!r.bildKey) return;
  const url = await store.bildUrl(r.bildKey);
  if (!url) return;
  const halter = ziel.querySelector('[data-bild-key]');
  if (halter) halter.innerHTML = `<img class="rezept-bild" src="${url}" alt="${esc(r.titel)}">`;
}

// ---------------------------------------------------------------- Bedienung

function verdrahten(ziel, r) {
  const neuZeichnen = () => zeichnen(ziel, r.id);

  // Portionen
  for (const b of ziel.querySelectorAll('[data-portionen]')) {
    b.addEventListener('click', () => {
      const neu = r.portionen + Number(b.dataset.portionen);
      if (neu < 1 || neu > 50) return;
      store.rezeptAendern(r.id, { portionen: neu });
      neuZeichnen();
    });
  }
  ziel.querySelector('[data-portionen-reset]')?.addEventListener('click', () => {
    store.rezeptAendern(r.id, { portionen: r.portionenOriginal || r.portionen });
    neuZeichnen();
  });

  // Favorit
  ziel.querySelector('[data-favorit]').addEventListener('click', (e) => {
    const jetzt = store.favoritUmschalten(r.id);
    const knopf = e.currentTarget;
    knopf.classList.toggle('gefuellt', jetzt);
    knopf.innerHTML = herz(jetzt);
    if (jetzt) {
      knopf.classList.add('pop');
      setTimeout(() => knopf.classList.remove('pop'), 450);
      toast('Gemerkt!', '❤️');
    }
  });

  // Einkaufsliste
  ziel.querySelector('[data-auf-liste]').addEventListener('click', () => {
    const aktuell = store.rezept(r.id);
    zutatKram.rezeptAufListe(store.liste(), aktuell, aktuell.portionen);
    store.listeGeaendert();
    toast(`${aktuell.zutaten.length} Zutaten auf der Liste`, '🛒');
  });

  // Einplanen
  ziel.querySelector('[data-einplanen]').addEventListener('click', () => einplanenModal(r));

  // Gekocht
  ziel.querySelector('[data-gekocht]').addEventListener('click', () => {
    store.rezeptAendern(r.id, { gekocht: new Date().toISOString() });
    toast('Guten Appetit!', '🍳');
    neuZeichnen();
  });

  // Teilen
  ziel.querySelector('[data-teilen]').addEventListener('click', async () => {
    const text = textFassung(store.rezept(r.id));
    const art = await teilen({ titel: r.titel, text, url: r.quelle?.url || '' });
    if (art === 'kopiert') toast('Rezept in die Zwischenablage kopiert', '📋');
    if (art === 'nix') toast('Teilen hat nicht geklappt', '😕');
  });

  ziel.querySelector('[data-drucken]').addEventListener('click', () => window.print());

  // Bild tauschen
  ziel.querySelector('[data-bild-tauschen]').addEventListener('click', async () => {
    const datei = await dateiWaehlen('image/*');
    if (!datei) return;
    if (!datei.type.startsWith('image/')) {
      toast('Das ist kein Bild', '🙈');
      return;
    }
    const klein = await store.bildVerkleinern(datei);
    const key = await store.bildSpeichern(klein);
    if (!key) {
      toast('Das Bild ließ sich nicht speichern', '😕');
      return;
    }
    const alterKey = store.rezept(r.id).bildKey;
    store.rezeptAendern(r.id, { bildKey: key });
    if (alterKey) await store.bildLoeschen(alterKey);
    toast('Neues Bild sitzt', '🖼️');
    neuZeichnen();
  });

  // Sterne
  ziel.querySelector('[data-sterne]')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-stern]');
    if (!b) return;
    const wert = Number(b.dataset.stern);
    store.rezeptAendern(r.id, { bewertung: wert || null });
    neuZeichnen();
  });
  ziel.querySelector('[data-stern="0"]')?.addEventListener('click', () => {
    store.rezeptAendern(r.id, { bewertung: null });
    neuZeichnen();
  });

  // Würde ich wieder kochen
  for (const b of ziel.querySelectorAll('[data-wieder]')) {
    b.addEventListener('click', () => {
      const willJa = b.dataset.wieder === 'ja';
      const aktuell = store.rezept(r.id).wiederKochen;
      store.rezeptAendern(r.id, { wiederKochen: aktuell === willJa ? null : willJa });
      neuZeichnen();
    });
  }

  // Eigene Notizen - beim Tippen mit kurzer Verzögerung speichern
  const notiz = ziel.querySelector('#eigene-notizen');
  const status = ziel.querySelector('[data-notiz-status]');
  let timer;
  notiz.addEventListener('input', () => {
    clearTimeout(timer);
    status.textContent = 'Schreibe...';
    timer = setTimeout(() => {
      store.rezeptAendern(r.id, { eigeneNotizen: notiz.value });
      status.textContent = 'Gespeichert ✓';
    }, 600);
  });

  // Tag anklicken führt zurück ins Kochbuch
  for (const a of ziel.querySelectorAll('[data-tag-link]')) {
    a.addEventListener('click', () => {
      // Das Kochbuch merkt sich seinen Filter selbst; hier reicht der Sprung
      location.hash = '#/rezepte';
    });
  }

  // Löschen
  ziel.querySelector('[data-loeschen]').addEventListener('click', async () => {
    const sicher = await nachfragen({
      titel: 'Rezept löschen?',
      text: `"${r.titel}" wird aus dem Kochbuch, der Einkaufsliste und dem Wochenplan entfernt. Das lässt sich nicht zurückholen.`,
      jaText: 'Ja, löschen',
      gefahr: true,
    });
    if (!sicher) return;
    await store.rezeptLoeschen(r.id);
    toast('Rezept gelöscht', '🗑️');
    location.hash = '#/rezepte';
  });
}

/** Rezept als Text - fürs Teilen und für die Zwischenablage. */
function textFassung(r) {
  const basis = r.portionenOriginal || r.portionen;
  const zutaten = zutatKram.zutatenSkalieren(r.zutaten, basis, r.portionen);

  const zeilen = [
    `${rezeptEmoji(r)} ${r.titel}`,
    '',
    `${r.portionen} ${r.portionen === 1 ? 'Portion' : 'Portionen'}`
      + (r.zeit?.gesamt ? ` · ${zeitText(r.zeit.gesamt)}` : '')
      + ` · ${schwierigkeitText(r.schwierigkeit)}`,
    '',
    'ZUTATEN',
    ...zutaten.map((z) => {
      const menge = zutatKram.mengeMitEinheit(z.menge, z.einheit);
      return `- ${menge ? `${menge} ` : ''}${z.name}${z.hinweis ? ` (${z.hinweis})` : ''}`;
    }),
    '',
    'ZUBEREITUNG',
    ...r.schritte.map((s, i) => `${i + 1}. ${s.text}`),
  ];

  if (r.notizen) zeilen.push('', `Tipp: ${r.notizen}`);
  if (r.quelle?.creator) zeilen.push('', `Original von ${r.quelle.creator}`);

  return zeilen.join('\n');
}

// ---------------------------------------------------------------- Einplanen

const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/** Montag der Woche, in der das Datum liegt. */
export function montagVon(datum = new Date()) {
  const d = new Date(datum);
  d.setHours(12, 0, 0, 0);
  const versatz = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - versatz);
  return d;
}

export function isoTag(datum) {
  const d = new Date(datum);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function einplanenModal(r) {
  const montag = montagVon();
  const tage = TAGE.map((name, i) => {
    const d = new Date(montag);
    d.setDate(d.getDate() + i);
    return { name, iso: isoTag(d), datum: d };
  });

  const modal = modalOeffnen(`
    <h2>Einplanen</h2>
    <p class="leise klein">"${esc(r.titel)}" - wann soll's das geben?</p>
    <div style="display:grid;gap:8px;margin-top:16px">
      ${tage.map((t) => `
        <div class="reihe" style="gap:8px">
          <strong style="min-width:104px">${t.name}</strong>
          <span class="klein leise" style="min-width:56px">${t.datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
          <button type="button" class="chip" data-plan="${t.iso}|mittag">Mittag</button>
          <button type="button" class="chip" data-plan="${t.iso}|abend">Abend</button>
        </div>`).join('')}
    </div>`);

  modal.addEventListener('click', (e) => {
    const b = e.target.closest('[data-plan]');
    if (!b) return;
    const [tag, slot] = b.dataset.plan.split('|');
    store.planSetzen(tag, slot, r.id);
    modalSchliessen();
    toast('Im Wochenplan eingetragen', '📅');
  });
}
