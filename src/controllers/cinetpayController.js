// =============================================
// controllers/cinetpayController.js
// PAYIN SAFE — ESCROW VERSION
// =============================================

const mongoose = require("mongoose");
const CinetPayService = require("../services/CinetPayService");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Order = require("../models/order.model");

const BASE_URL =
  process.env.BASE_URL || "https://backend-api-m0tf.onrender.com";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://emarket-web.onrender.com";

const SUPPORTED_OPERATORS_TG = ["TMONEY", "MOOVMONEY", "WAVE"];

module.exports = {
  /* ======================================================
     🟢 CREATE PAYIN (CLIENT)
     — Maintenant entièrement sécurisé via CinetPayService
  ====================================================== */
  createPayIn: async (req, res) => {
    try {
      const {
        productPrice,
        amount,
        shippingFee = 0,
        currency = "XOF",
        description,
        sellerId,
        returnUrl,
        notifyUrl,
        items,
        buyerAddress,
      } = req.body;

      const clientId = req.user?.id || req.user?._id;
      if (!clientId)
        return res.status(401).json({ error: "Utilisateur non authentifié" });

      if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId))
        return res.status(400).json({ error: "sellerId invalide" });

      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "Panier vide" });

      // Montant résolu
      const resolvedAmount = productPrice !== undefined ? productPrice : amount;
      if (!resolvedAmount || Number(resolvedAmount) <= 0)
        return res.status(400).json({ error: "Montant invalide" });

      // 🔹 Appel sécurisé du service PAYIN
      const result = await CinetPayService.createPayIn({
        sellerId,
        clientId,
        items,
        productPrice: Number(resolvedAmount),
        shippingFee: Number(shippingFee) || 0,
        currency,
        buyerEmail: req.user?.email || null,
        buyerPhone: req.user?.phone || null,
        buyerAddress: buyerAddress || null,
        description,
        returnUrl,
        notifyUrl,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ createPayIn:", err.message, err);
      return res.status(500).json({
        error: err.message,
        hint: "Vérifier payload côté frontend et connexion CinetPay",
      });
    }
  },

  /* ======================================================
     🔔 VERIFY PAYIN — WEBHOOK ONLY (SERVER ↔ SERVER)
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const payload = req.body;
      const result = await CinetPayService.handleWebhook(payload, req.headers);

      return res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ verifyPayIn webhook:", err.message);
      return res.status(200).json({ success: false, error: err.message });
    }
  },

  /* ======================================================
     🔁 PAYIN RETURN — REDIRECT FRONTEND ONLY
  ====================================================== */
  payinReturn: (req, res) => {
    const { transaction_id, status } = req.query;
    return res.redirect(
      `${FRONTEND_URL}/payin/result?transaction_id=${transaction_id || ""}&status=${status || "PENDING"}`
    );
  },

  /* ======================================================
     💸 CREATE PAYOUT — SELLER WITHDRAW
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, currency = "XOF" } = req.body;
      const realSellerId = req.user?.sellerId || sellerId;

      if (!realSellerId || !mongoose.Types.ObjectId.isValid(realSellerId) || isNaN(amount)) {
        return res.status(400).json({ error: "sellerId valide et amount requis" });
      }

      const seller = await Seller.findById(realSellerId);
      if (!seller) return res.status(404).json({ error: "Vendeur introuvable" });

      if (Number(amount) > Number(seller.balance_available || 0)) {
        return res.status(409).json({ error: "Solde insuffisant", balance: seller.balance_available });
      }

      if (seller.operator && !SUPPORTED_OPERATORS_TG.includes(seller.operator.toUpperCase())) {
        return res.status(422).json({
          error: "Opérateur payout non supporté",
          operator: seller.operator,
          supported: SUPPORTED_OPERATORS_TG,
        });
      }

      const result = await CinetPayService.createPayOutForSeller({
        sellerId: seller._id,
        amount: Number(amount),
        currency,
        notifyUrl: `${BASE_URL}/api/cinetpay/payout/verify`,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ createPayOut:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🟡 VERIFY PAYOUT — WEBHOOK / API
  ====================================================== */
  verifyPayOut: async (req, res) => {
    try {
      const payoutId = req.body?.payout_id || req.query?.payout_id;
      if (!payoutId) return res.status(400).json({ error: "payout_id requis" });

      const result = await CinetPayService.verifyPayOut(payoutId);

      if (result?.status === "SUCCESS" && result.sellerId && !isNaN(result.amount)) {
        await Seller.updateOne(
          { _id: result.sellerId },
          { $inc: { balance_locked: -Number(result.amount) } }
        );
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error("❌ verifyPayOut:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🧩 REGISTER SELLER
  ====================================================== */
  registerSeller: async (req, res) => {
    try {
      const { name, surname, email, phone, prefix } = req.body;
      if (!name || !email || !phone || !prefix) {
        return res.status(400).json({ error: "Champs requis manquants" });
      }

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ name, surname, email, phone, prefix, role: "seller" });
      }

      const existingSeller = await Seller.findOne({ user: user._id });
      if (existingSeller) return res.status(409).json({ error: "Seller existe déjà" });

      const seller = await Seller.create({
        user: user._id,
        name,
        surname,
        email,
        phone,
        prefix,
        balance_available: 0,
        balance_locked: 0,
      });

      return res.status(201).json({ success: true, sellerId: seller._id, userId: user._id });
    } catch (err) {
      console.error("❌ registerSeller:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔔 WEBHOOK GLOBAL CINETPAY (OPTIONNEL)
  ====================================================== */
  handleWebhook: async (req, res) => {
    try {
      const result = await CinetPayService.handleWebhook(req.body, req.headers);
      return res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ Webhook error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },
};
