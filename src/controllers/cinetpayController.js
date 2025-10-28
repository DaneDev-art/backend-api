// controllers/cinetpayController.js
const CinetPayService = require("../services/CinetPayService");
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");
const PayoutTransaction = require("../models/PayoutTransaction");

// 📊 Frais marketplace + CinetPay
const FEES = { payinCinetPay: 0.035, payoutCinetPay: 0.015, app: 0.02 };
const TOTAL_FEES = FEES.payinCinetPay + FEES.payoutCinetPay + FEES.app;

module.exports = {
  // ------------------- CREATE PAYIN -------------------
  createPayIn: async (req, res) => {
    try {
      const { amount, currency = "XOF", buyerEmail, buyerPhone, description, sellerId, returnUrl, notifyUrl } = req.body;

      if (!sellerId || !amount || !buyerEmail || !buyerPhone)
        return res.status(400).json({ error: "sellerId, amount, buyerEmail et buyerPhone requis" });

      const seller = await Seller.findById(sellerId);
      if (!seller) return res.status(404).json({ error: "Vendeur introuvable" });

      const result = await CinetPayService.createPayIn({
        amount,
        currency,
        email: buyerEmail,
        phone_number: buyerPhone,
        description: description || "Paiement Marketplace",
        sellerId,
        return_url: returnUrl,
        notify_url: notifyUrl,
      });

      // Bloquer solde du seller
      const netAmount = amount - amount * TOTAL_FEES;
      seller.balance_locked = (seller.balance_locked || 0) + netAmount;
      await seller.save();

      res.status(201).json({
        success: true,
        transaction_id: result.transaction_id,
        netAmount,
        payment_url: result.payment_url,
      });
    } catch (err) {
      console.error("❌ createPayIn:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ------------------- VERIFY PAYIN -------------------
  verifyPayIn: async (req, res) => {
    try {
      const { transaction_id } = req.body;
      if (!transaction_id) return res.status(400).json({ error: "transaction_id requis" });

      const result = await CinetPayService.verifyPayIn(transaction_id);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("❌ verifyPayIn:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ------------------- CREATE PAYOUT -------------------
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, currency = "XOF", notifyUrl } = req.body;
      if (!sellerId || !amount) return res.status(400).json({ error: "sellerId et amount requis" });

      const seller = await Seller.findById(sellerId);
      if (!seller) return res.status(404).json({ error: "Vendeur introuvable" });
      if ((seller.balance_available || 0) < amount)
        return res.status(400).json({ error: "Solde insuffisant", balance_available: seller.balance_available });

      const result = await CinetPayService.createPayOutForSeller({ sellerId, amount, currency, notifyUrl });

      res.status(201).json({
        success: true,
        client_transaction_id: result.client_transaction_id,
        netAmount: result.netToSend,
        fees: result.fees,
      });
    } catch (err) {
      console.error("❌ createPayOut:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ------------------- VERIFY PAYOUT -------------------
  verifyPayOut: async (req, res) => {
    try {
      const { transaction_id } = req.body;
      if (!transaction_id) return res.status(400).json({ error: "transaction_id requis" });

      const data = await CinetPayService.verifyPayOut(transaction_id);
      res.json({ success: true, data });
    } catch (err) {
      console.error("❌ verifyPayOut:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ------------------- REGISTER SELLER -------------------
  registerSeller: async (req, res) => {
    try {
      const { name, surname, email, phone, prefix } = req.body;
      if (!name || !email || !phone || !prefix) return res.status(400).json({ error: "Champs requis manquants" });

      const existing = await Seller.findOne({ email });
      if (existing) return res.status(409).json({ error: "Vendeur existe déjà" });

      const seller = await Seller.create({ name, surname, email, phone, prefix });
      res.status(201).json({ success: true, seller });
    } catch (err) {
      console.error("❌ registerSeller:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ------------------- HANDLE WEBHOOK -------------------
  handleWebhook: async (req, res) => {
    try {
      const result = await CinetPayService.handleWebhook(req.body, req.headers);
      res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ webhook error:", err);
      res.status(500).json({ error: "Erreur webhook" });
    }
  },
};
