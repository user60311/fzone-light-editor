# FZone Bright Light QR Editor

Browser-App zum Lesen, Bearbeiten, Veröffentlichen und Erzeugen von FZone Lichtprogramm-QR-Codes.

## MVP-Funktionen

- QR-Code-Bilder hochladen und per jsQR dekodieren
- QR-Rohdaten direkt einfügen
- Modell-Prefix und Header anzeigen
- FZone-Schaltpunkte im bekannten 10-Byte-Format parsen
- interne Reihenfolge `WGBR` als `WRGB` anzeigen
- Checksumme `(sum(bytes) + 0x55) mod 256` prüfen und neu berechnen
- Schaltpunkte bearbeiten, hinzufügen und löschen
- neuen QR-Code als großes Canvas anzeigen, kopieren oder als PNG speichern
- Community-Profile über Cloudflare Workers, Static Assets und D1 speichern
- Regressionstests für die drei analysierten Beispielcodes

## Beobachtete Modelle

- `fzone_solo55` mit Header `04 10`: FZONE Solo 55
- `smartaqua_brite55` mit Header `04 12`: FZONE Brite 55
- `smartaqua_brite55` mit Header `04 11`: FZONE Bright Light 120, anhand einer echten Nutzerlampe beobachtet

## Entwicklung

```bash
npm install
npm run dev
```

## Prüfung

```bash
npm test
npm run lint
npm run build
npm run worker:check
```

## Community-Speicher mit Cloudflare D1

Die App kann kostenlos auf GitHub Pages laufen. Für gemeinsam gespeicherte Profile braucht sie zusätzlich Cloudflare Workers mit Static Assets und D1.

1. In Cloudflare unter Workers & Pages eine Application mit diesem GitHub-Repo verbinden.
2. Build command: `npm run build`
3. Deploy command: `npx wrangler deploy`
4. Version command: `npx wrangler versions upload`
5. Root directory: `/`
6. D1-Datenbank anlegen: `npx wrangler d1 create fzone-light-editor`
7. In Cloudflare beim Worker unter Settings > Bindings die D1-Bindung `DB` auf diese Datenbank setzen.
8. Migration anwenden: `npm run d1:migrate:remote`

Die Datei `wrangler.jsonc` liefert dabei `dist` als Static Assets aus und schickt nur `/api/*` an den Worker.

Lokaler Cloudflare-Test:

```bash
npm run worker:dev
```

Wenn die D1-Bindung noch fehlt, läuft die App trotzdem, aber der Community-Bereich meldet, dass der Speicher noch nicht verbunden ist.
