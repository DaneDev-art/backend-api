// src/controllers/productController.js
const Product = require("../models/Product");
const cloudinary = require("cloudinary").v2;

// --- Configuration Cloudinary (depuis .env) ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Obtenir tous les produits
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("seller", "email shopName");
    res.status(200).json(products); // <-- ✅ renvoie une liste pure
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Obtenir les produits d’un vendeur spécifique
exports.getProductsBySeller = async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.params.sellerId });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Ajouter un produit
exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, category, images } = req.body;
    const sellerId = req.params.sellerId;

    // Vérifie si le vendeur est valide
    if (!sellerId) {
      return res.status(400).json({ message: "Seller ID manquant" });
    }

    // --- Gestion des images Cloudinary (si base64 ou URL) ---
    const uploadedImages = [];
    if (images && images.length > 0) {
      for (const img of images) {
        const uploadRes = await cloudinary.uploader.upload(img, {
          folder: "products",
        });
        uploadedImages.push(uploadRes.secure_url);
      }
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      images: uploadedImages,
      sellerId,
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Modifier un produit
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, category, images } = req.body;
    const { sellerId, productId } = req.params;

    const product = await Product.findOne({ _id: productId, sellerId });
    if (!product) {
      return res.status(404).json({ message: "Produit introuvable" });
    }

    // Met à jour les champs
    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price || product.price;
    product.category = category || product.category;

    // Gestion Cloudinary
    if (images && images.length > 0) {
      const uploadedImages = [];
      for (const img of images) {
        const uploadRes = await cloudinary.uploader.upload(img, {
          folder: "products",
        });
        uploadedImages.push(uploadRes.secure_url);
      }
      product.images = uploadedImages;
    }

    await product.save();
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Supprimer un produit
exports.deleteProduct = async (req, res) => {
  try {
    const { sellerId, productId } = req.params;

    const deleted = await Product.findOneAndDelete({ _id: productId, sellerId });
    if (!deleted) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    res.status(200).json({ message: "Produit supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
