# PersonCam Web

Browser-Version für Android/iPhone/iPad.

## Start
Am einfachsten lokal mit einem kleinen HTTPS/localhost-Webserver:

Python:
    python3 -m http.server 8080

Dann im Browser:
    http://localhost:8080

Auf einem anderen Handy im WLAN funktioniert Kamera-Zugriff normalerweise nur
über HTTPS. Für öffentliche Nutzung die Dateien auf einer HTTPS-Webseite hosten.

## Datenschutz
Die Personenerkennung findet im Browser statt. Es gibt keinen Upload-Code.
Die erzeugten Videos bleiben zunächst als Blob/Objekt-URL im Browser und werden
nur über den Download-Link als Datei gespeichert.

## Einschränkung
Die grüne Box ist ein Overlay der Live-Ansicht und wird in dieser Version nicht
in das gespeicherte Video eingebrannt.

## Erkennung (KI)
Die Personenerkennung läuft mit TensorFlow.js (COCO-SSD, Modell "mobilenet_v2" –
genauer als die vorherige Standardeinstellung "lite_mobilenet_v2"):

- Neuer Regler "Empfindlichkeit" in den Steuerelementen: höher = die KI muss
  sicherer sein, bevor eine Person zählt (Standard 55 %).
- Eine neue Aufnahme startet erst, wenn eine Person kurz hintereinander erkannt
  wird – das verhindert Fehlalarme durch einzelne Ausreißer-Frames. Ist die
  Aufnahme schon aktiv, zählt eine wiederkehrende Person sofort (kein erneutes
  Warten).
- Sehr kleine/entfernte Erkennungen (unter 4 % der Bildhöhe) zählen nicht mit.
- Die Erkennung läuft ca. 3x pro Sekunde statt bei jedem Kamerabild – schont
  Akku/CPU auf dem Handy, ohne die Reaktionszeit spürbar zu verschlechtern.
- Das Modell wird nur einmal pro Sitzung geladen; nach Stoppen/Starten ist die
  Kamera sofort wieder einsatzbereit.
- Kamera-Fehler (z. B. Zugriff verweigert) und KI-Fehler (z. B. Modell lädt
  nicht wegen fehlender Internetverbindung) zeigen jetzt getrennte, klarere
  Meldungen.
- Die Erkennungsbox zeigt zusätzlich die Sicherheit der KI an (z. B. "PERSON 82%").

Die Feinjustierung (Modellwahl, Zeitabstand, Anzahl Bestätigungen, Mindestgröße)
steht als Konstanten ganz oben in app.js und lässt sich dort bei Bedarf anpassen.
