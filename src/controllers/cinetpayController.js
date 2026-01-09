// =============================================
// controllers/cinetpayController.js
// FINAL — PAYIN SAFE CONFIRMATION + WEB REDIRECT
// =============================================

const mongoose = require("mongoose");
const CinetPayService = require("../services/CinetPayService");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");
const Order = require("../models/order.model");

// =============================================
// 🌍 URLS
// =============================================
const BASE_URL =
  process.env.BASE_URL || "https://backend-api-m0tf.onrender.com";

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://emarket-web.onrender.com";

// =============================================
// 🧩 OPERATEURS PAYOUT SUPPORTÉS (TG)
// =============================================
const SUPPORTED_OPERATORS_TG = ["TMONEY", "MOOVMONEY", "WAVE"];

module.exports = {
  /* ======================================================
     🟢 CREATE PAYIN (CLIENT)
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
      } = req.body;

      const clientId = req.user?.id || req.user?._id;
      if (!clientId) {
        return res.status(401).json({ error: "Utilisateur non authentifié" });
      }

      if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
        return res.status(400).json({ error: "sellerId invalide" });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Panier vide" });
      }

      // 🔒 VALIDATION ITEMS
      for (const item of items) {
        if (
          !item.productId ||
          !mongoose.Types.ObjectId.isValid(item.productId) ||
          typeof item.quantity !== "number" ||
          item.quantity <= 0
        ) {
          return res.status(400).json({
            error: "Item invalide",
            item,
          });
        }
      }

      // 🔎 FETCH PRODUITS
      const productIds = items.map(
        (i) => new mongoose.Types.ObjectId(i.productId)
      );

      const products = await Product.find({ _id: { $in: productIds } });

      if (products.length !== productIds.length) {
        return res.status(404).json({
          error: "Un ou plusieurs produits introuvables",
        });
      }

      const safeItems = items.map((item) => {
        const product = products.find(
          (p) => p._id.toString() === item.productId
        );

        return {
          productId: product._id.toString(),
          productName: product.name,
          price: Number(product.price),
          quantity: item.quantity,
        };
      });

      // 👤 VALIDATION VENDEUR
      const seller =
        (await Seller.findById(sellerId)) ||
        (await User.findById(sellerId));

      if (!seller) {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      const resolvedAmount =
        productPrice !== undefined ? productPrice : amount;

      if (!resolvedAmount || Number(resolvedAmount) <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      // 🚀 CINETPAY PAYIN
      const result = await CinetPayService.createPayIn({
        sellerId,
        clientId,
        items: safeItems,
        productPrice: Number(resolvedAmount),
        shippingFee: Number(shippingFee) || 0,
        currency,
        buyerEmail: req.user?.email || null,
        buyerPhone: req.user?.phone || null,
        description:
          description || `Paiement vers ${seller.name || "vendeur"}`,
        returnUrl: returnUrl || `${FRONTEND_URL}/payin/return`,
        notifyUrl:
          notifyUrl || `${BASE_URL}/api/cinetpay/payin/verify`,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ createPayIn:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔔 VERIFY PAYIN — WEBHOOK ONLY (SERVER ↔ SERVER)
     ⚠️ JAMAIS DE REDIRECT ICI
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const payload = req.body;

      const result = await CinetPayService.handleWebhook(
        payload,
        req.headers
      );

      if (result?.status === "SUCCESS" && result.transaction_id) {
        await Order.updateOne(
          {
            transactionId: result.transaction_id,
            paymentStatus: { $ne: "PAID" },
          },
          {
            $set: {
              paymentStatus: "PAID",
              paidAt: new Date(),
            },
          }
        );
      }

      // ⚠️ Toujours 200 sinon CinetPay retry
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("❌ verifyPayIn webhook:", err.message);
      return res.status(200).json({ success: false });
    }
  },

  /* ======================================================
     🔁 PAYIN RETURN — REDIRECT FRONTEND ONLY
     ❌ PAS DE LOGIQUE MÉTIER
  ====================================================== */
  payinReturn: (req, res) => {
    const { transaction_id, status } = req.query;

    return res.redirect(
      `${FRONTEND_URL}/payin/result` +
        `?transaction_id=${transaction_id || ""}` +
        `&status=${status || "PENDING"}`
    );
  },

  /* ======================================================
     💸 CREATE PAYOUT — SELLER WITHDRAW
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, currency = "XOF" } = req.body;
      const realSellerId = req.user?.sellerId || sellerId;

      if (
        !realSellerId ||
        !mongoose.Types.ObjectId.isValid(realSellerId) ||
        isNaN(amount)
      ) {
        return res.status(400).json({
          error: "sellerId valide et amount requis",
        });
      }

      const seller = await Seller.findById(realSellerId);
      if (!seller) {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      if (Number(amount) > Number(seller.balance_available || 0)) {
        return res.status(409).json({
          error: "Solde insuffisant",
          balance: seller.balance_available,
        });
      }

      if (
        seller.operator &&
        !SUPPORTED_OPERATORS_TG.includes(
          seller.operator.toUpperCase()
        )
      ) {
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
      if (!payoutId) {
        return res.status(400).json({ error: "payout_id requis" });
      }

      const result = await CinetPayService.verifyPayOut(payoutId);

      if (
        result?.status === "SUCCESS" &&
        result.sellerId &&
        !isNaN(result.amount)
      ) {
        await Seller.updateOne(
          { _id: result.sellerId },
          {
            $inc: {
              balance_locked: -Number(result.amount),
            },
          }
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
      console.error("❌ registerSeller:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔔 WEBHOOK GLOBAL CINETPAY (OPTIONNEL)
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
