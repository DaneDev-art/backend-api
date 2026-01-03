// ==========================================
// src/routes/cart.js (VERSION COMPATIBLE FLUTTER)
// ==========================================
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Product = require("../models/Product");

// ==========================================
// 🧾 Cart Schema
// ==========================================
const cartSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, default: 1, min: 1 },
      },
    ],
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);

// ==========================================
// 🔍 GET CART — FORMAT FLUTTER SAFE ✅
// ==========================================
router.get("/:userId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId })
      .populate({
        path: "items.product",
        select:
          "_id name description price stock images category seller shopName country",
      })
      .lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(200).json([]);
    }

    // 🔥 FORMAT ATTENDU PAR FLUTTER
    const formatted = cart.items
      .filter((i) => i.product)
      .map((item) => ({
        productId: item.product._id.toString(), // ✅ OBLIGATOIRE
        name: item.product.name,
        description: item.product.description,
        price: item.product.price,
        stock: item.product.stock,
        images: item.product.images,
        category: item.product.category,
        seller: item.product.seller,
        shopName: item.product.shopName,
        country: item.product.country,
        quantity: item.quantity,
      }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("❌ getCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ➕ ADD TO CART
// ==========================================
router.post("/:userId/add", async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ error: "productId invalide" });
  }

  try {
    const product = await Product.findById(productId).select("_id");
    if (!product) {
      return res.status(404).json({ error: "Produit introuvable" });
    }

    let cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) {
      cart = new Cart({ userId: req.params.userId, items: [] });
    }

    const item = cart.items.find(
      (i) => i.product.toString() === productId
    );

    if (item) {
      item.quantity += Math.max(1, quantity);
    } else {
      cart.items.push({
        product: product._id,
        quantity: Math.max(1, quantity),
      });
    }

    await cart.save();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("❌ addToCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ✏️ UPDATE QUANTITY
// ==========================================
router.put("/:userId/update/:productId", async (req, res) => {
  const { quantity } = req.body;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "quantity invalide" });
  }

  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) {
      return res.status(404).json({ error: "Panier non trouvé" });
    }

    const item = cart.items.find(
      (i) => i.product.toString() === req.params.productId
    );

    if (!item) {
      return res
        .status(404)
        .json({ error: "Produit non trouvé dans le panier" });
    }

    item.quantity = quantity;
    await cart.save();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ updateCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ❌ REMOVE ITEM
// ==========================================
router.delete("/:userId/remove/:productId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) {
      return res.status(404).json({ error: "Panier non trouvé" });
    }

    cart.items = cart.items.filter(
      (i) => i.product.toString() !== req.params.productId
    );

    await cart.save();
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ removeFromCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🧹 CLEAR CART
// ==========================================
router.delete("/:userId/clear", async (req, res) => {
  try {
    await Cart.deleteOne({ userId: req.params.userId });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ clearCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
