// src/routes/wallet.routes.js
const express = require("express");
const router = express.Router();
const WalletController = require("../controllers/wallet.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// ============================
// 💰 WALLET ROUTES
// ============================

// 🔹 Solde wallet
router.get("/balance", verifyToken, WalletController.getBalance);

// 🔹 Historique transactions
router.get("/transactions", verifyToken, WalletController.getTransactions);

// 🔹 Payout vendeur (withdraw)
router.post("/payout", verifyToken, WalletController.payout);

module.exports = router;
