// ==========================================
// src/routes/cart.js
// ==========================================
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// 🔹 Models
const Product = require("../models/Product");

// ==========================================
// 🧾 Schéma MongoDB pour le panier
// ==========================================
const cartSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [
    {
      productId: { type: String, required: true },
      name: String,
      price: Number,
      quantity: Number,
      shopName: String,
      image: String,
      sellerId: { type: String }, // 🆕 Ajout du vendeur
    },
  ],
});

const Cart = mongoose.model("Cart", cartSchema);

// ==========================================
// 🔍 Récupérer le panier d’un utilisateur
// GET /api/cart/:userId
// ==========================================
router.get("/:userId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    res.status(200).json(cart ? cart.items : []);
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

  if (!productId) {
    return res.status(400).json({ error: "productId requis" });
  }

  try {
    // 🔹 Récupérer ou créer le panier
    let cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) cart = new Cart({ userId: req.params.userId, items: [] });

    // 🔹 Vérifier si le produit existe dans la base
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Produit introuvable" });
    }

    // 🔹 Vérifier si le produit est déjà dans le panier
    const existingIndex = cart.items.findIndex(
      (item) => item.productId === productId
    );

    if (existingIndex >= 0) {
      // 🔹 Incrémenter la quantité
      cart.items[existingIndex].quantity += quantity;
    } else {
      // 🔹 Ajouter le produit avec infos vendeur
      cart.items.push({
        productId,
        name: product.name,
        price: product.price,
        quantity,
        shopName: product.shopName || "",
        image: product.images?.[0] || "",
        sellerId: product.seller?.toString() || null, // 🆕 Récupération du vendeur
      });
    }

    await cart.save();
    res.status(201).json(cart.items);
  } catch (err) {
    console.error("❌ addToCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ✏️ Modifier la quantité d’un produit
// PUT /api/cart/:userId/update/:productId
// ==========================================
router.put("/:userId/update/:productId", async (req, res) => {
  const { quantity } = req.body;

  if (quantity == null) {
    return res.status(400).json({ error: "quantity requis" });
  }

  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) return res.status(404).json({ error: "Panier non trouvé" });

    const index = cart.items.findIndex(
      (item) => item.productId === req.params.productId
    );
    if (index === -1) {
      return res.status(404).json({ error: "Produit non trouvé dans le panier" });
    }

    cart.items[index].quantity = quantity;
    await cart.save();

    res.status(200).json(cart.items);
  } catch (err) {
    console.error("❌ updateCartItem error:", err);
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
      (item) => item.productId !== req.params.productId
    );
    await cart.save();

    res.status(200).json(cart.items);
  } catch (err) {
    console.error("❌ removeFromCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🧹 Vider complètement le panier
// DELETE /api/cart/:userId/clear
// ==========================================
router.delete("/:userId/clear", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) return res.status(404).json({ error: "Panier non trouvé" });

    cart.items = [];
    await cart.save();

    res.status(200).json({ message: "Panier vidé avec succès" });
  } catch (err) {
    console.error("❌ clearCart error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
