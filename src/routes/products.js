// ==========================================
// src/routes/products.js
// ==========================================
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const fileUpload = require("express-fileupload");
const productController = require("../controllers/productController");

// ==========================================
// ✅ Middleware pour gérer les fichiers
// ==========================================
router.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

// ==========================================
// 🔹 ROUTES PRODUITS
// ==========================================

// ✅ Tous les produits (public, avec filtres)
router.get("/", productController.getAllProducts);

// ✅ Produits d’un vendeur spécifique (public ou auth)
router.get("/seller/:sellerId", productController.getProductsBySeller);

// ✅ Ajouter un produit (vendeur connecté)
router.post("/add", auth, productController.addProduct);

// ✅ Modifier un produit (vendeur connecté)
router.put("/update/:productId", auth, productController.updateProduct);

// ✅ Supprimer un produit (vendeur connecté)
router.delete("/remove/:productId", auth, productController.deleteProduct);

// ==========================================
// ✅ Export du routeur
// ==========================================
module.exports = router;
