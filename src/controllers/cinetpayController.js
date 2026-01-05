// =============================================
// controllers/cinetpayController.js
// PRODUCTION READY — FULL VERSION
// =============================================

const mongoose = require("mongoose");
const CinetPayService = require("../services/CinetPayService");

const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Product = require("../models/Product");
const Order = require("../models/order.model");

const BASE_URL =
  process.env.PLATFORM_BASE_URL || "https://backend-api-m0tf.onrender.com";

/* ======================================================
   🧠 UTILS
====================================================== */
const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

module.exports = {
  /* ======================================================
   🟢 CREATE PAYIN (ESCROW SAFE) — VERSION CORRIGÉE
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
      items,
    } = req.body;

    const clientId = req.user?.id || req.user?._id;
    if (!clientId) {
      return res.status(401).json({ error: "Utilisateur non authentifié" });
    }

    if (!sellerId || !isValidObjectId(sellerId)) {
      return res.status(400).json({ error: "sellerId invalide" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Panier vide" });
    }

    const resolvedProductPrice =
      productPrice !== undefined ? productPrice : amount;

    if (!resolvedProductPrice || Number(resolvedProductPrice) <= 0) {
      return res
        .status(400)
        .json({ error: "amount ou productPrice invalide" });
    }

    // =====================================
    // 🔎 FETCH PRODUITS
    // =====================================
    const productIds = items.map((i) => i.productId);

    for (const pid of productIds) {
      if (!isValidObjectId(pid)) {
        return res.status(400).json({
          error: "productId invalide",
          productId: pid,
        });
      }
    }

    const products = await Product.find({
      _id: { $in: productIds },
    });

    if (products.length !== items.length) {
      return res.status(404).json({
        error: "Un ou plusieurs produits introuvables",
      });
    }

    // =====================================
    // 📦 ITEMS SNAPSHOT
    // =====================================
    const safeItems = items.map((item) => {
      const product = products.find(
        (p) => p._id.toString() === item.productId
      );

      return {
        product: product._id,
        productId: product._id.toString(),
        productName: product.name,
        productImage: product.image || null,
        quantity: item.quantity,
        price: Number(product.price),
      };
    });

    const productTotal = safeItems.reduce(
      (s, i) => s + i.price * i.quantity,
      0
    );

    const totalAmount = productTotal + Number(shippingFee || 0);

    // =====================================
    // 🏪 SELLER (Seller OU User)
    // =====================================
    let seller = await Seller.findById(sellerId);
    if (!seller) seller = await User.findById(sellerId);

    if (!seller) {
      return res.status(404).json({ error: "Vendeur introuvable" });
    }

    // =====================================
    // 🧾 CREATE ORDER (ESCROW LOCKED)
    // =====================================
    // Génération temporaire unique pour éviter doublons MongoDB
    const tempTransactionId = `PAYIN-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const order = await Order.create({
      client: clientId,
      seller: sellerId,
      items: safeItems,
      totalAmount,
      netAmount: productTotal,
      shippingFee,
      deliveryAddress: req.user?.address || "Adresse inconnue",
      status: "PAYMENT_PENDING",
      cinetpayTransactionId: tempTransactionId,
      escrow: {
        isLocked: true,
      },
    });

    // =====================================
    // 🚀 CINETPAY PAYIN
    // =====================================
    const payin = await CinetPayService.createPayIn({
      sellerId,
      clientId,
      amount: totalAmount,
      currency,
      items: safeItems,
      description:
        description || `Paiement vers ${seller.name || "vendeur"}`,
      buyerEmail: req.user?.email || null,
      buyerPhone: req.user?.phone || null,
      // MOBILE DEEPLINK
      returnUrl: `emarket://payin?transaction_id=${order._id}`,
      notifyUrl: `${BASE_URL}/api/cinetpay/webhook`,
    });

    // Mettre à jour l’Order avec le vrai transaction_id
    order.cinetpayTransactionId = payin.transaction_id;
    await order.save();

    return res.status(201).json({
      success: true,
      transaction_id: payin.transaction_id,
      payment_url: payin.payment_url,
      orderId: order._id,
    });
  } catch (err) {
    console.error("❌ createPayIn:", err);
    return res.status(500).json({
      error: "Erreur interne createPayIn",
      details: err.message,
    });
  }
},

  /* ======================================================
     🟡 VERIFY PAYIN (API / POLLING / MOBILE)
  ====================================================== */
  verifyPayIn: async (req, res) => {
    try {
      const transactionId =
        req.body?.transaction_id ||
        req.body?.cpm_trans_id ||
        req.query?.transaction_id;

      if (!transactionId) {
        return res.status(400).json({ error: "transaction_id requis" });
      }

      const result = await CinetPayService.verifyPayIn(transactionId);

      const order = await Order.findOne({
        cinetpayTransactionId: transactionId,
      });

      if (order && result.status === "SUCCESS" && order.status !== "PAID") {
        order.status = "PAID";
        order.escrow.isLocked = true;
        await order.save();
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error("❌ verifyPayIn:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🔵 CREATE PAYOUT (SELLER)
  ====================================================== */
  createPayOut: async (req, res) => {
    try {
      const { sellerId, amount, currency = "XOF", notifyUrl } = req.body;

      if (!sellerId || !isValidObjectId(sellerId) || Number(amount) <= 0) {
        return res.status(400).json({ error: "Données payout invalides" });
      }

      const result = await CinetPayService.createPayOutForSeller({
        sellerId,
        amount,
        currency,
        notifyUrl,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("❌ createPayOut:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  /* ======================================================
     🟡 VERIFY PAYOUT
  ====================================================== */
  verifyPayOut: async (req, res) => {
    try {
      const payoutId = req.body?.payout_id || req.query?.payout_id;

      if (!payoutId) {
        return res.status(400).json({ error: "payout_id requis" });
      }

      const result = await CinetPayService.verifyPayOut(payoutId);

      return res.status(200).json(result);
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
        return res.status(400).json({ error: "Champs requis manquants" });
      }

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

      const existingSeller = await Seller.findOne({ user: user._id });
      if (existingSeller) {
        return res.status(409).json({ error: "Seller existe déjà" });
      }

      const seller = await Seller.create({
        user: user._id,
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

      if (result?.transaction_id && result.status === "SUCCESS") {
        const order = await Order.findOne({
          cinetpayTransactionId: result.transaction_id,
        });

        if (order && order.status !== "PAID") {
          order.status = "PAID";
          order.escrow.isLocked = true;
          await order.save();
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("❌ Webhook error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  },
};
