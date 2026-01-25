// =============================================
// controllers/qospayController.js
// PRODUCTION READY — QOSPAY (TM / TG)
// ESCROW + COMMISSION SAFE
// =============================================

const mongoose = require("mongoose");
const QosPayService = require("../services/QosPayService"); // ✅ CommonJS

const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");
const Order = require("../models/order.model");
const PayinTransaction = require("../models/PayinTransaction");

const { finalizeOrder } = require("../services/orderFinalize.service");

module.exports = {
  /* ======================================================
     🟢 CREATE PAYIN (ANY AUTH USER)
  ====================================================== */
  createPayIn: async (req, res) => {
    try {
      const {
        sellerId,
        operator = "AUTO",
        items,
        productPrice,
        shippingFee = 0,
      } = req.body;

      /* ======================================================
         🔐 AUTH USER (ANY ROLE)
      ====================================================== */
      const clientId = req.user?.id || req.user?._id;
      if (!clientId) {
        return res.status(401).json({
          success: false,
          error: "Utilisateur non authentifié",
        });
      }

      /* ======================================================
         👤 LOAD REAL USER FROM DB
      ====================================================== */
      const client = await User.findById(clientId).select("phone role");
      if (!client || !client.phone) {
        return res.status(400).json({
          success: false,
          error: "Numéro de téléphone utilisateur requis",
        });
      }

      const buyerPhone = normalizePhone(client.phone);

      /* ======================================================
         🔎 BASIC VALIDATIONS
      ====================================================== */
      if (!sellerId) {
        return res.status(400).json({
          success: false,
          error: "sellerId requis",
        });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Items requis",
        });
      }

      /* ======================================================
         🔎 LOAD PRODUCTS (SAFE)
      ====================================================== */
      const productIds = items.map(
        (i) => new mongoose.Types.ObjectId(i.productId)
      );

      const products = await Product.find({
        _id: { $in: productIds },
      });

      if (products.length !== items.length) {
        return res.status(404).json({
          success: false,
          error: "Produit introuvable",
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
          quantity: Number(item.quantity) || 1,
        };
      });

      /* ======================================================
         👤 SELLER (USER OR SELLER MODEL)
      ====================================================== */
      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);

      if (!seller) {
        return res.status(404).json({
          success: false,
          error: "Vendeur introuvable",
        });
      }

      /* ======================================================
         📦 CREATE ORDER (ESCROW)
      ====================================================== */
      const totalAmount =
        Number(productPrice) + Number(shippingFee || 0);

      const order = await Order.create({
        seller: seller._id,
        client: clientId,
        items: safeItems,
        totalAmount,
        netAmount: Number(productPrice),
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
        buyerPhone, // ✅ USER PHONE (ANY ROLE)
        operator,   // AUTO | TM | TG
      });

      /* ======================================================
         🔗 LINK PAYIN ↔ ORDER
      ====================================================== */
      if (payInResult?.payinTransactionId) {
        order.payinTransaction = payInResult.payinTransactionId;
        order.netAmount = payInResult.netAmount ?? order.netAmount;
        order.platformFee = payInResult.totalFees ?? 0;
        await order.save();
      }

      return res.status(201).json({
        success: true,
        provider: "QOSPAY",
        transaction_id: payInResult.transaction_id,
        payment_url: payInResult.payment_url,
        netAmount: order.netAmount,
        totalFees: order.platformFee || 0,
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

      /* ======================================================
         🔐 FINALIZE ORDER (IDEMPOTENT)
      ====================================================== */
      if (result.status === "SUCCESS") {
        const payinTx = await PayinTransaction.findOne({
          transaction_id: transactionId,
          sellerCredited: { $ne: true },
        });

        if (payinTx?.order) {
          await finalizeOrder(payinTx.order, "QOSPAY");
        }
      }

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
     🔵 CREATE PAYOUT (SELLER)
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
        operator,
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

  /* ======================================================
     🔔 WEBHOOK QOSPAY (OPTIONNEL)
  ====================================================== */
  handleWebhook: async (req, res) => {
    try {
      if (!QosPayService.handleWebhook) {
        return res.status(501).json({
          success: false,
          error: "Webhook non implémenté",
        });
      }

      const result = await QosPayService.handleWebhook(req.body);

      return res.status(200).json({
        success: true,
        result,
      });
    } catch (err) {
      console.error("❌ QOSPAY webhook:", err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },
};
