// ==========================================
// src/controllers/productController.js
// ==========================================
const Product = require("../models/Product");
const cloudinary = require("cloudinary").v2;

// ==========================================
// 🔹 Configuration Cloudinary (depuis .env)
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// ✅ Obtenir tous les produits (avec boutique & pays)
// ==========================================
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate({ path: "seller", select: "shopName country" })
      .sort({ createdAt: -1 });

    const enrichedProducts = products.map((p) => ({
      _id: p._id,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      images: p.images,
      category: p.category,
      status: p.status,
      shopName: p.seller?.shopName || "Boutique inconnue",
      country: p.seller?.country || "Pays inconnu",
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.status(200).json(enrichedProducts);
  } catch (err) {
    console.error("❌ getAllProducts error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ Obtenir les produits d’un vendeur spécifique
// ==========================================
exports.getProductsBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const products = await Product.find({ seller: sellerId })
      .populate("seller", "shopName country")
      .sort({ createdAt: -1 });

    const enrichedProducts = products.map((p) => ({
      _id: p._id,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      images: p.images,
      category: p.category,
      status: p.status,
      shopName: p.seller?.shopName || "Boutique inconnue",
      country: p.seller?.country || "Pays inconnu",
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.status(200).json(enrichedProducts);
  } catch (err) {
    console.error("❌ getProductsBySeller error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ Ajouter un produit (auth requis)
// ==========================================
exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, category, images } = req.body;
    const sellerId = req.user.id;

    if (!sellerId) return res.status(401).json({ message: "Utilisateur non authentifié" });
    if (!name || !price) return res.status(400).json({ message: "Nom et prix obligatoires" });

    let uploadedImages = [];
    if (images && images.length > 0) {
      for (const img of images) {
        const uploadRes = await cloudinary.uploader.upload(img, { folder: "products" });
        uploadedImages.push(uploadRes.secure_url);
      }
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      images: uploadedImages,
      seller: sellerId,
      status: "pending",
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error("❌ addProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ Modifier un produit (auth requis)
// ==========================================
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.user.id;
    const { name, description, price, category, images } = req.body;

    const product = await Product.findOne({ _id: productId, seller: sellerId });
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) product.category = category;

    if (images && images.length > 0) {
      const uploadedImages = [];
      for (const img of images) {
        const uploadRes = await cloudinary.uploader.upload(img, { folder: "products" });
        uploadedImages.push(uploadRes.secure_url);
      }
      product.images = uploadedImages;
    }

    await product.save();
    res.status(200).json(product);
  } catch (err) {
    console.error("❌ updateProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ Supprimer un produit (auth requis)
// ==========================================
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.user.id;

    const deleted = await Product.findOneAndDelete({ _id: productId, seller: sellerId });
    if (!deleted) return res.status(404).json({ message: "Produit non trouvé ou non autorisé" });

    res.status(200).json({ message: "Produit supprimé avec succès" });
  } catch (err) {
    console.error("❌ deleteProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ Valider un produit (admin)
// ==========================================
exports.validateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    product.status = "validé";
    await product.save();
    res.status(200).json({ message: "Produit validé avec succès", product });
  } catch (err) {
    console.error("❌ validateProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 🚫 Bloquer un produit (admin)
// ==========================================
exports.blockProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    product.status = "bloqué";
    await product.save();
    res.status(200).json({ message: "Produit bloqué avec succès", product });
  } catch (err) {
    console.error("❌ blockProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};
