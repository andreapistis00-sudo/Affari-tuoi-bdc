document.addEventListener("DOMContentLoaded", () => {
  const CONFIG = {
    title: "IL GIOCO DEI PACCHI",
    subtitle: "Scegli una località e prova a portarti a casa il premio migliore!",
    bankerName: "Il Banco",
    currency: "punti",

    casesCount: 20,

    caseNames: [
      "Girilonga","Coroddis","Su tauli","Corosa","Gennaguara",
      "Maricoxina","Niu Susu","Funtanedda De basciu","Barigau","Niu Sciossu",
      "Su fossu e Bobboi","S'arcu e susu","Mattemola","Pissu e cuccu","Tucci",
      "Costa e coccu","Santa Luscia","Mesu idda","Sa Cranniga","Bosco selene"
    ],

    prizeLabels: [
      "Premio 1","Premio 2","Premio 3","Premio 4","Premio 5",
      "Premio 6","Premio 7","Premio 8","Premio 9","Premio 10",
      "Premio 11","Premio 12","Premio 13","Premio 14","Premio 15",
      "Premio 16","Premio 17","Premio 18","Premio 19","Premio 20"
    ],

    // valori interni per offerta (non mostrati)
    prizeValues: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],

    offerMoments: [5, 15],
    swapMoments: [10],
    finalSwapAtTwoLeft: true,
    offerMultipliers: [0.62, 0.82],
    maxSwaps: 2
  };

  /* ===== Firebase init (obbligatorio: incolla la tua config reale) ===== */
  const firebaseConfig = {
    // INCOLLA QUI (Firebase Console -> Project settings -> Your apps -> Web app)
    // apiKey: "...",
    // authDomain: "...",
    // projectId: "...",
    // storageBucket: "...",
    // messagingSenderId: "...",
    // appId: "..."
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  /* ===== Cloud Functions URL (OBBLIGATORIO) ===== */
  const PROJECT_ID = "IL_TUO_PROJECT_ID";
  const REGION = "us-central1";
  const FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
  const URL_CREATE = `${FUNCTIONS_BASE}/createCode`;
  const URL_REDEEM = `${FUNCTIONS_BASE}/redeemCode`;
  const URL_FINISH = `${FUNCTIONS_BASE}/finishGame`;

  let state = null;
  let scrollY = 0;

  const $ = (id) => document.getElementById(id);

  const ui = {
    title: $("gameTitle"),
    subtitle: $("subtitle"),
    bankerName: $("bankerName"),
    bankerLine: $("bankerLine"),

    prizeGrid: $("prizeGrid"),
    caseGrid: $("caseGrid"),

    openedLabel: $("openedLabel"),
    myCaseLabel: $("myCaseLabel"),
    hintText: $("hintText"),

    btnNew: $("btnNew"),
    btnSwap: $("btnSwap"),
    btnOffer: $("btnOffer"),
    btnDeal: $("btnDeal"),
    btnNoDeal: $("btnNoDeal"),

    offerValue: $("offerValue"),
    casesLeft: $("casesLeft"),

    resultBox: $("resultBox"),
    resultTitle: $("resultTitle"),
    resultText: $("resultText"),

    // access
    accessModal: $("accessModal"),
    accessClose: $("accessClose"),
    accessCodeInput: $("accessCodeInput"),
    accessSubmit: $("accessSubmit"),
    accessError: $("accessError"),

    // staff
    btnStaff: $("btnStaff"),
    staffModal: $("staffModal"),
    staffClose: $("staffClose"),
    staffPin: $("staffPin"),
    staffGenerate: $("staffGenerate"),
    staffError: $("staffError"),
    staffCodeBox: $("staffCodeBox"),
    staffCode: $("staffCode"),
    staffCopy: $("staffCopy"),

    // pick
    pickModal: $("pickModal"),
    pickGrid: $("pickGrid"),
    pickClose: $("pickClose"),
    pickRandom: $("pickRandom"),

    // reveal
    revealModal: $("revealModal"),
    revealPlace: $("revealPlace"),
    revealPrize: $("revealPrize"),
    revealSub: $("revealSub"),
    revealOk: $("revealOk"),
    revealClose: $("revealClose"),

    // offer modal
    offerModal: $("offerModal"),
    offerModalValue: $("offerModalValue"),
    offerModalSub: $("offerModalSub"),
    offerAccept: $("offerAccept"),
    offerReject: $("offerReject"),
    offerClose: $("offerClose"),

    // swap
    swapModal: $("swapModal"),
    swapGrid: $("swapGrid"),
    swapMyCase: $("swapMyCase"),
    swapSub: $("swapSub"),
    swapSkip: $("swapSkip"),
    swapClose: $("swapClose")
  };

  /* ===== UTIL ===== */
  function shuffle(arr){
    const a = [...arr];
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getCaseName(id){ return CONFIG.caseNames[id-1] || `Località ${id}`; }

  function formatPoints(v){
    if (v == null) return "—";
    return `${Math.round(v).toLocaleString("it-IT")} ${CONFIG.currency}`;
  }

  function remainingCases(){ return state.cases.filter(c => !c.opened); }
  function remainingCaseIds(){ return remainingCases().map(c => c.id); }

  function computeEV(){
    const vals = remainingCases().map(c => c.prizeValue);
    const sum = vals.reduce((s,v)=>s+v,0);
    return vals.length ? sum/vals.length : 0;
  }

  function setHint(t){ ui.hintText.textContent=t; }
  function setBankerLine(t){ ui.bankerLine.textContent=t; }
  function renderOffer(v){ ui.offerValue.textContent=formatPoints(v); }

  /* ===== MODAL BASE (lock scroll) ===== */
  function openModal(modalEl){
    scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    modalEl.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal(modalEl){
    modalEl.hidden = true;

    const anyOpen =
      !ui.accessModal.hidden ||
      !ui.staffModal.hidden ||
      !ui.pickModal.hidden ||
      !ui.revealModal.hidden ||
      !ui.offerModal.hidden ||
      !ui.swapModal.hidden;

    if(!anyOpen){
      document.body.classList.remove("modal-open");

      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";

      window.scrollTo(0, scrollY);
    }
  }

  function isAnyModalOpen(){
    return (
      !ui.accessModal.hidden ||
      !ui.staffModal.hidden ||
      !ui.pickModal.hidden ||
      !ui.revealModal.hidden ||
      !ui.offerModal.hidden ||
      !ui.swapModal.hidden
    );
  }

  /* ===== ACCESS GATE ===== */
  function showAccessError(msg){
    ui.accessError.hidden = !msg;
    ui.accessError.textContent = msg || "";
  }

  function openAccessGate(){
    showAccessError("");
    ui.accessCodeInput.value = "";
    openModal(ui.accessModal);
    setHint("Inserisci un codice per giocare.");
  }

  async function handleAccessSubmit(){
    const code = (ui.accessCodeInput.value || "").trim().toUpperCase();

    if(!code){
      showAccessError("Inserisci un codice.");
      return;
    }
    if(!/^[A-Z0-9]{5}$/.test(code)){
      showAccessError("Il codice deve essere di 5 caratteri (A-Z, 0-9).");
      return;
    }

    showAccessError("");
    ui.accessSubmit.disabled = true;

    try{
      const r = await fetch(URL_REDEEM, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      const data = await r.json().catch(()=>null);

      if(!data || !data.ok){
        const err = data && data.error ? data.error : "SERVER_ERROR";
        const msg =
          err === "NOT_FOUND" ? "Codice non trovato." :
          err === "ALREADY_USED" ? "Codice già usato." :
          err === "IN_GAME" ? "Questo codice è già in uso." :
          err === "INVALID_CODE" ? "Codice non valido." :
          "Errore. Riprova o chiama lo staff.";
        showAccessError(msg);
        return;
      }

      // OK: sbloccato dal server
      state.access.code = code;
      state.access.sessionId = data.sessionId;

      closeModal(ui.accessModal);
      setBankerLine("Accesso OK. Scegli il tuo pacco.");
      setHint("Scegli la tua località (il tuo pacco).");

      renderAll();
      showPickModal();
    }catch(e){
      showAccessError("Connessione non disponibile. Riprova.");
    }finally{
      ui.accessSubmit.disabled = false;
    }
  }

  ui.accessSubmit.addEventListener("click", handleAccessSubmit);
  ui.accessCodeInput.addEventListener("keydown", (e)=>{
    if(e.key === "Enter") handleAccessSubmit();
  });

  ui.accessClose.addEventListener("click", () => {
    showAccessError("Devi inserire un codice valido per giocare.");
  });
  ui.accessModal.addEventListener("click", (e)=>{
    if(e.target === ui.accessModal) showAccessError("Devi inserire un codice valido per giocare.");
  });

  /* ===== STAFF PANEL ===== */
  function showStaffError(msg){
    ui.staffError.hidden = !msg;
    ui.staffError.textContent = msg || "";
  }

  function openStaff(){
    showStaffError("");
    ui.staffPin.value = "";
    ui.staffCodeBox.hidden = true;
    ui.staffCode.textContent = "—";
    openModal(ui.staffModal);
  }

  async function handleGenerateCode(){
    const pin = String(ui.staffPin.value || "").trim();
    if(!pin){
      showStaffError("Inserisci il PIN staff.");
      return;
    }

    showStaffError("");
    ui.staffGenerate.disabled = true;

    try{
      const r = await fetch(URL_CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });

      const data = await r.json().catch(()=>null);

      if(!data || !data.ok){
        const err = data && data.error ? data.error : "SERVER_ERROR";
        const msg =
          err === "WRONG_PIN" ? "PIN errato." :
          err === "STAFF_PIN_NOT_CONFIGURED" ? "PIN non configurato nelle Functions." :
          "Errore. Riprova.";
        showStaffError(msg);
        return;
      }

      ui.staffCode.textContent = data.code;
      ui.staffCodeBox.hidden = false;
      showStaffError("");
    }catch(e){
      showStaffError("Connessione non disponibile. Riprova.");
    }finally{
      ui.staffGenerate.disabled = false;
    }
  }

  ui.btnStaff.addEventListener("click", openStaff);
  ui.staffGenerate.addEventListener("click", handleGenerateCode);
  ui.staffPin.addEventListener("keydown", (e)=>{ if(e.key === "Enter") handleGenerateCode(); });

  ui.staffCopy.addEventListener("click", async ()=>{
    const code = String(ui.staffCode.textContent || "").trim();
    if(!code || code === "—") return;
    try{
      await navigator.clipboard.writeText(code);
      showStaffError("Copiato negli appunti ✅");
      setTimeout(()=>showStaffError(""), 1200);
    }catch(e){
      showStaffError("Non riesco a copiare: seleziona e copia manualmente.");
    }
  });

  ui.staffClose.addEventListener("click", () => closeModal(ui.staffModal));
  ui.staffModal.addEventListener("click", (e)=>{ if(e.target === ui.staffModal) closeModal(ui.staffModal); });

  /* ===== RENDER ===== */
  function prizeTierByValue(v){
    const sorted=[...CONFIG.prizeValues].sort((a,b)=>a-b);
    const p33=sorted[Math.floor(sorted.length*0.33)];
    const p66=sorted[Math.floor(sorted.length*0.66)];
    if(v<=p33) return "low";
    if(v>=p66) return "high";
    return "mid";
  }

  function renderPrizes(){
    ui.prizeGrid.innerHTML="";
    state.allPrizes.forEach(p=>{
      const item=document.createElement("div");
      const isOut=state.removedPrizeIds.has(p.id);
      item.className=`prizeItem ${isOut ? "out":""}`;

      const left=document.createElement("div");
      left.textContent=p.label;

      const tag=document.createElement("div");
      const tier=prizeTierByValue(p.value);
      tag.className=`tag ${tier}`;
      tag.textContent=tier.toUpperCase();

      item.appendChild(left);
      item.appendChild(tag);
      ui.prizeGrid.appendChild(item);
    });
  }

  function renderCases(){
    ui.caseGrid.innerHTML="";
    state.cases.forEach(c=>{
      const btn=document.createElement("button");
      btn.className="caseBtn";
      if(c.id===state.myCaseId) btn.classList.add("mine");
      if(c.opened) btn.classList.add("opened");

      btn.innerHTML = `
        <div class="num">${getCaseName(c.id)}</div>
        <span class="small">${c.opened ? "—" : "clicca"}</span>
      `;

      btn.addEventListener("click", ()=>onCaseClick(c.id));
      ui.caseGrid.appendChild(btn);
    });
  }

  function renderTop(){
    ui.title.textContent=CONFIG.title;
    ui.subtitle.textContent=CONFIG.subtitle;
    ui.bankerName.textContent=CONFIG.bankerName;

    ui.openedLabel.textContent = String(state.openedCount);
    ui.myCaseLabel.textContent = state.myCaseId ? getCaseName(state.myCaseId) : "—";
    ui.casesLeft.textContent = String(remainingCaseIds().length);

    ui.btnOffer.disabled = true;
    ui.btnDeal.disabled = true;
    ui.btnNoDeal.disabled = true;

    ui.btnSwap.disabled = true;
  }

  function renderAll(){
    renderTop();
    renderPrizes();
    renderCases();
  }

  /* ===== MODAL: PICK ===== */
  function showPickModal(){
    ui.pickGrid.innerHTML = "";
    state.cases.slice().sort((a,b)=>a.id-b.id).forEach(c=>{
      const b = document.createElement("button");
      b.className = "swapBtn";
      b.innerHTML = `<strong>${getCaseName(c.id)}</strong><span>scegli come tuo pacco</span>`;
      b.addEventListener("click", () => pickMyCase(c.id));
      ui.pickGrid.appendChild(b);
    });
    openModal(ui.pickModal);
  }

  function pickMyCase(id){
    state.myCaseId = id;
    closeModal(ui.pickModal);
    setBankerLine("Perfetto. Inizia ad aprire le località!");
    setHint("Apri una località.");
    renderAll();
  }

  ui.pickClose.addEventListener("click", () => {
    setHint("Devi scegliere una località per iniziare.");
  });
  ui.pickModal.addEventListener("click", (e)=>{
    if(e.target===ui.pickModal) setHint("Devi scegliere una località per iniziare.");
  });
  ui.pickRandom.addEventListener("click", ()=>{
    const ids = state.cases.map(c=>c.id);
    pickMyCase(ids[Math.floor(Math.random()*ids.length)]);
  });

  /* ===== MODAL: REVEAL ===== */
  function showRevealModal(placeName, prizeLabel, subText){
    ui.revealPlace.textContent = placeName;
    ui.revealPrize.textContent = prizeLabel;
    ui.revealSub.textContent = subText || "Continua a giocare.";
    openModal(ui.revealModal);
  }

  function hideRevealModal(){
    closeModal(ui.revealModal);

    if(state.nextForced && state.nextForced.length){
      const next = state.nextForced.shift();
      if(next.type === "offer") showOfferModalMandatory(next.offer);
      if(next.type === "swap") showSwapModalMandatory();
    }
  }

  ui.revealOk.addEventListener("click", hideRevealModal);
  ui.revealClose.addEventListener("click", hideRevealModal);
  ui.revealModal.addEventListener("click", (e)=>{ if(e.target===ui.revealModal) hideRevealModal(); });

  /* ===== MODAL: SWAP ===== */
  function showSwapModalMandatory(){
    if(state.swapsLeft <= 0) return;

    ui.swapGrid.innerHTML = "";
    ui.swapMyCase.textContent = `Il tuo pacco: ${getCaseName(state.myCaseId)} (cambi rimasti: ${state.swapsLeft})`;

    const choices = state.cases
      .filter(c => !c.opened && c.id !== state.myCaseId)
      .sort((a,b)=>a.id-b.id);

    choices.forEach(c=>{
      const btn = document.createElement("button");
      btn.className = "swapBtn";
      btn.innerHTML = `<strong>${getCaseName(c.id)}</strong><span>clicca per scambiare</span>`;
      btn.addEventListener("click", () => doSwap(c.id));
      ui.swapGrid.appendChild(btn);
    });

    openModal(ui.swapModal);
  }

  function doSwap(newId){
    const oldId = state.myCaseId;
    state.myCaseId = newId;
    state.swapsLeft -= 1;

    closeModal(ui.swapModal);
    setBankerLine("Cambio pacco effettuato!");
    setHint(`Scambio: ${getCaseName(oldId)} → ${getCaseName(newId)}. Ora continua ad aprire.`);
    renderAll();
  }

  function skipSwap(){
    closeModal(ui.swapModal);
    setBankerLine("Nessun cambio.");
    setHint("Continua ad aprire le località.");
    renderAll();
  }

  ui.swapSkip.addEventListener("click", skipSwap);
  ui.swapClose.addEventListener("click", skipSwap);
  ui.swapModal.addEventListener("click", (e) => {
    if (e.target === ui.swapModal) {
      ui.swapSub.textContent = "Devi scegliere un pacco oppure premere 'Continua senza cambiare'.";
    }
  });

  /* ===== MODAL: OFFERTA ===== */
  function showOfferModalMandatory(offer){
    ui.offerModalValue.textContent = formatPoints(offer);
    ui.offerModalSub.textContent = "Devi scegliere: accetta o rifiuta.";
    openModal(ui.offerModal);
  }

  function finishServer(outcome){
    if(state.access && state.access.code && state.access.sessionId){
      fetch(URL_FINISH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: state.access.code,
          sessionId: state.access.sessionId,
          outcome: outcome || "ended"
        })
      }).catch(()=>{});
    }
  }

  function acceptOffer(){
    closeModal(ui.offerModal);

    const my = state.cases.find(c=>c.id===state.myCaseId);
    setBankerLine("Offerta accettata!");
    setHint("Partita finita.");

    ui.resultBox.hidden = false;
    ui.resultTitle.textContent = "OFFERTA ACCETTATA!";
    ui.resultText.innerHTML =
      `Hai accettato: ${formatPoints(state.lastOffer)}.<br>` +
      `Nel tuo pacco (${getCaseName(state.myCaseId)}) c’era: ${my.prizeLabel}.`;

    state.phase = "ended";
    renderAll();

    finishServer("offer_accepted");
  }

  function rejectOffer(){
    closeModal(ui.offerModal);
    setBankerLine("Offerta rifiutata!");
    setHint("Continua ad aprire le località.");
    renderAll();
  }

  ui.offerAccept.addEventListener("click", acceptOffer);
  ui.offerReject.addEventListener("click", rejectOffer);
  ui.offerClose.addEventListener("click", () => setHint("Devi scegliere: ACCETTA o RIFIUTA l’offerta."));
  ui.offerModal.addEventListener("click", (e)=>{ if(e.target===ui.offerModal) setHint("Devi scegliere: ACCETTA o RIFIUTA l’offerta."); });

  document.addEventListener("keydown", (e)=>{
    if(e.key !== "Escape") return;
    if(!ui.revealModal.hidden) hideRevealModal();
  });

  /* ===== LOGICA: OFFERTA ===== */
  function computeOffer(){
    const ev = computeEV();
    const idx = Math.min(state.offersMade, CONFIG.offerMultipliers.length - 1);
    const mult = CONFIG.offerMultipliers[idx];
    const jitter = 0.92 + Math.random()*0.16;
    return Math.round(ev * mult * jitter);
  }

  function queueOffer(){
    const offer = computeOffer();
    state.lastOffer = offer;
    state.offersMade += 1;
    state.offerDone.add(state.openedCount);

    if(!state.nextForced) state.nextForced = [];
    if(!ui.revealModal.hidden){
      state.nextForced.push({ type: "offer", offer });
    } else {
      showOfferModalMandatory(offer);
    }

    renderOffer(offer);
    setBankerLine("Il Banco ha fatto un’offerta!");
  }

  function queueSwap(kindKey){
    if(state.swapsLeft <= 0) return;

    if(kindKey === "opened10") state.swapDone.add(10);
    if(kindKey === "final2") state.finalSwapDone = true;

    if(!state.nextForced) state.nextForced = [];
    if(!ui.revealModal.hidden){
      state.nextForced.push({ type: "swap" });
    } else {
      showSwapModalMandatory();
    }

    setBankerLine("Momento CAMBIO PACCO!");
  }

  /* ===== CLICK PACCHI ===== */
  function onCaseClick(id){
    if(state.phase === "ended") return;
    if(isAnyModalOpen()) return;

    const c = state.cases.find(x=>x.id===id);
    if(!c || c.opened) return;

    if(!state.myCaseId){
      pickMyCase(id);
      return;
    }

    if(id === state.myCaseId){
      setHint("Questa è la tua località. Apri un’altra località.");
      return;
    }

    c.opened = true;
    state.removedPrizeIds.add(c.prizeId);
    state.openedCount += 1;

    const remaining = remainingCaseIds().length;

    // fine naturale quando resta solo il tuo pacco
    if(remaining === 1){
      const my = state.cases.find(x=>x.id===state.myCaseId);

      setBankerLine("Partita finita!");
      setHint("Fine partita.");

      ui.resultBox.hidden = false;
      ui.resultTitle.textContent = "PARTITA FINITA!";
      ui.resultText.innerHTML =
        `Nel tuo pacco (${getCaseName(state.myCaseId)}) c’era: ${my.prizeLabel}.`;

      state.phase = "ended";
      renderAll();
      finishServer("completed");
      return;
    }

    showRevealModal(
      getCaseName(c.id),
      c.prizeLabel,
      `Pacchi aperti: ${state.openedCount} • Pacchi rimasti: ${remaining}`
    );

    renderAll();

    if (CONFIG.offerMoments.includes(state.openedCount) && !state.offerDone.has(state.openedCount)) {
      queueOffer();
      return;
    }

    if (CONFIG.swapMoments.includes(state.openedCount) && !state.swapDone.has(state.openedCount)) {
      queueSwap("opened10");
      return;
    }

    if (CONFIG.finalSwapAtTwoLeft && remaining === 2 && !state.finalSwapDone) {
      queueSwap("final2");
      return;
    }
  }

  /* ===== AVVIO / NUOVA PARTITA ===== */
  function newGame(){
    const ok =
      CONFIG.casesCount === CONFIG.caseNames.length &&
      CONFIG.casesCount === CONFIG.prizeLabels.length &&
      CONFIG.casesCount === CONFIG.prizeValues.length;

    if(!ok){
      alert("Errore CONFIG: casesCount deve essere uguale a caseNames, prizeLabels e prizeValues.");
      return;
    }

    const allPrizes = CONFIG.prizeLabels.map((label,i)=>({
      id:i+1,
      label,
      value:CONFIG.prizeValues[i]
    }));

    const shuffled = shuffle([...allPrizes]);

    state = {
      phase: "playing",
      myCaseId: null,
      lastOffer: null,

      openedCount: 0,
      offersMade: 0,
      swapsLeft: CONFIG.maxSwaps,

      offerDone: new Set(),
      swapDone: new Set(),
      finalSwapDone: false,
      nextForced: [],

      allPrizes,
      removedPrizeIds: new Set(),

      access: { code: null, sessionId: null },

      cases: Array.from({length:CONFIG.casesCount}, (_,i)=>({
        id:i+1,
        prizeId: shuffled[i].id,
        prizeLabel: shuffled[i].label,
        prizeValue: shuffled[i].value,
        opened:false
      }))
    };

    ui.resultBox.hidden = true;
    renderOffer(null);
    setBankerLine("Accesso richiesto.");
    setHint("Inserisci il codice per giocare.");

    closeModal(ui.revealModal);
    closeModal(ui.offerModal);
    closeModal(ui.swapModal);
    closeModal(ui.pickModal);

    renderAll();
    openAccessGate();
  }

  ui.btnNew.addEventListener("click", newGame);
  ui.btnSwap.addEventListener("click", () => {});

  newGame();
});
