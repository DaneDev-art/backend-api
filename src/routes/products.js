const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const Product = require("../models/Product");
const cloudinary = require("../config/cloudinary");
const fileUpload = require("express-fileupload");

// Middleware pour gérer l'upload de fichiers
router.use(fileUpload({ useTempFiles: true }));

// 🔹 GET all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// 🔹 POST create product (protected)
router.post("/", auth, async (req, res) => {
  try {
    const { name, price, category } = req.body;

    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "Image du produit requise" });
    }

    // Upload image sur Cloudinary
    const file = req.files.image;
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "products",
    });

    const product = new Product({
      name,
      price,
      category,
      image: result.secure_url, // URL Cloudinary
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// 🔹 PUT update product (protected)
router.put("/:id", auth, async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Si nouvelle image, upload sur Cloudinary
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
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    res.json(product);
  } catch (err) {
    console.error("PUT /products/:id error:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// 🔹 DELETE product (protected)
router.delete("/:id", auth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    res.json({ message: "Produit supprimé" });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
