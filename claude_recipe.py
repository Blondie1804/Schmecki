"""
Aus Text ein Rezept machen - via Claude API.

Das ist das fragile Herz der App: der Prompt bestimmt, ob aus einer TikTok-Caption
ein brauchbares Rezept wird oder Gruetze. Aenderungen klein halten und immer gegen
mindestens drei echte TikToks gegenpruefen (eins mit Rezept in der Caption, eins mit
Rezept nur im Video, eins mit reinem Hashtag-Salat).

Die Struktur erzwingt das SDK ueber ein Pydantic-Modell (Structured Outputs) - wir
parsen kein JSON von Hand.
"""

import logging
import os
from typing import Literal, Optional

import anthropic
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-opus-5"

# Laenger als das braucht kein TikTok-Transkript. Schuetzt vor Copy-Paste-Unfaellen.
MAX_EINGABE_ZEICHEN = 20_000

Bereich = Literal[
    "obst-gemuese",
    "kuehlung",
    "fleisch-fisch",
    "vorrat",
    "backen",
    "tiefkuehl",
    "getraenke",
    "gewuerze",
    "sonstiges",
]


class RezeptError(Exception):
    """Fehler bei der Rezept-Analyse - die Meldung geht direkt an die Nutzerin."""
    pass


class Zutat(BaseModel):
    name: str = Field(description="Die Zutat selbst, ohne Menge. Beispiel: 'Pasta', 'Knoblauchzehe'")
    menge: Optional[float] = Field(
        description="Zahl für eine Portionsangabe (0.5 für eine halbe). "
                    "null, wenn keine Menge genannt wurde."
    )
    einheit: str = Field(
        description="g, ml, EL, TL, Stück, Prise, Zehe, Bund, Dose, Packung "
                    "oder leerer String, wenn keine Einheit passt."
    )
    hinweis: str = Field(
        description="Kurzer Zusatz wie 'z. B. Spaghetti', 'gehackt', 'nach Geschmack'. "
                    "Leerer String, wenn nichts zu sagen ist."
    )
    bereich: Bereich = Field(description="Supermarktbereich für die Einkaufsliste")
    skalierbar: bool = Field(
        description="false bei Gewürzen, Salz, Pfeffer, Öl zum Anbraten und allem "
                    "'nach Geschmack' - das wächst nicht mit der Portionszahl."
    )


class Schritt(BaseModel):
    text: str = Field(description="Ein Arbeitsschritt, ein bis drei Sätze, in der Du-Form")
    minuten: Optional[int] = Field(description="Dauer dieses Schritts in Minuten, sonst null")
    temperatur: Optional[str] = Field(
        description="Temperaturangabe wie '180 °C Umluft' oder 'mittlere Hitze', sonst null"
    )


class Rezept(BaseModel):
    reicht_aus: bool = Field(
        description="true, wenn der Text für ein echtes, nachkochbares Rezept reicht. "
                    "false, wenn du raten müsstest."
    )
    grund: str = Field(
        description="Nur wenn reicht_aus false ist: ein freundlicher Satz, was fehlt. "
                    "Sonst leerer String."
    )
    titel: str = Field(description="Kurzer Rezeptname ohne Hashtags und ohne Emojis")
    beschreibung: str = Field(description="Ein bis zwei Sätze, was das Gericht ausmacht")
    portionen: int = Field(description="Für wie viele Portionen die Mengen gelten")
    zeit_gesamt: Optional[int] = Field(description="Gesamtzeit in Minuten, sonst null")
    zeit_vorbereitung: Optional[int] = Field(description="Vorbereitungszeit in Minuten, sonst null")
    zeit_kochen: Optional[int] = Field(description="Koch- oder Backzeit in Minuten, sonst null")
    schwierigkeit: Literal["einfach", "mittel", "aufwendig"]
    zutaten: list[Zutat]
    schritte: list[Schritt]
    notizen: str = Field(description="Tipps aus dem Video, die in keinen Schritt passen")
    tags: list[str] = Field(
        description="3 bis 6 kleingeschriebene Schlagworte, z. B. pasta, schnell, "
                    "vegetarisch, comfort-food, high-protein, süß, one-pot"
    )
    unsicherheiten: list[str] = Field(
        description="Was du nicht sicher aus dem Text lesen konntest, je ein kurzer Satz"
    )


SYSTEM_PROMPT = """Du bist der Rezeptkoch von Schmecki, einem privaten Kochbuch. Du bekommst \
Text zu einem Kochvideo - meistens die Caption eines TikToks, manchmal ein automatisches \
Transkript der Tonspur, manchmal einen von Hand eingetippten Text. Daraus machst du ein \
saubereres, nachkochbares Rezept.

Wie du arbeitest:

ERFINDE NICHTS. Das ist die wichtigste Regel. Wenn eine Menge nicht genannt wird, setzt du \
menge auf null und schreibst "nach Geschmack" oder "je nach Bedarf" in den hinweis - du \
denkst dir keine Zahl aus. Eine ehrliche Lücke ist besser als eine erfundene Angabe, die \
das Essen ruiniert.

REICHT DER TEXT NICHT, sagst du das. Bei einer Caption wie "cremige Pasta ist einfach alles \
#pasta #foryou" gibt es kein Rezept - da stehen keine Zutaten drin. Dann setzt du reicht_aus \
auf false und schreibst in grund einen freundlichen Satz, was fehlt. Bau in diesem Fall trotzdem \
so viel, wie du sicher weißt (Titel, Tags, ein paar erkennbare Zutaten), aber erfinde keine \
Schritte dazu. Reicht der Text, ist reicht_aus true und grund ein leerer String.

TRANSKRIPTE sind fehlerhaft. Automatisch erkannter Text verschluckt Wörter und hört \
Mengen falsch. "500 Gramm" kann als "fünfhundert Gramm" oder "50 Gramm" ankommen. Wenn eine \
Menge unplausibel ist, nimm die plausible Variante und schreib eine Zeile in unsicherheiten.

EINHEITEN vereinheitlichst du auf: g, kg, ml, l, EL, TL, Stück, Prise, Zehe, Bund, Dose, \
Packung, Scheibe. Aus "ne halbe Tasse Sahne" wird 125 ml. Aus "zwei Knoblauch" werden 2 Zehen. \
Passt keine Einheit (etwa bei "1 Zwiebel"), ist einheit ein leerer String und die Zahl steht \
allein.

MENGEN gelten für eine Portionszahl, die du in portionen schreibst. Sagt das Video nichts \
dazu, schätze aus den Mengen (250 g Pasta sind 2 Portionen) und vermerke das in \
unsicherheiten.

SKALIERBAR ist alles, was mit der Portionszahl mitwächst. Salz, Pfeffer, Gewürze, Öl zum \
Anbraten und alles "nach Geschmack" bekommen skalierbar false - doppelte Portion heißt nicht \
doppelt so viel Salz.

BEREICH ist der Supermarktbereich für die Einkaufsliste. Sahne, Butter, Käse, Joghurt und \
Eier sind kuehlung. Nudeln, Reis, Konserven, Öl und Essig sind vorrat. Mehl, Zucker, \
Backpulver und Schokolade sind backen. Salz, Pfeffer und getrocknete Kräuter sind gewuerze. \
Frische Kräuter sind obst-gemuese.

SCHRITTE schreibst du in der Du-Form, ein bis drei Sätze, in der Reihenfolge, in der man \
kocht. Zeiten und Temperaturen gehören in die eigenen Felder, dürfen aber zusätzlich im \
Text stehen, damit man beim Kochen nicht suchen muss. Aus einem hektischen Video-Monolog \
machst du ruhige, klare Anweisungen - ohne "und dann halt einfach so".

TITEL ohne Hashtags, ohne Emojis, ohne "Teil 3" und ohne Großbuchstaben-Geschrei.

SPRACHE ist Deutsch, auch wenn das Video Englisch ist. Etablierte Gerichtnamen bleiben \
(Creamy Garlic Pasta, Chili sin Carne).

UNSICHERHEITEN sammelst du ehrlich: geschätzte Portionszahl, unklare Menge, ein Schritt, \
der nur zu sehen und nicht zu hören war. Ist alles klar, bleibt die Liste leer."""


# Fuer Fotos gelten dieselben Grundregeln, aber die Fehlerquellen sind andere:
# gedruckte Karten sind praezise, dafuer kommen Schraeglage, Anschnitt und
# mehrseitige Vorlagen dazu.
SYSTEM_PROMPT_BILD = """Du bist der Rezeptkoch von Schmecki, einem privaten Kochbuch. Du \
bekommst ein oder mehrere Fotos: eine Rezeptkarte (zum Beispiel von HelloFresh oder \
Marley Spoon), eine Kochbuchseite, einen handgeschriebenen Zettel oder einen Screenshot. \
Daraus machst du ein sauberes, nachkochbares Rezept.

Wie du arbeitest:

ALLE BILDER GEHÖREN ZU EINEM REZEPT. Rezeptkarten haben zwei Seiten - vorne das Foto und \
die Zutaten, hinten die Arbeitsschritte. Kochbuchseiten gehen über zwei Seiten. Du baust aus \
allen Fotos zusammen EIN Rezept, nicht mehrere. Steht dieselbe Zutat auf zwei Fotos, zählst \
du sie einmal.

LIES AB, WAS DASTEHT. Auf einer gedruckten Karte stehen Mengen und Portionen exakt - übernimm \
sie genau so, ohne Umrechnen und ohne Aufrunden. Erfinde nichts dazu. Ist eine Stelle \
unleserlich, angeschnitten, verdeckt oder unscharf, setzt du menge auf null, schreibst \
"nicht lesbar" in den hinweis und notierst es in unsicherheiten. Rate keine Zahl.

PORTIONEN stehen auf Rezeptkarten fast immer oben ("2 Portionen", "für 4 Personen"). Nimm \
diese Zahl. Steht sie nirgends, schätze aus den Mengen und vermerke das in unsicherheiten.

VORRATSZUTATEN gehören mit ins Rezept. Rezeptkarten trennen zwischen dem, was in der Box \
liegt, und dem, was man selbst hat - Überschriften wie "Nicht vergessen", "Aus deinem \
Vorrat", "Außerdem brauchst du" oder "Pantry items". Diese Zutaten (Öl, Salz, Pfeffer, \
Butter, Zucker, Essig) nimmst du in die Zutatenliste auf, mit skalierbar false.

WAS DU WEGLÄSST: Nährwerttabellen, Kalorien, Allergenhinweise, Barcodes, Artikelnummern, \
Kundenservice-Texte, Werbung, QR-Codes und Wochennummern. Das ist kein Rezept.

TITEL nimmst du von der Karte. Marketing-Beiwerk wie "Familienliebling" oder "Neu!" lässt du \
weg, den Gerichtnamen behältst du. Untertitel wie "mit Kirschtomaten und Basilikum" darfst du \
in die beschreibung übernehmen.

SCHRITTE sind auf Karten nummeriert. Halte die Reihenfolge ein und schreib sie in der \
Du-Form aus. Zeiten und Temperaturen gehören zusätzlich in ihre eigenen Felder. Die kleinen \
Bilder neben den Schritten zeigen oft, was der Text nicht sagt - was du dort klar erkennst, \
darfst du ergänzen.

IST DAS ÜBERHAUPT EIN REZEPT? Zeigt das Foto nur ein Essen ohne Text, eine leere Seite, \
etwas völlig anderes oder ist es so unscharf, dass du die Zutaten nicht lesen kannst, dann \
setzt du reicht_aus auf false und schreibst in grund freundlich, was das Problem ist - zum \
Beispiel "Auf dem Foto ist nur das fertige Gericht zu sehen, keine Zutatenliste" oder "Das \
Bild ist zu unscharf, um die Mengen zu lesen". Rate in diesem Fall kein Rezept zusammen. \
Ein Foto von einem Teller Pasta ist kein Rezept.

SPRACHE ist Deutsch, auch wenn die Karte englisch ist. Etablierte Gerichtnamen bleiben.

EINHEITEN, SKALIERBAR und BEREICH behandelst du wie bei jedem anderen Rezept: Einheiten \
vereinheitlicht auf g, kg, ml, l, EL, TL, Stück, Prise, Zehe, Bund, Dose, Packung, Scheibe; \
Gewürze und alles "nach Geschmack" mit skalierbar false; bereich ist der Supermarktbereich \
für die Einkaufsliste (Sahne und Käse kuehlung, Nudeln und Konserven vorrat, Mehl und Zucker \
backen, Salz und Pfeffer gewuerze, frische Kräuter obst-gemuese)."""


_client: Optional[anthropic.Anthropic] = None


def api_key_vorhanden() -> bool:
    """Ist ein API-Key gesetzt? Fuer /health und freundliche Fehlermeldungen."""
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    return bool(key) and not key.startswith("sk-ant-dein-key")


def modell_name() -> str:
    return os.getenv("CLAUDE_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _get_client() -> anthropic.Anthropic:
    """Client einmal anlegen und wiederverwenden."""
    global _client
    if _client is None:
        if not api_key_vorhanden():
            raise RezeptError(
                "Es ist kein API-Key hinterlegt. Trag deinen Key in app/.env ein "
                "(ANTHROPIC_API_KEY=...) und starte Schmecki neu."
            )
        _client = anthropic.Anthropic()
    return _client


def _eingabe_bauen(
    text: str,
    art: str,
    creator: str = "",
    quelle_url: str = "",
) -> str:
    """Baut die Nutzer-Nachricht: erst der Kontext, dann der Text."""
    kopf = {
        "caption": "Das hier ist die Caption eines TikToks:",
        "transkript": (
            "Das hier ist ein automatisches Transkript der Tonspur eines Kochvideos. "
            "Es kann Hörfehler enthalten:"
        ),
        "text": "Das hier hat die Nutzerin selbst eingetippt oder kopiert:",
    }.get(art, "Das hier ist der Text zu einem Kochvideo:")

    zeilen = []
    if creator:
        zeilen.append(f"Creator: {creator}")
    if quelle_url:
        zeilen.append(f"Quelle: {quelle_url}")
    zeilen.append(kopf)
    zeilen.append("")
    zeilen.append(text.strip())

    return "\n".join(zeilen)


def rezept_aus_text(
    text: str,
    art: str = "text",
    creator: str = "",
    quelle_url: str = "",
    zusatz: str = "",
) -> dict:
    """
    Macht aus Text ein strukturiertes Rezept.

    Args:
        text: Caption, Transkript oder eingetippter Text
        art: "caption" | "transkript" | "text" - steuert nur den Prompt-Kopf
        creator: TikTok-Handle, falls bekannt
        quelle_url: Link zum Video, falls bekannt
        zusatz: Zweiter Textblock (z.B. Caption zusaetzlich zum Transkript)

    Returns:
        dict des Rezept-Modells
    """
    text = (text or "").strip()
    if not text:
        raise RezeptError("Da ist kein Text, aus dem ich ein Rezept machen könnte.")

    if len(text) > MAX_EINGABE_ZEICHEN:
        raise RezeptError(
            f"Der Text ist zu lang ({len(text)} Zeichen, erlaubt sind "
            f"{MAX_EINGABE_ZEICHEN}). Kürze ihn auf den Rezept-Teil."
        )

    if len(text) < 15:
        raise RezeptError(
            "Das sind zu wenige Worte für ein Rezept. Füge mehr Text ein oder "
            "lade das Video hoch."
        )

    inhalt = _eingabe_bauen(text, art, creator, quelle_url)
    if zusatz.strip():
        inhalt += "\n\nZusaetzlich die Caption des Videos:\n\n" + zusatz.strip()[:2000]

    return _claude_fragen(inhalt, SYSTEM_PROMPT, "Text")


def _claude_fragen(inhalt, system_prompt: str, quelle_beschreibung: str) -> dict:
    """
    Der eigentliche API-Aufruf - gemeinsam fuer Text und Bilder.

    Args:
        inhalt: String oder Liste von Content-Bloecken fuer die Nutzer-Nachricht
        system_prompt: SYSTEM_PROMPT oder SYSTEM_PROMPT_BILD
        quelle_beschreibung: nur fuer Fehlermeldungen und das Log ("Text", "Fotos")

    Returns:
        dict des Rezept-Modells
    """
    client = _get_client()
    modell = modell_name()

    try:
        antwort = client.messages.parse(
            model=modell,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=system_prompt,
            messages=[{"role": "user", "content": inhalt}],
            output_format=Rezept,
        )
    except anthropic.AuthenticationError as e:
        raise RezeptError(
            "Der API-Key wurde nicht akzeptiert. Stimmt der Key in app/.env?"
        ) from e
    except anthropic.RateLimitError as e:
        raise RezeptError(
            "Die API bremst gerade (Rate Limit). Warte einen Moment und probier es nochmal."
        ) from e
    except anthropic.NotFoundError as e:
        raise RezeptError(
            f"Das Modell '{modell}' gibt es nicht oder dein Key darf nicht darauf zugreifen. "
            "CLAUDE_MODEL in app/.env prüfen."
        ) from e
    except anthropic.APIStatusError as e:
        logger.exception("Claude API hat einen Fehler gemeldet")
        raise RezeptError(f"Die Claude API hat einen Fehler gemeldet ({e.status_code}).") from e
    except anthropic.APIConnectionError as e:
        raise RezeptError(
            "Keine Verbindung zur Claude API. Hängt das Internet?"
        ) from e

    if antwort.stop_reason == "refusal":
        logger.warning(f"Claude hat abgelehnt: {antwort.stop_details}")
        raise RezeptError(
            "Claude wollte das nicht verarbeiten. Wenn es wirklich um Essen "
            "geht, probier es mit einem anderen Ausschnitt."
        )

    if antwort.stop_reason == "max_tokens":
        raise RezeptError(
            "Die Antwort wurde abgeschnitten - die Vorlage war zu umfangreich. "
            "Beschränke sie auf den Rezept-Teil."
        )

    rezept: Optional[Rezept] = antwort.parsed_output
    if rezept is None:
        raise RezeptError("Claude hat kein verwertbares Rezept zurückgegeben.")

    daten = rezept.model_dump()
    _nachbessern(daten)

    logger.info(
        f"Rezept '{daten['titel']}' aus {quelle_beschreibung}: "
        f"{len(daten['zutaten'])} Zutaten, {len(daten['schritte'])} Schritte, "
        f"reicht_aus={daten['reicht_aus']}, "
        f"Tokens {antwort.usage.input_tokens}/{antwort.usage.output_tokens}"
    )
    return daten


# ---------------------------------------------------------------- Fotos

# Claude skaliert groessere Bilder ohnehin herunter; 1568 px auf der langen Kante
# ist der Punkt, ab dem nichts mehr dazugewonnen wird - nur Tokens gekostet.
MAX_BILD_KANTE = 1568

# Eine Rezeptkarte hat zwei Seiten, ein Kochbuch-Rezept selten mehr als vier.
MAX_BILDER = 6

MAX_BILD_BYTES = 12 * 1024 * 1024


def rezept_aus_bildern(bilder: list[bytes], hinweis: str = "") -> dict:
    """
    Macht aus Fotos ein strukturiertes Rezept.

    Gedacht fuer Rezeptkarten (HelloFresh & Co.), Kochbuchseiten, Screenshots
    und handgeschriebene Zettel. Mehrere Bilder gelten als Seiten EINES Rezepts -
    Vorder- und Rueckseite einer Karte gehoeren zusammen.

    Args:
        bilder: Rohdaten der Bilder, in der Reihenfolge der Seiten
        hinweis: optionaler Zusatz der Nutzerin ("Seite 2 ist die Rueckseite")

    Returns:
        dict des Rezept-Modells
    """
    if not bilder:
        raise RezeptError("Es ist kein Bild angekommen.")

    if len(bilder) > MAX_BILDER:
        raise RezeptError(
            f"Das sind {len(bilder)} Bilder - erlaubt sind {MAX_BILDER}. "
            "Nimm die Seiten, auf denen Zutaten und Zubereitung stehen."
        )

    bloecke = []

    # Bei mehreren Seiten hilft eine Beschriftung, damit Claude die Reihenfolge kennt
    for nummer, rohdaten in enumerate(bilder, start=1):
        daten, medientyp = _bild_vorbereiten(rohdaten, nummer)

        if len(bilder) > 1:
            bloecke.append({"type": "text", "text": f"Bild {nummer} von {len(bilder)}:"})

        bloecke.append({
            "type": "image",
            "source": {"type": "base64", "media_type": medientyp, "data": daten},
        })

    aufgabe = (
        "Das sind Fotos einer Rezeptvorlage - eine Rezeptkarte, eine Kochbuchseite, "
        "ein Zettel oder ein Screenshot. Bau daraus ein Rezept."
        if len(bilder) > 1 else
        "Das ist das Foto einer Rezeptvorlage - eine Rezeptkarte, eine Kochbuchseite, "
        "ein Zettel oder ein Screenshot. Bau daraus ein Rezept."
    )
    if len(bilder) > 1:
        aufgabe += (
            f" Alle {len(bilder)} Bilder gehören zu EINEM Rezept "
            "(zum Beispiel Vorder- und Rückseite einer Karte)."
        )
    if hinweis.strip():
        aufgabe += f"\n\nHinweis von der Nutzerin: {hinweis.strip()[:500]}"

    bloecke.append({"type": "text", "text": aufgabe})

    return _claude_fragen(
        bloecke,
        SYSTEM_PROMPT_BILD,
        f"{len(bilder)} Foto{'s' if len(bilder) > 1 else ''}",
    )


def _bild_vorbereiten(rohdaten: bytes, nummer: int) -> tuple[str, str]:
    """
    Bild fuer die API vorbereiten: lesen, drehen, verkleinern, als JPEG kodieren.

    Handyfotos bringen ihre Ausrichtung als EXIF-Angabe mit - ohne das Drehen
    liegt die Rezeptkarte quer und Claude liest schlechter.

    Returns:
        (base64-String, Medientyp)
    """
    import base64
    import io

    if not rohdaten:
        raise RezeptError(f"Bild {nummer} ist leer.")

    if len(rohdaten) > MAX_BILD_BYTES:
        raise RezeptError(
            f"Bild {nummer} ist größer als {MAX_BILD_BYTES // (1024 * 1024)} MB."
        )

    try:
        from PIL import Image, ImageOps
    except ImportError as e:
        raise RezeptError(
            "Pillow ist nicht installiert. Bitte 'pip install -r requirements.txt' ausführen."
        ) from e

    # iPhone-Fotos sind oft HEIC. pillow-heif haengt sich als Plugin in Pillow ein;
    # fehlt es, faellt das unten in die freundliche Fehlermeldung.
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        pass

    try:
        bild = Image.open(io.BytesIO(rohdaten))
        bild = ImageOps.exif_transpose(bild)
        bild = bild.convert("RGB")
    except Exception as e:
        raise RezeptError(
            f"Bild {nummer} konnte ich nicht lesen. JPEG, PNG und WebP gehen sicher - "
            "bei einem iPhone-Foto (HEIC) exportiere es als JPEG."
        ) from e

    if max(bild.size) > MAX_BILD_KANTE:
        bild.thumbnail((MAX_BILD_KANTE, MAX_BILD_KANTE), Image.LANCZOS)

    puffer = io.BytesIO()
    bild.save(puffer, format="JPEG", quality=88, optimize=True)
    daten = puffer.getvalue()

    logger.info(
        f"Bild {nummer}: {bild.size[0]}x{bild.size[1]} px, "
        f"{len(rohdaten) / 1024:.0f} KB -> {len(daten) / 1024:.0f} KB"
    )

    return base64.b64encode(daten).decode("ascii"), "image/jpeg"


def _nachbessern(daten: dict) -> None:
    """
    Kleine Aufraeumarbeiten nach der Analyse.

    Wir verwerfen hier nichts - das Schema hat schon garantiert, dass die Struktur
    stimmt. Es geht nur um Plausibilitaet, die kein Schema abfangen kann.
    """
    # Portionen unter 1 sind ein Rechenfehler, nicht eine Absicht
    if not daten.get("portionen") or daten["portionen"] < 1:
        daten["portionen"] = 2
        daten.setdefault("unsicherheiten", []).append(
            "Die Portionszahl stand nicht in der Vorlage - ich habe 2 angenommen."
        )

    # Ohne Zutaten oder Schritte ist es kein Rezept, egal was das Modell meint
    if not daten.get("zutaten") or not daten.get("schritte"):
        daten["reicht_aus"] = False
        if not daten.get("grund"):
            daten["grund"] = (
                "Daraus kriege ich kein vollständiges Rezept - "
                "es fehlen Zutaten oder Arbeitsschritte."
            )

    # Gesamtzeit ergaenzen, wenn nur die Einzelzeiten da sind
    if not daten.get("zeit_gesamt"):
        teile = [daten.get("zeit_vorbereitung"), daten.get("zeit_kochen")]
        summe = sum(t for t in teile if t)
        if summe:
            daten["zeit_gesamt"] = summe

    # Tags klein und ohne Doppelte
    tags = []
    for tag in daten.get("tags") or []:
        sauber = tag.strip().lower().lstrip("#")
        if sauber and sauber not in tags:
            tags.append(sauber)
    daten["tags"] = tags[:6]
