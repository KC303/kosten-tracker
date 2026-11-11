# Kosten-Tracker

Eine kleine Web-App fürs Handy: Ausgaben erfassen, Fixkosten und Abos führen, Monatsbudget im Blick behalten.

Alle Daten bleiben auf dem Gerät (im Speicher des Browsers). Es gibt kein Konto, keinen Server für die Daten und keine fremden Skripte. Die App läuft nach dem ersten Öffnen auch ohne Netz.

## Was sie kann

- Ausgabe in wenigen Tippern erfassen: Betrag, Kategorie, Datum, Notiz
- Liste je Monat, antippen zum Ändern oder Löschen
- Statistik je Monat: Aufteilung nach Kategorie, Verlauf im Monat mit Budgetlinie, die letzten sechs Monate als Säulen, dazu Schnitt pro Tag, Prognose zum Monatsende, Vergleich zum Vormonat und größte Ausgabe
- Acht feste Kategorienfarben (auf Unterscheidbarkeit geprüft), hell und dunkel nach Systemeinstellung
- Glas-Look mit kleinen Animationen; wer im System „Bewegung reduzieren“ eingeschaltet hat, bekommt eine ruhige App
- Wiederkehrende Kosten (monatlich, vierteljährlich, halbjährlich, jährlich), sie zählen in ihrem Monat automatisch mit
- Monatsbudget, auf Wunsch für einen einzelnen Monat abweichend
- Export als CSV (Semikolon, Komma als Dezimalzeichen, öffnet in Excel und Numbers)
- Sicherung als Datei speichern und wieder einlesen

## Auf dem iPhone installieren

1. Die Adresse der App in Safari öffnen.
2. Teilen-Knopf antippen, dann „Zum Home-Bildschirm“.
3. Die App vom Home-Bildschirm starten.

Wichtig: Die Daten gehören zu dieser Installation. Wer das Symbol vom Home-Bildschirm löscht, löscht auch die Daten. Unter „Mehr“ lässt sich eine Sicherung speichern.

## Entwickeln

Keine Abhängigkeiten, kein Build-Schritt.

```bash
npm test      # Tests der Rechenlogik (node --test)
npm start     # lokal starten: http://127.0.0.1:8765
```

| Datei | Inhalt |
|---|---|
| `index.html`, `styles.css` | Oberfläche |
| `app.js` | Bedienung, Speichern im `localStorage` |
| `logik.js` | Rechenlogik ohne Browser-Zugriffe: Beträge, Fälligkeiten, Summen, Statistik, CSV, Datenprüfung |
| `diagramme.js` | Diagramme als SVG, ohne fremde Bibliothek |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation auf dem Home-Bildschirm |
| `tests/logik.test.js` | Tests |
| `werkzeuge/icon.swift` | zeichnet das App-Symbol neu (`swift werkzeuge/icon.swift icons`) |

Beträge werden als ganze Cent gespeichert, Daten als `JJJJ-MM-TT`.
