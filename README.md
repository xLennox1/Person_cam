# PersonCam Web

Browser-Version für Android, iPhone und iPad.

## Start

Die App benötigt Kamera-/Mikrofonzugriff. Für lokale Tests kannst du einen kleinen Server verwenden:

```bash
python3 -m http.server 8080
```

Dann im Browser `http://localhost:8080` öffnen. Auf einem anderen Gerät im WLAN ist für Kamerazugriff normalerweise HTTPS erforderlich.

## Funktionen

- Live-Kamera im Browser
- Personenerkennung mit TensorFlow.js / COCO-SSD
- Grüne `PERSON`-Box um erkannte Personen
- Automatische Aufnahme bei erkannter Person
- Einstellbarer Nachlauf (Standard: 4 Sekunden)
- Aufnahmen als WebM zum Speichern
- Keine Upload-Funktion; Erkennung läuft lokal im Browser

## Hinweis

Die grüne Box ist ein Live-Overlay und wird in dieser Version nicht in das gespeicherte Video eingebrannt.
