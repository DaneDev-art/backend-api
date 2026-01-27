// =============================================
// controllers/qospayController.js
// QOSPAY (TM / TG / CARD)
// PROD READY — ESCROW SAFE + COMMISSION SAFE
// =============================================

const mongoose = require("mongoose");
const QosPayService = require("../services/QosPayService");

const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");

// 🔍 Debug export service
console.log("QosPayService exports:", Object.keys(QosPayService));

module.exports = {

  /* ======================================================
     🟢 CREATE PAYIN
     (ORDER + PAYIN QOSPAY)
  ====================================================== */
  createPayIn: async (req, res) => {
    try {
      const {
        sellerId,
        items,
        shippingFee = 0,
        operator = "AUTO",
      } = req.body;

      // =========================
      // 🔐 AUTH CLIENT
      // =========================
      const clientId = req.user?.id || req.user?._id;
      if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
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

      // =========================
      // 🔎 VALIDATIONS
      // =========================
      if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
        return res.status(400).json({
          success: false,
          error: "sellerId invalide",
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Items invalides",
        });
      }

      // =========================
      // 🔎 LOAD PRODUCTS (SAFE)
      // =========================
      const productIds = items.map(i => new mongoose.Types.ObjectId(i.productId));
      const products = await Product.find({ _id: { $in: productIds } });

      if (products.length !== items.length) {
        return res.status(404).json({
          success: false,
          error: "Certains produits sont introuvables",
        });
      }

      // =========================
      // 👤 SELLER
      // =========================
      const seller = await Seller.findById(sellerId);
      if (!seller) {
        return res.status(404).json({
          success: false,
          error: "Vendeur introuvable",
        });
      }

      // =========================
      // 🚀 CALL QOSPAY SERVICE
      // =========================
      if (!QosPayService.createPayIn) {
        throw new Error("QosPayService.createPayIn est undefined");
      }

      const payinResult = await QosPayService.createPayIn({
        orderId: new mongoose.Types.ObjectId(), // ID logique (order réel créé dans le service)
        buyerPhone: client.phone,
        operator: operator === "AUTO" ? null : operator,
        items,
        shippingFee,
        clientId,
        sellerId,
        currency: "XOF",
      });

      if (!payinResult?.success) {
        return res.status(400).json({
          success: false,
          error: payinResult.error || "Erreur PayIn QOSPAY",
        });
      }

      return res.status(201).json({
        success: true,
        provider: "QOSPAY",
        transaction_id: payinResult.transaction_id,
        orderId: payinResult.orderId,
      });

    } catch (err) {
      console.error("❌ QOSPAY createPayIn:", err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },

  /* ======================================================
     🔁 VERIFY PAYIN
     (STATUS + CREDIT SELLER ESCROW)
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

      if (!QosPayService.verifyPayIn) {
        throw new Error("QosPayService.verifyPayIn est undefined");
      }

      const result = await QosPayService.verifyPayIn(transactionId);

      // ⚠️ IMPORTANT : on respecte le success retourné par le service
      return res.status(200).json(result);

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
     (WITHDRAW QOSPAY)
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, operator = "AUTO" } = req.body;

      if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
        return res.status(400).json({
          success: false,
          error: "sellerId invalide",
        });
      }

      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "amount invalide",
        });
      }

      if (!QosPayService.createPayOutForSeller) {
        throw new Error("QosPayService.createPayOutForSeller est undefined");
      }

      const result = await QosPayService.createPayOutForSeller({
        sellerId,
        amount,
        operator: operator === "AUTO" ? null : operator,
      });

      return res.status(201).json(result);

    } catch (err) {
      console.error("❌ QOSPAY createPayOut:", err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },

  /* ======================================================
     🔔 WEBHOOK (OPTIONNEL)
  ====================================================== */
  handleWebhook: async (req, res) => {
    try {
      console.log("🔔 QOSPAY Webhook reçu:", req.body);
      return res.status(200).send("OK");
    } catch (err) {
      console.error("❌ QOSPAY webhook:", err.message);
      return res.status(500).send("ERROR");
    }
  },
};

// 🔍 Debug final export
console.log("QosPayController exports:", Object.keys(module.exports));
