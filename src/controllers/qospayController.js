// =============================================
// controllers/qospayController.js
// PRODUCTION READY — QOSPAY (TM / TG)
// ESCROW + COMMISSION SAFE
// =============================================

const mongoose = require("mongoose");
const QosPayService = require("../services/QosPayService");

const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");
const Order = require("../models/order.model");
const PayinTransaction = require("../models/PayinTransaction");

module.exports = {
  /* ======================================================
     🟢 CREATE PAYIN
  ====================================================== */
  createPayIn: async (req, res) => {
    try {
      const {
        sellerId,
        operator = "AUTO",
        items,
        shippingFee = 0,
      } = req.body;

      /* ======================================================
         🔐 AUTH USER
      ====================================================== */
      const clientId = req.user?.id || req.user?._id;
      if (!clientId) {
        return res.status(401).json({
          success: false,
          error: "Utilisateur non authentifié",
        });
      }

      const client = await User.findById(clientId).select("phone");
      if (!client?.phone) {
        return res.status(400).json({
          success: false,
          error: "Téléphone utilisateur requis",
        });
      }

      /* ======================================================
         🔎 VALIDATIONS
      ====================================================== */
      if (!sellerId) {
        return res.status(400).json({
          success: false,
          error: "sellerId requis",
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Items invalides",
        });
      }

      /* ======================================================
         🔎 LOAD PRODUCTS (SECURE)
      ====================================================== */
      const productIds = items.map(
        (i) => new mongoose.Types.ObjectId(i.productId)
      );

      const products = await Product.find({ _id: { $in: productIds } });

      if (products.length !== items.length) {
        return res.status(404).json({
          success: false,
          error: "Produit introuvable",
        });
      }

      let totalProducts = 0;

      const safeItems = items.map((item) => {
        const product = products.find(
          (p) => p._id.toString() === item.productId
        );

        const qty = Number(item.quantity) || 1;
        const lineTotal = product.price * qty;
        totalProducts += lineTotal;

        return {
          productId: product._id.toString(),
          productName: product.name,
          price: product.price,
          quantity: qty,
        };
      });

      const totalAmount = totalProducts + Number(shippingFee || 0);

      /* ======================================================
         👤 SELLER
      ====================================================== */
      const seller = await Seller.findById(sellerId);
      if (!seller) {
        return res.status(404).json({
          success: false,
          error: "Vendeur introuvable",
        });
      }

      /* ======================================================
         📦 CREATE ORDER (ESCROW)
      ====================================================== */
      const order = await Order.create({
        seller: seller._id,
        client: clientId,
        items: safeItems,
        totalAmount,
        netAmount: totalProducts,
        shippingFee: Number(shippingFee || 0),
        currency: "XOF",
        status: "PAYMENT_PENDING",
      });

      /* ======================================================
         🚀 QOSPAY PAYIN
      ====================================================== */
      const payInResult = await QosPayService.createPayIn({
        orderId: order._id,
        amount: totalAmount,
        buyerPhone: client.phone,
        operator: operator === "AUTO" ? null : operator,
      });

      if (payInResult?.payinTransactionId) {
        order.payinTransaction = payInResult.payinTransactionId;
        await order.save();
      }

      return res.status(201).json({
        success: true,
        provider: "QOSPAY",
        transaction_id: payInResult.transaction_id,
        totalAmount,
      });
    } catch (err) {
      console.error("❌ QOSPAY createPayIn:", err);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },

  /* ======================================================
     🔁 VERIFY PAYIN
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const transactionId =
        req.body?.transaction_id || req.query?.transaction_id;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: "transaction_id requis",
        });
      }

      const result = await QosPayService.verifyPayIn(transactionId);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error("❌ QOSPAY verifyPayIn:", err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },

  /* ======================================================
     🔵 CREATE PAYOUT SELLER
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, operator = "AUTO" } = req.body;

      if (!sellerId || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
        });
      }

      const result = await QosPayService.createPayOutForSeller({
        sellerId,
        amount: Number(amount),
        operator: operator === "AUTO" ? null : operator,
      });

      return res.status(201).json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error("❌ QOSPAY createPayOut:", err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },
};
