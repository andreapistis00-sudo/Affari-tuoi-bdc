const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

function json(res, status, payload){
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(payload));
}

function normalizeCode(s){
  return String(s || "").trim().toUpperCase();
}

function isValidCode(code){
  return /^[A-Z0-9]{5}$/.test(code);
}

/* ===== STAFF: createCode (protetta da PIN in functions config) ===== */
exports.createCode = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try{
      if(req.method !== "POST") return json(res, 405, { ok:false, error:"METHOD_NOT_ALLOWED" });

      const pin = String((req.body && req.body.pin) || "").trim();
      const staffPin = (functions.config().staff && functions.config().staff.pin) ? String(functions.config().staff.pin) : "";

      if(!staffPin) return json(res, 500, { ok:false, error:"STAFF_PIN_NOT_CONFIGURED" });
      if(pin !== staffPin) return json(res, 401, { ok:false, error:"WRONG_PIN" });

      // A-Z0-9 senza ambigui (O/0, I/1)
      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      function gen(){
        let out = "";
        for(let i=0;i<5;i++){
          out += alphabet[Math.floor(Math.random()*alphabet.length)];
        }
        return out;
      }

      let code = "";
      let created = false;

      for(let attempt=0; attempt<10; attempt++){
        code = gen();
        const ref = db.collection("accessCodes").doc(code);

        try{
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if(snap.exists) throw new Error("EXISTS");
            tx.set(ref, {
              status: "ready",
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          });
          created = true;
          break;
        }catch(e){
          if(String(e.message) !== "EXISTS") throw e;
        }
      }

      if(!created) return json(res, 500, { ok:false, error:"FAILED_TO_GENERATE" });

      return json(res, 200, { ok:true, code });
    }catch(err){
      console.error(err);
      return json(res, 500, { ok:false, error:"SERVER_ERROR" });
    }
  });
});

/* ===== CLIENT: redeemCode (ready -> in_game) ===== */
exports.redeemCode = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try{
      if(req.method !== "POST") return json(res, 405, { ok:false, error:"METHOD_NOT_ALLOWED" });

      const code = normalizeCode(req.body && req.body.code);
      if(!isValidCode(code)) return json(res, 400, { ok:false, error:"INVALID_CODE" });

      const ref = db.collection("accessCodes").doc(code);

      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if(!snap.exists) return { ok:false, error:"NOT_FOUND" };

        const data = snap.data() || {};
        if(data.status === "used") return { ok:false, error:"ALREADY_USED" };
        if(data.status === "in_game") return { ok:false, error:"IN_GAME" };
        if(data.status !== "ready") return { ok:false, error:"INVALID_STATUS" };

        const sessionId = db.collection("_").doc().id; // random id
        tx.update(ref, {
          status: "in_game",
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          sessionId
        });

        return { ok:true, sessionId };
      });

      return json(res, 200, result);
    }catch(err){
      console.error(err);
      return json(res, 500, { ok:false, error:"SERVER_ERROR" });
    }
  });
});

/* ===== CLIENT: finishGame (in_game -> used) ===== */
exports.finishGame = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try{
      if(req.method !== "POST") return json(res, 405, { ok:false, error:"METHOD_NOT_ALLOWED" });

      const code = normalizeCode(req.body && req.body.code);
      const sessionId = String((req.body && req.body.sessionId) || "").trim();
      const outcome = String((req.body && req.body.outcome) || "").trim();

      if(!isValidCode(code)) return json(res, 400, { ok:false, error:"INVALID_CODE" });
      if(!sessionId) return json(res, 400, { ok:false, error:"MISSING_SESSION" });

      const ref = db.collection("accessCodes").doc(code);

      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if(!snap.exists) return { ok:false, error:"NOT_FOUND" };

        const data = snap.data() || {};
        if(data.status === "used") return { ok:true }; // idempotente
        if(data.status !== "in_game") return { ok:false, error:"NOT_IN_GAME" };
        if(data.sessionId !== sessionId) return { ok:false, error:"SESSION_MISMATCH" };

        tx.update(ref, {
          status: "used",
          endedAt: admin.firestore.FieldValue.serverTimestamp(),
          outcome: outcome || "ended"
        });

        return { ok:true };
      });

      return json(res, 200, result);
    }catch(err){
      console.error(err);
      return json(res, 500, { ok:false, error:"SERVER_ERROR" });
    }
  });
});
