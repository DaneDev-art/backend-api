// =============================================
// controllers/cinetpayController.js
// UPDATED WITH PAYOUT CONTACT HANDLING & PAYIN RETURNURL
// =============================================

const mongoose = require("mongoose");
const CinetPayService = require("../services/CinetPayService");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");

const BASE_URL =
  process.env.BASE_URL || "https://backend-api-m0tf.onrender.com";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://emarket-web.onrender.com";

// =====================================================
// 🧩 OPERATEURS PAYOUT SUPPORTÉS AU TOGO
// =====================================================
const SUPPORTED_OPERATORS_TG = [
  "TMONEY",
  "MOOVMONEY",
  "WAVE",
];

module.exports = {
  /* ======================================================
     🟢 CREATE PAYIN
  ====================================================== */
  createPayIn: async (req, res) => {
    try {
      console.log("📦 Requête PAYIN reçue:", req.body);

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
      } = req.body;

      const clientId = req.user?.id || req.user?._id;

      if (!clientId) {
        return res.status(401).json({ error: "Utilisateur non authentifié" });
      }

      if (!sellerId) {
        return res.status(400).json({ error: "sellerId requis" });
      }

      const resolvedProductPrice =
        productPrice !== undefined ? productPrice : amount;

      if (!resolvedProductPrice || Number(resolvedProductPrice) <= 0) {
        return res.status(400).json({ error: "amount ou productPrice invalide" });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Panier vide" });
      }

      // 🔒 VALIDATION DES IDS PRODUITS
      for (const item of items) {
        if (!item.productId || typeof item.quantity !== "number") {
          return res.status(400).json({
            error: "Structure item invalide",
            item,
          });
        }

        if (!mongoose.Types.ObjectId.isValid(item.productId)) {
          return res.status(400).json({
            error: "productId invalide",
            productId: item.productId,
          });
        }
      }

      // 🔎 FETCH PRODUITS
      const productIds = items.map(i => new mongoose.Types.ObjectId(i.productId));

      const products = await Product.find({ _id: { $in: productIds } });

      if (products.length !== productIds.length) {
        return res.status(404).json({
          error: "Un ou plusieurs produits introuvables",
        });
      }

      const safeItems = items.map(item => {
        const product = products.find(p => p._id.toString() === item.productId);
        return {
          productId: product._id.toString(),
          productName: product.name,
          price: Number(product.price),
          quantity: item.quantity,
        };
      });

      // 👤 VALIDATION VENDEUR
      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);
      if (!seller) return res.status(404).json({ error: "Vendeur introuvable" });

      // 🚀 CINETPAY PAYIN
      const result = await CinetPayService.createPayIn({
        sellerId,
        clientId,
        items: safeItems,
        productPrice: Number(resolvedProductPrice),
        shippingFee: Number(shippingFee) || 0,
        currency,
        buyerEmail: req.user?.email || null,
        buyerPhone: req.user?.phone || null,
        description: description || `Paiement vers ${seller.name || "vendeur"}`,
        returnUrl: returnUrl || `${FRONTEND_URL}/paiement/result`,
        notifyUrl: notifyUrl || `${BASE_URL}/api/cinetpay/payin/verify`,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ createPayIn:", err.message);
      return res.status(500).json({
        error: "Erreur interne createPayIn",
        details: err.message,
      });
    }
  },

  /* ======================================================
     🔵 VERIFY PAYIN — redirection vers frontend
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const { transaction_id, status, message } = req.body; // ou req.query si redirigé
      const redirectUrl = `${FRONTEND_URL}/paiement/result?transaction_id=${transaction_id || ''}&status=${status || 'PENDING'}&message=${encodeURIComponent(message || '')}`;

      return res.redirect(302, redirectUrl);
    } catch (err) {
      console.error("❌ verifyPayIn:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔵 CREATE PAYOUT — ALIGNED WITH SERVICE ✅
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, currency = "XOF", notifyUrl = null } = req.body;
      const realSellerId = req.user?.sellerId || sellerId;

      if (!realSellerId || typeof Number(amount) !== "number" || isNaN(amount)) {
        return res.status(400).json({ error: "sellerId et amount (numérique) sont requis" });
      }

      if (!mongoose.Types.ObjectId.isValid(realSellerId)) {
        return res.status(400).json({ error: "sellerId invalide" });
      }

      const seller = await Seller.findById(realSellerId);
      if (!seller) return res.status(404).json({ error: "Vendeur introuvable" });
      if (!seller.phone || !seller.prefix) {
        return res.status(422).json({ error: "Vendeur invalide : numéro ou préfixe manquant" });
      }

      if (Number(amount) > Number(seller.balance_available || 0)) {
        return res.status(409).json({ error: "Solde insuffisant", balance: seller.balance_available });
      }

      if (seller.operator && !SUPPORTED_OPERATORS_TG.includes(seller.operator.toUpperCase())) {
        return res.status(422).json({
          error: "Opérateur payout non supporté actuellement au Togo",
          operator: seller.operator,
          supported: SUPPORTED_OPERATORS_TG,
          hint: "Utiliser TMoney ou MoovMoney",
        });
      }

      const result = await CinetPayService.createPayOutForSeller({
        sellerId: seller._id,
        amount: Number(amount),
        currency,
        notifyUrl: notifyUrl || `${BASE_URL.replace(/\/+$/, "")}/api/cinetpay/payout-webhook`,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ createPayOut:", err.message);
      return res.status(500).json({
        error: err.message,
        hint: "Vérifier numéro et opérateur supporté TG",
        cinetpay: err.cinetpay || null,
      });
    }
  },

  /* ======================================================
     🟡 VERIFY PAYOUT — SAFE UNLOCK ✅
  ====================================================== */
  verifyPayOut: async (req, res) => {
    try {
      const payoutId = req.body?.payout_id || req.query?.payout_id;
      if (!payoutId) return res.status(400).json({ error: "payout_id requis" });

      const result = await CinetPayService.verifyPayOut(payoutId);

      if (result?.status === "SUCCESS" && result.sellerId && !isNaN(result.amount)) {
        await Seller.updateOne(
          { _id: result.sellerId },
          { $inc: { balance_locked: -Number(result.amount || 0) } }
        );
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error("[CinetPay][verifyPayOut] erreur:", err.message);
      return res.status(500).json({
        error: err.message,
        hint: "Vérifier verifyPayOut côté service",
      });
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
     🔔 WEBHOOK CINETPAY
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
