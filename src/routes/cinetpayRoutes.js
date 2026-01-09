// ============================================
// src/routes/cinetpayRoutes.js
// ============================================

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

// 🟢 Création paiement (frontend)
router.post(
  "/payin/create",
  verifyToken,
  CinetpayController.createPayIn
);

// 🔔 WEBHOOK OFFICIEL CINETPAY (SOURCE DE VÉRITÉ)
// ⚠️ appelé automatiquement par CinetPay
router.post(
  "/payin/verify",
  CinetpayController.verifyPayIn
);

// 🔁 RETOUR UTILISATEUR (NAVIGATEUR)
// ⚠️ ne fait QUE rediriger vers Flutter Web
router.get(
  "/payin/return",
  (req, res) => {
    const query = new URLSearchParams(req.query).toString();
    res.redirect(
      `${process.env.FRONTEND_URL || "https://emarket-web.onrender.com"}?${query}`
    );
  }
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

// Vérification payout (webhook/API)
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
// 🔔 WEBHOOK GLOBAL (OPTIONNEL / LEGACY)
// ============================
// ⚠️ à garder seulement si utilisé ailleurs
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
