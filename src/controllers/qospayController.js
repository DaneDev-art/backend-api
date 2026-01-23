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
const PayinTransaction = require("../models/PayinTransaction");

const { finalizeOrder } = require("../services/orderFinalize.service");

const BASE_URL = process.env.PLATFORM_BASE_URL || "https://backend-api-m0tf.onrender.com";

module.exports = {
  /* ======================================================
     🟢 CREATE PAYIN
  ====================================================== */
  createPayIn: async (req, res) => {
    try {
      const { sellerId, operator, items, productPrice, shippingFee = 0, description } = req.body;

      const clientId = req.user?.id || req.user?._id;
      if (!clientId) return res.status(401).json({ error: "Utilisateur non authentifié" });
      if (!sellerId) return res.status(400).json({ error: "sellerId requis" });
      if (!items || !Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "Items requis" });

      /* ======================================================
         🔎 PRODUITS
      ====================================================== */
      const productIds = items.map(i => new mongoose.Types.ObjectId(i.productId));
      const products = await Product.find({ _id: { $in: productIds } });
      if (products.length !== items.length) return res.status(404).json({ error: "Produit introuvable" });

      const safeItems = items.map(item => {
        const product = products.find(p => p._id.toString() === item.productId);
        return {
          productId: product._id.toString(),
          productName: product.name,
          price: Number(product.price),
          quantity: item.quantity || 1,
        };
      });

      /* ======================================================
         👤 SELLER
      ====================================================== */
      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);
      if (!seller) return res.status(404).json({ error: "Vendeur introuvable" });

      /* ======================================================
         ⚡ CRÉATION DE L'ORDRE
      ====================================================== */
      const order = await Order.create({
        seller: seller._id,
        client: clientId,
        items: safeItems,
        totalAmount: Number(productPrice) + Number(shippingFee),
        netAmount: Number(productPrice), // montant net estimé, ajusté après PayIn
        shippingFee: Number(shippingFee),
        currency: "XOF",
        status: "PAYMENT_PENDING",
      });

      /* ======================================================
         🚀 QOSPAY PAYIN
      ====================================================== */
      const payInResult = await QosPayService.createPayIn({
        orderId: order._id,
        amount: Number(productPrice) + Number(shippingFee),
        buyerPhone: req.user?.phone,
        operator,
      });

      // 🔗 Mise à jour de l'Order avec PayinTransaction et netAmount réel
      if (payInResult?.payinTransactionId) {
        order.payinTransaction = payInResult.payinTransactionId;
        order.netAmount = payInResult.netAmount || order.netAmount;
        order.platformFee = payInResult.totalFees || 0;
        await order.save();
      }

      return res.status(201).json({
        transaction_id: payInResult.transactionId || payInResult.payinTransactionId,
        payment_url: payInResult.payment_url || null,
        netAmount: order.netAmount,
        totalFees: order.platformFee || 0,
        provider: payInResult.provider || "QOSPAY",
        success: payInResult.success,
      });
    } catch (err) {
      console.error("❌ QOSPAY createPayIn:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔁 VERIFY PAYIN
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const transactionId = req.body?.transaction_id || req.query?.transaction_id;
      if (!transactionId) return res.status(400).json({ error: "transaction_id requis" });

      const result = await QosPayService.verifyPayIn(transactionId);

      // ⚡ Finalize order si paiement confirmé
      if (result.status === "SUCCESS") {
        const payinTx = await PayinTransaction.findOne({ transaction_id: transactionId });
        if (payinTx && payinTx.order) {
          await finalizeOrder(payinTx.order, "QOSPAY");
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
      if (!sellerId || Number(amount) <= 0) return res.status(400).json({ error: "Données invalides" });

      const result = await QosPayService.createPayOutForSeller({ sellerId, amount, operator });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ QOSPAY createPayOut:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔔 WEBHOOK QOSPAY
  ====================================================== */
  handleWebhook: async (req, res) => {
    try {
      if (!QosPayService.handleWebhook) {
        return res.status(501).json({ error: "Webhook non implémenté" });
      }

      const result = await QosPayService.handleWebhook(req.body);
      return res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ QOSPAY webhook:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },
};
