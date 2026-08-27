# Schmecki – TikTok-Kochbuch

Private Web-App: aus einem TikTok wird ein strukturiertes Rezept, daraus ein
Kochbuch mit Einkaufsliste, Wochenplan und Vorratsabgleich.

Läuft lokal. Kein Deployment, kein Account, keine Datenbank.

## Grundidee

Der Server macht nur die Dinge, die im Browser nicht gehen:

1. einen TikTok-Link auflösen (oEmbed)
2. ein hochgeladenes Video lokal transkribieren (faster-whisper)
3. Text von Claude in ein Rezept verwandeln
4. Fotos von Claude lesen lassen – Rezeptkarten (HelloFresh & Co.),
   Kochbuchseiten, Screenshots, handgeschriebene Zettel

Alles andere – Kochbuch, Portionsrechner, Einkaufsliste, Wochenplan, Würfeln,
Vorrat – passiert im Browser und funktioniert auch ohne laufenden Server, sobald
die Seite einmal geladen ist.

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JS als ES-Module. Kein Build-Schritt.
- **Backend:** Python FastAPI, stateless
- **Transkription:** faster-whisper (lokal, bringt PyAV mit – kein separates ffmpeg)
- **Claude API:** `messages.parse` mit Pydantic-Modell (Structured Outputs)
- **Speicher:** localStorage (Struktur) + IndexedDB (Bilder)

## Projektstruktur

```
app/
├── backend/
│   ├── main.py             # FastAPI, Endpoints, Job-Verwaltung, Statics
│   ├── tiktok.py           # Link normalisieren, oEmbed, Thumbnail laden
│   ├── transcribe.py       # faster-whisper + Standbild aus dem Video
│   └── claude_recipe.py    # Claude → strukturiertes Rezept (fragil!)
├── frontend/
│   ├── index.html          # App-Shell: Sidebar, Bottom-Nav, View-Container
│   ├── style.css           # Design, hell + dunkel + Druck
│   ├── js/
│   │   ├── app.js          # Hash-Router, Thema, Navigation, Listen-Badge
│   │   ├── store.js        # localStorage + IndexedDB, Export/Import
│   │   ├── seed.js         # 8 Beispielrezepte für den ersten Start
│   │   ├── ingredients.js  # Einheiten, Skalierung, Zusammenrechnen, Bereiche
│   │   ├── cards.js        # Rezeptkarte (überall wiederverwendet)
│   │   ├── doodles.js      # SVG-Doodles + Platzhalterbilder
│   │   ├── ui.js           # Toasts, Modale, Nachfragen, Textkram
│   │   ├── importer.js     # Die drei Import-Wege
│   │   ├── start.js / cookbook.js / recipe.js /
│   │   ├── shopping.js / planner.js / dice.js / pantry.js / settings.js
│   └── assets/             # Fonts (Caveat, Nunito), Icons, manifest.json
├── models/                 # Whisper-Modelle (gitignored, Download beim 1. Video)
├── tmp/                    # Video-Uploads (gitignored, werden sofort gelöscht)
├── requirements.txt
├── start.ps1 / start.sh
└── .env                    # API-Key (nie committen!)
```

## Start

Siehe [README.md](README.md). Kurzfassung: `cd app` und `.\start.ps1` bzw.
`./start.sh`. URL: http://localhost:8010

## API Endpoints

| Endpoint | Method | Beschreibung |
|---|---|---|
| `/` | GET | App-Shell |
| `/api/tiktok` | POST | Link → Caption, Creator, Vorschaubild (oEmbed) |
| `/api/recipe` | POST | Text/Caption/Transkript → strukturiertes Rezept |
| `/api/recipe/bilder` | POST | Fotos (multipart, 1–6 Stück) → strukturiertes Rezept |
| `/api/transcribe` | POST | Video annehmen, Job starten → `job_id` |
| `/api/transcribe/{job_id}` | GET | Fortschritt, Transkript, Standbild |
| `/health` | GET | API-Key vorhanden?, Modell, aktive Jobs |

Fehler kommen immer als `{"fehler": "..."}` zurück – der Text ist für die
Nutzerin geschrieben und wird im Frontend unverändert angezeigt.

## Datenmodell (Browser)

```js
{ id, titel, beschreibung, portionen, portionenOriginal,
  zeit: { gesamt, vorbereitung, kochen }, schwierigkeit,
  zutaten: [{ name, menge, einheit, hinweis, bereich, skalierbar }],
  schritte: [{ text, minuten, temperatur }],
  notizen, tags: [], unsicherheiten: [],
  quelle: { art: 'tiktok'|'video'|'text'|'beispiel', url, creator, caption },
  bildKey, favorit, bewertung, eigeneNotizen, wiederKochen, angelegt, gekocht }
```

`portionenOriginal` ist der Bezugswert der Mengen und ändert sich nie.
`portionen` ist die aktuell angezeigte Zahl. Der Portionsrechner rechnet immer
vom Original aus, nicht vom letzten Stand – sonst summieren sich Rundungsfehler.

## Zwei Prompts, ein Schema

`claude_recipe.py` hat zwei System-Prompts, aber nur ein Pydantic-Modell (`Rezept`):

- `SYSTEM_PROMPT` für Text – Captions und Transkripte. Die Fehlerquelle ist
  Lückenhaftigkeit: Mengen fehlen, Whisper verhört sich.
- `SYSTEM_PROMPT_BILD` für Fotos. Gedruckte Karten sind exakt, dafür kommen
  Schräglage, Anschnitt und mehrseitige Vorlagen dazu. Der Prompt sagt
  ausdrücklich, dass alle Bilder zu **einem** Rezept gehören (Karten haben vorne
  die Zutaten, hinten die Schritte), dass Vorratszutaten aus dem Kasten
  "Nicht vergessen" mit ins Rezept gehören und dass Nährwerttabellen,
  Barcodes und Werbung wegfallen.

Beide gehen durch `_claude_fragen()`. Wenn du das Schema änderst, ändere beide
Prompts mit – sonst füllt einer der Wege ein Feld nie.

## Gotchas

- **`claude_recipe.py` ist das fragile Stück.** Der Prompt bestimmt die
  Rezeptqualität. Änderungen klein halten und gegen mindestens drei echte
  TikToks prüfen: eins mit Rezept in der Caption, eins mit Rezept nur im Video,
  eins mit reinem Hashtag-Salat. Bekannt heikel: erfundene Mengen, geschätzte
  Portionszahlen, `skalierbar` bei Gewürzen.

- **`reicht_aus: false` ist ein Feature, kein Fehler.** Bei dünnen Captions soll
  Claude sagen "das reicht nicht", statt ein Rezept zu erfinden. Das Frontend
  bietet dann Video-Upload oder Texteingabe an und nimmt Thumbnail und Creator
  mit. Wenn plötzlich alles durchgewinkt wird: Prompt prüfen.

- **Zutaten zusammenrechnen ist konservativer, als es aussieht.** Nur innerhalb
  einer Einheiten-Familie wird addiert. "250 g Tomaten" und "1 Dose Tomaten"
  bleiben zwei Zeilen – alles andere wäre geraten. Ausnahme: hat eine Seite gar
  keine Menge ("Basilikum nach Geschmack"), wird zusammengelegt und die konkrete
  Angabe gewinnt.

- **EL und TL werden nicht in ml umgerechnet.** Beim Kochen zählt der Löffel.
  "3 EL Olivenöl" soll nicht als "45 ml" auf der Einkaufsliste landen.

- **Der Vorratsabgleich ignoriert Salz, Pfeffer, Wasser, Öl und Zucker**
  (`IMMER_DA` in `ingredients.js`), sonst wäre nie etwas kochbar.

- **Bilder gehören in IndexedDB, nicht in den localStorage.** Base64-Fotos
  sprengen dessen ~5 MB nach drei Rezepten. Eigene Uploads werden vor dem
  Speichern per Canvas auf 1200 px verkleinert.

- **Statische Dateien werden bewusst nicht gecacht** (`FrischeStatics` in
  `main.py`). Browser halten ES-Module sonst zäh fest und man debuggt eine alte
  Fassung. Fonts und Bilder werden weiterhin gecacht.

- **`[hidden]` braucht die `!important`-Regel ganz oben in `style.css`.** Das
  Browser-Standard-Stylesheet setzt für `[hidden]` nur `display: none` – jede
  eigene Klassenregel mit `display` schlägt das. Genau das ist einmal passiert:
  `.modal-schicht { display: grid }` lag dauerhaft über der ganzen Seite, hat
  alles milchig gemacht und jeden Mausklick geschluckt. Die Regel nicht
  entfernen, und bei neuen Elementen mit `hidden`-Attribut daran denken.

- **Klicks im Test mit `element.click()` beweisen nichts.** Das umgeht die
  Trefferprüfung des Browsers – ein unsichtbares Element davor fällt damit nicht
  auf. Wer prüfen will, ob etwas wirklich anklickbar ist, nimmt
  `document.elementFromPoint(mitte_x, mitte_y)` und schaut, ob dort auch das
  erwartete Element liegt.

- **Transkription ist CPU-gebunden.** Der ThreadPoolExecutor hat bewusst nur
  einen Worker. Zwei Uploads laufen hintereinander, nicht gleichzeitig.

- **Jobs liegen nur im Speicher.** Server-Neustart = laufende Transkription weg.
  Bewusst so – keine Datenbank, keine Persistenz.

- **Der API-Key gehört in `app/.env` und nirgendwo sonst.** Nie ins Frontend,
  nie in ein Repository. Alle Claude-Aufrufe laufen über den lokalen Server.

- **Der Port ist Teil der Identität der Daten – Port niemals leichtfertig
  ändern.** Browser trennen `localStorage` und IndexedDB nach Herkunft, und die
  Portnummer gehört zur Herkunft. `http://localhost:8010` und
  `http://localhost:8032` sind zwei verschiedene Websites mit getrennten Daten.
  Das ist schon einmal teuer geworden: beim Entwickeln wurde der Port dreimal
  hochgezählt, um den Browser-Cache zu umgehen – jedes Mal stand ein leeres
  Kochbuch da, und die Rezepte lagen unerreichbar unter dem alten Port.

  **Wenn du den Cache umgehen willst, nimm nicht den Port.** `FrischeStatics` in
  `main.py` schickt für Code schon `no-store`; hilft das nicht, im Browser
  `fetch(pfad, {cache: 'reload'})` für die betroffenen Dateien aufrufen und dann
  neu laden. Der Port bleibt 8010.

  Dagegen abgesichert ist die App über zwei Banner (`hinweiseZeichnen()` in
  `app.js`): ein Port-Hinweis, wenn Schmecki auf einem anderen Port als 8010
  läuft **und** dort noch keine eigenen Rezepte liegen, und eine
  Backup-Erinnerung ab fünf ungesicherten eigenen Rezepten. Beide sind für die
  Sitzung wegklickbar. Erkennen kann die App fremde Ports nicht – sie kann nur
  warnen, denn eine Seite sieht den Speicher anderer Herkünfte nie.

- **`Cache-Control` für `/` braucht die Sonderbehandlung.** `FrischeStatics`
  entscheidet an der Dateiendung, und `/` sowie jeder Verzeichnispfad haben
  keine – ohne die Prüfung `"." not in Path(path).name` bekäme die `index.html`
  einen Tages-Cache.

## Bewusst nicht gebaut

- **Automatischer TikTok-Download.** Der Weg über die oEmbed-Caption plus selbst
  hochgeladenes Video deckt denselben Zweck ab, ohne einen Scraper, der bei der
  nächsten TikTok-Änderung kaputtgeht.
- **Service Worker.** Das `manifest.json` macht die App installierbar; ein
  Service Worker würde beim Entwickeln nur Cache-Ärger machen.
- Instagram/YouTube, Allergien und Zutaten-Ersatz, Sprachsteuerung, Kochmodus
  mit Timern – alles später möglich, alles ohne Umbau anschließbar.

## Stand

Die Wege über TikTok-Link (oEmbed), Fehlerpfade, Kochbuch, Portionsrechner,
Einkaufsliste, Wochenplan, Würfeln, Vorrat, Backup und Dark Mode sind geprüft.

Vom Foto-Weg ist alles geprüft außer dem Claude-Aufruf selbst:
Mehrfachauswahl, Vorschau-Streifen mit Seitennummern, Entfernen, Einfügen aus
der Zwischenablage, der multipart-Upload gegen den echten Server, die
Fehlerdarstellung und das Behalten der Seiten bei "Nochmal versuchen".
`_bild_vorbereiten` ist gegen echte Bilder getestet: ein 3024×4032-Handyfoto
landet bei 1176×1568, EXIF-Drehung wird angewandt, leere und kaputte Dateien
sowie zu große und zu viele Bilder werfen lesbare Meldungen.

**Noch nicht mit echtem API-Key gelaufen:** `/api/recipe` und
`/api/recipe/bilder` – also beide Claude-Analysen und damit das Ende des Video-
und des Foto-Wegs. Beim ersten echten Import darauf achten, ob `messages.parse`
mit `thinking={"type": "adaptive"}` und `output_format` durchgeht – falls nicht,
ist der dokumentierte Rückfallweg `messages.create` mit
`output_config={"format": {"type": "json_schema", ...}}`.

Beim ersten Foto-Import lohnt ein Blick auf zwei Dinge: Übernimmt Claude die
Portionszahl von der Karte statt zu schätzen, und landen die Zutaten aus
"Nicht vergessen" mit in der Liste?
