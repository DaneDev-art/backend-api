// ==========================================
// src/controllers/cartController.js ✅ FINAL
// ==========================================
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Product = require("../models/Product");

// ==========================================
// 🧾 GET CART
// ==========================================
exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "userId invalide" });
    }

    const user = await User.findById(userId).populate({
      path: "cart.product",
      select: "name price images seller shopName",
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    if (!user.cart || user.cart.length === 0) {
      return res.status(200).json([]);
    }

    // 🔹 Nettoyage + mapping safe
    const cartWithDetails = user.cart
      .filter((item) => item.product)
      .map((item) => {
        const product = item.product;

        return {
          productId: product._id.toString(),
          name: product.name,
          price: product.price,
          images: product.images || [],
          quantity: item.quantity || 1,
          shopName: product.shopName || "",
          sellerId:
            product.seller?._id?.toString?.() ||
            product.seller?.toString?.() ||
            "",
        };
      });

    res.status(200).json(cartWithDetails);
  } catch (err) {
    console.error("❌ getCart error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ➕ ADD TO CART — CORRIGÉ ET MIS À JOUR
// ==========================================
exports.addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    let { productId, quantity } = req.body;

    // ─────────────────────────────
    // VALIDATIONS ID
    // ─────────────────────────────
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "userId invalide" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: "productId invalide (ObjectId Mongo requis)",
      });
    }

    quantity = Number(quantity) > 0 ? Number(quantity) : 1;

    // ─────────────────────────────
    // CHARGER PRODUIT
    // ─────────────────────────────
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Produit introuvable" });
    }

    if (!product.seller) {
      return res.status(400).json({
        message: "Produit sans vendeur associé",
      });
    }

    // ─────────────────────────────
    // VÉRIFIER UTILISATEUR
    // ─────────────────────────────
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // 🛒 Mise à jour du panier de façon atomique
    const existingItem = user.cart.find(
      (item) => item.product.toString() === productId.toString()
    );

    if (existingItem) {
      // ✔ incrémenter quantité SANS déclencher validation User.transportMode
      await User.updateOne(
        { _id: userId, "cart.product": product._id },
        { $inc: { "cart.$.quantity": quantity } }
      );
    } else {
      // ✔ ajouter nouvel élément
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            cart: {
              product: product._id,
              quantity,
              seller: product.seller,
            },
          },
        }
      );
    }

    res.status(201).json({
      message: "Produit ajouté au panier",
      productId: product._id.toString(),
      quantity,
    });
  } catch (err) {
    console.error("❌ addToCart error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✏️ UPDATE QUANTITY
// ==========================================
exports.updateCartItem = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const { quantity } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({ message: "ID invalide" });
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      return res.status(400).json({ message: "Quantité invalide" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const item = user.cart.find((i) => i.product.toString() === productId);

    if (!item) {
      return res.status(404).json({
        message: "Produit non trouvé dans le panier",
      });
    }

    item.quantity = qty;
    await user.save();

    res.status(200).json({ message: "Quantité mise à jour" });
  } catch (err) {
    console.error("❌ updateCartItem error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ❌ REMOVE FROM CART
// ==========================================
exports.removeFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({ message: "ID invalide" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    user.cart = user.cart.filter(
      (item) => item.product.toString() !== productId
    );

    await user.save();

    res.status(200).json({ message: "Produit retiré du panier" });
  } catch (err) {
    console.error("❌ removeFromCart error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 🧹 CLEAR CART
// ==========================================
exports.clearCart = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "userId invalide" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    user.cart = [];
    await user.save();

    res.status(200).json({
      message: "Panier vidé avec succès",
    });
  } catch (err) {
    console.error("❌ clearCart error:", err);
    res.status(500).json({ error: err.message });
  }
};
