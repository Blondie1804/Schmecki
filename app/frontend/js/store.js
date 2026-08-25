/**
 * Wo Schmecki seine Sachen hinlegt.
 *
 * Alles bleibt auf diesem Gerät:
 *   - Struktur (Rezepte, Einkaufsliste, Wochenplan, Vorrat) im localStorage
 *   - Bilder als Blob in IndexedDB
 *
 * Warum getrennt? Fotos als Base64 im localStorage sprengen dessen ~5 MB nach
 * drei Rezepten. IndexedDB nimmt Blobs und hat viel mehr Platz.
 *
 * Der Server bekommt von all dem nichts zu sehen.
 */

import { SEED_REZEPTE, SEED_VORRAT } from './seed.js';

const LS_KEY = 'schmecki.daten';
const SCHEMA_VERSION = 1;

const DB_NAME = 'schmecki-bilder';
const DB_VERSION = 1;
const DB_STORE = 'bilder';

/** Eigene Fotos werden vor dem Speichern hierauf verkleinert (längste Kante). */
const MAX_BILD_KANTE = 1200;

const LEER = () => ({
  schemaVersion: SCHEMA_VERSION,
  rezepte: [],
  liste: [],
  plan: {},      // { "2026-08-24": { mittag: rezeptId, abend: rezeptId } }
  vorrat: [],    // [ { id, name, angelegt } ]
  einstellungen: {
    thema: 'system',   // 'system' | 'hell' | 'dunkel'
    geseedet: false,
  },
});

let daten = LEER();
const horcher = new Set();

// ---------------------------------------------------------------- Laden & Speichern

export function laden() {
  try {
    const roh = localStorage.getItem(LS_KEY);
    if (roh) {
      const gelesen = JSON.parse(roh);
      daten = migrieren(gelesen);
    }
  } catch (e) {
    console.error('Gespeicherte Daten sind nicht lesbar - fange neu an', e);
    daten = LEER();
  }

  // Beim allerersten Start ein paar Beispielrezepte hineinlegen, damit die App
  // nicht leer und traurig aussieht (und damit ohne API-Key alles testbar ist).
  if (!daten.einstellungen.geseedet && daten.rezepte.length === 0) {
    daten.rezepte = SEED_REZEPTE.map((r) => ({ ...r }));
    daten.vorrat = SEED_VORRAT.map((name, i) => ({
      id: `v_seed_${i}`,
      name,
      angelegt: new Date().toISOString(),
    }));
    daten.einstellungen.geseedet = true;
    speichern();
  }

  return daten;
}

export function speichern() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(daten));
  } catch (e) {
    // Quota voll - das passiert praktisch nur, wenn jemand hunderte Rezepte hat
    console.error('Speichern fehlgeschlagen', e);
    melden('speicher-voll');
    return false;
  }
  melden('geaendert');
  return true;
}

function migrieren(gelesen) {
  const basis = LEER();
  const zusammen = {
    ...basis,
    ...gelesen,
    einstellungen: { ...basis.einstellungen, ...(gelesen.einstellungen || {}) },
  };
  zusammen.schemaVersion = SCHEMA_VERSION;
  // Hier kämen künftige Migrationen hin - vorerst reicht das Auffüllen fehlender Felder
  return zusammen;
}

/** Views hängen sich hier ein und zeichnen neu, wenn sich etwas ändert. */
export function abonnieren(callback) {
  horcher.add(callback);
  return () => horcher.delete(callback);
}

function melden(was) {
  for (const cb of horcher) {
    try {
      cb(was);
    } catch (e) {
      console.error('Horcher hat sich verschluckt', e);
    }
  }
}

export function alles() {
  return daten;
}

// ---------------------------------------------------------------- Rezepte

export function rezepte() {
  return daten.rezepte;
}

export function rezept(id) {
  return daten.rezepte.find((r) => r.id === id) || null;
}

export function neueId(prefix = 'r') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Baut aus einer Claude-Antwort ein Rezept für den Speicher.
 * Die API-Antwort ist flach (zeit_gesamt, ...), im Speicher liegt es verschachtelt.
 */
export function rezeptAusApi(api, quelle = {}, bildKey = null) {
  return {
    id: neueId(),
    titel: api.titel,
    beschreibung: api.beschreibung || '',
    portionen: api.portionen,
    portionenOriginal: api.portionen,
    zeit: {
      gesamt: api.zeit_gesamt ?? null,
      vorbereitung: api.zeit_vorbereitung ?? null,
      kochen: api.zeit_kochen ?? null,
    },
    schwierigkeit: api.schwierigkeit || 'einfach',
    zutaten: (api.zutaten || []).map((z) => ({
      name: z.name,
      menge: z.menge ?? null,
      einheit: z.einheit || '',
      hinweis: z.hinweis || '',
      bereich: z.bereich || 'sonstiges',
      skalierbar: z.skalierbar !== false,
    })),
    schritte: (api.schritte || []).map((s) => ({
      text: s.text,
      minuten: s.minuten ?? null,
      temperatur: s.temperatur ?? null,
    })),
    notizen: api.notizen || '',
    tags: api.tags || [],
    unsicherheiten: api.unsicherheiten || [],
    quelle: {
      art: quelle.art || 'text',
      url: quelle.url || '',
      creator: quelle.creator || '',
      caption: quelle.caption || '',
    },
    bildKey,
    favorit: false,
    bewertung: null,
    eigeneNotizen: '',
    wiederKochen: null,
    angelegt: new Date().toISOString(),
    gekocht: null,
  };
}

export function rezeptHinzufuegen(neu) {
  daten.rezepte.unshift(neu);
  speichern();
  return neu;
}

export function rezeptAendern(id, aenderungen) {
  const vorhanden = rezept(id);
  if (!vorhanden) return null;
  Object.assign(vorhanden, aenderungen);
  speichern();
  return vorhanden;
}

export async function rezeptLoeschen(id) {
  const vorhanden = rezept(id);
  if (!vorhanden) return;

  if (vorhanden.bildKey) await bildLoeschen(vorhanden.bildKey);

  daten.rezepte = daten.rezepte.filter((r) => r.id !== id);
  daten.liste = daten.liste.filter((e) => {
    e.rezeptIds = (e.rezeptIds || []).filter((rid) => rid !== id);
    // Einträge, die nur wegen dieses Rezepts auf der Liste standen, gehen mit
    return !(e.herkunft === 'rezept' && e.rezeptIds.length === 0);
  });
  for (const tag of Object.keys(daten.plan)) {
    for (const slot of ['mittag', 'abend']) {
      if (daten.plan[tag]?.[slot] === id) delete daten.plan[tag][slot];
    }
    if (daten.plan[tag] && Object.keys(daten.plan[tag]).length === 0) delete daten.plan[tag];
  }
  speichern();
}

export function favoritUmschalten(id) {
  const r = rezept(id);
  if (!r) return false;
  r.favorit = !r.favorit;
  speichern();
  return r.favorit;
}

/** Alle Tags, die in den Rezepten vorkommen - nach Häufigkeit sortiert. */
export function alleTags() {
  const zaehler = new Map();
  for (const r of daten.rezepte) {
    for (const tag of r.tags || []) {
      zaehler.set(tag, (zaehler.get(tag) || 0) + 1);
    }
  }
  return [...zaehler.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, anzahl]) => ({ tag, anzahl }));
}

// ---------------------------------------------------------------- Einkaufsliste

export function liste() {
  return daten.liste;
}

export function listeGeaendert() {
  speichern();
}

export function listeLeeren(nurErledigte = false) {
  daten.liste = nurErledigte ? daten.liste.filter((e) => !e.erledigt) : [];
  speichern();
}

// ---------------------------------------------------------------- Wochenplan

export function plan() {
  return daten.plan;
}

export function planSetzen(tag, slot, rezeptId) {
  if (!daten.plan[tag]) daten.plan[tag] = {};
  if (rezeptId) {
    daten.plan[tag][slot] = rezeptId;
  } else {
    delete daten.plan[tag][slot];
    if (Object.keys(daten.plan[tag]).length === 0) delete daten.plan[tag];
  }
  speichern();
}

// ---------------------------------------------------------------- Vorrat

export function vorrat() {
  return daten.vorrat;
}

export function vorratHinzufuegen(name) {
  const sauber = (name || '').trim();
  if (!sauber) return false;
  const schon = daten.vorrat.some((v) => v.name.toLowerCase() === sauber.toLowerCase());
  if (schon) return false;
  daten.vorrat.push({ id: neueId('v'), name: sauber, angelegt: new Date().toISOString() });
  speichern();
  return true;
}

export function vorratEntfernen(id) {
  daten.vorrat = daten.vorrat.filter((v) => v.id !== id);
  speichern();
}

// ---------------------------------------------------------------- Einstellungen

export function einstellungen() {
  return daten.einstellungen;
}

export function einstellungSetzen(schluessel, wert) {
  daten.einstellungen[schluessel] = wert;
  speichern();
}

// ---------------------------------------------------------------- Bilder (IndexedDB)

let dbPromise = null;
const urlCache = new Map();

function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((auf, ab) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const datenbank = anfrage.result;
      if (!datenbank.objectStoreNames.contains(DB_STORE)) {
        datenbank.createObjectStore(DB_STORE);
      }
    };
    anfrage.onsuccess = () => auf(anfrage.result);
    anfrage.onerror = () => ab(anfrage.error);
  });
  return dbPromise;
}

async function transaktion(modus, arbeit) {
  const datenbank = await db();
  return new Promise((auf, ab) => {
    const tx = datenbank.transaction(DB_STORE, modus);
    const store = tx.objectStore(DB_STORE);
    let ergebnis;
    try {
      ergebnis = arbeit(store);
    } catch (e) {
      ab(e);
      return;
    }
    tx.oncomplete = () => auf(ergebnis?.result ?? ergebnis);
    tx.onerror = () => ab(tx.error);
  });
}

/** Legt ein Bild ab und gibt den Schlüssel zurück, der ins Rezept wandert. */
export async function bildSpeichern(blob) {
  if (!blob) return null;
  const key = neueId('img');
  try {
    await transaktion('readwrite', (store) => store.put(blob, key));
    return key;
  } catch (e) {
    console.error('Bild konnte nicht gespeichert werden', e);
    return null;
  }
}

/** URL zum Anzeigen. Wird gecacht, damit ein Neuzeichnen nicht flackert. */
export async function bildUrl(key) {
  if (!key) return null;
  if (urlCache.has(key)) return urlCache.get(key);
  try {
    const blob = await transaktion('readonly', (store) => store.get(key));
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(key, url);
    return url;
  } catch (e) {
    console.error('Bild konnte nicht geladen werden', e);
    return null;
  }
}

export async function bildLoeschen(key) {
  if (!key) return;
  if (urlCache.has(key)) {
    URL.revokeObjectURL(urlCache.get(key));
    urlCache.delete(key);
  }
  try {
    await transaktion('readwrite', (store) => store.delete(key));
  } catch (e) {
    console.error('Bild konnte nicht gelöscht werden', e);
  }
}

async function bildBlob(key) {
  if (!key) return null;
  try {
    return await transaktion('readonly', (store) => store.get(key));
  } catch {
    return null;
  }
}

/** data:-URL vom Server (TikTok-Thumbnail, Video-Standbild) zu einem Blob machen. */
export async function dataUrlZuBlob(dataUrl) {
  if (!dataUrl) return null;
  try {
    const antwort = await fetch(dataUrl);
    return await antwort.blob();
  } catch (e) {
    console.error('Bilddaten nicht lesbar', e);
    return null;
  }
}

/**
 * Eigenes Foto verkleinern, bevor es in die Datenbank geht.
 * Ein Handyfoto hat gern 4 MB - als 1200er JPEG sind es 200 KB und man sieht
 * keinen Unterschied auf einer Rezeptkarte.
 */
export async function bildVerkleinern(datei) {
  if (!datei) return null;

  const bitmap = await createImageBitmap(datei).catch(() => null);
  if (!bitmap) return datei; // Kein Bild lesbar - dann nehmen wir das Original

  const faktor = Math.min(1, MAX_BILD_KANTE / Math.max(bitmap.width, bitmap.height));
  if (faktor === 1 && datei.size < 600 * 1024) {
    bitmap.close?.();
    return datei;
  }

  const breite = Math.round(bitmap.width * faktor);
  const hoehe = Math.round(bitmap.height * faktor);

  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, breite, hoehe);
  bitmap.close?.();

  return new Promise((auf) => {
    canvas.toBlob((blob) => auf(blob || datei), 'image/jpeg', 0.85);
  });
}

// ---------------------------------------------------------------- Export & Import

/**
 * Alles in eine JSON-Datei - das Backup, das dieses Gerät nicht verlässt,
 * solange Lisa die Datei nicht selbst weitergibt.
 */
export async function exportieren(mitBildern = true) {
  const paket = {
    app: 'schmecki',
    schemaVersion: SCHEMA_VERSION,
    exportiert: new Date().toISOString(),
    daten: JSON.parse(JSON.stringify(daten)),
    bilder: {},
  };

  if (mitBildern) {
    for (const r of daten.rezepte) {
      if (!r.bildKey) continue;
      const blob = await bildBlob(r.bildKey);
      if (blob) paket.bilder[r.bildKey] = await blobZuDataUrl(blob);
    }
  }

  return paket;
}

function blobZuDataUrl(blob) {
  return new Promise((auf, ab) => {
    const leser = new FileReader();
    leser.onload = () => auf(leser.result);
    leser.onerror = () => ab(leser.error);
    leser.readAsDataURL(blob);
  });
}

/**
 * Backup einlesen.
 * @param {object} paket   geparste JSON-Datei
 * @param {string} modus   'ersetzen' | 'dazu'
 */
export async function importieren(paket, modus = 'dazu') {
  if (!paket || paket.app !== 'schmecki' || !paket.daten) {
    throw new Error('Das ist keine Schmecki-Datei.');
  }

  const eingang = migrieren(paket.daten);

  // Bilder zuerst - damit die Rezepte danach auf existierende Schlüssel zeigen
  const schluesselKarte = new Map();
  for (const [alterKey, dataUrl] of Object.entries(paket.bilder || {})) {
    const blob = await dataUrlZuBlob(dataUrl);
    const neuerKey = blob ? await bildSpeichern(blob) : null;
    if (neuerKey) schluesselKarte.set(alterKey, neuerKey);
  }

  const rezepteNeu = eingang.rezepte.map((r) => ({
    ...r,
    bildKey: r.bildKey && schluesselKarte.has(r.bildKey) ? schluesselKarte.get(r.bildKey) : null,
  }));

  if (modus === 'ersetzen') {
    // Alte Bilder wegräumen, sonst liegen sie für immer in der Datenbank
    for (const r of daten.rezepte) {
      if (r.bildKey) await bildLoeschen(r.bildKey);
    }
    daten = {
      ...eingang,
      rezepte: rezepteNeu,
      einstellungen: { ...eingang.einstellungen, geseedet: true },
    };
  } else {
    const vorhandeneIds = new Set(daten.rezepte.map((r) => r.id));
    const dazu = rezepteNeu.filter((r) => !vorhandeneIds.has(r.id));
    daten.rezepte = [...dazu, ...daten.rezepte];

    for (const eintrag of eingang.liste || []) {
      if (!daten.liste.some((e) => e.id === eintrag.id)) daten.liste.push(eintrag);
    }
    for (const [tag, slots] of Object.entries(eingang.plan || {})) {
      daten.plan[tag] = { ...(daten.plan[tag] || {}), ...slots };
    }
    for (const v of eingang.vorrat || []) {
      if (!daten.vorrat.some((x) => x.name.toLowerCase() === v.name.toLowerCase())) {
        daten.vorrat.push(v);
      }
    }
  }

  speichern();
  return { rezepte: rezepteNeu.length, bilder: schluesselKarte.size };
}

/** Alles weg - mit Vorwarnung im UI. */
export async function allesLoeschen() {
  for (const r of daten.rezepte) {
    if (r.bildKey) await bildLoeschen(r.bildKey);
  }
  daten = LEER();
  daten.einstellungen.geseedet = true; // nicht sofort wieder Beispiele reinlegen
  speichern();
}
