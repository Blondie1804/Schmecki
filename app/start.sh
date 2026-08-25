#!/usr/bin/env bash
#
# Schmecki (macOS / Linux)
#
# Start:  ./start.sh
#

set -euo pipefail
cd "$(dirname "$0")"

echo ""
echo "=========================================="
echo "  Schmecki - dein TikTok-Kochbuch"
echo "=========================================="
echo ""

if [ ! -f .env ]; then
    cp .env.example .env
    echo "! Ich habe eine .env angelegt. Bitte deinen API-Key eintragen:"
    echo "  $(pwd)/.env"
    echo ""
    echo "  Dann nochmal ./start.sh ausfuehren."
    exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${ANTHROPIC_API_KEY:-}" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-dein-key-hier" ]; then
    echo "! Kein API-Key in .env - Schmecki startet trotzdem."
    echo "  Kochbuch, Einkaufsliste, Wochenplan und Vorrat funktionieren ohne Key."
    echo "  Nur der Rezept-Import braucht ihn."
    echo ""
else
    echo "OK API-Key"
fi

if [ ! -d venv ]; then
    echo "Erstelle venv (einmalig)..."
    python3 -m venv venv
fi

PYTHON="venv/bin/python"

if ! "$PYTHON" -c "import fastapi, anthropic, httpx, PIL, faster_whisper" 2>/dev/null; then
    echo "Installiere Dependencies (einmalig, dauert ein paar Minuten)..."
    "$PYTHON" -m pip install --upgrade pip --quiet
    "$PYTHON" -m pip install -r requirements.txt --quiet
fi
echo "OK Dependencies"

echo ""
echo "i  Beim ersten Video-Upload wird das Whisper-Modell geladen"
echo "   (~500 MB, einmalig, landet in app/models/)."
echo ""
echo "-> http://localhost:8010"
echo ""

exec "$PYTHON" -m uvicorn main:app --reload --port 8010 --app-dir backend
