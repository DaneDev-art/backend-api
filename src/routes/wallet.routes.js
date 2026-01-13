// src/routes/wallet.routes.js
const express = require("express");
const router = express.Router();
const WalletController = require("../controllers/wallet.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// ============================
// 💰 WALLET ROUTES
// ============================

router.get("/balance", verifyToken, WalletController.getBalance);
router.get("/transactions", verifyToken, WalletController.getTransactions);

module.exports = router;
