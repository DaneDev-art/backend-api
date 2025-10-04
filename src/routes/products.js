// src/routes/products.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const fileUpload = require("express-fileupload");
const productController = require("../controllers/productController");

// ✅ Middleware pour gérer les fichiers
router.use(fileUpload({ useTempFiles: true }));

// ----------------------------------------
// 🔹 ROUTES PRODUITS
// ----------------------------------------

// ✅ Tous les produits (public, avec filtres)
router.get("/", productController.getAllProducts);

// ✅ Produits d’un vendeur spécifique (public ou auth)
router.get("/seller/:sellerId", productController.getProductsBySeller);

// ✅ Ajouter un produit (vendeur connecté)
router.post("/:sellerId/add", auth, productController.addProduct);

// ✅ Modifier un produit (vendeur connecté)
router.put("/:sellerId/update/:productId", auth, productController.updateProduct);

// ✅ Supprimer un produit (vendeur connecté)
router.delete("/:sellerId/remove/:productId", auth, productController.deleteProduct);

module.exports = router;
