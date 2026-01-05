document.addEventListener("DOMContentLoaded", () => {
  const CONFIG = {
    title: "IL GIOCO DEI PACCHI",
    subtitle: "Scegli una località e prova a portarti a casa il premio migliore!",
    bankerName: "Il Banco",
    currency: "punti",

    // ✅ PIN locale
    accessPin: "4827",

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

  // ✅ Persistenza partita (localStorage)
  const STORAGE_KEY = "paccoGameState_v1";
  const CONFIG_SIGNATURE = JSON.stringify({
    casesCount: CONFIG.casesCount,
    caseNames: CONFIG.caseNames,
    prizeLabels: CONFIG.prizeLabels,
    prizeValues: CONFIG.prizeValues,
    offerMoments: CONFIG.offerMoments,
    swapMoments: CONFIG.swapMoments,
    finalSwapAtTwoLeft: CONFIG.finalSwapAtTwoLeft,
    offerMultipliers: CONFIG.offerMultipliers,
    maxSwaps: CONFIG.maxSwaps,
    currency: CONFIG.currency
  });

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

    // PIN modal
    pinModal: $("pinModal"),
    pinInput: $("pinInput"),
    pinSubmit: $("pinSubmit"),
    pinError: $("pinError"),

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

  /* ===== TV FX ===== */
  function modalCardOf(modalEl){
    if(!modalEl) return null;
    return modalEl.querySelector(".modalCard");
  }

  function animateModalEnter(modalEl){
    const card = modalCardOf(modalEl);
    if(!card) return;
    card.classList.remove("tvEnter");
    // reflow
    void card.offsetWidth;
    card.classList.add("tvEnter");
  }

  function shakeModal(modalEl){
    const card = modalCardOf(modalEl);
    if(!card) return;
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
  }

  function pulseEl(el){
    if(!el) return;
    el.classList.remove("tvPulse");
    void el.offsetWidth;
    el.classList.add("tvPulse");
  }

  /* ===== PERSISTENZA ===== */
  function serializeState(s){
    return {
      __sig: CONFIG_SIGNATURE,
      phase: s.phase,
      myCaseId: s.myCaseId,
      lastOffer: s.lastOffer,

      openedCount: s.openedCount,
      offersMade: s.offersMade,
      swapsLeft: s.swapsLeft,

      offerDone: Array.from(s.offerDone || []),
      swapDone: Array.from(s.swapDone || []),
      finalSwapDone: !!s.finalSwapDone,
      nextForced: Array.isArray(s.nextForced) ? s.nextForced : [],

      allPrizes: s.allPrizes,
      removedPrizeIds: Array.from(s.removedPrizeIds || []),

      access: s.access || { unlocked: false },

      cases: s.cases
    };
  }

  function deserializeState(obj){
    if(!obj || obj.__sig !== CONFIG_SIGNATURE) return null;

    const s = {
      phase: obj.phase || "playing",
      myCaseId: obj.myCaseId || null,
      lastOffer: obj.lastOffer ?? null,

      openedCount: Number(obj.openedCount || 0),
      offersMade: Number(obj.offersMade || 0),
      swapsLeft: Number(obj.swapsLeft ?? CONFIG.maxSwaps),

      offerDone: new Set(obj.offerDone || []),
      swapDone: new Set(obj.swapDone || []),
      finalSwapDone: !!obj.finalSwapDone,
      nextForced: Array.isArray(obj.nextForced) ? obj.nextForced : [],

      allPrizes: Array.isArray(obj.allPrizes) ? obj.allPrizes : [],
      removedPrizeIds: new Set(obj.removedPrizeIds || []),

      access: obj.access || { unlocked: false },

      cases: Array.isArray(obj.cases) ? obj.cases : []
    };

    if(s.cases.length !== CONFIG.casesCount) return null;
    return s;
  }

  function saveGame(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState(state)));
    }catch(e){}
  }

  function loadGame(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      return deserializeState(obj);
    }catch(e){
      return null;
    }
  }

  function clearSavedGame(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  /* ===== MODAL BASE (lock scroll) ===== */
  function openModal(modalEl){
    scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    modalEl.hidden = false;
    document.body.classList.add("modal-open");
    animateModalEnter(modalEl);
  }

  function closeModal(modalEl){
    modalEl.hidden = true;

    const anyOpen =
      !ui.pinModal.hidden ||
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
      !ui.pinModal.hidden ||
      !ui.pickModal.hidden ||
      !ui.revealModal.hidden ||
      !ui.offerModal.hidden ||
      !ui.swapModal.hidden
    );
  }

  /* ===== PIN GATE ===== */
  function showPinError(msg){
    ui.pinError.hidden = !msg;
    ui.pinError.textContent = msg || "";
  }

  function openPinGate(){
    showPinError("");
    ui.pinInput.value = "";
    ui.pinSubmit.disabled = false;
    openModal(ui.pinModal);

    setBankerLine("Inserisci il PIN per giocare.");
    setHint("Inserisci il PIN per iniziare.");
    setTimeout(()=>ui.pinInput && ui.pinInput.focus(), 80);
  }

  function unlockGame(){
    state.access.unlocked = true;
    saveGame();

    closeModal(ui.pinModal);

    setBankerLine("Accesso OK.");
    if(!state.myCaseId){
      setHint("Scegli la tua località (il tuo pacco).");
      renderAll();
      showPickModal();
    }else{
      setHint("Continua la partita.");
      renderAll();
    }
  }

  function handlePinSubmit(){
    const pin = String(ui.pinInput.value || "").trim();

    if(!pin){
      showPinError("Inserisci il PIN.");
      shakeModal(ui.pinModal);
      return;
    }

    ui.pinSubmit.disabled = true;

    if(pin !== CONFIG.accessPin){
      showPinError("PIN errato.");
      shakeModal(ui.pinModal);
      ui.pinSubmit.disabled = false;
      ui.pinInput.focus();
      ui.pinInput.select?.();
      return;
    }

    showPinError("");
    unlockGame();
  }

  ui.pinSubmit.addEventListener("click", handlePinSubmit);
  ui.pinInput.addEventListener("keydown", (e)=>{
    if(e.key === "Enter") handlePinSubmit();
  });

  ui.pinModal.addEventListener("click", (e)=>{
    if(e.target === ui.pinModal){
      showPinError("Accesso obbligatorio: inserisci il PIN.");
      shakeModal(ui.pinModal);
    }
  });

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
    saveGame();

    closeModal(ui.pickModal);
    setBankerLine("Perfetto. Inizia ad aprire le località!");
    setHint("Apri una località.");
    renderAll();
  }

  ui.pickClose.addEventListener("click", () => {
    setHint("Devi scegliere una località per iniziare.");
    shakeModal(ui.pickModal);
  });
  ui.pickModal.addEventListener("click", (e)=>{
    if(e.target===ui.pickModal){
      setHint("Devi scegliere una località per iniziare.");
      shakeModal(ui.pickModal);
    }
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
      saveGame();
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
    saveGame();

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
      shakeModal(ui.swapModal);
    }
  });

  /* ===== MODAL: OFFERTA ===== */
  function showOfferModalMandatory(offer){
    ui.offerModalValue.textContent = formatPoints(offer);
    ui.offerModalSub.textContent = "Devi scegliere: accetta o rifiuta.";
    openModal(ui.offerModal);
    pulseEl(ui.offerModalValue);
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
    saveGame();
    renderAll();
  }

  function rejectOffer(){
    closeModal(ui.offerModal);
    setBankerLine("Offerta rifiutata!");
    setHint("Continua ad aprire le località.");
    saveGame();
    renderAll();
  }

  ui.offerAccept.addEventListener("click", acceptOffer);
  ui.offerReject.addEventListener("click", rejectOffer);
  ui.offerClose.addEventListener("click", () => {
    setHint("Devi scegliere: ACCETTA o RIFIUTA l’offerta.");
    shakeModal(ui.offerModal);
  });
  ui.offerModal.addEventListener("click", (e)=>{ if(e.target===ui.offerModal){ setHint("Devi scegliere: ACCETTA o RIFIUTA l’offerta."); shakeModal(ui.offerModal); } });

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
    saveGame();
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
    saveGame();
  }

  /* ===== CLICK PACCHI ===== */
  function onCaseClick(id){
    if(state.phase === "ended") return;
    if(isAnyModalOpen()) return;

    // blocco finché non sbloccato
    if(!state.access.unlocked){
      openPinGate();
      return;
    }

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
      saveGame();
      renderAll();
      return;
    }

    showRevealModal(
      getCaseName(c.id),
      c.prizeLabel,
      `Pacchi aperti: ${state.openedCount} • Pacchi rimasti: ${remaining}`
    );

    saveGame();
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

      access: { unlocked: false },

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

    setBankerLine("Inserisci il PIN per giocare.");
    setHint("Inserisci il PIN per iniziare.");

    closeModal(ui.revealModal);
    closeModal(ui.offerModal);
    closeModal(ui.swapModal);
    closeModal(ui.pickModal);

    saveGame();
    renderAll();
    openPinGate();
  }

  ui.btnNew.addEventListener("click", () => {
    clearSavedGame();
    newGame();
  });
  ui.btnSwap.addEventListener("click", () => {});

  /* ===== BOOT: prova a riprendere partita ===== */
  function boot(){
    const saved = loadGame();
    if(saved){
      state = saved;

      closeModal(ui.revealModal);
      closeModal(ui.offerModal);
      closeModal(ui.swapModal);
      closeModal(ui.pickModal);

      ui.resultBox.hidden = (state.phase !== "ended");
      if(state.phase === "ended"){
        setBankerLine("Partita finita.");
        setHint("Fine partita.");
      }else{
        setBankerLine("Partita ripresa.");
        setHint("Continua ad aprire le località.");
      }

      renderOffer(state.lastOffer);
      renderAll();

      if(!state.access.unlocked){
        openPinGate();
      }else if(!state.myCaseId && state.phase !== "ended"){
        showPickModal();
      }
      return;
    }

    newGame();
  }

  boot();

  /* ===== PROTEZIONE USCITA PAGINA (popup di sistema) ===== */
  window.addEventListener("beforeunload", (e) => {
    if (!state) return;
    if (state.phase !== "ended") {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });
});
