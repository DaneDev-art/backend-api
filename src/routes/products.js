const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const Product = require("../models/Product");
const cloudinary = require("../config/cloudinary");
const fileUpload = require("express-fileupload");

// Middleware pour gérer l'upload de fichiers
router.use(fileUpload({ useTempFiles: true }));

// 🔹 GET all products avec pagination et filtres
router.get("/", async (req, res) => {
  try {
    let { page = 1, limit = 10, category, search } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: "i" }; // recherche insensible à la casse

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
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 POST create product (protected)
router.post("/", auth, async (req, res) => {
  try {
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
    });

    await product.save();
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 PUT update product (protected)
router.put("/:id", auth, async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.files && req.files.image) {
      const file = req.files.image;
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "products",
      });
      updateData.image = result.secure_url;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produit non trouvé",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("PUT /products/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// 🔹 DELETE product (protected)
router.delete("/:id", auth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produit non trouvé",
      });
    }

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
