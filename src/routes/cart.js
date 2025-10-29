// src/routes/cart.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// 🔹 Models
const Product = require("../models/Product");

// 🔹 Schéma MongoDB pour le panier
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
    },
  ],
});

const Cart = mongoose.model("Cart", cartSchema);

// =======================
// Récupérer le panier d’un utilisateur
// GET /api/cart/:userId
router.get("/:userId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    res.json(cart ? cart.items : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// Ajouter un produit au panier
// POST /api/cart/:userId/add
router.post("/:userId/add", async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) return res.status(400).json({ error: "productId requis" });

  try {
    // 🔹 Récupérer ou créer le panier
    let cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) cart = new Cart({ userId: req.params.userId, items: [] });

    // 🔹 Vérifier si le produit existe déjà dans le panier
    const index = cart.items.findIndex((item) => item.productId === productId);

    // 🔹 Récupérer les infos produit depuis la collection Product
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Produit introuvable" });

    const productData = {
      productId,
      name: product.name,
      price: product.price,
      quantity,
      shopName: product.shopName || "",
      image: product.images.length > 0 ? product.images[0] : "",
    };

    if (index >= 0) {
      // 🔹 Incrémenter la quantité si le produit existe déjà
      cart.items[index].quantity += quantity;
    } else {
      // 🔹 Ajouter le produit au panier
      cart.items.push(productData);
    }

    await cart.save();
    res.json(cart.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// Modifier la quantité d’un produit
// PUT /api/cart/:userId/update/:productId
router.put("/:userId/update/:productId", async (req, res) => {
  const { quantity } = req.body;

  if (quantity == null) return res.status(400).json({ error: "quantity requis" });

  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) return res.status(404).json({ error: "Panier non trouvé" });

    const index = cart.items.findIndex((item) => item.productId === req.params.productId);
    if (index === -1) return res.status(404).json({ error: "Produit non trouvé" });

    cart.items[index].quantity = quantity;
    await cart.save();
    res.json(cart.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// Retirer un produit du panier
// DELETE /api/cart/:userId/remove/:productId
router.delete("/:userId/remove/:productId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) return res.status(404).json({ error: "Panier non trouvé" });

    cart.items = cart.items.filter(item => item.productId !== req.params.productId);
    await cart.save();
    res.json(cart.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// Vider le panier
// DELETE /api/cart/:userId/clear
router.delete("/:userId/clear", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) return res.status(404).json({ error: "Panier non trouvé" });

    cart.items = [];
    await cart.save();
    res.json(cart.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
