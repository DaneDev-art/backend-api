// =============================================
// routes/qospay.routes.js
// QOSPAY ROUTES — TM / TG / CARD
// PRODUCTION READY
// =============================================

const express = require("express");
const router = express.Router();

const controller = require("../controllers/qospayController");
const { verifyToken } = require("../middleware/auth.middleware");

/* ======================================================
   🟢 PAYIN
====================================================== */

// ➜ Création PayIn (USSD / SIM Toolkit)
router.post(
  "/payin/create",
  verifyToken,               // 🔐 utilisateur authentifié obligatoire
  controller.createPayIn     // ✅ fonction valide
);

// ➜ Vérification PayIn (polling Flutter / Postman)
router.post(
  "/payin/verify",
  verifyToken,
  controller.verifyPayIn
);

router.get(
  "/payin/verify",
  verifyToken,
  controller.verifyPayIn
);

/* ======================================================
   🔵 PAYOUT (SELLER)
====================================================== */

// ➜ Retrait vendeur (Mobile Money)
router.post(
  "/payout/create",
  verifyToken,
  controller.createPayOut
);

/* ======================================================
   🔔 WEBHOOK QOSPAY (OPTIONNEL)
   ⚠️ QOSIC n’envoie pas toujours de webhook fiable
   ⚠️ Pas de JWT ici
====================================================== */

router.post(
  "/webhook/qospay",
  controller.handleWebhook   // ✅ toujours défini (stub safe)
);

module.exports = router;
