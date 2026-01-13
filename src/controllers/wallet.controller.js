// src/controllers/wallet.controller.js
const WalletService = require("../services/wallet.service");
const User = require("../models/user.model");

class WalletController {
  // 🔹 GET /api/wallet/balance
  static async getBalance(req, res) {
    try {
      const user = await User.findById(req.user.id).select(
        "balance_available"
      );

      if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      res.json({
        balance: user.balance_available,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  // 🔹 GET /api/wallet/transactions
  static async getTransactions(req, res) {
    try {
      const transactions = await WalletService.getTransactions(req.user.id);
      res.json(transactions);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
}

module.exports = WalletController;
