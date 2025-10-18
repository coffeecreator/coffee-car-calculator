# ☕ Coffee-Car Kalkulator

**Coffee-Car GmbH – Professionelles Coffee-Catering & Barista-Service**

Der Coffee-Car Kalkulator ist ein webbasiertes Tool zur schnellen und transparenten Preisermittlung für Coffee-Car Events.  
Die Anwendung greift live auf ein Google Sheet zu, in dem alle Preisparameter (Add-ons, Tagespauschalen, MwSt. usw.) gepflegt werden.  
Dadurch können Kunden, Partner oder Mitarbeiter in Echtzeit den Preis für Events kalkulieren – getrennt nach **Privat-** und **Gewerbekunden**.

---

## 🚀 Funktionen

- Dynamische Preisberechnung über Google Apps Script (Web-API)  
- Echtzeit-Anbindung an das Coffee-Car-Kalkulations-Sheet  
- Unterschiedliche Preislogik für Privat & Gewerbe  
- Add-ons (Waffeln, Frozen Cappuccino, Softeis, Milchschaumdrucker)  
- Branding-Optionen für Gewerbekunden (auf Anfrage)  
- Eventtyp-Auswahl (Hochzeit, Messe, Promotion etc.)  
- CTA-Formular „Unverbindlich anfragen“ mit Lead-Erfassung im Sheet  

---

## 🧩 Deployment über GitHub Pages

### 1️⃣ Dateien hochladen

1. Gehe zu **https://github.com/coffeecreator/coffee-car-calculator**
2. Klicke auf **Add file → Upload files**
3. Ziehe alle Dateien aus deinem Projektordner hinein:
   - `index.html`
   - `ape.jpg`, `bulli.jpg`, `mercedes.jpg`, `milkschaum.jpg`, `waffel.png`
4. Ganz unten auf **Commit changes** klicken

---

### 2️⃣ Veröffentlichung aktivieren

1. Oben auf **Settings → Pages**
2. Unter **Build and deployment**:
   - **Source:** „Deploy from a branch“
   - **Branch:** `main` + Ordner `/ (root)`
   - **Save**
3. Nach ca. 30 Sekunden ist die Seite online unter:  
   👉 **https://coffeecreator.github.io/coffee-car-calculator/**

---

## ⚙️ Technische Hinweise

- API-Verbindung über:  
  `https://script.google.com/macros/s/AKfycbzVZlwrVhJRISZHMmcbbE-Qy8CXGSPALcLogLpXHYCyWaKMsmxgdH6rm_uPWseVfGjC/exec`
- Zugriff im Google Apps Script: **„Jeder“** (öffentlich, ohne Login)
- Eventuelle Anpassungen an Preisen/Logik erfolgen ausschließlich im verbundenen Google Sheet  

---

## 🧑‍💼 Kontakt

**Coffee-Car GmbH**  
Professionelles Coffee-Catering & Barista-Service  
[www.coffee-car.com](https://www.coffee-car.com)

---

© 2025 Coffee-Car GmbH – alle Rechte vorbehalten.
