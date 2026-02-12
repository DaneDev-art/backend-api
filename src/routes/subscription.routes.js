// ==========================================
// src/routes/subscription.routes.js
// ==========================================
const express = require("express");
const router = express.Router();

const {
  verifyToken,
  verifyRole,
} = require("../middleware/auth.middleware");

const subscriptionController = require("../controllers/subscription.controller");

// ==========================================
// 🔹 Créer paiement abonnement annuel
// ==========================================
router.post(
  "/create",
  verifyToken,
  verifyRole(["seller"]),
  subscriptionController.createSubscriptionPayment
);

// ==========================================
// 🔹 Récupérer statut abonnement vendeur
// (pour Flutter)
// ==========================================
router.get(
  "/status",
  verifyToken,
  verifyRole(["seller"]),
  subscriptionController.getSubscriptionStatus
);

module.exports = router;
