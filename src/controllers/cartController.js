// ==========================================
// src/controllers/cartController.js ✅ Version améliorée
// ==========================================
const User = require("../models/user.model");
const Product = require("../models/Product");

// ==========================================
// 🧾 Obtenir le panier d'un utilisateur
// ==========================================
exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate({
      path: "cart.product",
      select: "name price images seller shopName",
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // Si le panier est vide
    if (!user.cart || user.cart.length === 0) {
      return res.status(200).json([]);
    }

    // 🔹 Structure propre avec infos vendeur
    const cartWithDetails = user.cart.map((item) => {
      const product = item.product;
      return {
        productId: product?._id,
        name: product?.name || "Produit inconnu",
        price: product?.price || 0,
        images: product?.images || [],
        quantity: item.quantity,
        shopName: product?.shopName || "",
        sellerId: product?.seller?._id?.toString?.() || product?.seller?.toString?.() || "",
      };
    });

    res.status(200).json(cartWithDetails);
  } catch (err) {
    console.error("❌ getCart error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ➕ Ajouter un produit au panier
// ==========================================
exports.addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId, quantity } = req.body;

    // 🔹 Validation de base
    if (!productId || !quantity) {
      return res.status(400).json({ message: "Champs manquants : productId et quantity requis" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    // 🔹 Récupération automatique du produit et du vendeur
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    const sellerId = product.seller;
    if (!sellerId) {
      return res.status(400).json({ message: "Produit sans vendeur associé dans la base" });
    }

    // 🔹 Vérifie si le produit existe déjà dans le panier
    const existingItem = user.cart.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity || 1;
    } else {
      // 🔹 Ajout automatique du sellerId dans le panier
      user.cart.push({
        product: productId,
        quantity: quantity || 1,
        seller: sellerId, // 🧠 ajouté automatiquement
      });
    }

    await user.save();
    res.status(201).json({ message: "Produit ajouté au panier avec succès" });
  } catch (err) {
    console.error("❌ addToCart error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✏️ Mettre à jour la quantité d’un produit
// ==========================================
exports.updateCartItem = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const { quantity } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    const item = user.cart.find((i) => i.product.toString() === productId);
    if (!item) return res.status(404).json({ message: "Produit non trouvé dans le panier" });

    item.quantity = quantity;
    await user.save();

    res.status(200).json({ message: "Quantité mise à jour" });
  } catch (err) {
    console.error("❌ updateCartItem error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ❌ Supprimer un produit du panier
// ==========================================
exports.removeFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    user.cart = user.cart.filter((i) => i.product.toString() !== productId);
    await user.save();

    res.status(200).json({ message: "Produit retiré du panier" });
  } catch (err) {
    console.error("❌ removeFromCart error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 🧹 Vider complètement le panier
// ==========================================
exports.clearCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    user.cart = [];
    await user.save();

    res.status(200).json({ message: "Panier vidé avec succès" });
  } catch (err) {
    console.error("❌ clearCart error:", err);
    res.status(500).json({ error: err.message });
  }
};
