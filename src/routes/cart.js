// ==========================================
// src/routes/cart.js (VERSION PROPRE & JWT)
// ==========================================
const express = require("express");
const router = express.Router();

const cartController = require("../controllers/cartController");
const { verifyToken } = require("../middleware/auth.middleware");

// ==========================================
// 🛒 PANIER (SOURCE UNIQUE = User.cart)
// ==========================================
// ⚠️ userId est VALIDÉ contre req.user.id dans le controller
// ⚠️ AUCUN schema Cart ici
// ⚠️ AUCUNE collection carts

// 🔍 GET CART — FORMAT FLUTTER SAFE ✅
router.get("/:userId", verifyToken, cartController.getCart);

// ➕ ADD TO CART
router.post("/:userId/add", verifyToken, cartController.addToCart);

// ✏️ UPDATE QUANTITY
router.put(
  "/:userId/update/:productId",
  verifyToken,
  cartController.updateCartItem
);

// ❌ REMOVE ITEM
router.delete(
  "/:userId/remove/:productId",
  verifyToken,
  cartController.removeFromCart
);

// 🧹 CLEAR CART
router.delete("/:userId/clear", verifyToken, cartController.clearCart);

module.exports = router;
