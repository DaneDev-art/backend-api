// ==========================================
// src/routes/cart.js (ARCHITECTURE PROPRE)
// ==========================================
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// 🔹 Models
const Product = require("../models/Product");

// ==========================================
// 🧾 Schéma MongoDB pour le panier
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
// 🔍 Récupérer le panier d’un utilisateur
// GET /api/cart/:userId
// ==========================================
router.get("/:userId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId })
      .populate({
        path: "items.product",
        select: "_id name price images seller",
      })
      .lean();

    if (!cart) return res.status(200).json([]);

    const formattedItems = cart.items.map((item) => ({
      productId: item.product._id,
      name: item.product.name,
      price: item.product.price,
      image: item.product.images?.[0] || null,
      sellerId: item.product.seller,
      quantity: item.quantity,
    }));

    res.status(200).json(formattedItems);
  } catch (err) {
    console.error("❌ getCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ➕ Ajouter un produit au panier
// POST /api/cart/:userId/add
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
    if (!cart) cart = new Cart({ userId: req.params.userId, items: [] });

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += Math.max(1, quantity);
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
// ✏️ Modifier la quantité
// PUT /api/cart/:userId/update/:productId
// ==========================================
router.put("/:userId/update/:productId", async (req, res) => {
  const { quantity } = req.body;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "quantity invalide" });
  }

  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) return res.status(404).json({ error: "Panier non trouvé" });

    const item = cart.items.find(
      (i) => i.product.toString() === req.params.productId
    );

    if (!item) {
      return res.status(404).json({ error: "Produit non trouvé dans le panier" });
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
// ❌ Supprimer un produit du panier
// DELETE /api/cart/:userId/remove/:productId
// ==========================================
router.delete("/:userId/remove/:productId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) return res.status(404).json({ error: "Panier non trouvé" });

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== req.params.productId
    );

    await cart.save();
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ removeFromCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🧹 Vider le panier
// DELETE /api/cart/:userId/clear
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
