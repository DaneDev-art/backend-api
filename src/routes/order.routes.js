const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");

const Order = require("../models/order.model");
const Seller = require("../models/Seller");

// 🔥 LOGIQUE MÉTIER UNIQUE
const confirmOrderByClient = require("../controllers/confirmOrderByClient");

const BASE_URL =
  process.env.BASE_URL || "https://backend-api-m0tf.onrender.com";

/* ======================================================
   🔹 UTIL — IMAGE PRODUIT ABSOLUE
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
   1️⃣ COMMANDES DU CLIENT
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
      payinTransactionId:
        o.qospayTransactionId || o.payinTransaction || null,
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

    return res.status(200).json({
      success: true,
      orders: ordersForFrontend,
    });
  } catch (err) {
    console.error("❌ GET /orders/me:", err);
    return res.status(500).json({
      success: false,
      error: "Erreur récupération commandes client",
    });
  }
});

/* ======================================================
   2️⃣ COMMANDES DU VENDEUR
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
      .populate("client", "fullName name email phone")
      .populate({
        path: "items.product",
        select: "name images price",
      })
      .sort({ createdAt: -1 });

    res.set("Cache-Control", "no-store");

    const ordersForFrontend = orders.map((o) => ({
      _id: o._id,
      sellerName: seller.name,
      clientName:
        o.client?.fullName ||
        o.client?.name ||
        o.client?.email ||
        "Client inconnu",
      clientPhone: o.client?.phone || null,
      totalAmount: o.totalAmount || 0,
      netAmount: o.netAmount || 0,
      shippingFee: o.shippingFee || 0,
      deliveryAddress: o.deliveryAddress || "Adresse inconnue",
      status: o.status,
      isConfirmedByClient: o.isConfirmedByClient || false,
      payinTransactionId:
        o.qospayTransactionId || o.payinTransaction || null,
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

    return res.status(200).json({
      success: true,
      orders: ordersForFrontend,
    });
  } catch (err) {
    console.error("❌ GET /orders/seller:", err);
    return res.status(500).json({
      success: false,
      error: "Erreur récupération commandes vendeur",
    });
  }
});

/* ======================================================
   3️⃣ DÉTAIL COMMANDE (CLIENT OU VENDEUR)
   GET /api/orders/:orderId
====================================================== */
router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("seller", "name")
      .populate("client", "fullName name email phone")
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

    const isClient = order.client._id.toString() === req.user._id.toString();
    const seller = await Seller.findOne({ user: req.user._id });
    const isSeller =
      seller && order.seller._id.toString() === seller._id.toString();

    if (!isClient && !isSeller) {
      return res.status(403).json({
        success: false,
        error: "Accès non autorisé",
      });
    }

    return res.status(200).json({
      success: true,
      order: {
        _id: order._id,
        sellerName: order.seller?.name || "Vendeur inconnu",
        clientName:
          order.client?.fullName ||
          order.client?.name ||
          order.client?.email ||
          "Client inconnu",
        clientPhone: order.client?.phone || null,
        totalAmount: order.totalAmount || 0,
        netAmount: order.netAmount || 0,
        shippingFee: order.shippingFee || 0,
        deliveryAddress: order.deliveryAddress || "Adresse inconnue",
        status: order.status,
        isConfirmedByClient: order.isConfirmedByClient || false,
        payinTransactionId:
          order.qospayTransactionId || order.payinTransaction || null,
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
    return res.status(500).json({
      success: false,
      error: "Erreur récupération commande",
    });
  }
});

/* ======================================================
   4️⃣ CONFIRMATION CLIENT
   POST /api/orders/:orderId/confirm
====================================================== */
router.post("/:orderId/confirm", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const clientId = req.user._id;

    console.log(
      `🔔 Confirmation commande | orderId=${orderId} | clientId=${clientId}`
    );

    const result = await confirmOrderByClient(orderId, clientId);

    return res.status(200).json({
      ...result,
      netAmount: result.releasedAmount || 0,
    });
  } catch (error) {
    console.error("❌ POST /orders/:orderId/confirm:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Erreur confirmation commande",
    });
  }
});

module.exports = router;
