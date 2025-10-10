// ==========================================
// src/routes/products.js
// ==========================================
const express = require("express");
const router = express.Router();
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware");
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
router.post("/add", verifyToken, productController.addProduct);

// ✅ Modifier un produit (vendeur connecté)
router.put("/update/:productId", verifyToken, productController.updateProduct);

// ✅ Supprimer un produit (vendeur connecté)
router.delete("/remove/:productId", verifyToken, productController.deleteProduct);

// ==========================================
// 🔹 ROUTES ADMINISTRATEUR
// ==========================================

// ✅ Valider un produit (changer statut -> "validé")
router.put(
  "/validate/:productId",
  verifyToken,
  verifyAdmin,
  productController.validateProduct || ((req, res) => res.status(501).json({ message: "Not implemented" }))
);

// 🚫 Bloquer un produit (changer statut -> "bloqué")
router.put(
  "/block/:productId",
  verifyToken,
  verifyAdmin,
  productController.blockProduct || ((req, res) => res.status(501).json({ message: "Not implemented" }))
);

// ==========================================
// ✅ Export du routeur
// ==========================================
module.exports = router;
