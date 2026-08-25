#
# Schmecki (Windows)
#
# Start:  .\start.ps1
#

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "=========================================="
Write-Host "  Schmecki - dein TikTok-Kochbuch"
Write-Host "=========================================="
Write-Host ""

# .env pruefen
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "! Ich habe eine .env angelegt. Bitte deinen API-Key eintragen:" -ForegroundColor Yellow
    Write-Host "  $PSScriptRoot\.env"
    Write-Host ""
    Write-Host "  Dann nochmal .\start.ps1 ausfuehren."
    exit 1
}

# .env einlesen und als Umgebungsvariablen setzen
Get-Content ".env" | ForEach-Object {
    $zeile = $_.Trim()
    if ($zeile -and -not $zeile.StartsWith("#") -and $zeile.Contains("=")) {
        $name, $wert = $zeile.Split("=", 2)
        Set-Item -Path "env:$($name.Trim())" -Value $wert.Trim()
    }
}

if (-not $env:ANTHROPIC_API_KEY -or $env:ANTHROPIC_API_KEY -eq "sk-ant-dein-key-hier") {
    Write-Host "! Kein API-Key in .env - Schmecki startet trotzdem." -ForegroundColor Yellow
    Write-Host "  Kochbuch, Einkaufsliste, Wochenplan und Vorrat funktionieren ohne Key."
    Write-Host "  Nur der Rezept-Import braucht ihn."
    Write-Host ""
} else {
    Write-Host "OK API-Key" -ForegroundColor Green
}

# venv anlegen falls nicht vorhanden
if (-not (Test-Path "venv")) {
    Write-Host "Erstelle venv (einmalig)..."
    py -3 -m venv venv
}

$python = Join-Path $PSScriptRoot "venv\Scripts\python.exe"

# Dependencies installieren falls noetig
& $python -c "import fastapi, anthropic, httpx, PIL, faster_whisper" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installiere Dependencies (einmalig, dauert ein paar Minuten)..."
    & $python -m pip install --upgrade pip --quiet
    & $python -m pip install -r requirements.txt --quiet
}
Write-Host "OK Dependencies" -ForegroundColor Green

Write-Host ""
Write-Host "i  Beim ersten Video-Upload wird das Whisper-Modell geladen"
Write-Host "   (~500 MB, einmalig, landet in app\models\)."
Write-Host ""
Write-Host "-> http://localhost:8010" -ForegroundColor Green
Write-Host ""

& $python -m uvicorn main:app --reload --port 8010 --app-dir backend
