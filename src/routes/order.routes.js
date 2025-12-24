const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");

const Order = require("../models/order.model");
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");

// ======================================================
// 📦 1. Commandes du client connecté (COMPLÈTES)
// GET /api/orders/me
// ======================================================
router.get("/me", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ client: req.user._id })
      .populate("seller", "name")
      .populate({
        path: "items.product",
        select: "name image",
      })
      .populate("payinTransaction", "netAmount")
      .sort({ createdAt: -1 });

    res.set("Cache-Control", "no-store");

    const ordersForFlutter = orders.map((o) => ({
      _id: o._id,
      sellerName: o.seller?.name || "Vendeur inconnu",
      amount: o.totalAmount || 0,
      netAmount: o.payinTransaction?.netAmount || 0,
      shippingFee: o.shippingFee || 0,
      deliveryAddress: o.deliveryAddress || "Adresse inconnue",
      status: o.status,
      isConfirmedByClient: o.isConfirmedByClient || false,
      payinTransactionId: o.payinTransaction?._id || null,
      items: o.items.map((i) => ({
        product: {
          _id: i.product?._id,
          name: i.product?.name || "Produit inconnu",
          image: i.product?.image || null,
        },
        quantity: i.quantity,
        price: i.price,
      })),
      createdAt: o.createdAt,
    }));

    res.status(200).json({
      success: true,
      orders: ordersForFlutter,
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
// 📦 2. Commandes du vendeur connecté
// GET /api/orders/seller
// ======================================================
router.get("/seller", verifyToken, async (req, res) => {
  try {
    const seller = await Seller.findOne({ user: req.user._id });
    if (!seller) {
      return res.status(403).json({
        success: false,
        error: "Accès vendeur requis",
      });
    }

    const orders = await Order.find({ seller: seller._id })
      .populate({
        path: "items.product",
        select: "name image",
      })
      .populate("payinTransaction", "netAmount")
      .sort({ createdAt: -1 });

    const ordersForFlutter = orders.map((o) => ({
      _id: o._id,
      sellerName: seller.name,
      amount: o.totalAmount || 0,
      netAmount: o.payinTransaction?.netAmount || 0,
      shippingFee: o.shippingFee || 0,
      deliveryAddress: o.deliveryAddress || "Adresse inconnue",
      status: o.status,
      isConfirmedByClient: o.isConfirmedByClient || false,
      items: o.items.map((i) => ({
        product: {
          _id: i.product?._id,
          name: i.product?.name || "Produit inconnu",
          image: i.product?.image || null,
        },
        quantity: i.quantity,
        price: i.price,
      })),
      createdAt: o.createdAt,
    }));

    res.set("Cache-Control", "no-store");

    res.status(200).json({
      success: true,
      orders: ordersForFlutter,
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
// 📦 3. Détail commande (client OU vendeur)
// GET /api/orders/:orderId
// ======================================================
router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("seller", "name")
      .populate({
        path: "items.product",
        select: "name image price",
      })
      .populate("payinTransaction", "netAmount");

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Commande introuvable",
      });
    }

    const isClient = order.client.toString() === req.user._id.toString();
    const seller = await Seller.findOne({ user: req.user._id });
    const isSeller =
      seller && order.seller._id.toString() === seller._id.toString();

    if (!isClient && !isSeller) {
      return res.status(403).json({
        success: false,
        error: "Accès non autorisé",
      });
    }

    res.status(200).json({
      success: true,
      order: {
        _id: order._id,
        sellerName: order.seller?.name || "Vendeur inconnu",
        amount: order.totalAmount || 0,
        netAmount: order.payinTransaction?.netAmount || 0,
        shippingFee: order.shippingFee || 0,
        deliveryAddress: order.deliveryAddress || "Adresse inconnue",
        status: order.status,
        isConfirmedByClient: order.isConfirmedByClient || false,
        payinTransactionId: order.payinTransaction?._id || null,
        items: order.items.map((i) => ({
          product: {
            _id: i.product?._id,
            name: i.product?.name || "Produit inconnu",
            image: i.product?.image || null,
          },
          quantity: i.quantity,
          price: i.price,
        })),
        createdAt: order.createdAt,
      },
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
// ✅ 4. Confirmation client — ESCROW OK
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
      sellerCredited: true,
    }).session(session);

    if (!transaction) {
      throw new Error("Transaction invalide");
    }

    const seller = await Seller.findById(order.seller).session(session);
    if (!seller) throw new Error("Vendeur introuvable");

    const amount = Number(transaction.netAmount || 0);

    seller.balance_locked -= amount;
    seller.balance_available += amount;
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
    res.status(400).json({
      success: false,
      error: err.message,
    });
  } finally {
    session.endSession();
  }
});

module.exports = router;
