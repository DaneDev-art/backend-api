// routes/order.routes.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");

const Order = require("../models/Order");
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");

// ======================================================
// 📦 1. Récupérer les commandes du client connecté
// ======================================================
router.get("/api/orders/me", verifyToken, async (req, res) => {
  try {
    const clientId = req.user._id;
    const orders = await Order.find({ client: clientId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error("❌ GET /api/orders/me:", err);
    return res.status(500).json({ error: "Erreur récupération commandes client" });
  }
});

// ======================================================
// 📦 2. Récupérer les commandes d’un vendeur
// ======================================================
router.get("/api/orders/seller", verifyToken, async (req, res) => {
  try {
    const sellerId = req.user._id;
    const orders = await Order.find({ seller: sellerId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error("❌ GET /api/orders/seller:", err);
    return res.status(500).json({ error: "Erreur récupération commandes vendeur" });
  }
});

// ======================================================
// 📦 3. Récupérer une commande par ID
// ======================================================
router.get("/api/orders/:orderId", verifyToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Commande introuvable" });
    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error("❌ GET /api/orders/:orderId:", err);
    return res.status(500).json({ error: "Erreur récupération commande" });
  }
});

// ======================================================
// ✅ 4. Confirmation client — libération des fonds
// ======================================================
router.post("/api/orders/:orderId/confirm", verifyToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const clientId = req.user._id;
    const { orderId } = req.params;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Commande introuvable" });
    }

    if (order.client.toString() !== clientId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ error: "Accès non autorisé" });
    }

    if (order.isConfirmedByClient) {
      await session.abortTransaction();
      return res.status(409).json({ error: "Commande déjà confirmée" });
    }

    if (order.status !== "DELIVERED") {
      await session.abortTransaction();
      return res.status(400).json({ error: "Commande non livrée" });
    }

    const transaction = await PayinTransaction.findOne({
      _id: order.payinTransaction,
      status: "SUCCESS",
    }).session(session);

    if (!transaction) {
      await session.abortTransaction();
      return res.status(400).json({ error: "Transaction invalide" });
    }

    const seller = await Seller.findById(order.seller).session(session);
    if (!seller) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Vendeur introuvable" });
    }

    const amountToRelease = transaction.netAmount;
    if ((seller.balance_locked || 0) < amountToRelease) {
      await session.abortTransaction();
      return res.status(409).json({ error: "Solde bloqué insuffisant" });
    }

    // 💰 Libération des fonds
    seller.balance_locked -= amountToRelease;
    seller.balance_available = (seller.balance_available || 0) + amountToRelease;
    await seller.save({ session });

    order.isConfirmedByClient = true;
    order.status = "COMPLETED";
    order.confirmedAt = new Date();
    await order.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Commande confirmée et fonds libérés",
      releasedAmount: amountToRelease,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ POST /api/orders/:orderId/confirm:", err);
    return res.status(500).json({ error: "Erreur confirmation commande" });
  } finally {
    session.endSession();
  }
});

module.exports = router;
