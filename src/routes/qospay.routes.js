// =============================================
// routes/qospay.routes.js
// QOSPAY ROUTES — TM / TG
// PRODUCTION READY — CORS SAFE
// =============================================

const express = require("express");
const router = express.Router();

const controller = require("../controllers/qospayController");
const { verifyToken } = require("../middleware/auth.middleware");

/* ======================================================
   🟢 PAYIN
====================================================== */

// 🟢 Préflight CORS (Flutter / Web)
router.options("/payin/create", (_, res) => res.sendStatus(204));
router.options("/payin/verify", (_, res) => res.sendStatus(204));

// ➜ Création PayIn (USSD / SIM Toolkit)
router.post(
  "/payin/create",
  verifyToken,               // 🔐 utilisateur authentifié obligatoire
  controller.createPayIn     // ✅ handler valide
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

// 🟢 Préflight CORS
router.options("/payout/create", (_, res) => res.sendStatus(204));

// ➜ Retrait vendeur (Mobile Money)
router.post(
  "/payout/create",
  verifyToken,
  controller.createPayOut
);

/* ======================================================
   🔔 WEBHOOK QOSPAY
   ⚠️ Pas de JWT
   ⚠️ Appelé uniquement par QOSIC
====================================================== */

router.post(
  "/webhook/qospay",
  controller.handleWebhook   // ✅ stub safe
);

module.exports = router;
