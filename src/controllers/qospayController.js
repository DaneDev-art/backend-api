// =============================================
// controllers/qospayController.js
// PRODUCTION READY — ESCROW & COMMISSION SAFE
// =============================================

const mongoose = require("mongoose");
const QosPayService = require("../services/QosPayService");

const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");
const Order = require("../models/order.model");

const { finalizeOrder } = require("../services/orderFinalize.service");

const BASE_URL =
  process.env.PLATFORM_BASE_URL || "https://backend-api-m0tf.onrender.com";

module.exports = {
  /* ======================================================
     🟢 CREATE PAYIN
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
        operator, // "tm" | "tg"
        items,
      } = req.body;

      const clientId = req.user?.id || req.user?._id;
      if (!clientId) {
        return res.status(401).json({ error: "Utilisateur non authentifié" });
      }

      if (!sellerId || !operator) {
        return res.status(400).json({ error: "sellerId et operator requis" });
      }

      const resolvedProductPrice =
        productPrice !== undefined ? productPrice : amount;

      if (!resolvedProductPrice || Number(resolvedProductPrice) <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      /* ======================================================
         🔎 PRODUITS
      ====================================================== */
      const productIds = items.map(
        (i) => new mongoose.Types.ObjectId(i.productId)
      );

      const products = await Product.find({ _id: { $in: productIds } });
      if (products.length !== items.length) {
        return res.status(404).json({ error: "Produit introuvable" });
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

      /* ======================================================
         👤 SELLER
      ====================================================== */
      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);

      if (!seller) {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      /* ======================================================
         🚀 QOSPAY PAYIN
      ====================================================== */
      const result = await QosPayService.createPayIn({
        sellerId,
        clientId,
        items: safeItems,
        productPrice: Number(resolvedProductPrice),
        shippingFee: Number(shippingFee),
        currency,
        buyerPhone: req.user?.phone,
        operator,
        description:
          description || `Paiement vers ${seller.name || "vendeur"}`,
        notifyUrl: `${BASE_URL}/api/qospay/payin/verify`,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ QOSPAY createPayIn:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🟡 VERIFY PAYIN (CALLBACK)
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const transactionId =
        req.body?.externalTransactionId ||
        req.query?.externalTransactionId;

      if (!transactionId) {
        return res.status(400).json({ error: "transactionId requis" });
      }

      const result = await QosPayService.verifyPayIn(transactionId);

      if (result?.status === "SUCCESS") {
        const order = await Order.findOne({
          qospayTransactionId: transactionId,
        });

        if (order) {
          await finalizeOrder(order._id, "QOSPAY");
        }
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error("❌ QOSPAY verifyPayIn:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔵 CREATE PAYOUT
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, operator } = req.body;

      if (!sellerId || !operator || Number(amount) <= 0) {
        return res.status(400).json({ error: "Données invalides" });
      }

      const result = await QosPayService.createPayOutForSeller({
        sellerId,
        amount,
        operator,
      });

      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔔 WEBHOOK QOSPAY
  ====================================================== */
  handleWebhook: async (req, res) => {
    try {
      const result = await QosPayService.handleWebhook(req.body);
      return res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ QOSPAY webhook:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },
};
