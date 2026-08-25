/**
 * Einstellungen: Thema, Backup und Aufräumen.
 *
 * Backup heißt hier: eine JSON-Datei auf deinem Rechner. Es gibt keine Cloud,
 * keinen Account und nichts, was im Hintergrund irgendwohin synchronisiert.
 */

import * as store from './store.js';
import { toast, nachfragen, modalOeffnen, modalSchliessen, dateiSpeichern, dateiWaehlen } from './ui.js';

export function einstellungenOeffnen() {
  const thema = store.einstellungen().thema || 'system';
  const anzahl = store.rezepte().length;
  const mitBild = store.rezepte().filter((r) => r.bildKey).length;

  const modal = modalOeffnen(`
    <h2>Einstellungen</h2>

    <section style="margin-top:18px">
      <p class="feld-label">Aussehen</p>
      <div class="chips">
        <button type="button" class="chip ${thema === 'system' ? 'aktiv' : ''}" data-thema-wahl="system">🖥️ Wie das System</button>
        <button type="button" class="chip ${thema === 'hell' ? 'aktiv' : ''}" data-thema-wahl="hell">☀️ Hell</button>
        <button type="button" class="chip ${thema === 'dunkel' ? 'aktiv' : ''}" data-thema-wahl="dunkel">🌙 Dunkel</button>
      </div>
    </section>

    <section style="margin-top:24px">
      <p class="feld-label">Deine Daten</p>
      <p class="klein leise">
        ${anzahl} ${anzahl === 1 ? 'Rezept' : 'Rezepte'}${mitBild ? `, davon ${mitBild} mit Bild` : ''} ·
        alles nur in diesem Browser auf diesem Gerät.
      </p>
      <div style="display:grid;gap:9px;margin-top:12px">
        <button type="button" class="knopf-2" data-tun="export">💾 Backup speichern (mit Bildern)</button>
        <button type="button" class="knopf-2" data-tun="export-klein">📄 Backup speichern (ohne Bilder)</button>
        <button type="button" class="knopf-2" data-tun="import">📥 Backup einlesen</button>
      </div>
      <p class="feld-hilfe">
        Nimm das Backup mit auf ein anderes Gerät oder sichere es, bevor du den
        Browser-Speicher leerst.
      </p>
    </section>

    <section style="margin-top:24px">
      <p class="feld-label">Aufräumen</p>
      <div style="display:grid;gap:9px">
        <button type="button" class="knopf-2 knopf-gefahr" data-tun="alles-weg">🗑️ Alles löschen</button>
      </div>
    </section>

    <p class="feld-hilfe" style="margin-top:22px">
      Schmecki 1.0 · gebaut mit viel Altrosa 💕
      <span data-server-status></span>
    </p>`);

  serverStatusZeigen(modal);
  verdrahten(modal);
}

/** Kurz nachsehen, ob der Server einen API-Key hat - erklärt später Fehler. */
async function serverStatusZeigen(modal) {
  const ziel = modal.querySelector('[data-server-status]');
  try {
    const antwort = await fetch('/health');
    const daten = await antwort.json();
    ziel.innerHTML = daten.api_key
      ? `<br>Server läuft, Modell: ${daten.modell}`
      : '<br>⚠️ Kein API-Key hinterlegt - der Rezept-Import funktioniert nicht. Trag ihn in app/.env ein.';
  } catch {
    ziel.innerHTML = '<br>⚠️ Der Server antwortet nicht - Import und Video gehen gerade nicht.';
  }
}

function verdrahten(modal) {
  for (const c of modal.querySelectorAll('[data-thema-wahl]')) {
    c.addEventListener('click', () => {
      const wahl = c.dataset.themaWahl;
      store.einstellungSetzen('thema', wahl);
      // app.js hört nicht auf Einstellungen, also hier direkt anwenden
      if (wahl === 'system') document.documentElement.removeAttribute('data-thema');
      else document.documentElement.dataset.thema = wahl;

      const dunkel = wahl === 'dunkel'
        || (wahl === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const icon = document.querySelector('[data-thema-icon]');
      if (icon) icon.textContent = dunkel ? '☀️' : '🌙';

      for (const x of modal.querySelectorAll('[data-thema-wahl]')) {
        x.classList.toggle('aktiv', x === c);
      }
    });
  }

  modal.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tun]');
    if (!b) return;

    if (b.dataset.tun === 'export' || b.dataset.tun === 'export-klein') {
      const mitBildern = b.dataset.tun === 'export';
      b.disabled = true;
      b.textContent = 'Packe zusammen...';
      const paket = await store.exportieren(mitBildern);
      const datum = new Date().toISOString().slice(0, 10);
      dateiSpeichern(`schmecki-backup-${datum}.json`, JSON.stringify(paket, null, 2));
      modalSchliessen();
      toast('Backup gespeichert', '💾');
      return;
    }

    if (b.dataset.tun === 'import') {
      const datei = await dateiWaehlen('application/json,.json');
      if (!datei) return;

      let paket;
      try {
        paket = JSON.parse(await datei.text());
      } catch {
        toast('Die Datei ist kein lesbares JSON', '😕');
        return;
      }

      const anzahl = paket?.daten?.rezepte?.length ?? 0;
      const ersetzen = await nachfragen({
        titel: 'Backup einlesen',
        text: `Die Datei enthält ${anzahl} ${anzahl === 1 ? 'Rezept' : 'Rezepte'}. `
            + 'Soll alles Vorhandene ersetzt werden? "Abbrechen" legt die Rezepte stattdessen dazu.',
        jaText: 'Ersetzen',
        neinText: 'Dazulegen',
      });

      try {
        const ergebnis = await store.importieren(paket, ersetzen ? 'ersetzen' : 'dazu');
        modalSchliessen();
        toast(`${ergebnis.rezepte} Rezepte eingelesen`, '📥');
        location.hash = '#/rezepte';
        // Wenn wir schon auf der Seite sind, neu zeichnen lassen
        window.schmecki?.route?.();
      } catch (err) {
        toast(err.message || 'Das Backup ließ sich nicht einlesen', '😕');
      }
      return;
    }

    if (b.dataset.tun === 'alles-weg') {
      modalSchliessen();
      const sicher = await nachfragen({
        titel: 'Wirklich alles löschen?',
        text: 'Rezepte, Bilder, Einkaufsliste, Wochenplan und Vorrat sind danach weg. '
            + 'Ohne Backup lässt sich das nicht zurückholen.',
        jaText: 'Ja, alles löschen',
        gefahr: true,
      });
      if (!sicher) return;
      await store.allesLoeschen();
      toast('Alles gelöscht', '🗑️');
      location.hash = '#/';
      window.schmecki?.route?.();
    }
  });
}
