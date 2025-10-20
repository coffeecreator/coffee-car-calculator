/* === Coffee-Car GAS Backend (Proxy + Pricing + Logging + Auto-Reply + ICS) ===
Script Properties:
  MAPS_API_KEY     = dein Google Maps-Key
  SHEET_ID         = 1blV9Q73aAx1FUz2X9gJpu3q8fEBhpcV8S1n-ni6cbX8
  PRICES_SHEET_ID  = <optional Pricing-Sheet>
*/

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const BASES = [
  {name:"Frankfurt",  lat:50.1109, lng:8.6821},
  {name:"Stuttgart",  lat:48.7758, lng:9.1829},
  {name:"München",    lat:48.1351, lng:11.5820},
  {name:"Singen",     lat:47.7593, lng:8.8406},
  {name:"Düsseldorf", lat:51.2277, lng:6.7735},
];

function doOptions(){ return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT).setHeaders(CORS); }

function doGet(e){
  const action = (e.parameter.action||"").toLowerCase();
  if(action === "distance"){ return json_(distanceForOrigin_(e.parameter.origin||"")); }
  if(action === "places"){ return json_(places_(e.parameter.q||"")); }
  if(action === "ping"){ return json_({ok:true, ts:new Date().toISOString()}); }
  return json_({ok:false, error:"unknown action"});
}

function doPost(e){
  let body = {};
  try{ body = JSON.parse(e.postData.contents||"{}"); }catch(_){}
  const action = (body.action||"").toLowerCase();
  if(action === "lead"){ return json_({ok: logLead_(body)}); }
  if(action === "price"){ return json_(priceFor_(body)); }
  return json_({ok:false, error:"unknown action"});
}

// ---------- Helpers ----------
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON).setHeaders(CORS); }
function prop_(k){ return PropertiesService.getScriptProperties().getProperty(k); }

// --- Places Autocomplete (Proxy) ---
function places_(q){
  const key = prop_("MAPS_API_KEY");
  if(!q) return {ok:false, predictions:[]};
  const url = "https://maps.googleapis.com/maps/api/place/autocomplete/json?input="+encodeURIComponent(q)+"&types=geocode&language=de&components=country:de&key="+encodeURIComponent(key);
  const resp = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
  const data = JSON.parse(resp.getContentText()||"{}");
  return {ok:true, predictions:(data.predictions||[]).map(p=>({description:p.description, place_id:p.place_id}))};
}

// --- Distance Matrix (kürzeste Basis) ---
function distanceForOrigin_(origin){
  const key = prop_("MAPS_API_KEY");
  if(!origin) return {ok:false, error:"no origin"};
  const results = BASES.map(b=>{
    const url = "https://maps.googleapis.com/maps/api/distancematrix/json?units=metric"
      +"&origins="+encodeURIComponent(origin)
      +"&destinations="+encodeURIComponent(b.lat+","+b.lng)
      +"&key="+encodeURIComponent(key);
    const resp = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
    const data = JSON.parse(resp.getContentText()||"{}");
    const el = data.rows?.[0]?.elements?.[0]||{};
    return {base:b, distance_m: el.distance?.value||null, duration_s: el.duration?.value||null};
  }).filter(x=>x.distance_m);
  if(!results.length) return {ok:false, error:"geocode"};
  const best = results.sort((a,b)=>a.distance_m-b.distance_m)[0];
  return {ok:true, base:best.base, distance_m:best.distance_m, duration_s:best.duration_s};
}

// --- Preisberechnung ---
function priceFor_(b){
  const start = new Date(b.date_start), end = new Date(b.date_end);
  const days = Number(b.days||1);
  const hoursPerDay = Number(b.hours_per_day||6);
  const guests = Number(b.guests||0);
  const addons = b.addons||{};
  const origin = b.loc||"";
  const seg = (b.segment||"").toLowerCase();

  const d = distanceForOrigin_(origin);
  const km = d.distance_m ? d.distance_m/1000 : 0;
  const nearestBaseName = d.base?.name || "";

  const cfg = readPricingConfig_() || {
    UST: 0.19,
    BASE_DAY: 690,
    HOUR_FACTOR: 1.00,
    KM_COST: 0.85,
    HELPER_PER_100: 1,
    HELPER_RATE: 29,
    GUEST_STEP_EUR: 1.80,
    WEEKEND_MULT: 1.2,
    SEGMENT_MULT: { privat:1.0, gewerbe:1.05, agentur:1.08, "kindergarten/schule":0.95, "behörde/öffentliche einrichtung":0.98 },
    ADDONS: { waffles:190, softice:240, latteart:0, milkalts:35, branding:160 }
  };

  let weekend = false;
  if(!isNaN(start.valueOf()) && !isNaN(end.valueOf())){
    const dt = new Date(start);
    for(let i=0;i<days;i++){
      const w = (dt.getDay()+6)%7; // 0=Mo…6=So
      if(w>=5) { weekend = true; break; }
      dt.setDate(dt.getDate()+1);
    }
  }

  const helpers = Math.max(0, Math.ceil(guests/100)*cfg.HELPER_PER_100);
  const helperCost = helpers * cfg.HELPER_RATE * hoursPerDay * days;

  let addonsCost = 0;
  Object.keys(addons||{}).forEach(k=>{ if(addons[k] && cfg.ADDONS[k]!=null) addonsCost += Number(cfg.ADDONS[k])||0; });

  const hourFactor = hoursPerDay<=6 ? 1.00 : (hoursPerDay<=8 ? 1.08 : 1.15);
  const segMult = cfg.SEGMENT_MULT[seg] || 1.0;
  const distanceCost = km * cfg.KM_COST;

  let price_net =
    (cfg.BASE_DAY * days * hourFactor) +
    (guests * cfg.GUEST_STEP_EUR) +
    helperCost + addonsCost + distanceCost;

  if(weekend) price_net *= cfg.WEEKEND_MULT;
  price_net *= segMult;

  const vat = price_net * cfg.UST;
  const gross = price_net + vat;

  const note = [
    `${days} Tag(e) × Basis`,
    `${hoursPerDay} h/Tag (Faktor ${hourFactor.toFixed(2)})`,
    `${guests} Gäste`,
    helpers ? `${helpers} Helfer` : null,
    km ? `${km.toFixed(1)} km ab ${nearestBaseName}` : null,
    weekend ? `Wochenend-Zuschlag` : null,
    addonsCost? `Addons: ${formatEUR_(addonsCost)}`: null
  ].filter(Boolean).join(" · ");

  return { ok:true, price_net: round2_(price_net), vat: round2_(vat), price_gross: round2_(gross), note };
}

function round2_(n){ return Math.round((n+Number.EPSILON)*100)/100; }
function formatEUR_(n){ return Utilities.formatString('%.2f €', n); }

function readPricingConfig_(){
  const sid = prop_("PRICES_SHEET_ID"); if(!sid) return null;
  const ss = SpreadsheetApp.openById(sid);
  const sh = ss.getSheetByName("Pricing") || ss.getSheetByName("Config");
  if(!sh) return null;
  const values = sh.getDataRange().getValues(); // key | value
  const m = {};
  for(let i=0;i<values.length;i++){
    const k = String(values[i][0]||"").trim();
    const v = values[i][1];
    if(!k) continue;
    m[k] = v;
  }
  const parseNum = x => Number(String(x).replace(",", "."));
  const seg = {
    privat: parseNum(m["SEG_PRIVAT"]||1),
    gewerbe: parseNum(m["SEG_GEWERBE"]||1.05),
    agentur: parseNum(m["SEG_AGENTUR"]||1.08),
    "kindergarten/schule": parseNum(m["SEG_KITA_SCHULE"]||0.95),
    "behörde/öffentliche einrichtung": parseNum(m["SEG_BEHOERDE"]||0.98)
  };
  const addons = {
    waffles:  parseNum(m["ADD_WAFFLES"]||190),
    softice:  parseNum(m["ADD_SOFTICE"]||240),
    latteart: parseNum(m["ADD_LATTEART"]||0),
    milkalts: parseNum(m["ADD_MILKALTS"]||35),
    branding: parseNum(m["ADD_BRANDING"]||160),
  };
  return {
    UST: parseNum(m["UST"]||0.19),
    BASE_DAY: parseNum(m["BASE_DAY"]||690),
    HOUR_FACTOR: 1,
    KM_COST: parseNum(m["KM_COST"]||0.85),
    HELPER_PER_100: parseNum(m["HELPER_PER_100"]||1),
    HELPER_RATE: parseNum(m["HELPER_RATE"]||29),
    GUEST_STEP_EUR: parseNum(m["GUEST_STEP_EUR"]||1.8),
    WEEKEND_MULT: parseNum(m["WEEKEND_MULT"]||1.2),
    SEGMENT_MULT: seg,
    ADDONS: addons
  };
}

// --- Lead Logging + Mail (inkl. Auto-Reply & ICS-Anhang) ---
function logLead_(b){
  const sid = prop_("SHEET_ID");
  const ss = SpreadsheetApp.openById(sid);
  const sh = ss.getSheetByName("Anfragen") || ss.insertSheet("Anfragen");
  const now = new Date();

  let price = {price_gross:null, price_net:null, vat:null, note:""};
  try{ price = priceFor_(b); }catch(_){}

  const row = [
    now, b.name||"", b.email||"", b.phone||"", b.segment||"",
    b.date_start||"", b.date_end||"", b.days||"", b.hours_per_day||"", b.guests||"",
    b.loc||"", b.base||"", b.dist_label||"", b.notes||"",
    price.price_net||"", price.vat||"", price.price_gross||"", price.note||""
  ];
  sh.appendRow(row);

  try{
    MailApp.sendEmail({
      to: "info@coffee-car.com",
      replyTo: b.email || "",
      subject: "Neue Coffee-Car Anfrage",
      htmlBody:
        "<b>Neue Anfrage</b><br><pre style='font-size:12px'>"
        + sanitize_(JSON.stringify(b, null, 2))
        + "</pre><hr><b>Preis</b>: "
        + (price.price_gross? formatEUR_(price.price_gross):"-")
        + "<br><i>"+sanitize_(price.note||"")+"</i>"
        + "<hr><p style='font-size:12px;color:#64748b'>Diese Nachricht wurde automatisch vom Coffee-Car Anfrage-System gesendet.<br>"
        + "Datenschutz: <a href='mailto:privacy@coffee-car.com'>privacy@coffee-car.com</a></p>"
    });
  }catch(e){
    Logger.log("Mail (intern) error: "+e);
  }

  try{
    if(isValidEmail_(b.email)){
      const subj = "Ihre Coffee-Car Anfrage – Eingangsbestätigung";
      const html = buildCustomerMail_(b, price);
      const text = htmlToText_(html);
      const ics  = buildICS_(b);
      const blob = Utilities.newBlob(ics, "text/calendar", "Coffee-Car-Anfrage.ics");

      MailApp.sendEmail({
        to: b.email,
        name: "Coffee-Car",
        replyTo: "info@coffee-car.com",
        subject: subj,
        htmlBody: html,
        body: text,
        attachments: [blob]
      });
    }
  }catch(e){
    Logger.log("Mail (customer) error: "+e);
  }

  return true;
}

// --- Utilities ---
function isValidEmail_(s){
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function buildCustomerMail_(b, price){
  var name   = sanitize_(b.name || "");
  var email  = sanitize_(b.email || "");
  var phone  = sanitize_(b.phone || "");
  var dates  = sanitize_((b.date_start||"") + (b.date_end && b.date_end!==b.date_start ? " – "+b.date_end : ""));
  var loc    = sanitize_(b.loc || "");
  var seg    = sanitize_(b.segment || "");
  var guests = sanitize_(String(b.guests || ""));
  var hours  = sanitize_(String(b.hours_per_day || ""));
  var base   = sanitize_(b.base || "");
  var dist   = sanitize_(b.dist_label || "");
  var note   = sanitize_(price.note || "");
  var gross  = price.price_gross!=null ? formatEUR_(price.price_gross) : "-";

  return (
    "<div style='font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#0f172a'>" +
    "<div style='padding:14px 0'>" +
      "<span style='font-weight:700'>Coffee-Car</span>" +
    "</div>" +
    "<h2 style='margin:0 0 6px 0'>Vielen Dank für Ihre Anfrage!</h2>" +
    "<p>Wir haben Ihre Angaben erhalten und melden uns zeitnah mit einem konkreten Angebot. Unten finden Sie eine kurze Zusammenfassung:</p>" +
    "<table cellpadding='6' style='border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px'>" +
      row_("Name", name || "-") +
      row_("E-Mail", email || "-") +
      row_("Telefon", phone || "-") +
      row_("Termin", dates || "-") +
      row_("Ort/PLZ", loc || "-") +
      row_("Segment", seg || "-") +
      row_("Gäste (ca.)", guests || "-") +
      row_("Stunden/Tag", hours || "-") +
      row_("Nächste Basis / Distanz", (base||"-")+" / "+(dist||"-")) +
      row_("Preisindikator (brutto)", gross) +
      row_("Berechnungsnotiz", note || "-") +
    "</table>" +
    "<p style='margin-top:12px'>Wenn Sie noch Informationen ergänzen möchten, antworten Sie einfach auf diese E-Mail.</p>" +
    "<p style='margin-top:20px;color:#64748b;font-size:12px'>Coffee-Car GmbH · Theodor-Heuss-Allee 112, 60486 Frankfurt am Main · " +
    "<a href='mailto:info@coffee-car.com'>info@coffee-car.com</a> · +49 711 219535609</p>" +
    "</div>"
  );
  function row_(k,v){
    return "<tr><td style='border-bottom:1px solid #e2e8f0;color:#64748b'>"+k+
           "</td><td style='border-bottom:1px solid #e2e8f0'><b>"+v+"</b></td></tr>";
  }
}

function htmlToText_(html){
  return html.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
}

function buildICS_(b){
  var tz = "Europe/Berlin";
  var startDate = b.date_start ? new Date(b.date_start+"T09:00:00") : new Date();
  var endDate;
  var hours = Number(b.hours_per_day||4);
  if(b.date_end){
    var endBase = new Date(b.date_end+"T09:00:00");
    endDate = new Date(endBase.getTime() + (hours*60*60*1000));
  }else{
    endDate = new Date(startDate.getTime() + (hours*60*60*1000));
  }
  var uid = "coffee-car-" + Utilities.getUuid() + "@coffee-car.com";
  var now = new Date();
  var summary = "Coffee-Car – Anfrage eingegangen";
  var description = "Vielen Dank für Ihre Anfrage.\\nWir melden uns zeitnah mit einem konkreten Angebot.";

  var ics =
"BEGIN:VCALENDAR\r\n" +
"PRODID:-//Coffee-Car//Inquiry//DE\r\n" +
"VERSION:2.0\r\n" +
"CALSCALE:GREGORIAN\r\n" +
"METHOD:PUBLISH\r\n" +
"BEGIN:VEVENT\r\n" +
"UID:" + uid + "\r\n" +
"DTSTAMP:" + toICSDate_(now) + "\r\n" +
"SUMMARY:" + summary + "\r\n" +
"DESCRIPTION:" + description + "\r\n" +
"DTSTART;TZID=" + tz + ":" + toICSDate_(startDate, true) + "\r\n" +
"DTEND;TZID=" + tz + ":" + toICSDate_(endDate, true) + "\r\n" +
"LOCATION:" + (b.loc||"") + "\r\n" +
"END:VEVENT\r\n" +
"END:VCALENDAR\r\n";
  return ics;
}
function toICSDate_(d, local){
  if(local){
    return d.getFullYear().toString() + pad2_(d.getMonth()+1) + pad2_(d.getDate()) + "T" + pad2_(d.getHours()) + pad2_(d.getMinutes()) + pad2_(d.getSeconds());
  }else{
    var u = new Date(d.getTime() - d.getTimezoneOffset()*60000);
    return u.getFullYear().toString() + pad2_(u.getMonth()+1) + pad2_(u.getDate()) + "T" + pad2_(u.getHours()) + pad2_(u.getMinutes()) + pad2_(u.getSeconds()) + "Z";
  }
}
function pad2_(n){ return (n<10?"0":"")+n; }

function sanitize_(s){ return String(s).replace(/[<>&]/g, m=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[m])); }
