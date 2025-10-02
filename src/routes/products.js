const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const Product = require("../models/Product");
const cloudinary = require("../config/cloudinary");
const fileUpload = require("express-fileupload");

// Middleware upload fichiers
router.use(fileUpload({ useTempFiles: true }));

// 🔹 GET all products avec pagination et filtres
router.get("/", async (req, res) => {
  try {
    let { page = 1, limit = 10, category, search } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: "i" };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products,
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 GET product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produit non trouvé",
      });
    }
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 GET tous les produits d’un vendeur (admin ou vendeur lui-même)
router.get("/seller/:id", auth, async (req, res) => {
  try {
    const sellerId = req.params.id;

    if (req.user.role !== "seller" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Accès non autorisé",
      });
    }

    if (req.user.role === "seller" && req.user.id !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "Non autorisé à voir les produits d’un autre vendeur",
      });
    }

    const products = await Product.find({ sellerId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (err) {
    console.error("GET /products/seller/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 GET produits du vendeur connecté
router.get("/my", auth, async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Accès réservé aux vendeurs",
      });
    }

    const products = await Product.find({ sellerId: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (err) {
    console.error("GET /products/my error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 POST create product (seller only)
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Seuls les vendeurs peuvent ajouter des produits",
      });
    }

    const { name, price, category } = req.body;

    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: "Image du produit requise",
      });
    }

    const file = req.files.image;
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "products",
    });

    const product = new Product({
      name,
      price,
      category,
      image: result.secure_url,
      sellerId: req.user.id, // 🔹 lien avec le vendeur
    });

    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 PUT update product (seller only, must own product)
router.put("/:id", auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Produit non trouvé" });
    }

    if (req.user.role !== "seller" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Accès interdit",
      });
    }

    if (req.user.role === "seller" && product.sellerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Vous ne pouvez modifier que vos produits",
      });
    }

    const updateData = { ...req.body };

    if (req.files && req.files.image) {
      const file = req.files.image;
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "products",
      });
      updateData.image = result.secure_url;
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    res.status(200).json({ success: true, data: updatedProduct });
  } catch (err) {
    console.error("PUT /products/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 DELETE product (seller only, must own product)
router.delete("/:id", auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Produit non trouvé" });
    }

    if (req.user.role !== "seller" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Accès interdit",
      });
    }

    if (req.user.role === "seller" && product.sellerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Vous ne pouvez supprimer que vos produits",
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Produit supprimé",
    });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

module.exports = router;
