# FZone Bright Light QR Editor

Lokale Browser-App zum Lesen, Bearbeiten und Erzeugen von FZone Lichtprogramm-QR-Codes.

## MVP-Funktionen

- QR-Code-Bilder hochladen und per ZXing dekodieren
- QR-Rohdaten direkt einfuegen
- Modell-Prefix und Header anzeigen
- FZone-Schaltpunkte im bekannten 10-Byte-Format parsen
- interne Reihenfolge `WGBR` als `WRGB` anzeigen
- Checksumme `(sum(bytes) + 0x55) mod 256` pruefen und neu berechnen
- Schaltpunkte bearbeiten, hinzufuegen und loeschen
- neuen QR-Code als grosses Canvas anzeigen, kopieren oder als PNG speichern
- Regressionstests fuer die drei analysierten Beispielcodes

## Beobachtete Modelle

- `fzone_solo55` mit Header `04 10`: FZONE Solo 55
- `smartaqua_brite55` mit Header `04 12`: FZONE Brite 55
- `smartaqua_brite55` mit Header `04 11`: FZONE Bright Light 120, anhand einer echten Nutzerlampe beobachtet

## Entwicklung

```bash
npm install
npm run dev
```

## Pruefung

```bash
npm test
npm run lint
npm run build
```
