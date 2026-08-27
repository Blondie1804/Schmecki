/**
 * Rezept-Import: TikTok-Link, Text einfügen, Foto abknipsen oder Video hochladen.
 *
 * Der Link-Weg holt erst die Caption (schnell, ohne Claude) und schickt sie
 * dann zur Analyse. Reicht die Caption nicht - bei Food-TikToks steht das
 * Rezept oft nur im Video und in der Caption nur Hashtag-Salat - schiebt die
 * App auf den Video-Weg weiter und nimmt Thumbnail und Creator mit.
 *
 * Der Foto-Weg ist für Rezeptkarten (HelloFresh & Co.), Kochbuchseiten und
 * Screenshots. Mehrere Bilder sind Seiten EINES Rezepts, weil Karten vorne die
 * Zutaten und hinten die Schritte haben.
 */

import * as store from './store.js';
import { esc, toast, modalOeffnen, modalInhalt, modalSchliessen } from './ui.js';

const SPRUECHE = [
  'Ich schnipple dein TikTok auseinander… 🔪🍅',
  'Zutaten sortieren… 🥕',
  'Mengen abmessen… ⚖️',
  'Töpfe zusammensuchen… 🍳',
  'Schritte in Reihenfolge bringen… 📋',
  'Rezeptkarte schreiben… ✍️',
  'Noch ein Herzchen dazu… 💕',
];

const SPRUECHE_FOTO = [
  'Ich entziffere deine Karte… 🔍',
  'Zutatenliste abtippen… 📝',
  'Mengen übernehmen… ⚖️',
  'Nährwerttabelle ignorieren… 🙈',
  'Schritte sortieren… 📋',
  'Rezeptkarte schreiben… ✍️',
];

const VIDEO_TYPEN = '.mp4,.mov,.mkv,.webm,.m4v,.avi,.mp3,.m4a,.wav,.aac,video/*,audio/*';
const BILD_TYPEN = 'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif';

/** So viele Seiten nimmt das Backend an (siehe MAX_BILDER in claude_recipe.py). */
const MAX_BILDER = 6;

/** Was der Import gerade mitschleppt (Thumbnail, Creator, Link). */
let gepaeck = {};

/** Die ausgewählten Fotos, in Seitenreihenfolge. */
let fotos = [];

/**
 * Öffnet das Import-Modal.
 * @param {object} opt  { tab: 'link'|'text'|'video', link, text }
 */
export function importOeffnen(opt = {}) {
  gepaeck = {};

  // Nach einem Fehlversuch sollen die schon ausgewählten Seiten liegenbleiben -
  // sonst muss man beide Kartenseiten nochmal fotografieren, nur weil der
  // API-Key fehlte.
  if (opt.fotosBehalten) {
    for (const f of fotos) URL.revokeObjectURL(f.url);
    fotos = fotos.map((f) => ({ datei: f.datei, url: URL.createObjectURL(f.datei) }));
  } else {
    for (const f of fotos) URL.revokeObjectURL(f.url);
    fotos = [];
  }

  const tab = opt.tab || 'link';

  const modal = modalOeffnen(`
    <h2>Rezept hinzufügen</h2>

    <div class="tabs" role="tablist">
      <button type="button" class="tab ${tab === 'link' ? 'aktiv' : ''}" data-tab="link">TikTok-Link</button>
      <button type="button" class="tab ${tab === 'text' ? 'aktiv' : ''}" data-tab="text">Rezept als Text</button>
      <button type="button" class="tab ${tab === 'foto' ? 'aktiv' : ''}" data-tab="foto">Foto</button>
      <button type="button" class="tab ${tab === 'video' ? 'aktiv' : ''}" data-tab="video">Video hochladen</button>
    </div>

    <div class="tab-inhalt ${tab === 'link' ? 'aktiv' : ''}" data-inhalt="link">
      <form id="link-form">
        <label class="feld-label" for="imp-link">Link zum TikTok</label>
        <input type="text" id="imp-link" placeholder="https://www.tiktok.com/@foodie/video/..."
               value="${esc(opt.link || '')}" autocomplete="off" spellcheck="false" inputmode="url">
        <p class="feld-hilfe">
          Du kannst den ganzen Teilen-Text einfügen, ich fische den Link heraus.
        </p>
        <div class="reihe abstand-oben">
          <button type="submit" class="knopf">Rezept zaubern ✨</button>
        </div>
      </form>
    </div>

    <div class="tab-inhalt ${tab === 'text' ? 'aktiv' : ''}" data-inhalt="text">
      <form id="text-form">
        <label class="feld-label" for="imp-text">Rezept oder Video-Beschreibung</label>
        <textarea id="imp-text" placeholder="500 g Pasta, 200 ml Sahne, 3 Knoblauchzehen…&#10;&#10;Einfach reinkopieren oder eintippen - egal wie unsortiert.">${esc(opt.text || '')}</textarea>
        <p class="feld-hilfe">
          Funktioniert mit Kommentaren, Screenshots-Text, Omas Zettel - Hauptsache,
          Zutaten und Zubereitung stehen irgendwie drin.
        </p>
        <div class="reihe abstand-oben">
          <button type="submit" class="knopf">Rezept zaubern ✨</button>
        </div>
      </form>
    </div>

    <div class="tab-inhalt ${tab === 'foto' ? 'aktiv' : ''}" data-inhalt="foto">
      <div class="ablage" data-foto-ablage tabindex="0" role="button">
        <span class="ablage-emoji" aria-hidden="true">📸</span>
        <span class="ablage-gross">Fotos hierher ziehen</span>
        <span class="ablage-klein">
          oder klicken zum Auswählen · Rezeptkarte, Kochbuchseite, Screenshot
        </span>
      </div>

      <div class="foto-streifen" data-foto-streifen hidden></div>

      <form id="foto-form" hidden data-foto-form>
        <label class="feld-label" for="imp-foto-hinweis">Noch etwas dazu? (optional)</label>
        <input type="text" id="imp-foto-hinweis" autocomplete="off"
               placeholder="z. B. nur die Hälfte kochen, ich habe kein Koriander">
        <div class="reihe abstand-oben">
          <button type="submit" class="knopf">Rezept zaubern ✨</button>
          <button type="button" class="knopf-3" data-fotos-weg>Fotos verwerfen</button>
        </div>
      </form>

      <p class="feld-hilfe">
        <strong>Rezeptkarten haben zwei Seiten.</strong> Fotografier beide und wähl sie
        zusammen aus - vorne die Zutaten, hinten die Schritte. Ich baue daraus
        ein Rezept, nicht zwei. Bis zu ${MAX_BILDER} Seiten gehen.
      </p>
      <p class="feld-hilfe">
        Am besten gerade von oben, mit Licht und ohne Schatten auf der Schrift.
        Nährwerttabellen und Werbung lasse ich weg. Das erste Foto wird das
        Rezeptbild - du kannst es später austauschen.
      </p>
    </div>

    <div class="tab-inhalt ${tab === 'video' ? 'aktiv' : ''}" data-inhalt="video">
      <div class="ablage" data-ablage tabindex="0" role="button">
        <span class="ablage-emoji" aria-hidden="true">🎬</span>
        <span class="ablage-gross">Video hierher ziehen</span>
        <span class="ablage-klein">oder klicken zum Auswählen · MP4, MOV, WEBM · max. 200 MB</span>
      </div>
      <p class="feld-hilfe">
        Das Video bleibt auf deinem Rechner: Schmecki hört sich die Tonspur lokal an
        und schickt nur den erkannten Text an die Rezept-Analyse. Danach wird die
        Datei gelöscht.
      </p>
      <p class="feld-hilfe">
        Beim ersten Mal lädt das Spracherkennungs-Modell herunter (rund 500 MB, einmalig).
      </p>
    </div>
  `, { klasse: 'modal-import' });

  verdrahten(modal);

  // Behaltene Seiten wieder anzeigen
  if (fotos.length) fotoStreifenZeichnen(modal);
}

function verdrahten(modal) {
  for (const t of modal.querySelectorAll('[data-tab]')) {
    t.addEventListener('click', () => {
      for (const x of modal.querySelectorAll('[data-tab]')) x.classList.toggle('aktiv', x === t);
      for (const x of modal.querySelectorAll('[data-inhalt]')) {
        x.classList.toggle('aktiv', x.dataset.inhalt === t.dataset.tab);
      }
      modal.querySelector('.tab-inhalt.aktiv input, .tab-inhalt.aktiv textarea')?.focus();
    });
  }

  modal.querySelector('#link-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const link = modal.querySelector('#imp-link').value.trim();
    if (!link) {
      modal.querySelector('#imp-link').focus();
      return;
    }
    vonLink(link);
  });

  modal.querySelector('#text-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = modal.querySelector('#imp-text').value.trim();
    if (text.length < 15) {
      fehlerZeigen('Das sind zu wenige Worte für ein Rezept. Schreib etwas mehr rein.', 'text');
      return;
    }
    vonText(text);
  });

  // --- Foto-Tab
  const fotoAblage = modal.querySelector('[data-foto-ablage]');
  fotoAblage.addEventListener('click', () => bildDialog(modal));
  fotoAblage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      bildDialog(modal);
    }
  });
  fotoAblage.addEventListener('dragover', (e) => {
    e.preventDefault();
    fotoAblage.classList.add('ueber');
  });
  fotoAblage.addEventListener('dragleave', () => fotoAblage.classList.remove('ueber'));
  fotoAblage.addEventListener('drop', (e) => {
    e.preventDefault();
    fotoAblage.classList.remove('ueber');
    fotosAufnehmen([...(e.dataTransfer.files || [])], modal);
  });

  modal.querySelector('[data-foto-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!fotos.length) return;
    vonFotos(modal.querySelector('#imp-foto-hinweis').value.trim());
  });

  modal.querySelector('[data-fotos-weg]').addEventListener('click', () => {
    fotos = [];
    fotoStreifenZeichnen(modal);
  });

  // Bild aus der Zwischenablage einfügen - Screenshot machen, Strg+V, fertig
  modal.addEventListener('paste', (e) => {
    const aktiverTab = modal.querySelector('.tab-inhalt.aktiv')?.dataset.inhalt;
    if (aktiverTab !== 'foto') return;
    const dateien = [...(e.clipboardData?.files || [])].filter((d) => d.type.startsWith('image/'));
    if (!dateien.length) return;
    e.preventDefault();
    fotosAufnehmen(dateien, modal);
  });

  // --- Video-Tab
  const ablage = modal.querySelector('[data-ablage]');
  ablage.addEventListener('click', () => dateiDialog());
  ablage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dateiDialog();
    }
  });
  ablage.addEventListener('dragover', (e) => {
    e.preventDefault();
    ablage.classList.add('ueber');
  });
  ablage.addEventListener('dragleave', () => ablage.classList.remove('ueber'));
  ablage.addEventListener('drop', (e) => {
    e.preventDefault();
    ablage.classList.remove('ueber');
    const datei = e.dataTransfer.files?.[0];
    if (datei) vonVideo(datei);
  });
}

function dateiDialog() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = VIDEO_TYPEN;
  input.addEventListener('change', () => {
    const datei = input.files?.[0];
    if (datei) vonVideo(datei);
  }, { once: true });
  input.click();
}

// ---------------------------------------------------------------- Fotos auswählen

function bildDialog(modal) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = BILD_TYPEN;
  input.multiple = true;
  input.addEventListener('change', () => {
    fotosAufnehmen([...(input.files || [])], modal);
  }, { once: true });
  input.click();
}

/** Nimmt neue Dateien in die Seitenliste auf - mit den üblichen Prüfungen. */
function fotosAufnehmen(dateien, modal) {
  const bilder = dateien.filter(
    (d) => d.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(d.name),
  );

  if (!bilder.length) {
    toast('Das waren keine Bilder', '🙈');
    return;
  }

  const platz = MAX_BILDER - fotos.length;
  if (platz <= 0) {
    toast(`Mehr als ${MAX_BILDER} Seiten nehme ich nicht`, '✋');
    return;
  }

  if (bilder.length > platz) {
    toast(`Nur ${platz} ${platz === 1 ? 'Seite' : 'Seiten'} passen noch dazu`, '✋');
  }

  for (const datei of bilder.slice(0, platz)) {
    fotos.push({ datei, url: URL.createObjectURL(datei) });
  }

  fotoStreifenZeichnen(modal);
}

/** Zeichnet die Vorschau-Miniaturen mit Seitennummer und Entfernen-Knopf. */
function fotoStreifenZeichnen(modal) {
  const streifen = modal.querySelector('[data-foto-streifen]');
  const formular = modal.querySelector('[data-foto-form]');
  const ablage = modal.querySelector('[data-foto-ablage]');

  streifen.hidden = fotos.length === 0;
  formular.hidden = fotos.length === 0;

  ablage.querySelector('.ablage-gross').textContent = fotos.length
    ? 'Weitere Seite hinzufügen'
    : 'Fotos hierher ziehen';

  streifen.innerHTML = fotos.map((f, i) => `
    <div class="foto-kachel">
      <img src="${f.url}" alt="Seite ${i + 1}">
      <span class="foto-nummer">${fotos.length > 1 ? `Seite ${i + 1}` : 'Foto'}</span>
      <button type="button" class="foto-weg" data-foto-weg="${i}"
              aria-label="Seite ${i + 1} entfernen">✕</button>
    </div>`).join('');

  for (const b of streifen.querySelectorAll('[data-foto-weg]')) {
    b.addEventListener('click', () => {
      const index = Number(b.dataset.fotoWeg);
      URL.revokeObjectURL(fotos[index].url);
      fotos.splice(index, 1);
      fotoStreifenZeichnen(modal);
    });
  }
}

// ---------------------------------------------------------------- Anzeige während der Arbeit

let spruchTakt = null;

/**
 * Ersetzt den Modal-Inhalt durch die Ladeanzeige.
 * @param {number|null} anteil  0..1 für den Balken, null für "unbestimmt"
 */
function ladenZeigen(text, anteil = null, kessel = '🍲', spruecheListe = SPRUECHE) {
  modalInhalt(`
    <div class="laden">
      <span class="kessel" aria-hidden="true">${kessel}</span>
      <p class="spruch" data-spruch>${esc(text)}</p>
      <div class="balken ${anteil === null ? 'unbestimmt' : ''}">
        <i style="width:${anteil === null ? 40 : Math.round(anteil * 100)}%"></i>
      </div>
      ${anteil === null ? '' : `<p class="prozent">${Math.round(anteil * 100)} %</p>`}
    </div>`);

  spruecheRotieren(spruecheListe);
}

function ladenAktualisieren(text, anteil) {
  const spruch = document.querySelector('[data-spruch]');
  const balken = document.querySelector('.balken');
  const prozent = document.querySelector('.prozent');
  if (spruch && text) spruch.textContent = text;
  if (balken && anteil !== null && anteil !== undefined) {
    balken.classList.remove('unbestimmt');
    balken.querySelector('i').style.width = `${Math.round(anteil * 100)}%`;
    if (prozent) prozent.textContent = `${Math.round(anteil * 100)} %`;
  }
}

/** Während Claude arbeitet, wechseln die Sprüche - damit es nicht steht. */
function spruecheRotieren(liste = SPRUECHE) {
  spruecheStoppen();
  let i = 0;
  spruchTakt = setInterval(() => {
    const el = document.querySelector('[data-spruch]');
    if (!el) {
      spruecheStoppen();
      return;
    }
    i = (i + 1) % liste.length;
    el.textContent = liste[i];
  }, 2800);
}

function spruecheStoppen() {
  if (spruchTakt) clearInterval(spruchTakt);
  spruchTakt = null;
}

function fehlerZeigen(text, zurueckTab = 'link', extra = '') {
  spruecheStoppen();
  modalInhalt(`
    <h2>Hm.</h2>
    <div class="fehler-box">
      <span class="fehler-emoji" aria-hidden="true">🙈</span>
      <div>${esc(text)}</div>
    </div>
    ${extra}
    <div class="reihe abstand-oben">
      <button type="button" class="knopf-2" data-modal-zu>Schließen</button>
      <button type="button" class="knopf" data-nochmal="${esc(zurueckTab)}">Nochmal versuchen</button>
    </div>`);

  document.querySelector('[data-nochmal]')?.addEventListener('click', (e) => {
    const tab = e.currentTarget.dataset.nochmal;
    const link = gepaeck.url || '';
    modalSchliessen();
    importOeffnen({ tab, link, fotosBehalten: tab === 'foto' });
  });
}

// ---------------------------------------------------------------- Die drei Wege

async function vonLink(link) {
  ladenZeigen('Ich schaue mir das TikTok an… 🎵', null, '🎵');

  let meta;
  try {
    meta = await postJson('/api/tiktok', { link });
  } catch (e) {
    fehlerZeigen(e.message, 'link');
    return;
  }

  gepaeck = {
    url: meta.url,
    creator: meta.creator,
    caption: meta.caption,
    bild: meta.bild,
  };

  if (!meta.caption || meta.caption.length < 15) {
    // Ohne Text kann Claude nichts machen - direkt auf den Video-Weg schicken
    videoVorschlagZeigen(
      'In der Beschreibung dieses TikToks steht kein Rezept - nur Titel und Hashtags.',
    );
    return;
  }

  ladenZeigen(
    meta.creator ? `Rezept von ${meta.creator} gefunden - ich lese es… 📖` : 'Ich lese das Rezept… 📖',
    null,
  );

  try {
    const rezept = await postJson('/api/recipe', {
      text: meta.caption,
      art: 'caption',
      creator: meta.creator,
      quelle_url: meta.url,
    });
    await fertig(rezept, { art: 'tiktok', url: meta.url, creator: meta.creator, caption: meta.caption }, meta.bild);
  } catch (e) {
    fehlerZeigen(e.message, 'link');
  }
}

async function vonText(text) {
  ladenZeigen(SPRUECHE[0], null, '📝');

  try {
    const rezept = await postJson('/api/recipe', {
      text,
      art: 'text',
      creator: gepaeck.creator || '',
      quelle_url: gepaeck.url || '',
    });
    await fertig(
      rezept,
      { art: gepaeck.url ? 'tiktok' : 'text', url: gepaeck.url || '', creator: gepaeck.creator || '', caption: '' },
      gepaeck.bild || null,
    );
  } catch (e) {
    fehlerZeigen(e.message, 'text');
  }
}

async function vonFotos(hinweis) {
  const seiten = [...fotos];   // festhalten, das Modal wird gleich neu gezeichnet
  const anzahl = seiten.length;

  ladenZeigen(
    anzahl > 1 ? `Ich lese ${anzahl} Seiten… 🔍` : 'Ich lese deine Karte… 🔍',
    null,
    '📸',
    SPRUECHE_FOTO,
  );

  // Das erste Foto wird das Rezeptbild - verkleinert, damit es den Speicher
  // nicht sprengt. Passiert parallel zur Analyse.
  const bildVersprechen = store.bildVerkleinern(seiten[0].datei).catch(() => null);

  let rezept;
  try {
    const formular = new FormData();
    for (const seite of seiten) formular.append('bilder', seite.datei, seite.datei.name);
    if (hinweis) formular.append('hinweis', hinweis);

    const antwort = await fetch('/api/recipe/bilder', { method: 'POST', body: formular });
    const daten = await antwort.json().catch(() => ({}));
    if (!antwort.ok) {
      throw new Error(daten.fehler || `Fehler ${antwort.status} bei der Bild-Analyse.`);
    }
    rezept = daten;
  } catch (e) {
    const meldung = e instanceof TypeError
      ? 'Der Schmecki-Server antwortet nicht. Läuft er noch?'
      : e.message;
    fehlerZeigen(meldung, 'foto');
    return;
  }

  const bildBlob = await bildVersprechen;
  const bildKey = bildBlob ? await store.bildSpeichern(bildBlob) : null;

  // Die Objekt-URLs der Vorschau brauchen wir nicht mehr
  for (const seite of seiten) URL.revokeObjectURL(seite.url);
  fotos = [];

  await fertig(
    rezept,
    { art: 'foto', url: '', creator: '', caption: hinweis || '' },
    null,
    bildKey,
  );
}

async function vonVideo(datei) {
  ladenZeigen('Video wird übertragen… 📤', 0.02, '🎬');

  let jobId;
  try {
    const formular = new FormData();
    formular.append('video', datei);
    const antwort = await fetch('/api/transcribe', { method: 'POST', body: formular });
    const daten = await antwort.json();
    if (!antwort.ok) throw new Error(daten.fehler || 'Das Video wurde nicht angenommen.');
    jobId = daten.job_id;
  } catch (e) {
    fehlerZeigen(e.message, 'video');
    return;
  }

  // Auf die Transkription warten - der Server meldet den Fortschritt
  let ergebnis;
  try {
    ergebnis = await transkriptionAbwarten(jobId);
  } catch (e) {
    fehlerZeigen(e.message, 'video');
    return;
  }

  ladenZeigen('Zugehört. Jetzt mache ich ein Rezept daraus… ✍️', null, '🍲');

  try {
    const rezept = await postJson('/api/recipe', {
      text: ergebnis.text,
      art: 'transkript',
      creator: gepaeck.creator || '',
      quelle_url: gepaeck.url || '',
      zusatz: gepaeck.caption || '',
    });
    await fertig(
      rezept,
      { art: 'video', url: gepaeck.url || '', creator: gepaeck.creator || '', caption: gepaeck.caption || '' },
      gepaeck.bild || ergebnis.bild,
    );
  } catch (e) {
    fehlerZeigen(e.message, 'video');
  }
}

/** Fragt den Job im Sekundentakt ab, bis er fertig ist. */
function transkriptionAbwarten(jobId) {
  return new Promise((auf, ab) => {
    let fehlversuche = 0;

    const takt = setInterval(async () => {
      // Modal zu? Dann hört das Fragen auf.
      if (!document.querySelector('.laden')) {
        clearInterval(takt);
        ab(new Error('abgebrochen'));
        return;
      }

      try {
        const antwort = await fetch(`/api/transcribe/${jobId}`);
        const job = await antwort.json();

        if (!antwort.ok) throw new Error(job.fehler || 'Der Job ist verschwunden.');

        fehlversuche = 0;
        ladenAktualisieren(job.meldung, job.fortschritt);

        if (job.status === 'fertig') {
          clearInterval(takt);
          auf({ text: job.text, bild: job.bild, dauer: job.dauer });
        } else if (job.status === 'fehler') {
          clearInterval(takt);
          ab(new Error(job.fehler || 'Die Transkription ist gescheitert.'));
        }
      } catch (e) {
        // Ein Aussetzer ist kein Grund zum Aufgeben - der Server rechnet ja
        fehlversuche++;
        if (fehlversuche > 5) {
          clearInterval(takt);
          ab(new Error(e.message || 'Verbindung zum Server verloren.'));
        }
      }
    }, 1200);
  });
}

// ---------------------------------------------------------------- Abschluss

/**
 * Rezept speichern - oder, wenn Claude sagt "das reicht nicht", nachfragen.
 */
async function fertig(api, quelle, bildDataUrl, fertigerBildKey = null) {
  spruecheStoppen();

  if (api.reicht_aus === false) {
    schwachesRezeptZeigen(api, quelle, bildDataUrl, fertigerBildKey);
    return;
  }

  const id = await speichern(api, quelle, bildDataUrl, fertigerBildKey);
  modalSchliessen();
  toast('Rezept ist im Kochbuch', '💕');
  location.hash = `#/rezept/${id}`;
}

/**
 * @param bildDataUrl       data:-URL vom Server (TikTok-Thumbnail, Video-Standbild)
 * @param fertigerBildKey   schon in IndexedDB abgelegtes Bild (Foto-Weg)
 */
async function speichern(api, quelle, bildDataUrl, fertigerBildKey = null) {
  let bildKey = fertigerBildKey;

  if (!bildKey && bildDataUrl) {
    const blob = await store.dataUrlZuBlob(bildDataUrl);
    if (blob) bildKey = await store.bildSpeichern(blob);
  }

  const rezept = store.rezeptAusApi(api, quelle, bildKey);
  store.rezeptHinzufuegen(rezept);
  return rezept.id;
}

/**
 * Claude hat etwas gebaut, hält es aber selbst für lückenhaft.
 * Lisa entscheidet: trotzdem speichern oder das Video hochladen.
 */
function schwachesRezeptZeigen(api, quelle, bildDataUrl, fertigerBildKey = null) {
  modalInhalt(`
    <h2>Da fehlt was</h2>
    <div class="fehler-box">
      <span class="fehler-emoji" aria-hidden="true">🤏</span>
      <div>${esc(api.grund || 'Aus diesem Text lässt sich kein vollständiges Rezept bauen.')}</div>
    </div>

    <p class="klein leise">
      Gefunden habe ich: <strong>${esc(api.titel || 'kein Titel')}</strong> ·
      ${api.zutaten?.length || 0} Zutaten · ${api.schritte?.length || 0} Schritte
    </p>

    ${quelle.art === 'foto' ? `
      <p class="klein">
        Meistens hilft ein zweiter Versuch: gerade von oben, mehr Licht, und beide
        Seiten der Karte mit dabei. Notfalls tippst du die Zutaten ab.
      </p>

      <div class="reihe abstand-oben">
        <button type="button" class="knopf" data-zum-foto>📸 Nochmal fotografieren</button>
        <button type="button" class="knopf-2" data-zum-text>✍️ Abtippen</button>
        ${api.zutaten?.length ? '<button type="button" class="knopf-3" data-trotzdem>Trotzdem speichern</button>' : ''}
      </div>` : `
      <p class="klein">
        Bei TikToks steht das Rezept oft nur im Video. Lade es hoch, dann höre ich mir
        die Tonspur an - das gibt meistens ein vollständiges Rezept.
      </p>

      <div class="reihe abstand-oben">
        <button type="button" class="knopf" data-zum-video>🎬 Video hochladen</button>
        <button type="button" class="knopf-2" data-zum-text>✍️ Text einfügen</button>
        ${api.zutaten?.length ? '<button type="button" class="knopf-3" data-trotzdem>Trotzdem speichern</button>' : ''}
      </div>`}`);

  document.querySelector('[data-zum-video]')?.addEventListener('click', () => {
    modalSchliessen();
    importOeffnen({ tab: 'video' });
  });

  document.querySelector('[data-zum-foto]')?.addEventListener('click', () => {
    modalSchliessen();
    importOeffnen({ tab: 'foto' });
  });

  document.querySelector('[data-zum-text]')?.addEventListener('click', () => {
    modalSchliessen();
    importOeffnen({ tab: 'text', text: quelle.caption || '' });
  });

  document.querySelector('[data-trotzdem]')?.addEventListener('click', async () => {
    const id = await speichern(api, quelle, bildDataUrl, fertigerBildKey);
    modalSchliessen();
    toast('Gespeichert - du kannst es selbst ergänzen', '📝');
    location.hash = `#/rezept/${id}`;
  });
}

/** Nach einem Link ohne Rezept in der Caption: direkt aufs Video verweisen. */
function videoVorschlagZeigen(grund) {
  spruecheStoppen();

  modalInhalt(`
    <h2>Kein Rezept in der Beschreibung</h2>

    ${gepaeck.bild || gepaeck.creator ? `
      <div class="gefunden-box">
        ${gepaeck.bild ? `<img src="${gepaeck.bild}" alt="">` : ''}
        <div>
          <div class="gefunden-titel">${esc(gepaeck.caption || 'Ohne Beschreibung')}</div>
          <div class="gefunden-unter">${esc(gepaeck.creator || '')}</div>
        </div>
      </div>` : ''}

    <div class="fehler-box">
      <span class="fehler-emoji" aria-hidden="true">🙈</span>
      <div>${esc(grund)}</div>
    </div>

    <p class="klein">
      Lade das Video hoch - ich höre mir die Tonspur an und baue daraus das Rezept.
      Das Vorschaubild und der Creator sind schon gemerkt.
    </p>

    <div class="reihe abstand-oben">
      <button type="button" class="knopf" data-video-jetzt>🎬 Video auswählen</button>
      <button type="button" class="knopf-2" data-text-jetzt>✍️ Rezept eintippen</button>
    </div>`);

  document.querySelector('[data-video-jetzt]')?.addEventListener('click', () => dateiDialog());
  document.querySelector('[data-text-jetzt]')?.addEventListener('click', () => {
    const merk = { ...gepaeck };
    modalSchliessen();
    importOeffnen({ tab: 'text' });
    gepaeck = merk;
  });
}

// ---------------------------------------------------------------- Server

async function postJson(pfad, koerper) {
  let antwort;
  try {
    antwort = await fetch(pfad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    });
  } catch {
    throw new Error('Der Schmecki-Server antwortet nicht. Läuft er noch?');
  }

  let daten;
  try {
    daten = await antwort.json();
  } catch {
    throw new Error(`Unerwartete Antwort vom Server (Status ${antwort.status}).`);
  }

  if (!antwort.ok) {
    throw new Error(daten.fehler || daten.detail || `Fehler ${antwort.status}.`);
  }

  return daten;
}
