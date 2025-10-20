
/* Coffee-Car Calculator – v2 (2025-10-20)
   - Price via GAS using Google Sheet
   - Distance to nearest hub via Google Maps Distance Matrix (optional)
   - Trip cost: 0.65 €/km ab km 31
   - VAT fixed at 19%
*/

const MAPS_API_KEY = "AIzaSyBIRGZPccaGFYnieQTR8gbAox2KDL0pgoQ"; // <- Trage hier deinen Google Maps API Key ein (Geocoding + Distance Matrix)
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbx6ZY9exdi8AA3VnZhQJ7PTrK3KESP23QMheZTypVQAFuGDzySIptU5aAHBUoWl-_hc/exec";
const SHEET_ID = "16bzleQLoBucFyVTxeLwhFAk84_O0fOKCZW5U-UASbzI"; // vom Nutzer vorgegeben

const VAT = 0.19;

/* === CONFIG: Mapping deiner Sheet-/GAS-Feldnamen ===
   Links = FELDNAME, den dein GAS/Sheet erwartet
   Rechts = welchen UI-Wert wir liefern
   → Passe nur die Schlüssel auf der linken Seite an, wenn dein GAS andere Namen verwendet.
*/
const GAS_FIELD_MAP = {
  customer_type: (v)=>v.customer_type,
  guests: (v)=>v.guests,
  duration_hours: (v)=>v.duration_hours,
  weekday: (v)=>v.weekday,
  serving: (v)=>v.serving,
  days: (/*stateDays*/)=>state.days,
  addons_waffeln: (v)=>!!v.addons.waffeln,
  addons_softeis: (v)=>!!v.addons.softeis,
  addons_latteart: (v)=>!!v.addons.latteart,
  addons_kakaobar: (v)=>!!v.addons.kakaobar,
  addons_sirup: (v)=>!!v.addons.sirup,
};

function buildGASVars(ui){
  const o = {};
  for(const [key,fn] of Object.entries(GAS_FIELD_MAP)){
    try{ o[key] = fn(ui); }catch(e){ o[key] = null; }
  }
  return o;
}

const KM_FREE = 30; // km frei
const KM_RATE = 0.65; // EUR pro km ab 31.

// Hubs: name, lat, lng
const HUBS = [
  { name:"Stuttgart",  lat:48.7758, lng:9.1829 },
  { name:"Frankfurt",  lat:50.1109, lng:8.6821 },
  { name:"Singen",     lat:47.7653, lng:8.8420 },
  { name:"München",    lat:48.1351, lng:11.5820 },
  { name:"Düsseldorf", lat:51.2277, lng:6.7735 },
];

const state = {
  days: 1,
  lastCalc: null,
  distanceKm: null,
  distanceFrom: null,
  distanceStatus: "pending", // pending|ok|error|skipped
  addons: {
    waffeln: { label: "Waffeln am Stiel", selected: false },
    softeis: { label: "Softeis", selected: false },
    latteart: { label: "Latte-Art Show", selected: false },
    kakaobar: { label: "Kakao/Schoko", selected: false },
    sirup: { label: "Sirup-Auswahl", selected: false },
  },
};

function $(s,scope=document){return scope.querySelector(s)}
function $all(s,scope=document){return Array.from(scope.querySelectorAll(s))}
function eur(x){return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(x)}

function syncEndToStart(){
  const lock = $("#lock_dates").checked;
  if(!lock) return;
  $("#in_date_end").value = $("#in_date_start").value;
  $("#in_time_end").value = $("#in_time_start").value;
}

function calcDays(){
  const ds = $("#in_date_start").value;
  const de = $("#in_date_end").value || ds;
  const start = new Date(ds+"T00:00:00");
  const end = new Date(de+"T00:00:00");
  const days = Math.max(1, Math.floor((end-start)/86400000)+1);
  state.days = days;
  $("#out_days").textContent = String(days);
  return days;
}

function collectInputs(){
  return {
    customer_type: $("input[name=customer_type]:checked")?.value || "Privat",
    guests: +($("#in_guests").value || 0),
    duration_hours: +($("#in_duration").value || 0),
    weekday: $("#in_weekday").value,
    serving: $("#in_serving").value, // Tassen oder Becher
    addons: Object.fromEntries(Object.entries(state.addons).map(([k,v])=>[k,!!v.selected])),
    date_start: $("#in_date_start").value,
    time_start: $("#in_time_start").value,
    date_end: $("#in_date_end").value,
    time_end: $("#in_time_end").value,
    address: $("#in_address").value.trim(),
    name: $("#in_name").value.trim(),
    email: $("#in_email").value.trim(),
    phone: $("#in_phone").value.trim(),
    notes: $("#in_notes").value.trim(),
  };
}

async function fetchBasePriceFromGAS(vars){
  // Server computes net price based on the Google Sheet rules.
  // Expect: { status:"ok", price_net: number, breakdown?: {...} }
  const body = { action:"price", sheetId: SHEET_ID, vars };
  const resp = await fetch(GAS_ENDPOINT, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body),
  });
  if(!resp.ok) throw new Error("GAS HTTP "+resp.status);
  const data = await resp.json();
  if(!data || data.status!=="ok") throw new Error("GAS response invalid");
  return data;
}

function nearestHubDistanceMatrixUrl(encodedAddress, hub){
  const origins = encodeURIComponent(`${hub.lat},${hub.lng}`);
  const destinations = encodedAddress;
  return `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=${MAPS_API_KEY}`;
}

async function computeDistanceKm(address){
  // Requires MAPS_API_KEY; if missing, skip with status "skipped"
  if(!MAPS_API_KEY){
    state.distanceStatus = "skipped";
    return null;
  }
  const encAddr = encodeURIComponent(address);
  let best = { km: Infinity, hub: null };
  for(const hub of HUBS){
    const url = nearestHubDistanceMatrixUrl(encAddr, hub);
    const r = await fetch(url);
    if(!r.ok) continue;
    const j = await r.json();
    const el = j.rows?.[0]?.elements?.[0];
    const meters = el?.distance?.value;
    if(typeof meters === "number"){
      const km = meters/1000;
      if(km < best.km){
        best = { km, hub: hub.name };
      }
    }
  }
  if(best.hub){
    state.distanceKm = best.km;
    state.distanceFrom = best.hub;
    state.distanceStatus = "ok";
    return best;
  }else{
    state.distanceStatus = "error";
    return null;
  }
}

function computeTravelCost(distanceKm){
  if(distanceKm==null) return 0;
  const extra = Math.max(0, distanceKm - KM_FREE);
  return extra * KM_RATE;
}

async function recalc(){
  calcDays();
  const vars = collectInputs();
  const uiPriceNet = $("#out_price_net");
  const uiPriceBrut = $("#out_price_brut");
  const uiTrip = $("#out_trip_info");

  uiPriceNet.textContent = "Berechne…";
  uiPriceBrut.textContent = "–";
  uiTrip.textContent = "";

  try{
    // 1) Base price from GAS (sheet-driven)
    const result = await fetchBasePriceFromGAS(buildGASVars(vars));
    const baseNet = Number(result.price_net || 0);

    // 2) Distance → nearest hub → travel cost
    let travelInfo = null;
    if(vars.address && vars.address.length>=3){
      travelInfo = await computeDistanceKm(vars.address);
    }
    const km = state.distanceKm;
    const travelCost = computeTravelCost(km);

    // 3) Totals
    const net = baseNet + travelCost;
    const brut = Math.round((net*(1+VAT))*100)/100;

    uiPriceNet.textContent = eur(net);
    uiPriceBrut.textContent = eur(brut);

    if(state.distanceStatus==="ok"){
      uiTrip.textContent = `Anfahrt: ~${km.toFixed(1)} km ab ${state.distanceFrom} – ${KM_FREE} km frei, danach ${eur(KM_RATE)}/km → Zuschlag: ${eur(travelCost)}`;
    }else if(state.distanceStatus==="skipped"){
      uiTrip.textContent = "Anfahrt: Bitte Google Maps API Key hinterlegen, sonst wird die Entfernung nicht automatisch berechnet.";
    }else if(state.distanceStatus==="error"){
      uiTrip.textContent = "Anfahrt: Entfernung konnte nicht ermittelt werden.";
    }else{
      uiTrip.textContent = "";
    }

    state.lastCalc = { baseNet, travelCost, net, brut, km, from: state.distanceFrom };
  }catch(err){
    uiPriceNet.textContent = "Fehler bei der Preisberechnung";
    uiPriceBrut.textContent = "–";
    console.error(err);
  }
}

function init(){
  // default setup
  $("#lock_dates").checked = true;
  const today = new Date().toISOString().slice(0,10);
  $("#in_date_start").value = today;
  $("#in_date_end").value = today;
  $("#in_time_start").value = "10:00";
  $("#in_time_end").value = "10:00";

  // listeners
  ["in_date_start","in_time_start"].forEach(id=> $("#"+id).addEventListener("change", ()=>{ syncEndToStart(); recalc(); }));
  ["in_date_end","in_time_end"].forEach(id=> $("#"+id).addEventListener("change", recalc));
  $("#lock_dates").addEventListener("change", ()=>{ syncEndToStart(); recalc(); });

  ["in_guests","in_duration","in_weekday","in_serving","in_address"].forEach(id=> $("#"+id).addEventListener("input", recalc));
  $all("input[name=customer_type]").forEach(r => r.addEventListener("change", recalc));
  $all(".addon input[type=checkbox]").forEach(cb => cb.addEventListener("change", e=>{
    state.addons[e.target.dataset.key].selected = e.target.checked;
    recalc();
  }));

  $("#btn_check").addEventListener("click", async ()=>{
    await recalc();
    const resEl = $("#avail_result");
    resEl.textContent = "Verfügbarkeit wird geprüft…";
    try{
      const payload = { action:"check", sheetId:SHEET_ID, vars: collectInputs() };
      const resp = await fetch(GAS_ENDPOINT+"?action=check&sheetId="+encodeURIComponent(SHEET_ID), { method:"GET" });
      if(!resp.ok) throw new Error("HTTP "+resp.status);
      const data = await resp.json().catch(()=>null);
      if(data && (data.available===true || data.status==="ok")){
        resEl.textContent = "Verfügbar – wir senden Ihnen zeitnah ein Angebot.";
        resEl.className = "small success";
      }else{
        resEl.textContent = "Leider nicht verfügbar – wir melden uns mit Alternativen.";
        resEl.className = "small error";
      }
    }catch(e){
      resEl.textContent = "Konnte nicht geprüft werden (API/Netzwerk).";
      resEl.className = "small error";
    }
  });

  $("#btn_submit").addEventListener("click", async ()=>{
    await recalc();
    const resEl = $("#submit_result");
    resEl.textContent = "Senden…";
    try{
      const payload = { action:"request", sheetId:SHEET_ID, vars: collectInputs(), calc: state.lastCalc };
      const resp = await fetch(GAS_ENDPOINT, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
      if(!resp.ok) throw new Error("HTTP "+resp.status);
      const data = await resp.json().catch(()=>null);
      resEl.textContent = "Danke! Ihre Anfrage wurde übermittelt.";
      resEl.className = "small success";
    }catch(e){
      resEl.textContent = "Senden fehlgeschlagen (API/Netzwerk).";
      resEl.className = "small error";
    }
  });

  recalc();
}

document.addEventListener("DOMContentLoaded", init);
