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

    // valori interni solo per calcolare l’offerta (non mostrati)
    prizeValues: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],

    // ✅ MOMENTI SCELTI DA TE
    offerMoments: [5, 15],       // 1ª e 2ª offerta
    swapMoments: [10],           // 1° cambio
    finalSwapAtTwoLeft: true,    // 2° cambio quando restano 2 pacchi

    // moltiplicatori per 1ª e 2ª offerta (puoi ritoccarli)
    offerMultipliers: [0.62, 0.82],

    maxSwaps: 2
  };

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

  /* ===== MODAL BASE ===== */
  function openModal(modalEl){
    modalEl.hidden = false;
    document.body.classList.add("modal-open");
  }
  function closeModal(modalEl){
    modalEl.hidden = true;
    const anyOpen =
      !ui.pickModal.hidden ||
      !ui.revealModal.hidden ||
      !ui.offerModal.hidden ||
      !ui.swapModal.hidden;
    if(!anyOpen) document.body.classList.remove("modal-open");
  }
  function isAnyModalOpen(){
    return (
      !ui.pickModal.hidden ||
      !ui.revealModal.hidden ||
      !ui.offerModal.hidden ||
      !ui.swapModal.hidden
    );
  }

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

    // bottoni “vecchi” non usati
    ui.btnOffer.disabled = true;
    ui.btnDeal.disabled = true;
    ui.btnNoDeal.disabled = true;

    ui.btnSwap.disabled = true; // swap obbligatorio via modal quando scatta
  }

  function renderAll(){
    renderTop();
    renderPrizes();
    renderCases();
  }

  /* ===== MODAL: PICK (obbligatorio) ===== */
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

  // scelta obbligatoria: non chiudiamo, diamo feedback
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

    // azioni obbligatorie “in coda”
    if(state.nextForced && state.nextForced.length){
      const next = state.nextForced.shift();
      if(next.type === "offer") showOfferModalMandatory(next.offer);
      if(next.type === "swap") showSwapModalMandatory();
    }
  }

  ui.revealOk.addEventListener("click", hideRevealModal);
  ui.revealClose.addEventListener("click", hideRevealModal);
  ui.revealModal.addEventListener("click", (e)=>{ if(e.target===ui.revealModal) hideRevealModal(); });

  /* ===== MODAL: SWAP (obbligatorio) ===== */
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

  /* ===== MODAL: OFFERTA (obbligatorio) ===== */
  function showOfferModalMandatory(offer){
    ui.offerModalValue.textContent = formatPoints(offer);
    ui.offerModalSub.textContent = "Devi scegliere: accetta o rifiuta.";
    openModal(ui.offerModal);
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
    setBankerLine("Scegli il tuo pacco.");
    setHint("Scegli la tua località (il tuo pacco).");

    closeModal(ui.revealModal);
    closeModal(ui.offerModal);
    closeModal(ui.swapModal);
    closeModal(ui.pickModal);

    renderAll();
    showPickModal();
  }

  ui.btnNew.addEventListener("click", newGame);
  ui.btnSwap.addEventListener("click", () => {});

  newGame();
});
