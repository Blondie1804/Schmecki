"""
Schmecki - Backend.

Bewusst duenn. Der Server macht nur die drei Dinge, die im Browser nicht gehen:

  1. einen TikTok-Link aufloesen (oEmbed)
  2. ein hochgeladenes Video lokal transkribieren (faster-whisper)
  3. Text von Claude in ein Rezept verwandeln

Alles andere - Kochbuch, Einkaufsliste, Wochenplan, Vorrat - lebt im Browser.
Der Server speichert nichts: keine Datenbank, keine Rezepte, keine Videos. Jobs
liegen nur im Speicher, hochgeladene Videos werden direkt nach der Transkription
geloescht.
"""

import asyncio
import base64
import logging
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import claude_recipe
import tiktok
import transcribe

load_dotenv(Path(__file__).parent.parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("schmecki")

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
TMP_DIR = Path(__file__).parent.parent / "tmp"

# TikToks sind kurz. 200 MB sind reichlich Luft und immer noch ein sinnvoller Deckel.
MAX_VIDEO_BYTES = 200 * 1024 * 1024
ERLAUBTE_ENDUNGEN = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".mp3", ".m4a", ".wav", ".aac"}

# Transkription ist CPU-gebunden: bewusst nur ein Worker, damit zwei Uploads
# hintereinander laufen und nicht beide langsam gleichzeitig.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="whisper")

# job_id -> Zustand. Nur im Speicher; Neustart = laufende Jobs weg (so gewollt).
_jobs: dict[str, dict] = {}

# Job-Leichen nach einer Stunde vergessen
JOB_TTL_SEKUNDEN = 3600


@asynccontextmanager
async def lifespan(app: FastAPI):
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Schmecki startet")
    logger.info(
        "Claude-Modell: %s (API-Key: %s)",
        claude_recipe.modell_name(),
        "gesetzt" if claude_recipe.api_key_vorhanden() else "FEHLT",
    )
    yield
    _executor.shutdown(wait=False, cancel_futures=True)
    # tmp/ leeren - da soll nichts liegenbleiben
    for datei in TMP_DIR.glob("*"):
        try:
            datei.unlink()
        except OSError:
            pass
    logger.info("Schmecki beendet")


app = FastAPI(title="Schmecki", version="1.0.0", lifespan=lifespan)


# ---------------------------------------------------------------- Modelle


class LinkAnfrage(BaseModel):
    link: str = Field(max_length=2000)


class RezeptAnfrage(BaseModel):
    text: str = Field(max_length=claude_recipe.MAX_EINGABE_ZEICHEN)
    art: str = "text"
    creator: str = Field(default="", max_length=200)
    quelle_url: str = Field(default="", max_length=2000)
    zusatz: str = Field(default="", max_length=2000)


# ---------------------------------------------------------------- Endpoints


@app.get("/health")
async def health():
    """Laeuft alles? Wird von start.ps1 und beim Debuggen benutzt."""
    _jobs_aufraeumen()
    return {
        "status": "ok",
        "api_key": claude_recipe.api_key_vorhanden(),
        "modell": claude_recipe.modell_name(),
        "whisper_modell": os.getenv("WHISPER_MODEL", transcribe.DEFAULT_WHISPER_MODEL),
        "whisper_geladen": transcribe.is_model_loaded(),
        "jobs": len(_jobs),
    }


@app.post("/api/tiktok")
async def api_tiktok(anfrage: LinkAnfrage):
    """
    Loest einen TikTok-Link auf: Caption, Creator, Vorschaubild.

    Noch ohne Claude - das Frontend zeigt damit schon "gefunden bei @foodie" an,
    bevor die Analyse laeuft.
    """
    try:
        daten = await tiktok.metadaten_holen(anfrage.link)
    except tiktok.TikTokError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("TikTok-Aufloesung fehlgeschlagen")
        raise HTTPException(status_code=502, detail="TikTok liess sich nicht abfragen.")

    bild = daten.pop("thumbnail", None)
    typ = daten.pop("thumbnail_typ", None)
    daten["bild"] = _als_data_url(bild, typ) if bild else None

    # Caption unter ~80 Zeichen ist meistens nur Hashtag-Salat
    daten["caption_duenn"] = len(daten["caption"]) < 80

    return daten


@app.post("/api/recipe")
async def api_recipe(anfrage: RezeptAnfrage):
    """Text -> strukturiertes Rezept (Claude)."""
    if not claude_recipe.api_key_vorhanden():
        raise HTTPException(
            status_code=503,
            detail="Es ist kein API-Key hinterlegt. Trag ihn in app/.env ein und starte neu.",
        )

    try:
        # Der Claude-Aufruf ist blockierend - in den Threadpool, damit der Server
        # weiter Anfragen annimmt
        rezept = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: claude_recipe.rezept_aus_text(
                text=anfrage.text,
                art=anfrage.art,
                creator=anfrage.creator,
                quelle_url=anfrage.quelle_url,
                zusatz=anfrage.zusatz,
            ),
        )
    except claude_recipe.RezeptError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Rezept-Analyse fehlgeschlagen")
        raise HTTPException(status_code=500, detail="Bei der Analyse ist etwas schiefgegangen.")

    return rezept


@app.post("/api/recipe/bilder")
async def api_recipe_bilder(
    bilder: list[UploadFile] = File(...),
    hinweis: str = Form(""),
):
    """
    Fotos -> strukturiertes Rezept (Claude mit Bildern).

    Fuer Rezeptkarten (HelloFresh & Co.), Kochbuchseiten und Screenshots.
    Mehrere Bilder gelten als Seiten EINES Rezepts.

    Die Bilder werden nur durchgereicht, nicht abgelegt: sie gehen an die Claude
    API und danach aus dem Speicher. Das Rezeptbild speichert der Browser selbst.
    """
    if not claude_recipe.api_key_vorhanden():
        raise HTTPException(
            status_code=503,
            detail="Es ist kein API-Key hinterlegt. Trag ihn in app/.env ein und starte neu.",
        )

    if len(bilder) > claude_recipe.MAX_BILDER:
        raise HTTPException(
            status_code=400,
            detail=f"Das sind {len(bilder)} Bilder - erlaubt sind "
                   f"{claude_recipe.MAX_BILDER}.",
        )

    rohdaten = []
    for datei in bilder:
        inhalt = await datei.read()
        if not inhalt:
            continue
        if len(inhalt) > claude_recipe.MAX_BILD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"'{datei.filename}' ist größer als "
                       f"{claude_recipe.MAX_BILD_BYTES // (1024 * 1024)} MB.",
            )
        rohdaten.append(inhalt)

    if not rohdaten:
        raise HTTPException(status_code=400, detail="Die Bilder sind leer.")

    try:
        # Bildaufbereitung und API-Aufruf blockieren - beides in den Threadpool
        rezept = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: claude_recipe.rezept_aus_bildern(rohdaten, hinweis),
        )
    except claude_recipe.RezeptError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Bild-Analyse fehlgeschlagen")
        raise HTTPException(status_code=500, detail="Bei der Analyse ist etwas schiefgegangen.")

    return rezept


@app.post("/api/transcribe")
async def api_transcribe(video: UploadFile = File(...)):
    """
    Nimmt ein Video an und startet die Transkription als Hintergrund-Job.

    Das Video wird lokal verarbeitet und danach geloescht - es verlaesst diesen
    Rechner nicht. Nur der erkannte Text geht spaeter an die Claude API.
    """
    _jobs_aufraeumen()

    endung = Path(video.filename or "").suffix.lower()
    if endung not in ERLAUBTE_ENDUNGEN:
        raise HTTPException(
            status_code=400,
            detail=f"'{endung or 'ohne Endung'}' kann ich nicht lesen. "
                   f"Nimm MP4, MOV, WEBM oder eine Audiodatei.",
        )

    job_id = uuid.uuid4().hex
    ziel = TMP_DIR / f"{job_id}{endung}"
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    # Streamend schreiben, damit ein grosses Video nicht komplett in den Speicher geht
    groesse = 0
    try:
        with ziel.open("wb") as ausgabe:
            while chunk := await video.read(1024 * 1024):
                groesse += len(chunk)
                if groesse > MAX_VIDEO_BYTES:
                    ausgabe.close()
                    ziel.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"Das Video ist größer als "
                               f"{MAX_VIDEO_BYTES // (1024 * 1024)} MB.",
                    )
                ausgabe.write(chunk)
    except HTTPException:
        raise
    except Exception:
        ziel.unlink(missing_ok=True)
        logger.exception("Video konnte nicht gespeichert werden")
        raise HTTPException(status_code=500, detail="Das Video liess sich nicht ablegen.")

    if groesse == 0:
        ziel.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Die Datei ist leer.")

    _jobs[job_id] = {
        "status": "wartet",
        "fortschritt": 0.0,
        "meldung": (
            "Ich lade erst das Sprachmodell herunter - das passiert nur einmal "
            "und dauert ein paar Minuten."
            if not transcribe.is_model_loaded()
            else "Gleich geht's los..."
        ),
        "erstellt": time.time(),
        "text": None,
        "bild": None,
        "dauer": None,
        "fehler": None,
    }

    _executor.submit(_transkription_ausfuehren, job_id, str(ziel))
    logger.info(f"Job {job_id[:8]} angelegt ({groesse / 1024 / 1024:.1f} MB)")

    return {"job_id": job_id}


@app.get("/api/transcribe/{job_id}")
async def api_transcribe_status(job_id: str):
    """Fortschritt und Ergebnis eines Transkriptions-Jobs."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Diesen Job kenne ich nicht (mehr). Lade das Video nochmal hoch.",
        )

    return {
        "status": job["status"],
        "fortschritt": round(job["fortschritt"], 3),
        "meldung": job["meldung"],
        "text": job["text"],
        "bild": job["bild"],
        "dauer": job["dauer"],
        "fehler": job["fehler"],
    }


# ---------------------------------------------------------------- Job-Innenleben


def _transkription_ausfuehren(job_id: str, pfad: str) -> None:
    """Laeuft im Threadpool. Loescht das Video am Ende immer."""
    job = _jobs.get(job_id)
    if job is None:
        Path(pfad).unlink(missing_ok=True)
        return

    def fortschritt(anteil: float, meldung: str) -> None:
        if job_id in _jobs:
            _jobs[job_id]["fortschritt"] = anteil
            _jobs[job_id]["meldung"] = meldung

    try:
        job["status"] = "laeuft"

        # Standbild zuerst - danach ist das Video weg
        bild = transcribe.standbild_aus_video(pfad)

        ergebnis = transcribe.transcribe_media(pfad, progress_cb=fortschritt)

        job["text"] = ergebnis["text"]
        job["dauer"] = ergebnis["duration"]
        job["bild"] = _als_data_url(bild, "image/jpeg") if bild else None
        job["fortschritt"] = 1.0
        job["meldung"] = "Fertig zugehört"
        job["status"] = "fertig"
        logger.info(f"Job {job_id[:8]} fertig ({len(ergebnis['text'])} Zeichen)")

    except transcribe.TranscriptionError as e:
        job["status"] = "fehler"
        job["fehler"] = str(e)
        logger.warning(f"Job {job_id[:8]} fehlgeschlagen: {e}")
    except Exception as e:
        job["status"] = "fehler"
        job["fehler"] = f"Unerwarteter Fehler bei der Transkription: {e}"
        logger.exception(f"Job {job_id[:8]} abgestuerzt")
    finally:
        # Das Video ist hier fertig benutzt - es hat keinen Grund, zu bleiben
        Path(pfad).unlink(missing_ok=True)


def _jobs_aufraeumen() -> None:
    """Alte Jobs vergessen, damit der Speicher nicht vollaeuft."""
    grenze = time.time() - JOB_TTL_SEKUNDEN
    for job_id in [k for k, v in _jobs.items() if v["erstellt"] < grenze]:
        _jobs.pop(job_id, None)


def _als_data_url(daten: Optional[bytes], typ: Optional[str]) -> Optional[str]:
    """Bytes als data:-URL, damit das Frontend das Bild direkt in IndexedDB legen kann."""
    if not daten:
        return None
    mime = typ or "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(daten).decode('ascii')}"


# ---------------------------------------------------------------- Fehlerbilder


@app.exception_handler(HTTPException)
async def http_fehler(request, exc: HTTPException):
    """Fehler immer im gleichen Format - das Frontend zeigt 'fehler' direkt an."""
    return JSONResponse(status_code=exc.status_code, content={"fehler": exc.detail})


@app.exception_handler(RequestValidationError)
async def eingabe_fehler(request, exc: RequestValidationError):
    """
    Kaputte Anfrage - normalerweise ein zu langer Text oder ein fehlendes Feld.
    FastAPI wuerde hier "detail" schicken; wir bleiben bei "fehler".
    """
    logger.info(f"Anfrage abgelehnt: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"fehler": "Die Anfrage war nicht in Ordnung - ist der Text vielleicht zu lang?"},
    )


# Code wird nie gecacht, Fonts und Bilder schon - die aendern sich nicht.
CODE_ENDUNGEN = (".js", ".css", ".html", ".json")


class FrischeStatics(StaticFiles):
    """
    Statische Dateien ohne Caching fuer den Code.

    Browser halten ES-Module sonst zaeh fest: man aendert eine .js, laedt neu -
    und sieht trotzdem die alte Fassung. Das kostet beim Entwickeln mehr Nerven
    als der erneute Download ueber localhost je kosten koennte.
    """

    async def get_response(self, path: str, scope):
        antwort = await super().get_response(path, scope)

        # Der Pfad "/" und jeder Verzeichnispfad liefern die index.html, haben
        # aber keine Dateiendung - ohne diese Zeile bekaeme die App-Huelle einen
        # Tages-Cache und man laedt nach einer Aenderung die alte Seite.
        ist_code = path.lower().endswith(CODE_ENDUNGEN) or "." not in Path(path).name

        antwort.headers["Cache-Control"] = (
            "no-store, max-age=0" if ist_code else "public, max-age=86400"
        )
        return antwort


# Statics zuletzt: haengt an "/" und darf die API-Routen nicht verdecken
app.mount("/", FrischeStatics(directory=str(FRONTEND_DIR), html=True), name="frontend")
