// src/routes/wallet.routes.js
const express = require("express");
const router = express.Router();

const WalletController = require("../controllers/wallet.controller");
const { verifyToken } = require("../middleware/auth.middleware");

/* ======================================================
   👤 WALLET USER (CLIENT / AFFILIÉ)
====================================================== */

// 🔹 Solde wallet user
router.get(
  "/balance",
  verifyToken,
  WalletController.getBalance
);

// 🔹 Historique transactions wallet user
router.get(
  "/transactions",
  verifyToken,
  WalletController.getTransactions
);

// 🔹 Transfert commissions → solde disponible
router.post(
  "/transfer-commission",
  verifyToken,
  WalletController.transferCommission
);

// 🔹 Retrait USER (commissions, optionnel)
router.post(
  "/payout/user",
  verifyToken,
  WalletController.payout
);

/* ======================================================
   🏪 WALLET VENDEUR (MARKETPLACE)
====================================================== */

// 🔹 Retrait vendeur (fonds issus des ventes)
router.post(
  "/payout/seller",
  verifyToken, // ⚠️ idéalement verifySellerToken plus tard
  WalletController.payoutSeller
);

module.exports = router;
