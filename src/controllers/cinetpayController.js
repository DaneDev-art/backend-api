// =============================================
// controllers/cinetpayController.js
// ✅ MONGO-ID NORMALIZED — PRODUCTION READY
// =============================================

const mongoose = require("mongoose");
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
      console.log("📦 PAYIN BODY:", JSON.stringify(req.body, null, 2));

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

      /* ==========================
         🔐 CLIENT AUTH
      ========================== */
      const clientId = req.user?._id?.toString();
      if (!clientId) {
        return res.status(401).json({ error: "Utilisateur non authentifié" });
      }

      /* ==========================
         🧾 BASIC VALIDATION
      ========================== */
      if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
        return res.status(400).json({ error: "sellerId invalide" });
      }

      const resolvedProductPrice =
        productPrice !== undefined ? productPrice : amount;

      if (!resolvedProductPrice || Number(resolvedProductPrice) <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Panier vide" });
      }

      /* ==========================
         🔒 VALIDATE ITEMS (mongoId)
      ========================== */
      const productObjectIds = [];

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

        productObjectIds.push(
          new mongoose.Types.ObjectId(item.productId)
        );
      }

      /* ==========================
         🔍 FETCH PRODUCTS (SINGLE QUERY)
      ========================== */
      const products = await Product.find({
        _id: { $in: productObjectIds },
      });

      if (products.length !== items.length) {
        return res.status(404).json({
          error: "Produit introuvable dans le panier",
        });
      }

      /* ==========================
         🛡️ SAFE ITEMS (CANONICAL)
      ========================== */
      const safeItems = items.map((item) => {
        const product = products.find(
          (p) => p._id.toString() === item.productId
        );

        return {
          productId: product._id.toString(), // 🔑 mongoId ONLY
          productName: product.name,
          unitPrice: Number(product.price),
          quantity: item.quantity,
          total: Number(product.price) * item.quantity,
        };
      });

      /* ==========================
         👤 SELLER CHECK
      ========================== */
      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);

      if (!seller) {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      /* ==========================
         🚀 CREATE PAYIN (SERVICE)
      ========================== */
      const result = await CinetPayService.createPayIn({
        sellerId: seller._id.toString(),
        clientId,
        items: safeItems,
        productPrice: Number(resolvedProductPrice),
        shippingFee: Number(shippingFee) || 0,
        currency,
        buyerEmail: req.user?.email || "",
        buyerPhone: req.user?.phone || "",
        description:
          description || `Paiement vers ${seller.name || "vendeur"}`,
        returnUrl:
          returnUrl || `${BASE_URL}/api/cinetpay/payin/verify`,
        notifyUrl:
          notifyUrl || `${BASE_URL}/api/cinetpay/payin/verify`,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ createPayIn ERROR:", err);
      return res.status(500).json({
        error: "Erreur interne createPayIn",
        details: err.message,
      });
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
        return res.status(400).json({
          error: "transaction_id requis",
        });
      }

      const result =
        await CinetPayService.verifyPayIn(transactionId);

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
      const { sellerId, amount, currency = "XOF", notifyUrl } =
        req.body;

      if (
        !sellerId ||
        !mongoose.Types.ObjectId.isValid(sellerId) ||
        Number(amount) <= 0
      ) {
        return res.status(400).json({ error: "Données invalides" });
      }

      const result =
        await CinetPayService.createPayOutForSeller({
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

      const data =
        await CinetPayService.verifyPayOut(transaction_id);

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};

  /* ======================================================
     🧩 REGISTER SELLER
  ====================================================== */
  registerSeller: async (req, res) => {
    try {
      const { name, surname, email, phone, prefix } = req.body;

      if (!name || !email || !phone || !prefix) {
        return res
          .status(400)
          .json({ error: "Champs requis manquants" });
      }

      const existingUser = await User.findOne({ email });
      const existingSeller = await Seller.findOne({ email });

      if (
        (existingUser && existingUser.role === "seller") ||
        existingSeller
      ) {
        return res
          .status(409)
          .json({ error: "Vendeur existe déjà" });
      }

      const seller = await User.create({
        name,
        surname,
        email,
        phone,
        prefix,
        role: "seller",
        balance_available: 0,
        balance_locked: 0,
      });

      return res.status(201).json({ success: true, seller });
    } catch (err) {
      console.error("❌ registerSeller:", err.message);
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
