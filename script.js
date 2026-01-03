// =======================
// MODALITÀ: game / screen  ✅ (MODIFICA 1)
// =======================
const params = new URLSearchParams(window.location.search);
const MODE = (params.get("mode") || "game").toLowerCase(); // "game" | "screen"
console.log("MODE:", MODE);

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDc_SVC5FFyMf6fZeN0Be_kIAWWWBj8tYg",
  authDomain: "affari-tuoi-1b994.firebaseapp.com",
  projectId: "affari-tuoi-1b994",
  storageBucket: "affari-tuoi-1b994.firebasestorage.app",
  messagingSenderId: "639378779280",
  appId: "1:639378779280:web:dc550dd56b529bdfb93c15",
  measurementId: "G-JP7JTV9NTF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Init Firestore
const db = firebase.firestore();

console.log("🔥 Firebase inizializzato", db);

// attiva la modalità anche per il CSS (sicuro dopo caricamento DOM)
document.addEventListener("DOMContentLoaded", () => {
  document.body.setAttribute("data-mode", MODE);
});



// =======================
// CONFIG
// =======================
const LOCALITIES = [
  "Girilonga","Coroddis","Su tauli","Corosa","Gennaguara","Maricoxina","Niu Susu","Funtanedda De basciu",
  "Barigau","Niu Sciossu","Su fossu e Bobboi","S'arcu e susu","Mattemola","Pissu e cuccu","Tucci","Costa e coccu",
  "Santa Luscia","Mesu idda","Sa Cranniga","Bosco selene"
];

// tier: LOW 1-10, MID 11-13, HIGH 14-20
function tierForPrizeIndex(i1to20){
  if (i1to20 <= 10) return "LOW";
  if (i1to20 <= 13) return "MID";
  return "HIGH";
}
const TIER_VALUE = { LOW: 10, MID: 50, HIGH: 150 };

const OFFER_MOMENTS = [5, 15];
const SWAP_MOMENT = 10; // primo cambio dopo 10 pacchi
// secondo cambio quando restano gli ultimi 2 pacchi (gestito a parte)

// =======================
// STATE
// =======================
let state = null;

// =======================
// DOM
// =======================
const ui = {
  openedLabel: document.getElementById("openedLabel"),
  myCaseLabel: document.getElementById("myCaseLabel"),
  hintText: document.getElementById("hintText"),

  prizeGrid: document.getElementById("prizeGrid"),
  caseGrid: document.getElementById("caseGrid"),

  btnNew: document.getElementById("btnNew"),
  btnSwap: document.getElementById("btnSwap"),

  offerValue: document.getElementById("offerValue"),
  casesLeft: document.getElementById("casesLeft"),

  resultBox: document.getElementById("resultBox"),
  resultTitle: document.getElementById("resultTitle"),
  resultText: document.getElementById("resultText"),

  // modals
  pickModal: document.getElementById("pickModal"),
  pickGrid: document.getElementById("pickGrid"),
  pickClose: document.getElementById("pickClose"),
  pickRandom: document.getElementById("pickRandom"),

  revealModal: document.getElementById("revealModal"),
  revealClose: document.getElementById("revealClose"),
  revealOk: document.getElementById("revealOk"),
  revealPlace: document.getElementById("revealPlace"),
  revealPrize: document.getElementById("revealPrize"),
  revealSub: document.getElementById("revealSub"),

  offerModal: document.getElementById("offerModal"),
  offerClose: document.getElementById("offerClose"),
  offerModalValue: document.getElementById("offerModalValue"),
  offerAccept: document.getElementById("offerAccept"),
  offerReject: document.getElementById("offerReject"),

  swapModal: document.getElementById("swapModal"),
  swapClose: document.getElementById("swapClose"),
  swapMyCase: document.getElementById("swapMyCase"),
  swapGrid: document.getElementById("swapGrid"),
  swapSkip: document.getElementById("swapSkip"),
};

// =======================
// HELPERS
// =======================
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function openModal(el){
  el.hidden = false;
}
function closeModal(el){
  el.hidden = true;
}
function remainingUnopenedCases(){
  return state.cases.filter(c => !c.opened);
}
function remainingPlayableCases(){
  // casi cliccabili: non aperti e non il mio pacco
  return state.cases.filter(c => !c.opened && c.id !== state.myCaseId);
}
function getCaseName(caseId){
  const c = state.cases.find(x => x.id === caseId);
  return c ? c.name : "—";
}
function prizeBadgeClass(tier){
  return tier === "LOW" ? "low" : tier === "MID" ? "mid" : "high";
}

// =======================
// NEW GAME
// =======================
function newGame(){
  const prizes = Array.from({length:20}, (_,i)=>{
    const idx = i+1;
    const tier = tierForPrizeIndex(idx);
    return {
      label: `Premio ${idx}`,
      tier,
      value: TIER_VALUE[tier],
      out: false
    };
  });

  const shuffledPrizes = shuffle(prizes.map((p, i) => ({...p, _pi:i})));
  const cases = LOCALITIES.map((name, i)=>({
    id: i+1,
    name,
    opened:false,
    prize: shuffledPrizes[i] // oggetto premio assegnato
  }));

  state = {
    status: "picking",       // picking | playing | ended
    myCaseId: null,
    openedCount: 0,
    lastOffer: null,
    offersDone: new Set(),
    firstSwapDone: false,
    finalSwapDone: false,
    cases
  };

  ui.resultBox.hidden = true;
  ui.offerValue.textContent = "—";
  renderAll();
  showPickModalMandatory();
}

function renderAll(){
  // header
  ui.openedLabel.textContent = String(state.openedCount);
  ui.myCaseLabel.textContent = state.myCaseId ? getCaseName(state.myCaseId) : "—";

  const left = remainingUnopenedCases().length;
  ui.casesLeft.textContent = String(left);

  // hint
  if (!state.myCaseId) {
    ui.hintText.textContent = "Scegli la tua località (il tuo pacco).";
  } else if (state.status === "ended") {
    ui.hintText.textContent = "Partita terminata.";
  } else {
    ui.hintText.textContent = "Apri le località (non il tuo pacco).";
  }

  renderPrizeGrid();
  renderCaseGrid();
}

function renderPrizeGrid(){
  // ricostruiamo lista "compatta" dai pacchi assegnati (premi unici)
  // prendiamo tutti i premi originali (20) e segniamo out se aperti
  const allPrizes = [];
  const seen = new Set();
  for (const c of state.cases){
    const key = c.prize.label;
    if (!seen.has(key)){
      seen.add(key);
      allPrizes.push(c.prize);
    }
  }
  // ordina per numero premio
  allPrizes.sort((a,b)=>{
    const na = parseInt(a.label.replace(/\D/g,""),10);
    const nb = parseInt(b.label.replace(/\D/g,""),10);
    return na-nb;
  });

  ui.prizeGrid.innerHTML = "";
  allPrizes.forEach(p=>{
    const row = document.createElement("div");
    row.className = "prizeItem" + (p.out ? " out" : "");
    const left = document.createElement("div");
    left.textContent = p.label;
    const badge = document.createElement("span");
    badge.className = `badge ${prizeBadgeClass(p.tier)}`;
    badge.textContent = p.tier;
    row.appendChild(left);
    row.appendChild(badge);
    ui.prizeGrid.appendChild(row);
  });
}

function renderCaseGrid(){
  ui.caseGrid.innerHTML = "";
  state.cases.forEach(c=>{
    const btn = document.createElement("button");
    btn.className = "caseBtn" +
      (c.opened ? " opened" : "") +
      (state.myCaseId === c.id ? " mine" : "");

    btn.disabled = c.opened || (state.status !== "playing") || (c.id === state.myCaseId);
    btn.textContent = c.name;

    // ✅ (MODIFICA 2) click solo in MODE=game
    if (MODE === "game") {
      btn.addEventListener("click", ()=> onCaseClick(c.id));
    }

    ui.caseGrid.appendChild(btn);
  });
}

// =======================
// PICK MODAL
// =======================
function showPickModalMandatory(){
  // in screen mode mostriamo solo lo stato, non forziamo modali
  if (MODE !== "game") return;

  ui.pickGrid.innerHTML = "";
  state.cases.forEach(c=>{
    const btn = document.createElement("button");
    btn.className = "caseBtn";
    btn.textContent = c.name;

    btn.addEventListener("click", ()=>{
      pickMyCase(c.id);
    });

    ui.pickGrid.appendChild(btn);
  });

  openModal(ui.pickModal);
}

function pickMyCase(caseId){
  state.myCaseId = caseId;
  state.status = "playing";
  closeModal(ui.pickModal);
  renderAll();
}

// =======================
// OPEN CASE
// =======================
function onCaseClick(caseId){
  // ✅ (MODIFICA 3) blocca qualsiasi click su screen
  if (MODE !== "game") return;

  if (state.status !== "playing") return;
  if (!state.myCaseId) return;

  const c = state.cases.find(x=>x.id===caseId);
  if (!c || c.opened) return;
  if (caseId === state.myCaseId) return;

  c.opened = true;
  c.prize.out = true;
  state.openedCount++;

  renderAll();
  showRevealModal(c.name, c.prize.label);

  // momenti speciali dopo la rivelazione (quando premi OK)
}

// =======================
// REVEAL MODAL
// =======================
function showRevealModal(place, prizeLabel){
  ui.revealPlace.textContent = place;
  ui.revealPrize.textContent = prizeLabel;
  ui.revealSub.textContent = "Continua ad aprire le località.";
  openModal(ui.revealModal);
}

// =======================
// OFFER / SWAP LOGIC
// =======================
function computeOffer(){
  const remainingPrizes = [];
  const seen = new Set();
  for(const c of state.cases){
    const p = c.prize;
    if (!p.out && !seen.has(p.label)){
      seen.add(p.label);
      remainingPrizes.push(p.value);
    }
  }
  const sum = remainingPrizes.reduce((s,v)=>s+v,0);
  const ev = remainingPrizes.length ? sum/remainingPrizes.length : 0;

  const made = state.offersDone.size;
  const mult = made === 0 ? 0.62 : 0.82;
  const jitter = 0.92 + Math.random()*0.16;
  return Math.round(ev * mult * jitter);
}

function shouldTriggerOffer(){
  return OFFER_MOMENTS.includes(state.openedCount) && !state.offersDone.has(state.openedCount);
}
function shouldTriggerFirstSwap(){
  return state.openedCount >= SWAP_MOMENT && !state.firstSwapDone;
}
function shouldTriggerFinalSwap(){
  // ultimi 2 pacchi chiusi totali (incluso il tuo)
  const unopened = remainingUnopenedCases().length;
  return unopened === 2 && !state.finalSwapDone && state.status === "playing";
}

function queueMoments(){
  if (state.status !== "playing") return;

  if (shouldTriggerOffer()){
    showOfferModalMandatory();
    return;
  }
  if (shouldTriggerFirstSwap()){
    showSwapModalMandatory(false);
    return;
  }
  if (shouldTriggerOffer()){
    showOfferModalMandatory();
    return;
  }
  if (shouldTriggerFinalSwap()){
    showSwapModalMandatory(true);
    return;
  }
}

// OFFER MODAL
function showOfferModalMandatory(){
  // segna questo momento come fatto (così non si ripete)
  state.offersDone.add(state.openedCount);

  const offer = computeOffer();
  state.lastOffer = offer;

  ui.offerValue.textContent = String(offer);
  ui.offerModalValue.textContent = String(offer);

  // rendi “obbligatorio”: il close non fa nulla
  ui.offerClose.disabled = true;
  ui.offerClose.style.opacity = "0.4";
  ui.offerClose.style.pointerEvents = "none";

  openModal(ui.offerModal);
}

function acceptOffer(){
  const offer = state.lastOffer ?? 0;
  state.status = "ended";

  ui.resultBox.hidden = false;
  ui.resultTitle.textContent = "Hai accettato l’offerta!";
  ui.resultText.textContent = `Hai chiuso la partita con l’offerta del Banco: ${offer}.`;

  closeModal(ui.offerModal);
  renderAll();
}

function rejectOffer(){
  closeModal(ui.offerModal);
  renderAll();
}

// SWAP MODAL
function showSwapModalMandatory(isFinal){
  if (isFinal) state.finalSwapDone = true;
  else state.firstSwapDone = true;

  ui.swapMyCase.textContent = `Il tuo pacco: ${getCaseName(state.myCaseId)}`;
  ui.swapSub.textContent = isFinal
    ? "Ultimo scambio: scegli il pacco con cui scambiare oppure continua senza cambiare."
    : "Momento cambio: scegli il pacco con cui scambiare oppure continua senza cambiare.";

  ui.swapClose.disabled = true;
  ui.swapClose.style.opacity = "0.4";
  ui.swapClose.style.pointerEvents = "none";

  ui.swapGrid.innerHTML = "";
  remainingPlayableCases().forEach(c=>{
    const btn = document.createElement("button");
    btn.className = "caseBtn";
    btn.textContent = c.name;

    btn.addEventListener("click", ()=>{
      doSwapWith(c.id);
    });

    ui.swapGrid.appendChild(btn);
  });

  openModal(ui.swapModal);
}

function doSwapWith(otherId){
  const my = state.cases.find(x=>x.id===state.myCaseId);
  const other = state.cases.find(x=>x.id===otherId);
  if (!my || !other || other.opened) return;

  // scambia i due pacchi (premi assegnati)
  const tmpPrize = my.prize;
  my.prize = other.prize;
  other.prize = tmpPrize;

  closeModal(ui.swapModal);
  renderAll();
}

function skipSwap(){
  closeModal(ui.swapModal);
  renderAll();
}

// =======================
// EVENTS
// =======================
function bindEvents(){
  // ✅ (MODIFICA 2) in screen non agganciamo eventi di gioco
  if (MODE === "game") {
    ui.btnNew.addEventListener("click", newGame);

    ui.pickRandom.addEventListener("click", ()=>{
      const available = state.cases.map(c=>c.id);
      const id = available[Math.floor(Math.random()*available.length)];
      pickMyCase(id);
    });

    ui.pickClose.addEventListener("click", ()=>{
      // il pick è obbligatorio: non chiudere se non scelto
      if (!state.myCaseId) return;
      closeModal(ui.pickModal);
    });

    ui.revealOk.addEventListener("click", ()=>{
      closeModal(ui.revealModal);
      // dopo aver chiuso la rivelazione, controlla i momenti speciali
      queueMoments();
    });
    ui.revealClose.addEventListener("click", ()=>{
      closeModal(ui.revealModal);
      queueMoments();
    });

    ui.offerAccept.addEventListener("click", acceptOffer);
    ui.offerReject.addEventListener("click", rejectOffer);

    ui.swapSkip.addEventListener("click", skipSwap);
  } else {
    // mode=screen: niente click che cambiano stato
    ui.btnNew.disabled = true;
    ui.btnSwap.disabled = true;
  }
}

// =======================
// INIT
// =======================
bindEvents();
newGame();
