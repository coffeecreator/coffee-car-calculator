# Coffee-Car Calculator – Deploy Bundle

Dieses Paket enthält:
- `index.html` – Frontend (DSGVO, Autocomplete, Preis, Anfrage-Formular)
- `CoffeeCar_Backend_Final.gs` – Google Apps Script Backend (Proxy + Pricing + Logging + Auto-Reply + ICS)
- `pricing_template.xlsx` / `pricing_template.csv` – Preiskonfigurations-Vorlage (Tab: `Pricing`)
- `CoffeeCar_Dashboard.xlsx` – Dashboard-Vorlage zur Auswertung

## Einrichtung (Kurz)

1) **Apps Script**
   - https://script.google.com → Neues Projekt → Code aus `CoffeeCar_Backend_Final.gs` einfügen
   - Projekt-Eigenschaften → Script-Properties setzen:
     - `MAPS_API_KEY` = dein Google Maps Key (Places + Distance Matrix aktiv)
     - `SHEET_ID` = ID des Anfragen-Sheets
     - `PRICES_SHEET_ID` = (optional) ID des Pricing-Sheets
   - Deployment → **Als Web-App** (Ausführen als: *Ich*, Zugriff: *Jeder*) → URL kopieren

2) **Frontend**
   - `index.html` öffnen → `const GAS_ENDPOINT = "..."` mit Web-App-URL ersetzen
   - Datei ins GitHub-Repo (gh-pages) hochladen/ersetzen

3) **Pricing**
   - `pricing_template.xlsx` nach Google Sheets hochladen → Tab „Pricing“
   - Sheet-ID in Script-Property `PRICES_SHEET_ID` eintragen

4) **Dashboard**
   - `CoffeeCar_Dashboard.xlsx` nach Google Sheets hochladen
   - Datenbereich `Anfragen!A2:Q` referenziert die vom Backend geloggten Spalten

## Test
- Adresse tippen → Autocomplete
- „Verfügbarkeit prüfen“ → Basis/Distanz/Minuten
- Werte eingeben → Preis erscheint live
- „Angebot sichern“ → E-Mail an `info@coffee-car.com` + Auto-Antwort (mit ICS) + Eintrag im Sheet

## Support
Fragen? info@coffee-car.com
