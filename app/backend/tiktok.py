"""
TikTok-Links aufloesen - ueber die oeffentliche oEmbed-Schnittstelle.

Wir laden kein Video herunter und scrapen kein HTML. oEmbed gibt uns die Caption
(das Feld heisst dort "title"), den Creator und ein Vorschaubild - genau die drei
Dinge, die wir brauchen. Bei vielen Food-TikToks steht das Rezept komplett in der
Caption; wenn nicht, faellt das Frontend auf "Video hochladen" zurueck.
"""

import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

OEMBED_URL = "https://www.tiktok.com/oembed"

# Vorschaubilder sind normalerweise deutlich kleiner - der Deckel ist nur ein Schutz
MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024

# Nur diese Hosts loesen wir auf. Verhindert, dass ueber das Link-Feld beliebige
# URLs vom Server abgerufen werden.
ERLAUBTE_HOSTS = {
    "tiktok.com",
    "www.tiktok.com",
    "m.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
}

_URL_MUSTER = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)


class TikTokError(Exception):
    """Link nicht verwertbar - die Meldung geht direkt an die Nutzerin."""
    pass


def link_aus_text(eingabe: str) -> str:
    """
    Holt die erste URL aus der Eingabe.

    Wer einen TikTok teilt, kopiert oft den ganzen Text mit ("Schau dir das an!
    https://vm.tiktok.com/... "). Wir fischen die URL heraus statt zu meckern.
    """
    if not eingabe or not eingabe.strip():
        raise TikTokError("Da ist noch kein Link drin.")

    text = eingabe.strip()
    treffer = _URL_MUSTER.search(text)
    if not treffer:
        # Vielleicht hat sie das "https://" weggelassen
        if text.startswith(("tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com")):
            return "https://" + text
        raise TikTokError("Das sieht nicht nach einem Link aus. Er sollte mit https:// anfangen.")

    return treffer.group(0).rstrip(").,;\"'")


def host_pruefen(url: str) -> None:
    """Stellt sicher, dass wir nur TikTok-Links aufloesen."""
    treffer = re.match(r"https?://([^/:?#]+)", url, re.IGNORECASE)
    if not treffer:
        raise TikTokError("Der Link ist unvollständig.")

    host = treffer.group(1).lower()
    if host not in ERLAUBTE_HOSTS:
        raise TikTokError(
            f"'{host}' ist kein TikTok-Link. Instagram und YouTube kann Schmecki noch nicht - "
            "du kannst das Rezept aber als Text einfügen."
        )


async def metadaten_holen(eingabe: str, thumbnail_laden: bool = True) -> dict:
    """
    Loest einen TikTok-Link auf.

    Returns:
        dict mit url, caption, creator, creator_url, thumbnail_url,
        thumbnail (bytes oder None), thumbnail_typ
    """
    url = link_aus_text(eingabe)
    host_pruefen(url)

    async with httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=True,
        headers={"User-Agent": "Schmecki/1.0 (privates Rezept-Kochbuch)"},
    ) as client:
        try:
            antwort = await client.get(OEMBED_URL, params={"url": url})
        except httpx.TimeoutException as e:
            raise TikTokError(
                "TikTok antwortet nicht. Probier es gleich noch einmal - oder füge "
                "das Rezept als Text ein."
            ) from e
        except httpx.HTTPError as e:
            raise TikTokError(f"Verbindung zu TikTok fehlgeschlagen: {e}") from e

        if antwort.status_code == 404:
            raise TikTokError(
                "Dieses TikTok gibt es nicht (mehr) oder es ist privat. "
                "Wenn du das Video hast, lade es einfach hoch."
            )
        if antwort.status_code != 200:
            raise TikTokError(
                f"TikTok hat mit Status {antwort.status_code} geantwortet. "
                "Ist der Link vollständig?"
            )

        try:
            daten = antwort.json()
        except ValueError as e:
            raise TikTokError("TikTok hat etwas Unerwartetes geschickt.") from e

        caption = (daten.get("title") or "").strip()
        creator = (daten.get("author_name") or "").strip()
        creator_url = (daten.get("author_url") or "").strip()
        thumbnail_url = (daten.get("thumbnail_url") or "").strip()

        ergebnis = {
            "url": url,
            "caption": caption,
            "creator": creator,
            "creator_url": creator_url,
            "thumbnail_url": thumbnail_url,
            "thumbnail": None,
            "thumbnail_typ": None,
        }

        if thumbnail_laden and thumbnail_url:
            bild, typ = await _thumbnail_laden(client, thumbnail_url)
            ergebnis["thumbnail"] = bild
            ergebnis["thumbnail_typ"] = typ

        return ergebnis


async def _thumbnail_laden(client: httpx.AsyncClient, url: str) -> tuple[Optional[bytes], Optional[str]]:
    """
    Laedt das Vorschaubild.

    Faellt still auf None zurueck - ein fehlendes Bild ist kein Grund, den
    ganzen Import scheitern zu lassen. Dann zeigt die App ein Doodle.
    """
    if not url.lower().startswith("https://"):
        return None, None

    try:
        antwort = await client.get(url)
        if antwort.status_code != 200:
            logger.info(f"Thumbnail nicht ladbar (Status {antwort.status_code})")
            return None, None

        typ = (antwort.headers.get("content-type") or "").split(";")[0].strip().lower()
        if not typ.startswith("image/"):
            logger.info(f"Thumbnail ist kein Bild ({typ})")
            return None, None

        inhalt = antwort.content
        if len(inhalt) > MAX_THUMBNAIL_BYTES:
            logger.info(f"Thumbnail zu gross ({len(inhalt)} Bytes)")
            return None, None

        return inhalt, typ
    except (httpx.HTTPError, ValueError) as e:
        logger.info(f"Thumbnail konnte nicht geladen werden: {e}")
        return None, None
