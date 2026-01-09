// src/routes/cinetpayRoutes.js
const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const CinetpayController = require("../controllers/cinetpayController");
const { verifyToken } = require("../middleware/auth.middleware");

// Middleware
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// ============================
// 📌 PAYIN
// ============================

// Création paiement (client connecté)
router.post("/payin/create", verifyToken, CinetpayController.createPayIn);

// Vérification / webhook PayIn (CinetPay ONLY)
router.post("/payin/verify", CinetpayController.verifyPayIn);

// ============================
// 📌 PAYOUT
// ============================

// Retrait vendeur (vendeur connecté)
router.post("/payout/create", verifyToken, CinetpayController.createPayOut);

// Vérification payout (webhook / API)
router.post("/payout/verify", CinetpayController.verifyPayOut);

// ============================
// 📌 SELLER → CinetPay (wallet payout)
// ============================
router.post("/seller/register", verifyToken, CinetpayController.registerSeller);

// ============================
// 📌 WEBHOOK GLOBAL
// ============================
router.post("/webhook", CinetpayController.handleWebhook);

// ============================
// 📌 TEST
// ============================
router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ Route CinetPay fonctionnelle",
  });
});

module.exports = router;
