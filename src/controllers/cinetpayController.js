// =============================================
// controllers/cinetpayController.js
// ✅ Version finale propre & production-ready
// =============================================

const CinetPayService = require("../services/CinetPayService");
const Seller = require("../models/Seller");
const User = require("../models/user.model");

// URL de base plateforme
const BASE_URL =
  process.env.PLATFORM_BASE_URL || "https://backend-api-m0tf.onrender.com";

module.exports = {
  /* ======================================================
     🟢 CREATE PAYIN (Client → Marketplace)
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

      /* ==========================
         🔒 AUTH
      ========================== */
      const clientId = req.user?.id || req.user?._id;
      if (!clientId) {
        return res
          .status(401)
          .json({ error: "Utilisateur non authentifié" });
      }

      if (!sellerId) {
        return res.status(400).json({ error: "sellerId requis" });
      }

      /* ==========================
         🔥 MAPPING MONTANT
      ========================== */
      const resolvedProductPrice =
        productPrice !== undefined ? productPrice : amount;

      if (
        resolvedProductPrice === undefined ||
        Number(resolvedProductPrice) <= 0
      ) {
        return res.status(400).json({
          error: "amount ou productPrice invalide",
        });
      }

      /* ==========================
         📦 VALIDATION PANIER
      ========================== */
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: "items requis (panier vide ou invalide)",
        });
      }

      for (const item of items) {
        if (
          !item.productId ||
          !item.productName ||
          typeof item.quantity !== "number" ||
          typeof item.price !== "number"
        ) {
          return res.status(400).json({
            error: "Structure item invalide",
            item,
          });
        }
      }

      /* ==========================
         🔍 VÉRIFICATION VENDEUR
      ========================== */
      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);

      if (!seller) {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      if (seller.role && seller.role.toLowerCase() !== "seller") {
        return res.status(400).json({ error: "Compte non vendeur" });
      }

      /* ==========================
         🔗 URL SÉCURISÉES
      ========================== */
      const safeReturnUrl =
        returnUrl || `${BASE_URL}/api/cinetpay/payin/verify`;
      const safeNotifyUrl =
        notifyUrl || `${BASE_URL}/api/cinetpay/payin/verify`;

      /* ==========================
         🚀 DELEGATION SERVICE
      ========================== */
      const result = await CinetPayService.createPayIn({
        sellerId,
        clientId,

        items, // 🔥 SNAPSHOT PANIER TRANSMIS

        productPrice: Number(resolvedProductPrice),
        shippingFee: Number(shippingFee) || 0,
        currency,

        buyerEmail: req.user?.email || null,
        buyerPhone: req.user?.phone || null,

        description:
          description || `Paiement vers ${seller.name || "vendeur"}`,

        returnUrl: safeReturnUrl,
        notifyUrl: safeNotifyUrl,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ Erreur createPayIn:", err.message);

      if (/invalide|manquant|introuvable|incohérent/i.test(err.message)) {
        return res.status(400).json({ error: err.message });
      }

      return res
        .status(500)
        .json({ error: "Erreur interne serveur createPayIn" });
    }
  },

  /* ======================================================
     🟡 VERIFY PAYIN (Return URL + Webhook)
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const transactionId =
        req.body.transaction_id ||
        req.body.cpm_trans_id ||
        req.body.transactionId ||
        req.query.transaction_id;

      if (!transactionId) {
        console.warn("⚠️ verifyPayIn sans transaction_id:", req.body);
        return res
          .status(400)
          .json({ error: "transaction_id requis" });
      }

      console.log("🔍 [verifyPayIn] Transaction:", transactionId);

      const result = await CinetPayService.verifyPayIn(transactionId);

      return res.status(200).json(result);
    } catch (err) {
      console.error("❌ verifyPayIn:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔵 CREATE PAYOUT (Vendeur → Mobile Money / Banque)
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, currency = "XOF", notifyUrl } = req.body;

      if (!sellerId || !amount || Number(amount) <= 0) {
        return res
          .status(400)
          .json({ error: "sellerId et amount valides requis" });
      }

      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);

      if (!seller) {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      if (seller.role && seller.role.toLowerCase() !== "seller") {
        return res.status(400).json({ error: "Compte non vendeur" });
      }

      if ((seller.balance_available || 0) < amount) {
        return res.status(400).json({
          error: "Solde insuffisant",
          balance: seller.balance_available || 0,
        });
      }

      const result = await CinetPayService.createPayOutForSeller({
        sellerId,
        amount,
        currency,
        notifyUrl,
      });

      return res.status(201).json({
        success: true,
        client_transaction_id: result.client_transaction_id,
        netAmount: result.netToSend,
        fees: result.fees,
      });
    } catch (err) {
      console.error("❌ createPayOut:", err.message);
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
     🔔 HANDLE WEBHOOK
  ====================================================== */
  handleWebhook: async (req, res) => {
    try {
      const result = await CinetPayService.handleWebhook(
        req.body,
        req.headers
      );
      return res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ webhook error:", err.message);
      return res.status(500).json({ error: "Erreur webhook" });
    }
  },
};
