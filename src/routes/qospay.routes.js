const express = require("express");
const router = express.Router();
const controller = require("../controllers/qospayController");
const { verifyToken } = require("../middleware/auth.middleware");

// ======================================================
// 🟢 PAYIN
// ======================================================

// Création PayIn (USSD / SIM Toolkit)
router.post(
  "/payin/create",
  verifyToken,              // 🔐 utilisateur obligatoire
  controller.createPayIn
);

// Vérification PayIn (polling Flutter + Postman)
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

// ======================================================
// 🔵 PAYOUT
// ======================================================

// Retrait vendeur
router.post(
  "/payout/create",
  verifyToken,
  controller.createPayOut
);

// ======================================================
// 🔔 WEBHOOK QOSPAY
// ======================================================

// ⚠️ Webhook = PAS de JWT
router.post(
  "/webhook/qospay",
  controller.handleWebhook
);

module.exports = router;
