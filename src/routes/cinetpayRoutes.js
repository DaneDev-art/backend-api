// src/routes/cinetpayRoutes.js
const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const CinetpayController = require("../controllers/cinetpayController");
const { verifyToken } = require("../middleware/auth.middleware");

// ============================
// 🧩 MIDDLEWARE
// ============================
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// ============================
// 💳 PAYIN
// ============================

// Création paiement (client connecté)
router.post(
  "/payin/create",
  verifyToken,
  CinetpayController.createPayIn
);

// 🔁 Redirection utilisateur après paiement (PAS un webhook)
router.get(
  "/payin/return",
  CinetpayController.verifyPayIn
);

// ============================
// 💸 PAYOUT
// ============================

// Retrait vendeur
router.post(
  "/payout/create",
  verifyToken,
  CinetpayController.createPayOut
);

// Vérification payout (API / webhook)
router.post(
  "/payout/verify",
  CinetpayController.verifyPayOut
);

// ============================
// 🏪 SELLER → WALLET CINETPAY
// ============================
router.post(
  "/seller/register",
  verifyToken,
  CinetpayController.registerSeller
);

// ============================
// 🔔 WEBHOOK CINETPAY (UNIQUE)
// ============================
// ⚠️ SEUL endpoint appelé par CinetPay
router.post(
  "/webhook",
  CinetpayController.handleWebhook
);

// ============================
// 🧪 TEST
// ============================
router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ Route CinetPay fonctionnelle",
  });
});

module.exports = router;
