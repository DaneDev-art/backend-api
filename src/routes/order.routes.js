const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");

const Order = require("../models/order.model");
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");

// 🔥 LOGIQUE MÉTIER UNIQUE (la même que le script test)
const confirmOrderByClient = require("../controllers/confirmOrderByClient");

const BASE_URL =
  process.env.BASE_URL || "https://backend-api-m0tf.onrender.com";

/* ======================================================
   🔹 Fonction utilitaire pour URLs images absolues
====================================================== */
function getProductImageUrl(item) {
  let img = item.productImage || null;

  if ((!img || img.trim() === "") && item.product) {
    if (Array.isArray(item.product.images) && item.product.images.length > 0) {
      img = item.product.images[0];
    }
  }

  if (img && !img.startsWith("http")) {
    img = `${BASE_URL.replace(/\/$/, "")}/${img.replace(/^\/+/, "")}`;
  }

  return img;
}

/* ======================================================
   1️⃣ Commandes du client connecté
   GET /api/orders/me
====================================================== */
router.get("/me", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ client: req.user._id })
      .populate("seller", "name")
      .populate({
        path: "items.product",
        select: "name images price",
      })
      .sort({ createdAt: -1 });

    res.set("Cache-Control", "no-store");

    const ordersForFrontend = orders.map((o) => ({
      _id: o._id,

      sellerName: o.seller?.name || "Vendeur inconnu",

      totalAmount: o.totalAmount || 0,
      netAmount: o.netAmount || 0,
      shippingFee: o.shippingFee || 0,
      deliveryAddress: o.deliveryAddress || "Adresse inconnue",

      status: o.status,
      isConfirmedByClient: o.isConfirmedByClient || false,

      payinTransactionId: o.payinTransaction || null,

      items: o.items.map((i) => ({
        product: {
          _id: i.product?._id || i.productId,
          name: i.product?.name || i.productName || "Produit inconnu",
          productImage: getProductImageUrl(i),
          price: i.product?.price || i.price || 0,
        },
        quantity: i.quantity,
        price: i.price,
      })),

      createdAt: o.createdAt,
    }));

    res.status(200).json({
      success: true,
      orders: ordersForFrontend,
    });
  } catch (err) {
    console.error("❌ GET /orders/me:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération commandes client",
    });
  }
});

/* ======================================================
   2️⃣ Commandes du vendeur connecté
   GET /api/orders/seller
====================================================== */
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
        select: "name images price",
      })
      .sort({ createdAt: -1 });

    res.set("Cache-Control", "no-store");

    const ordersForFrontend = orders.map((o) => ({
      _id: o._id,

      sellerName: seller.name,

      totalAmount: o.totalAmount || 0,
      netAmount: o.netAmount || 0,
      shippingFee: o.shippingFee || 0,
      deliveryAddress: o.deliveryAddress || "Adresse inconnue",

      status: o.status,
      isConfirmedByClient: o.isConfirmedByClient || false,

      items: o.items.map((i) => ({
        product: {
          _id: i.product?._id || i.productId,
          name: i.product?.name || i.productName || "Produit inconnu",
          productImage: getProductImageUrl(i),
          price: i.product?.price || i.price || 0,
        },
        quantity: i.quantity,
        price: i.price,
      })),

      createdAt: o.createdAt,
    }));

    res.status(200).json({
      success: true,
      orders: ordersForFrontend,
    });
  } catch (err) {
    console.error("❌ GET /orders/seller:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération commandes vendeur",
    });
  }
});

/* ======================================================
   3️⃣ Détail commande (client OU vendeur)
   GET /api/orders/:orderId
====================================================== */
router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("seller", "name")
      .populate({
        path: "items.product",
        select: "name images price",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Commande introuvable",
      });
    }

    const isClient = order.client.toString() === req.user._id.toString();
    const seller = await Seller.findOne({ user: req.user._id });
    const isSeller =
      seller && order.seller.toString() === seller._id.toString();

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

        totalAmount: order.totalAmount || 0,
        netAmount: order.netAmount || 0,
        shippingFee: order.shippingFee || 0,
        deliveryAddress: order.deliveryAddress || "Adresse inconnue",

        status: order.status,
        isConfirmedByClient: order.isConfirmedByClient || false,

        payinTransactionId: order.payinTransaction || null,

        items: order.items.map((i) => ({
          product: {
            _id: i.product?._id || i.productId,
            name: i.product?.name || i.productName || "Produit inconnu",
            productImage: getProductImageUrl(i),
            price: i.product?.price || i.price || 0,
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

/* ======================================================
   4️⃣ CONFIRMATION CLIENT — LOGIQUE UNIQUE
   POST /api/orders/:orderId/confirm
   ✅ IDENTIQUE AU SCRIPT DE TEST
====================================================== */
router.post("/:orderId/confirm", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const clientId = req.user._id;

    console.log(
      `🔔 [ROUTE] Confirmation commande | orderId=${orderId} | clientId=${clientId}`
    );

    // 🔥 APPEL DIRECT À LA LOGIQUE MÉTIER TESTÉE
    const result = await confirmOrderByClient(orderId, clientId);

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ POST /orders/:orderId/confirm:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Erreur confirmation commande",
    });
  }
});

module.exports = router;
