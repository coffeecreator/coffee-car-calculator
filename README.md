
# Coffee‑Car Preiskalkulator v2 (2025-10-20)

**Was ist neu**
- Preis wird über **Google Apps Script** direkt aus dem **Sheet `16bzleQLoBucFyVTxeLwhFAk84_O0fOKCZW5U-UASbzI`** berechnet (Variablen: Gästezahl, Einsatzdauer, Wochentag, Ausschank, Addons, Tage).
- **Anfahrt** zum nächstgelegenen Standort (Stuttgart, Frankfurt, Singen, München, Düsseldorf). **0,65 €/km ab km 31**.
- **USt. 19 %** fest.
- **Impressum & Datenschutz** im Footer + **„Wir über uns“** + **FAQ (10)**.
- Mobile‑optimiertes, schnelles UI.

## Setup
1. **GAS Endpoint** in `app.js` prüfen (`GAS_ENDPOINT`). Der Server muss folgende Aktionen unterstützen:
   - `POST action:"price"` → Eingabe: `sheetId`, `vars` → Ausgabe: `{status:"ok", price_net:Number}`.
   - `GET  action:"check"` → Eingabe: `sheetId` → Ausgabe: `{status:"ok", available:Boolean}` (oder kompatibel).
   - `POST action:"request"` → Speichert Anfrage + Logging.
2. **Maps API Key** in `app.js` bei `MAPS_API_KEY` eintragen (Geocoding+Distance Matrix). Ohne Key wird die Anfahrtsberechnung übersprungen.
3. Dateien hochladen (z. B. GitHub Pages/Netlify/Server). Browser mit Strg/Cmd+F5 neu laden.

## Hinweise
- Der Server (GAS) übernimmt die **Preislogik aus dem Sheet**. Bitte sicherstellen, dass die Felder `vars` zu euren Tabellen/Benennungen passen.
- Anfahrt wird **immer** berechnet; es wird automatisch der **nächstgelegene Standort** verwendet.
- Impressum/Datenschutz sind Mustertexte – bitte eigene Firmendaten eintragen.

---

## Google-Maps Entfernung – Schritt-für-Schritt
1. In der Google Cloud Console ein Projekt wählen/anlegen.
2. **Billing aktivieren** (erforderlich für Distance Matrix).
3. **APIs aktivieren**: *Distance Matrix API* und *Geocoding API*.
4. **API Key erstellen** → Key **einschränken**:
   - Anwendungseinschränkung: **HTTP-Referrer (Websites)** → eure Domain(s) eintragen (z. B. `https://coffeecreator.github.io/*`).
   - API-Einschränkung: nur **Distance Matrix API** und **Geocoding API**.
5. Key in `app.js` bei `MAPS_API_KEY` eintragen.
6. Seite hart neu laden (Strg/Cmd+F5) und testen: Adresse eingeben → Ergebnis unter „Anfahrt“ erscheint.

**Kostenlogik:** 30 km frei, ab km 31 → 0.65 €/km Zuschlag. 


## Feldnamen-Mapping (GAS_FIELD_MAP)
In `app.js` gibt es den Block `GAS_FIELD_MAP`. Dort kannst du die **linken Schlüssel** so benennen,
wie dein Google-Apps-Script/Sheet sie erwartet. Die rechten Seiten erzeugen die Werte aus dem UI.
Beispiel: Wenn dein Sheet statt `duration_hours` einfach `dauer` erwartet, ändere die Zeile zu
`dauer: (v)=>v.duration_hours`.

Danach neu deployen, Seite hart neu laden.
