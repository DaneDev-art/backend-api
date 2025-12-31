// =============================================
// controllers/cinetpayController.js
// ✅ STRUCTURE FIX — PRODUCTION READY
// =============================================

const CinetPayService = require("../services/CinetPayService");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");

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
        amount,
        productPrice,
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
        return res
          .status(400)
          .json({ error: "amount ou productPrice invalide" });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Panier vide" });
      }

      const safeItems = [];
      for (const item of items) {
        if (!item.productId || typeof item.quantity !== "number") {
          return res.status(400).json({
            error: "Structure item invalide",
            item,
          });
        }

        const product = await Product.findById(item.productId);
        if (!product) {
          return res
            .status(404)
            .json({ error: "Produit introuvable" });
        }

        safeItems.push({
          productId: product._id.toString(),
          productName: product.name,
          price: Number(product.price),
          quantity: item.quantity,
        });
      }

      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);
      if (!seller) {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      const result = await CinetPayService.createPayIn({
        sellerId,
        clientId,
        items: safeItems,
        productPrice: Number(resolvedProductPrice),
        shippingFee: Number(shippingFee) || 0,
        currency,
        buyerEmail: req.user?.email || null,
        buyerPhone: req.user?.phone || null,
        description:
          description || `Paiement vers ${seller.name || "vendeur"}`,
        returnUrl:
          returnUrl || `${BASE_URL}/api/cinetpay/payin/verify`,
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
     🟡 VERIFY PAYIN
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const transactionId =
        req.body.transaction_id ||
        req.body.cpm_trans_id ||
        req.query.transaction_id;

      if (!transactionId) {
        return res
          .status(400)
          .json({ error: "transaction_id requis" });
      }

      const result = await CinetPayService.verifyPayIn(transactionId);
      return res.status(200).json(result);
    } catch (err) {
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
     🟠 VERIFY PAYOUT
  ====================================================== */
  verifyPayOut: async (req, res) => {
    try {
      const { transaction_id } = req.body;
      if (!transaction_id) {
        return res
          .status(400)
          .json({ error: "transaction_id requis" });
      }

      const data = await CinetPayService.verifyPayOut(transaction_id);
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔔 WEBHOOK
  ====================================================== */
  handleWebhook: async (req, res) => {
    try {
      const result = await CinetPayService.handleWebhook(
        req.body,
        req.headers
      );
      return res.status(200).json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
