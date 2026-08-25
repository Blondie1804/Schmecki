# 🍓 Schmecki

Dein privates TikTok-Kochbuch. Link rein, Rezept raus – plus Einkaufsliste,
Wochenplan, Vorratsschrank und einen Knopf für „was koche ich heute?".

Läuft komplett auf deinem Rechner. Kein Account, keine Cloud, keine Datenbank.

---

## Loslegen

**Windows**

```powershell
cd app
.\start.ps1
```

**macOS / Linux**

```bash
cd app
./start.sh
```

Beim ersten Start legt das Skript eine `.env` an und sagt dir Bescheid. Trag
deinen Claude-API-Key ein (von [console.anthropic.com](https://console.anthropic.com)):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Dann nochmal starten. Die App läuft auf **http://localhost:8010**.

Der erste Start dauert ein paar Minuten – er baut ein Python-venv und lädt die
Pakete. Danach geht es in Sekunden.

### Ohne API-Key

Schmecki startet trotzdem. Acht Beispielrezepte sind schon drin, und alles außer
dem Rezept-Import funktioniert: Kochbuch, Portionsrechner, Einkaufsliste,
Wochenplan, Würfeln, Vorrat.

---

## Die drei Wege ins Kochbuch

**🎵 TikTok-Link** – Schmecki holt Beschreibung, Creator und Vorschaubild und
macht daraus ein Rezept. Klappt, wenn das Rezept in der Beschreibung steht. Du
kannst den ganzen Teilen-Text einfügen, der Link wird herausgefischt.

**✍️ Rezept als Text** – Alles reinkopieren, was du hast: Kommentar,
abgetippter Zettel, Screenshot-Text. Hauptsache Zutaten und Zubereitung stehen
irgendwie drin.

**🎬 Video hochladen** – Für die vielen TikToks, bei denen das Rezept nur
gesprochen wird. Das Video bleibt auf deinem Rechner: Schmecki hört sich die
Tonspur lokal an (faster-whisper) und schickt nur den erkannten Text an die
Claude API. Danach wird die Datei gelöscht.

Beim ersten Video lädt das Spracherkennungs-Modell herunter – rund 500 MB,
einmalig, landet in `app/models/`.

---

## Was wo liegt

Rezepte, Einkaufsliste, Wochenplan und Vorrat liegen im **Browser** dieses
Geräts (localStorage), Bilder in IndexedDB. Der Server speichert **nichts**.

Das heißt auch: Browser-Daten löschen = Rezepte weg. Deshalb gibt es unter
⚙️ Einstellungen ein **Backup** als JSON-Datei – zum Sichern und zum Umziehen
auf ein anderes Gerät.

---

## Aufs Handy

Im Browser öffnen und „Zum Home-Bildschirm hinzufügen". Schmecki läuft dann wie
eine App, mit Bottom-Navigation statt Seitenleiste.

Auf dem Handy braucht es den Rechner, auf dem der Server läuft – im selben WLAN
über dessen IP statt `localhost`.

---

## Wenn etwas klemmt

| Problem | Woran es liegt |
|---|---|
| „Kein API-Key hinterlegt" | `ANTHROPIC_API_KEY` fehlt in `app/.env`, oder der Server wurde danach nicht neu gestartet |
| „Kein Rezept in der Beschreibung" | Bei dem TikTok steht das Rezept nur im Video – lade es hoch |
| Änderung am Code wirkt nicht | Im Browser einmal hart neu laden (Strg+Umschalt+R) |
| Transkription bricht ab | Tonspur fehlt oder ist stumm – dann hilft nur „Rezept als Text" |

Mehr Details in [CLAUDE.md](CLAUDE.md).

---

## Der API-Key

Der Key steht ausschließlich in `app/.env`. Diese Datei ist in der `.gitignore`
und gehört in kein Repository – auch in kein privates. Im Browser-Code taucht er
nie auf; alle Claude-Aufrufe laufen über den lokalen Server.
