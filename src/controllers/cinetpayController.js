// =============================================
// controllers/cinetpayController.js
// PRODUCTION READY — SYNTAX FIXED
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
        return res
          .status(400)
          .json({ error: "amount ou productPrice invalide" });
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
      const productIds = items.map(
        (i) => new mongoose.Types.ObjectId(i.productId)
      );

      const products = await Product.find({
        _id: { $in: productIds },
      });

      if (products.length !== items.length) {
        return res.status(404).json({
          error: "Un ou plusieurs produits introuvables",
        });
      }

      /* ======================================================
         🛡️ ITEMS SAFE
      ====================================================== */
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
         🚀 CINETPAY PAYIN
      ====================================================== */
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
      console.error("❌ createPayIn:", err);
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
   🟡 VERIFY PAYIN (API + REDIRECT SAFE)
   ====================================================== */
 verifyPayIn: async (req, res) => {
  try {
    const transactionId =
      req.body.transaction_id ||
      req.body.cpm_trans_id ||
      req.query.transaction_id;

    if (!transactionId) {
      return res.status(400).json({ error: "transaction_id requis" });
    }

    const result = await CinetPayService.verifyPayIn(transactionId);

    /**
     * 🔁 CAS NAVIGATEUR (return_url)
     * CinetPay redirige l'utilisateur avec une requête GET
     */
    if (req.method === "GET") {
      const redirectUrl = `${process.env.FRONTEND_URL}/payin/result?transaction_id=${transactionId}`;
      return res.redirect(302, redirectUrl);
    }

/* ======================================================
     🧩 REGISTER SELLER
  ====================================================== */
  registerSeller: async (req, res) => {
  try {
    const { name, surname, email, phone, prefix } = req.body;

    if (!name || !email || !phone || !prefix) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }

    // 1️⃣ Créer ou récupérer User
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

    // 2️⃣ Vérifier Seller existant
    const existingSeller = await Seller.findOne({ user: user._id });
    if (existingSeller) {
      return res.status(409).json({ error: "Seller existe déjà" });
    }

    // 3️⃣ Créer Seller (OBLIGATOIRE)
    const seller = await Seller.create({
      user: user._id, // 🔥 CHAMP CRITIQUE
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
