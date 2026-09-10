# PersonCam Web

Browser-Version für Android/iPhone/iPad. Erkennt Personen und Gesichter lokal
per Kamera, nimmt automatisch Video auf und macht automatische Schnappschüsse
erkannter Gesichter. Alles läuft ausschließlich im Browser – es gibt keinen
Server, keinen Upload, keine Cloud.

## Start
Am einfachsten lokal mit einem kleinen HTTPS/localhost-Webserver:

Python:
    python3 -m http.server 8080

Dann im Browser:
    http://localhost:8080

Kamera-Zugriff und die PIN-Sperre (Web Crypto API) funktionieren nur über
HTTPS oder localhost. Für Nutzung auf einem anderen Handy im WLAN die Dateien
entsprechend auf einer HTTPS-Webseite hosten.

## PIN-Sperre
Beim Öffnen der Seite ist die Kamera-/Aufnahmeoberfläche zunächst gesperrt.

- Start-PIN: **1234** (bitte nach dem ersten Start in den Einstellungen ändern)
- Die PIN wird nicht im Klartext gespeichert, sondern nur als PBKDF2-Hash
  (Web Crypto API, 150.000 Iterationen) plus zufälligem Salt in localStorage.
- Kamera- und Mikrofonzugriff werden erst NACH erfolgreicher PIN-Eingabe
  angefragt – beim bloßen Laden der Seite passiert nichts.
- „Jetzt sperren" (Kopfzeile oder Einstellungen) stoppt die Kamera sofort und
  zeigt wieder die PIN-Eingabe.
- PIN ändern: Einstellungen → Sicherheit → PIN ändern (aktuelle PIN + neue PIN
  zweimal).

## Personen & Gesichter
Personen-Erkennung läuft mit TensorFlow.js (COCO-SSD, Modell "mobilenet_v2").
Gesichtserkennung läuft zusätzlich und unabhängig mit TensorFlow.js
(BlazeFace). Beide laufen parallel, vollständig lokal im Browser.

- Mehrere Personen und Gesichter werden gleichzeitig erkannt und mit grünem
  HUD-Rahmen samt Sicherheit (%) markiert.
- Personen im Bild werden zusätzlich fortlaufend nummeriert (`PERSON 1`,
  `PERSON 2`, …), solange sie durchgehend im Bild sind (siehe Hinweis zu
  Tracking unten). Abschaltbar über Einstellungen → Personen.
- Aufnahme startet automatisch, sobald eine Person kurz hintereinander (2
  Erkennungszyklen) erkannt wird, und läuft weiter, bis die konfigurierte
  Nachlaufzeit ohne Person abgelaufen ist. `● REC` zeigt die laufende Dauer
  live an (`00:17`, `01:42`, …); die fertige Aufnahme zeigt die Enddauer.
- Bei ausreichend sicher erkanntem Gesicht (Standard ≥ 70 %) wird automatisch
  ein Foto des Gesichts (mit etwas Rand, ohne HUD-Overlay) als JPEG
  gespeichert – höchstens alle paar Sekunden (Standard 5s) pro Gesicht, nicht
  bei jedem Frame. Die laufende Videoaufnahme wird dadurch nicht unterbrochen.
- Aufnahmen und Gesichtsbilder werden dauerhaft **lokal im Browser** über
  IndexedDB gespeichert (bleiben nach Neustart erhalten) und lassen sich in
  den Tabs „Aufnahmen"/„Gesichter" ansehen, herunterladen und einzeln oder
  komplett löschen.

Einstellbar unter „Einstellungen": Nachlaufzeit, Empfindlichkeit der
Personenerkennung, Personen-Nummerierung an/aus, automatische Gesichtsbilder
an/aus, Mindest-Konfidenz und Abstand zwischen Gesichts-Schnappschüssen.

### Wichtiger Hinweis zum Tracking
Die Nummerierung (`PERSON 1`, `PERSON 2`, …) ist **rein sitzungsbasiert**: Sie
ordnet Boxen nur anhand von Position/Bewegung *innerhalb einer laufenden
Kamera-Aufnahme* zu und vergisst eine Nummer, sobald die Person länger als 2
Sekunden nicht mehr im Bild ist oder die Kamera neu gestartet wird. Es findet
**keine biometrische Gesichtserkennung/Wiedererkennung** statt – die App
erstellt keine dauerhaften Personenprofile, keine „diese Person war schon
X-mal hier"-Zählung über mehrere Videos hinweg und speichert keine
biometrischen Merkmale.

## Was bewusst nicht umgesetzt wurde
Aus der ursprünglichen Anfrage wurden absichtlich **nicht** umgesetzt:

- Biometrische Gesichts-Embeddings / lokale Gesichts-Wiedererkennung über
  mehrere Videos oder Tage hinweg
- Dauerhafte anonyme Personenprofile mit Besuchszähler ("VIDEOS: 7", "SEEN:
  24×", "zuletzt gesehen am …")
- Eine "Biometrie"-Einstellungssektion

Grund: Das hätte bedeutet, automatisch ein biometrisches Profil von jeder
Person zu erstellen, die vor die Kamera läuft (Besucher, Nachbarn, Passanten),
ohne deren Wissen oder Einwilligung – unabhängig davon, ob die Daten nur lokal
liegen. Das ist unter der DSGVO/dem BDSG eine besonders geschützte
Datenkategorie (Art. 9 DSGVO) und bei einer privat betriebenen Kamera, die
ggf. auch Besucher oder öffentlich zugänglichen Raum erfasst, rechtlich
riskant. Alles andere aus der Anfrage (Mehrfach-Personen-/Gesichtserkennung,
automatische Aufnahmen samt Timer, automatische Gesichtsfotos, lokale
Galerien, PIN-Schutz, Einstellungen, Design) wurde vollständig umgesetzt.

## Datenschutz
Kamera-, Personen- und Gesichtserkennung laufen vollständig lokal im Browser.
Es gibt keinen Server und keinen automatischen Upload. Aufnahmen und
Gesichtsbilder liegen nur in der IndexedDB dieses Browsers/Geräts und lassen
sich jederzeit über die App (einzeln oder "Alle löschen") entfernen.

## Einschränkung
Die grünen HUD-Rahmen sind ein Overlay der Live-Ansicht und werden nicht in
das gespeicherte Video eingebrannt.

## Technische Details / Stellschrauben
Alle wichtigen Konstanten stehen gesammelt oben in `app.js`:

- `MODEL_BASE`, `DETECT_INTERVAL_MS`, `CONFIRM_HITS`, `MIN_BOX_HEIGHT_RATIO`,
  `MAX_CONSECUTIVE_ERRORS` – Personenerkennung (siehe Kommentare im Code)
- `TRACK_TIMEOUT_MS`, `TRACK_MATCH_DIST` – sitzungsbasiertes Tracking
- `PBKDF2_ITERATIONS`, `DEFAULT_PIN` – PIN-Sicherheit

Falls `mobilenet_v2` sich auf einem älteren Handy als zu langsam erweist,
reicht ein Zurückstellen auf `'lite_mobilenet_v2'`.

Getestet wurde der Code auf Syntax-Korrektheit; ein echter Test mit Kamera,
IndexedDB und PIN-Verschlüsselung im Browser (insbesondere Safari/iOS) konnte
in dieser Umgebung nicht durchgeführt werden – bitte nach dem Hochladen einmal
lokal durchklicken.
