// =============================================
// controllers/cinetpayController.js
// PRODUCTION READY — FINAL & COMMISSION SAFE
// =============================================

const mongoose = require("mongoose");
const CinetPayService = require("../services/CinetPayService");

const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");
const Order = require("../models/order.model");

// 🔥 FINALISATION CENTRALISÉE (COMMISSION INCLUSE)
const { finalizeOrder } = require("../services/orderFinalize.service");

const BASE_URL =
  process.env.PLATFORM_BASE_URL || "https://backend-api-m0tf.onrender.com";

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
        provider,
        operator,
      } = req.body;

      /* ================= AUTH ================= */
      const clientId = req.user?.id || req.user?._id;
      if (!clientId) {
        return res.status(401).json({ error: "Utilisateur non authentifié" });
      }

      /* ================= VALIDATION ================= */
      if (!sellerId) {
        return res.status(400).json({ error: "sellerId requis" });
      }

      const validProviders = ["CINETPAY", "QOSPAY"];
      if (!provider || !validProviders.includes(provider)) {
        return res.status(400).json({
          error: "provider requis (CINETPAY ou QOSPAY)",
        });
      }

      const validOperators = ["MTN", "MOOV", "ORANGE", "WAVE"];
      if (!operator || !validOperators.includes(operator)) {
        return res.status(400).json({
          error: "operator requis (MTN, MOOV, ORANGE, WAVE...)",
        });
      }

      const resolvedProductPrice = productPrice ?? amount;
      if (!resolvedProductPrice || Number(resolvedProductPrice) <= 0) {
        return res.status(400).json({ error: "amount ou productPrice invalide" });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Panier vide" });
      }

      /* ======================================================
         🔒 VALIDATION DES IDS
      ====================================================== */
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

      /* ======================================================
         🔎 FETCH PRODUITS
      ====================================================== */
      const productIds = items.map((i) => new mongoose.Types.ObjectId(i.productId));

      const products = await Product.find({ _id: { $in: productIds } });

      if (products.length !== items.length) {
        return res.status(404).json({ error: "Un ou plusieurs produits introuvables" });
      }

      /* ======================================================
         🛡️ ITEMS SAFE
      ====================================================== */
      const safeItems = items.map((item) => {
        const product = products.find((p) => p._id.toString() === item.productId);
        return {
          productId: product._id.toString(),
          productName: product.name,
          price: Number(product.price),
          quantity: item.quantity,
        };
      });

      /* ======================================================
         👤 SELLER
      ====================================================== */
      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);

      if (!seller) {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      /* ======================================================
         🚀 CINETPAY PAYIN
      ====================================================== */
      const result = await CinetPayService.createPayIn({
        sellerId,
        clientId,
        provider,
        operator,
        items: safeItems,
        productPrice: Number(resolvedProductPrice),
        shippingFee: Number(shippingFee) || 0,
        currency,
        buyerEmail: req.user?.email || null,
        buyerPhone: req.user?.phone || null,
        description:
          description || `Paiement vers ${seller.name || "vendeur"}`,
        returnUrl: returnUrl || `${BASE_URL}/api/cinetpay/payin/verify`,
        notifyUrl: notifyUrl || `${BASE_URL}/api/cinetpay/payin/verify`,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ createPayIn:", err);
      return res.status(500).json({
        error: "Erreur interne createPayIn",
        details: err.message,
      });
    }
  },

  /* ======================================================
     🟡 VERIFY PAYIN (API + REDIRECT SAFE)
     🔥 FINALISE ORDER + COMMISSION
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const transactionId =
        req.body?.transaction_id ||
        req.body?.cpm_trans_id ||
        req.query?.transaction_id;

      if (!transactionId) {
        return res.status(400).json({ error: "transaction_id requis" });
      }

      const result = await CinetPayService.verifyPayIn(transactionId);

      /* ======================================================
         ✅ PAIEMENT ACCEPTÉ → FINALISATION COMMANDE
      ====================================================== */
      if (result?.status === "ACCEPTED") {
        const order = await Order.findOne({
          cinetpayTransactionId: transactionId,
        });

        if (!order) {
          console.error(
            "❌ Order introuvable pour transaction:",
            transactionId
          );
        } else {
          // 🔥 FINALISATION UNIQUE & IDÉMPOTENTE
          await finalizeOrder(order._id, "CINETPAY");
        }
      }

      /* ======================================================
         🔁 REDIRECT FRONTEND (GET)
      ====================================================== */
      if (req.method === "GET") {
        const status = result?.status || "PENDING";
        const redirectUrl =
          `${process.env.FRONTEND_URL}/payin/result` +
          `?transaction_id=${transactionId}` +
          `&status=${status}`;
        return res.redirect(302, redirectUrl);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error("❌ verifyPayIn:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔵 CREATE PAYOUT
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, currency = "XOF", notifyUrl } = req.body;

      if (!sellerId || Number(amount) <= 0) {
        return res.status(400).json({ error: "Données invalides" });
      }

      const result = await CinetPayService.createPayOutForSeller({
        sellerId,
        amount,
        currency,
        notifyUrl,
      });

      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🟡 VERIFY PAYOUT
  ====================================================== */
  verifyPayOut: async (req, res) => {
    try {
      const payoutId = req.body?.payout_id || req.query?.payout_id;

      if (!payoutId) {
        return res.status(400).json({ error: "payout_id requis" });
      }

      const result = await CinetPayService.verifyPayOut(payoutId);

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
        user = await User.create({
          name,
          surname,
          email,
          phone,
          prefix,
          role: "seller",
        });
      }

      const existingSeller = await Seller.findOne({ user: user._id });
      if (existingSeller) {
        return res.status(409).json({ error: "Seller existe déjà" });
      }

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

      return res.status(201).json({
        success: true,
        sellerId: seller._id,
        userId: user._id,
      });
    } catch (err) {
      console.error("❌ registerSeller:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔔 WEBHOOK CINETPAY
  ====================================================== */
  handleWebhook: async (req, res) => {
    try {
      const result = await CinetPayService.handleWebhook(
        req.body,
        req.headers
      );
      return res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ Webhook error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },
};
