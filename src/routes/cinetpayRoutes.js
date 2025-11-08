// =============================================
// routes/cinetpayRoutes.js ✅ Version finale avec verifyToken + bodyParser
// =============================================
const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const CinetpayController = require("../controllers/cinetpayController");
const { verifyToken } = require("../middleware/auth.middleware");
const Seller = require("../models/Seller");

// ============================
// 🧩 Middleware pour accepter webhooks CinetPay (très important)
// ============================
// CinetPay envoie ses callbacks en application/x-www-form-urlencoded
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// ============================
// 📌 PAYIN (Client → Marketplace → Vendeur)
// ============================

// Créer un paiement PayIn (utilisateur connecté obligatoire)
router.post("/payin/create", verifyToken, CinetpayController.createPayIn);

// Vérifier / confirmer un paiement PayIn (webhook CinetPay)
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

// ======================================================
// 📌 GET SELLER BY ID (utilisé par le frontend pour autoSyncCart / seller infos)
// ======================================================
router.get("/seller/:id", verifyToken, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({ message: "Seller introuvable" });
    }

    // 🔒 Sécurité : seul le vendeur connecté ou un admin peut voir ses infos
    if (req.user.role !== "admin" && req.user.id !== seller._id.toString()) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    res.status(200).json({
      success: true,
      seller,
    });
  } catch (err) {
    console.error("❌ Erreur GET /api/cinetpay/seller/:id :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération du vendeur" });
  }
});

module.exports = router;
