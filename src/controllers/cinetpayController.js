// =============================================
// controllers/cinetpayController.js ✅ Version finale mise à jour
// =============================================
const CinetPayService = require("../services/CinetPayService");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const PayinTransaction = require("../models/PayinTransaction");
const PayoutTransaction = require("../models/PayoutTransaction");

const FEES = { payinCinetPay: 0.035, payoutCinetPay: 0.015, app: 0.02 };
const TOTAL_FEES = FEES.payinCinetPay + FEES.payoutCinetPay + FEES.app;

const BASE_URL =
  process.env.PLATFORM_BASE_URL || "https://backend-api-m0tf.onrender.com";

module.exports = {
  // ======================================================
  // 🟢 CREATE PAYIN
  // ======================================================
  createPayIn: async (req, res) => {
    try {
      const { amount, currency = "XOF", description, sellerId, returnUrl, notifyUrl } = req.body;

      if (!sellerId || !amount)
        return res.status(400).json({ error: "sellerId et amount sont requis" });

      const clientId = req.user?.id || req.user?._id;
      if (!clientId) return res.status(500).json({ error: "clientId introuvable" });

      // Recherche vendeur
      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);
      if (!seller) return res.status(404).json({ error: "Vendeur introuvable" });
      if (seller.role && seller.role.toLowerCase() !== "seller")
        return res.status(400).json({ error: "Compte non vendeur" });

      const safeReturnUrl = returnUrl || `${BASE_URL}/api/cinetpay/payin/verify`;
      const safeNotifyUrl = notifyUrl || `${BASE_URL}/api/cinetpay/payin/verify`;

      console.log("📦 Requête PAYIN reçue:", req.body);
      console.log("🔗 URLs:", { safeReturnUrl, safeNotifyUrl });

      // 🔹 Appel du service CinetPay
      const result = await CinetPayService.createPayIn({
        amount,
        currency,
        buyerEmail: req.user?.email || null,
        buyerPhone: req.user?.phone || null,
        description: description || `Paiement vers ${seller.name || "vendeur"}`,
        sellerId,
        clientId,
        returnUrl: safeReturnUrl,
        notifyUrl: safeNotifyUrl,
      });

      if (!result || !result.payment_url) {
        console.error("⚠️ Erreur de réponse CinetPay:", result);
        return res.status(502).json({ error: "Erreur création paiement CinetPay" });
      }

      // 🔹 Calcul montant net et verrouillage
      const netAmount = result.netAmount || amount - amount * TOTAL_FEES;
      seller.balance_locked = (seller.balance_locked || 0) + netAmount;
      await seller.save();

      // 🔹 Sauvegarde transaction MongoDB
      await PayinTransaction.create({
        transaction_id: result.transaction_id,
        seller: seller._id,
        sellerId: seller._id,
        clientId,
        amount,
        netAmount,
        currency,
        status: "PENDING",
        payment_token: result.payment_token,
        paymentUrl: result.payment_url,
      });

      console.log("✅ PAYIN créé:", result.transaction_id);

      return res.status(201).json({
        success: true,
        transaction_id: result.transaction_id,
        payment_url: result.payment_url,
        netAmount,
        fees: result.fees,
      });
    } catch (err) {
      console.error("❌ Erreur createPayIn:", err.response?.data || err.message);
      res.status(500).json({
        error: "Erreur interne serveur createPayIn",
        details: err.response?.data || err.message,
      });
    }
  },

  // ======================================================
  // 🟡 VERIFY PAYIN
  // ======================================================
  verifyPayIn: async (req, res) => {
    try {
      const { transaction_id } = req.body;
      if (!transaction_id) return res.status(400).json({ error: "transaction_id requis" });

      const result = await CinetPayService.verifyPayIn(transaction_id);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("❌ verifyPayIn:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ======================================================
  // 🔵 CREATE PAYOUT
  // ======================================================
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, currency = "XOF", notifyUrl } = req.body;
      if (!sellerId || !amount) return res.status(400).json({ error: "sellerId et amount requis" });

      let seller = await Seller.findById(sellerId);
      if (!seller) seller = await User.findById(sellerId);
      if (!seller) return res.status(404).json({ error: "Vendeur introuvable" });
      if (seller.role && seller.role.toLowerCase() !== "seller")
        return res.status(400).json({ error: "Compte non vendeur" });
      if ((seller.balance_available || 0) < amount)
        return res.status(400).json({ error: "Solde insuffisant", balance: seller.balance_available });

      const result = await CinetPayService.createPayOutForSeller({ sellerId, amount, currency, notifyUrl });

      res.status(201).json({
        success: true,
        client_transaction_id: result.client_transaction_id,
        netAmount: result.netToSend,
        fees: result.fees,
      });
    } catch (err) {
      console.error("❌ createPayOut:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ======================================================
  // 🟠 VERIFY PAYOUT
  // ======================================================
  verifyPayOut: async (req, res) => {
    try {
      const { transaction_id } = req.body;
      if (!transaction_id) return res.status(400).json({ error: "transaction_id requis" });

      const data = await CinetPayService.verifyPayOut(transaction_id);
      res.json({ success: true, data });
    } catch (err) {
      console.error("❌ verifyPayOut:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ======================================================
  // 🧩 REGISTER SELLER
  // ======================================================
  registerSeller: async (req, res) => {
    try {
      const { name, surname, email, phone, prefix } = req.body;
      if (!name || !email || !phone || !prefix) return res.status(400).json({ error: "Champs requis manquants" });

      const existingUser = await User.findOne({ email });
      const existingSeller = await Seller.findOne({ email });
      if ((existingUser && existingUser.role === "seller") || existingSeller) {
        return res.status(409).json({ error: "Vendeur existe déjà" });
      }

      const seller = await User.create({ name, surname, email, phone, prefix, role: "seller", balance_available: 0, balance_locked: 0 });
      res.status(201).json({ success: true, seller });
    } catch (err) {
      console.error("❌ registerSeller:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ======================================================
  // 🔔 HANDLE WEBHOOK
  // ======================================================
  handleWebhook: async (req, res) => {
    try {
      const result = await CinetPayService.handleWebhook(req.body, req.headers);
      res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ webhook error:", err);
      res.status(500).json({ error: "Erreur webhook" });
    }
  },
};
