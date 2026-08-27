/**
 * Schmecki - Grundgerüst.
 *
 * Hält den Hash-Router, das Thema, die Navigation und den Zähler an der
 * Einkaufsliste. Die eigentlichen Seiten liegen in den anderen Modulen.
 */

import * as store from './store.js';
import * as ui from './ui.js';

import * as start from './start.js';
import * as cookbook from './cookbook.js';
import * as recipe from './recipe.js';
import * as shopping from './shopping.js';
import * as planner from './planner.js';
import * as dice from './dice.js';
import * as pantry from './pantry.js';
import { importOeffnen } from './importer.js';
import { einstellungenOeffnen } from './settings.js';

const view = () => document.getElementById('view');

/**
 * Routen: Muster, Seite, Name für die Navigations-Markierung.
 */
const ROUTEN = [
  [/^\/?$/,             ()  => start.zeichnen(view()),               'start'],
  [/^\/rezepte$/,       ()  => cookbook.zeichnen(view(), false),     'rezepte'],
  [/^\/favoriten$/,     ()  => cookbook.zeichnen(view(), true),      'favoriten'],
  [/^\/rezept\/(.+)$/,  (m) => recipe.zeichnen(view(), m[1]),        'rezepte'],
  [/^\/liste$/,         ()  => shopping.zeichnen(view()),            'liste'],
  [/^\/plan$/,          ()  => planner.zeichnen(view()),             'plan'],
  [/^\/wuerfeln$/,      ()  => dice.zeichnen(view()),                'wuerfeln'],
  [/^\/vorrat$/,        ()  => pantry.zeichnen(view()),              'vorrat'],
];

// ---------------------------------------------------------------- Router

function pfad() {
  const roh = location.hash.replace(/^#/, '');
  return roh || '/';
}

function route() {
  const p = pfad();

  for (const [muster, seite, name] of ROUTEN) {
    const treffer = p.match(muster);
    if (treffer) {
      navMarkieren(name);
      try {
        seite(treffer);
      } catch (e) {
        console.error('Seite konnte nicht gezeichnet werden', e);
        view().innerHTML = `
          <div class="leer">
            <span class="leer-emoji">😵</span>
            <h3>Hier ist etwas schiefgelaufen</h3>
            <p>Die Seite ließ sich nicht aufbauen. Die Konsole weiß mehr.</p>
            <a class="knopf" href="#/">Zur Startseite</a>
          </div>`;
      }
      // Nach jedem Seitenwechsel nach oben, sonst landet man mitten im Rezept
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
  }

  view().innerHTML = `
    <div class="leer">
      <span class="leer-emoji">🤷‍♀️</span>
      <h3>Diese Seite gibt es nicht</h3>
      <p>Vielleicht ein alter Lesezeichen-Link?</p>
      <a class="knopf" href="#/">Zur Startseite</a>
    </div>`;
  navMarkieren('');
}

function navMarkieren(name) {
  for (const a of document.querySelectorAll('[data-route]')) {
    a.classList.toggle('aktiv', a.dataset.route === name);
  }
}

// ---------------------------------------------------------------- Thema

function themaAnwenden(wert) {
  if (wert === 'system') {
    document.documentElement.removeAttribute('data-thema');
  } else {
    document.documentElement.dataset.thema = wert === 'dunkel' ? 'dunkel' : 'hell';
  }

  // Icon zeigt, was passiert, wenn man klickt
  const dunkelAktiv = wert === 'dunkel'
    || (wert === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const icon = document.querySelector('[data-thema-icon]');
  if (icon) icon.textContent = dunkelAktiv ? '☀️' : '🌙';

  const farbe = dunkelAktiv ? '#241b1e' : '#e8879c';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', farbe);
}

function themaUmschalten() {
  const jetzt = store.einstellungen().thema || 'system';
  const dunkelAktiv = jetzt === 'dunkel'
    || (jetzt === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const neu = dunkelAktiv ? 'hell' : 'dunkel';
  store.einstellungSetzen('thema', neu);
  themaAnwenden(neu);
}

// ---------------------------------------------------------------- Zähler an der Liste

// ---------------------------------------------------------------- Hinweise

/**
 * Der Port, auf dem start.ps1 / start.sh Schmecki startet.
 *
 * Warum das überhaupt eine Rolle spielt: Der Browser trennt localStorage und
 * IndexedDB pro Herkunft - und die Portnummer gehört zur Herkunft dazu.
 * http://localhost:8010 und http://localhost:8032 sind für ihn zwei
 * verschiedene Websites mit getrennten Daten. Wer Schmecki mal auf einem
 * anderen Port startet, sieht dort ein leeres Kochbuch und denkt, die Rezepte
 * seien weg. Sie liegen aber noch unter dem alten Port.
 */
const STANDARD_PORT = '8010';

/** Weggeklickte Hinweise gelten für diese Sitzung - nicht für immer. */
const weggeklickt = new Set();

function hinweiseZeichnen() {
  const box = document.getElementById('hinweise');
  if (!box) return;

  const teile = [];

  // 1. Port-Hinweis: nur wenn hier noch keine eigenen Rezepte liegen. Läuft
  //    alles normal, will das niemand lesen.
  const eigene = store.eigeneRezepteAnzahl();
  const port = location.port;
  if (!weggeklickt.has('port') && eigene === 0 && port && port !== STANDARD_PORT) {
    teile.push(`
      <div class="hinweis-banner" data-hinweis="port">
        <span class="banner-emoji" aria-hidden="true">🔌</span>
        <div class="banner-text">
          <strong>Du bist auf Port ${ui.esc(port)}, normalerweise läuft Schmecki auf ${STANDARD_PORT}.</strong>
          Rezepte hängen an der Adresse: was du auf einem anderen Port gespeichert
          hast, ist hier nicht zu sehen - es ist aber auch nicht weg. Öffne den
          alten Port, sichere dort ein Backup und lies es hier wieder ein.
        </div>
        <div class="banner-knoepfe">
          <button type="button" class="knopf-2" data-aktion="einstellungen">Backup einlesen</button>
          <button type="button" class="ikon-knopf" data-banner-zu="port" aria-label="Hinweis ausblenden">✕</button>
        </div>
      </div>`);
  }

  // 2. Backup-Erinnerung
  const faellig = store.backupFaellig();
  if (!weggeklickt.has('backup') && faellig) {
    const seit = faellig.letztesBackup
      ? `Dein letztes Backup ist von ${new Date(faellig.letztesBackup).toLocaleDateString('de-DE')}.`
      : 'Du hast noch kein Backup gespeichert.';
    teile.push(`
      <div class="hinweis-banner sanft" data-hinweis="backup">
        <span class="banner-emoji" aria-hidden="true">💾</span>
        <div class="banner-text">
          <strong>${faellig.eigene} eigene Rezepte - Zeit für ein Backup.</strong>
          ${seit} Deine Rezepte liegen nur in diesem Browser. Leert jemand die
          Browserdaten, sind sie weg.
        </div>
        <div class="banner-knoepfe">
          <button type="button" class="knopf" data-aktion="einstellungen">Backup speichern</button>
          <button type="button" class="ikon-knopf" data-banner-zu="backup" aria-label="Später">✕</button>
        </div>
      </div>`);
  }

  box.innerHTML = teile.join('');
}

function badgeAktualisieren() {
  const offen = store.liste().filter((e) => !e.erledigt).length;
  for (const el of document.querySelectorAll('[data-badge="liste"]')) {
    el.textContent = offen > 99 ? '99+' : String(offen);
    el.hidden = offen === 0;
  }
}

// ---------------------------------------------------------------- Start

function verdrahten() {
  // Ein Klick-Horcher für alles mit data-aktion
  document.addEventListener('click', (e) => {
    const bannerZu = e.target.closest('[data-banner-zu]');
    if (bannerZu) {
      weggeklickt.add(bannerZu.dataset.bannerZu);
      hinweiseZeichnen();
      return;
    }

    const ziel = e.target.closest('[data-aktion], [data-modal-zu]');
    if (!ziel) return;

    if (ziel.hasAttribute('data-modal-zu')) {
      ui.modalSchliessen();
      return;
    }

    switch (ziel.dataset.aktion) {
      case 'thema':
        themaUmschalten();
        break;
      case 'import':
        importOeffnen();
        break;
      case 'einstellungen':
        einstellungenOeffnen();
        break;
    }
  });

  // Klick auf den dunklen Hintergrund schließt das Modal
  document.getElementById('modal-schicht').addEventListener('click', (e) => {
    if (e.target.id === 'modal-schicht') ui.modalSchliessen();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.modalOffen()) ui.modalSchliessen();
  });

  window.addEventListener('hashchange', route);

  // Systemwechsel hell/dunkel mitnehmen, solange nichts anderes eingestellt ist
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((store.einstellungen().thema || 'system') === 'system') themaAnwenden('system');
  });

  store.abonnieren((was) => {
    badgeAktualisieren();
    hinweiseZeichnen();
    if (was === 'speicher-voll') {
      ui.toast('Der Speicher ist voll - lösch ein paar alte Rezepte.', '😬');
    }
  });
}

function los() {
  store.laden();
  themaAnwenden(store.einstellungen().thema || 'system');
  verdrahten();
  badgeAktualisieren();
  hinweiseZeichnen();
  route();
}

los();

// Zum Debuggen in der Konsole: schmecki.store.rezepte()
window.schmecki = { store, ui, route };
