// src/routes/me.routes.js

const express = require("express");
const router = express.Router();

// ✅ Middleware d'authentification (fonction seule)
const { verifyToken } = require("../middleware/auth.middleware");

// ✅ Contrôleurs
const payinTransaction = require("../controllers/payinTransaction.controller");
const payoutTransaction = require("../controllers/payoutTransaction.controller");

// ===========================
// 🧾 Routes de l'utilisateur connecté
// ===========================

// 🔹 Transactions d'entrée (PAYIN)
router.get("/me/payin-transactions", verifyToken, payinTransaction.getMyPayinTransactions);

// 🔹 Retraits du vendeur connecté (PAYOUT)
router.get("/me/payout-transactions", verifyToken, payoutTransaction.getMyPayoutTransactions);

module.exports = router;
