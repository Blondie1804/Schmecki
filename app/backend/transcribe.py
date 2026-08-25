"""
Lokale Transkription von Videos via faster-whisper.

Laeuft vollstaendig auf diesem Rechner - es geht keine Mediendatei an einen
externen Dienst. faster-whisper bringt PyAV mit und dekodiert MP4/MOV/WEBM
direkt, ein separat installiertes ffmpeg ist nicht noetig.

Dieselbe Mechanik wie im Lernportal-Projekt, nur ohne Untertitel-Parser (den
braucht Schmecki nicht) und mit einem Extra: aus dem Video wird ein Standbild
gezogen, damit das Rezept auch auf dem Video-Weg ein Bild bekommt.
"""

import logging
import os
import threading
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger(__name__)

# TikToks sind kurz - "small" ist fuer Deutsch der beste Kompromiss.
# Ueber WHISPER_MODEL in der .env umstellbar ("base" ist schneller, "medium" genauer).
DEFAULT_WHISPER_MODEL = "small"

# Modell einmal laden und wiederverwenden - das Laden kostet mehrere Sekunden
_model = None
_model_lock = threading.Lock()


class TranscriptionError(Exception):
    """Fehler bei der Transkription - die Meldung geht direkt an die Nutzerin."""
    pass


def _model_dir() -> str:
    """Ablageort fuer heruntergeladene Whisper-Modelle (app/models/)."""
    path = Path(__file__).parent.parent / "models"
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def _get_model():
    """Laedt das Whisper-Modell (thread-safe, nur beim ersten Aufruf)."""
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model

        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise TranscriptionError(
                "faster-whisper ist nicht installiert. "
                "Bitte 'pip install -r requirements.txt' ausführen."
            ) from e

        name = os.getenv("WHISPER_MODEL", DEFAULT_WHISPER_MODEL)
        device = os.getenv("WHISPER_DEVICE", "cpu")
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

        logger.info(f"Lade Whisper-Modell '{name}' ({device}/{compute_type})...")
        try:
            _model = WhisperModel(
                name,
                device=device,
                compute_type=compute_type,
                download_root=_model_dir(),
            )
        except Exception as e:
            raise TranscriptionError(
                f"Whisper-Modell '{name}' konnte nicht geladen werden: {e}"
            ) from e

        logger.info(f"Whisper-Modell '{name}' geladen")
        return _model


def is_model_loaded() -> bool:
    """
    Liegt das Whisper-Modell schon im Speicher?

    Beim ersten Video laedt faster-whisper das Modell erst herunter (mehrere
    Minuten) - das Frontend zeigt dann eine andere Meldung als bei einer
    normalen Transkription.
    """
    return _model is not None


def format_timestamp(seconds: float) -> str:
    """Sekunden als mm:ss (bzw. h:mm:ss ab einer Stunde) formatieren."""
    total = int(round(seconds))
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def transcribe_media(
    file_path: str,
    language: Optional[str] = None,
    progress_cb: Optional[Callable[[float, str], None]] = None,
) -> dict:
    """
    Transkribiert eine Video- oder Audiodatei.

    Args:
        file_path: Pfad zur Mediendatei
        language: Sprachcode ("de", "en") oder None fuer Auto-Erkennung
        progress_cb: Callback(fortschritt_0_bis_1, status_text) fuer Zwischenstand

    Returns:
        dict mit text, segments [{start, end, text}], language, duration
    """
    model = _get_model()

    if progress_cb:
        progress_cb(0.05, "Video wird gelesen...")

    try:
        segments_iter, info = model.transcribe(
            file_path,
            language=language,
            beam_size=5,
            vad_filter=True,  # Stille ueberspringen - schneller und weniger Halluzinationen
            vad_parameters={"min_silence_duration_ms": 500},
        )
    except Exception as e:
        raise TranscriptionError(f"Datei konnte nicht verarbeitet werden: {e}") from e

    duration = float(getattr(info, "duration", 0) or 0)
    detected_language = getattr(info, "language", None) or language or "de"

    segments = []
    parts = []
    # segments_iter ist ein Generator - die Transkription passiert erst beim Iterieren
    for seg in segments_iter:
        text = (seg.text or "").strip()
        if not text:
            continue
        segments.append({
            "start": round(float(seg.start), 2),
            "end": round(float(seg.end), 2),
            "text": text,
        })
        parts.append(text)

        if progress_cb and duration > 0:
            # 5-95 % fuer die eigentliche Transkription reservieren
            anteil = min(float(seg.end) / duration, 1.0)
            progress_cb(
                0.05 + 0.90 * anteil,
                f"Ich höre zu... {format_timestamp(seg.end)} von {format_timestamp(duration)}",
            )

    if not segments:
        raise TranscriptionError(
            "In dem Video wird nichts gesagt. Wenn das Rezept nur eingeblendet ist, "
            "tippe es bitte unter 'Rezept als Text' ein."
        )

    if progress_cb:
        progress_cb(1.0, "Zugehört - jetzt kommt Claude")

    return {
        "text": " ".join(parts),
        "segments": segments,
        "language": detected_language,
        "duration": round(duration, 2),
    }


def standbild_aus_video(file_path: str, max_kante: int = 1080) -> Optional[bytes]:
    """
    Zieht ein Standbild aus dem Video (bei etwa einem Drittel der Laufzeit).

    Der Anfang eines TikToks ist oft ein Titel-Screen, das Ende der Call-to-Action -
    ein Drittel rein sieht man meistens Essen.

    Gibt None zurueck, wenn es nicht klappt. Ein fehlendes Bild ist kein Grund,
    den Import scheitern zu lassen; dann zeigt die App ein Doodle.
    """
    try:
        import av
        from PIL import Image
    except ImportError:
        logger.info("PyAV oder Pillow fehlt - kein Standbild")
        return None

    import io

    try:
        with av.open(file_path) as container:
            if not container.streams.video:
                return None

            stream = container.streams.video[0]
            stream.thread_type = "AUTO"

            # Zu einem Drittel der Laufzeit springen, wenn die Dauer bekannt ist
            if container.duration:
                ziel = int(container.duration / 3)
                try:
                    container.seek(ziel)
                except av.AVError:
                    pass  # Nicht seekbar - dann nehmen wir das erste Bild

            frame = next(container.decode(stream), None)
            if frame is None:
                return None

            bild: "Image.Image" = frame.to_image()

        bild.thumbnail((max_kante, max_kante), Image.LANCZOS)
        puffer = io.BytesIO()
        bild.convert("RGB").save(puffer, format="JPEG", quality=85, optimize=True)
        return puffer.getvalue()
    except Exception as e:
        # Bewusst breit: ein kaputtes Standbild darf den Import nicht abbrechen
        logger.info(f"Standbild konnte nicht erzeugt werden: {e}")
        return None
