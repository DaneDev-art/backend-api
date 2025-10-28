// =============================================
// routes/cinetpayRoutes.js ✅ Version finale
// =============================================
const express = require("express");
const router = express.Router();
const CinetpayController = require("../controllers/cinetpayController");

// ============================
// 📌 PAYIN (Client → Marketplace → Vendeur)
// ============================

// Créer un paiement PayIn
router.post("/payin/create", CinetpayController.createPayIn);

// Vérifier / confirmer un paiement PayIn
router.post("/payin/verify", CinetpayController.verifyPayIn);

// ============================
// 📌 PAYOUT (Vendeur → Banque / Mobile Money)
// ============================

// Créer un payout pour un vendeur
router.post("/payout/create", CinetpayController.createPayOut);

// Vérifier le statut d’un payout
router.post("/payout/verify", CinetpayController.verifyPayOut);

// ============================
// 📌 SELLER (Enregistrement dans CinetPay pour payout)
// ============================

// Enregistrer un vendeur dans CinetPay (Wallet payout)
router.post("/seller/register", CinetpayController.registerSeller);

// ============================
// 📌 WEBHOOK (Callback automatique de CinetPay)
// ============================

// Un seul webhook pour PayIn et PayOut — CinetPay distingue par le type d’opération
router.post("/webhook", CinetpayController.handleWebhook);

// ============================
// 📌 Test route
// ============================
router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ Route CinetPay fonctionnelle !",
  });
});

module.exports = router;
