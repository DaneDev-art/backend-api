// routes/order.routes.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");

const Order = require("../models/order.model");
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");

// ======================================================
// 📦 1. Commandes du client connecté
// GET /api/orders/me
// ======================================================
router.get("/me", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ client: req.user._id })
      .sort({ createdAt: -1 });

    // 🔥 évite le 304
    res.set("Cache-Control", "no-store");

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (err) {
    console.error("❌ GET /orders/me:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération commandes client",
    });
  }
});

// ======================================================
// 📦 2. Commandes du vendeur
// GET /api/orders/seller
// ======================================================
router.get("/seller", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ seller: req.user._id })
      .sort({ createdAt: -1 });

    res.set("Cache-Control", "no-store");

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (err) {
    console.error("❌ GET /orders/seller:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération commandes vendeur",
    });
  }
});

// ======================================================
// 📦 3. Détail commande
// GET /api/orders/:orderId
// ======================================================
router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Commande introuvable",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (err) {
    console.error("❌ GET /orders/:orderId:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération commande",
    });
  }
});

// ======================================================
// ✅ 4. Confirmation client
// POST /api/orders/:orderId/confirm
// ======================================================
router.post("/:orderId/confirm", verifyToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(req.params.orderId).session(session);
    if (!order) throw new Error("Commande introuvable");

    if (order.client.toString() !== req.user._id.toString()) {
      throw new Error("Accès non autorisé");
    }

    if (order.isConfirmedByClient) {
      throw new Error("Commande déjà confirmée");
    }

    if (order.status !== "DELIVERED") {
      throw new Error("Commande non livrée");
    }

    const transaction = await PayinTransaction.findOne({
      _id: order.payinTransaction,
      status: "SUCCESS",
    }).session(session);

    if (!transaction) throw new Error("Transaction invalide");

    const seller = await Seller.findById(order.seller).session(session);
    if (!seller) throw new Error("Vendeur introuvable");

    const amount = transaction.netAmount;

    if ((seller.balance_locked || 0) < amount) {
      throw new Error("Solde bloqué insuffisant");
    }

    // 💰 Libération des fonds
    seller.balance_locked -= amount;
    seller.balance_available = (seller.balance_available || 0) + amount;
    await seller.save({ session });

    order.isConfirmedByClient = true;
    order.status = "COMPLETED";
    order.confirmedAt = new Date();
    await order.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Commande confirmée et fonds libérés",
      releasedAmount: amount,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ POST /orders/:orderId/confirm:", err.message);

    res.status(400).json({
      success: false,
      error: err.message,
    });
  } finally {
    session.endSession();
  }
});

module.exports = router;
