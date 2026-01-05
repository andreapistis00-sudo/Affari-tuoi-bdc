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
      .filter(c => !c.opened && c.id !== state.my
