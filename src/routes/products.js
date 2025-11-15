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
// 🔹 ROUTES PRODUITS (version corrigée)
// ==========================================

// ✅ GET — Tous les produits (public)
router.get("/", productController.getAllProducts);

// ✅ GET — Produits d’un vendeur spécifique
router.get("/seller/:sellerId", productController.getProductsBySeller);

// ============================
// 🟢 IMPORTANT : COHÉRENCE FLUTTER
// ============================
// Flutter envoie POST /api/products
// Donc ici on remplace "/add" par "/".
// ============================

// ✅ POST — Ajouter un produit
router.post("/", verifyToken, productController.addProduct);

// ============================
// idem pour update et delete
// Flutter envoie :
// PUT    /api/products/:id
// DELETE /api/products/:id
// ============================

// ✅ PUT — Modifier un produit
router.put("/:productId", verifyToken, productController.updateProduct);

// ✅ DELETE — Supprimer un produit
router.delete("/:productId", verifyToken, productController.deleteProduct);

// ==========================================
// 🔹 ROUTES ADMINISTRATEUR
// ==========================================

// 🔸 Valider un produit
router.put(
  "/validate/:productId",
  verifyToken,
  verifyAdmin,
  productController.validateProduct
);

// 🔸 Bloquer un produit
router.put(
  "/block/:productId",
  verifyToken,
  verifyAdmin,
  productController.blockProduct
);

// ==========================================
// ✅ Export du routeur
// ==========================================
module.exports = router;
