/**
 * Kleinteile fürs Bedienen: Toasts, Modale, Nachfragen, Textkram.
 *
 * Liegt bewusst zwischen app.js und den Views, damit sich beide daran bedienen
 * können, ohne sich gegenseitig zu importieren.
 */

// ---------------------------------------------------------------- Text

/** Fremden Text sicher in HTML einsetzen. */
export function esc(text) {
  return (text ?? '').toString().replace(/[&<>"']/g, (z) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[z]));
}

/** "25 Min." - oder leer, wenn keine Zeit bekannt ist. */
export function zeitText(minuten) {
  if (!minuten) return '';
  if (minuten < 60) return `${minuten} Min.`;
  const std = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest ? `${std} Std. ${rest} Min.` : `${std} Std.`;
}

export function schwierigkeitText(wert) {
  return { einfach: 'Einfach', mittel: 'Mittel', aufwendig: 'Aufwendig' }[wert] || 'Einfach';
}

/** "vor 3 Tagen", "gestern", "heute" - für Rezeptkarten. */
export function vorText(iso) {
  if (!iso) return '';
  const dann = new Date(iso);
  if (Number.isNaN(dann.getTime())) return '';
  const tage = Math.floor((Date.now() - dann.getTime()) / 86400000);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  if (tage < 7) return `vor ${tage} Tagen`;
  if (tage < 31) return `vor ${Math.floor(tage / 7)} Wochen`;
  return dann.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------- Toasts

const toastBox = () => document.getElementById('toasts');

/** Kurze Rückmeldung unten in der Mitte. */
export function toast(text, emoji = '') {
  const box = toastBox();
  if (!box) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${emoji ? `<span aria-hidden="true">${emoji}</span>` : ''}<span>${esc(text)}</span>`;
  box.appendChild(el);

  setTimeout(() => {
    el.classList.add('weg');
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

// ---------------------------------------------------------------- Modal

const schicht = () => document.getElementById('modal-schicht');
let zuletztFokussiert = null;
let aktuellesBeimSchliessen = null;

/**
 * Öffnet ein Modal.
 * @param {string} inhalt  HTML für das Innere (ohne die .modal-Hülle)
 * @param {object} opt     { breit, beimSchliessen, klasse }
 * @returns {HTMLElement}  das .modal-Element, damit der Aufrufer Listener setzen kann
 */
export function modalOeffnen(inhalt, opt = {}) {
  const box = schicht();
  zuletztFokussiert = document.activeElement;

  box.innerHTML = `
    <div class="modal ${opt.klasse || ''}" role="dialog" aria-modal="true">
      <button type="button" class="ikon-knopf modal-schliessen" data-modal-zu aria-label="Schließen">✕</button>
      ${inhalt}
    </div>`;
  box.hidden = false;
  document.body.style.overflow = 'hidden';
  aktuellesBeimSchliessen = opt.beimSchliessen || null;

  const modal = box.querySelector('.modal');
  // Erstes sinnvolles Element fokussieren, damit man direkt tippen kann
  const ziel = modal.querySelector('input:not([type=file]), textarea, button:not([data-modal-zu])');
  ziel?.focus();

  return modal;
}

export function modalSchliessen() {
  const box = schicht();
  if (box.hidden) return;
  box.hidden = true;
  box.innerHTML = '';
  document.body.style.overflow = '';
  const fn = aktuellesBeimSchliessen;
  aktuellesBeimSchliessen = null;
  fn?.();
  zuletztFokussiert?.focus?.();
}

export function modalOffen() {
  return !schicht().hidden;
}

/** Ersetzt nur den Inhalt des offenen Modals - für Schritt-für-Schritt-Abläufe. */
export function modalInhalt(html) {
  const modal = schicht().querySelector('.modal');
  if (!modal) return null;
  const knopf = modal.querySelector('.modal-schliessen');
  modal.innerHTML = '';
  if (knopf) modal.appendChild(knopf);
  modal.insertAdjacentHTML('beforeend', html);
  return modal;
}

/**
 * Nachfrage mit zwei Knöpfen. Löst zu true oder false auf.
 */
export function nachfragen({ titel, text, jaText = 'Ja, machen', neinText = 'Abbrechen', gefahr = false }) {
  return new Promise((auf) => {
    const modal = modalOeffnen(
      `
      <h2>${esc(titel)}</h2>
      <p>${esc(text)}</p>
      <div class="reihe abstand-oben">
        <button type="button" class="knopf-2" data-nein>${esc(neinText)}</button>
        <button type="button" class="knopf ${gefahr ? 'knopf-gefahr-voll' : ''}" data-ja>${esc(jaText)}</button>
      </div>`,
      { klasse: 'modal-schmal', beimSchliessen: () => auf(false) },
    );

    modal.querySelector('[data-ja]').addEventListener('click', () => {
      aktuellesBeimSchliessen = null;
      modalSchliessen();
      auf(true);
    });
    modal.querySelector('[data-nein]').addEventListener('click', () => modalSchliessen());
  });
}

// ---------------------------------------------------------------- Sonstiges

/** Datei-Download anstoßen (Export). */
export function dateiSpeichern(name, inhalt, typ = 'application/json') {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Datei auswählen lassen. Löst zu einer File oder null auf. */
export function dateiWaehlen(accept) {
  return new Promise((auf) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.addEventListener('change', () => auf(input.files?.[0] || null), { once: true });
    input.click();
  });
}

/** Teilen - über die System-Freigabe, sonst in die Zwischenablage. */
export async function teilen({ titel, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titel, text, url });
      return 'geteilt';
    } catch {
      return 'abgebrochen';
    }
  }
  try {
    await navigator.clipboard.writeText([titel, text, url].filter(Boolean).join('\n'));
    return 'kopiert';
  } catch {
    return 'nix';
  }
}
