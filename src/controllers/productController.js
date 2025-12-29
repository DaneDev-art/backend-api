// ==========================================
// src/controllers/productController.js
// ==========================================
const Product = require("../models/Product");
const cloudinary = require("cloudinary").v2;

// ==========================================
// 🔹 Configuration Cloudinary
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// 🔹 Fonction utilitaire pour enrichir un produit
// ==========================================
const enrichProduct = async (product) => {
  let sellerId = "";
  let shopName = "";
  let country = "";

  // 🔹 sellerId
  if (product.seller) {
    sellerId =
      typeof product.seller === "string"
        ? product.seller
        : product.seller._id?.toString();
  }

  // 🔹 shopName / country depuis produit
  if (product.shopName?.trim()) shopName = product.shopName;
  if (product.country?.trim()) country = product.country;

  // 🔹 fallback depuis User
  if ((!shopName || !country) && sellerId) {
    try {
      const User = require("../models/user.model");
      const seller = await User.findById(sellerId);
      if (seller) {
        shopName ||= seller.shopName || "Boutique inconnue";
        country ||= seller.country || "Pays inconnu";
      }
    } catch (err) {
      console.error("❌ enrichProduct user fetch error:", err);
      shopName ||= "Boutique inconnue";
      country ||= "Pays inconnu";
    }
  }

  return {
    _id: product._id,
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    images: product.images,
    category: product.category,
    status: product.status,
    rating: product.rating,
    numReviews: product.numReviews,
    sellerId,
    shopName,
    country,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

// ==========================================
// ✅ GET — Tous les produits PAYABLES (PUBLIC)
// ==========================================
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({
      status: "actif", // 🔐 CRITIQUE
    }).sort({ createdAt: -1 });

    const enriched = await Promise.all(products.map(enrichProduct));
    res.status(200).json(enriched);
  } catch (err) {
    console.error("❌ getAllProducts error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ GET — Produits PAYABLES d’un vendeur
// ==========================================
exports.getProductsBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const products = await Product.find({
      seller: sellerId,
      status: "actif", // 🔐 CRITIQUE
    }).sort({ createdAt: -1 });

    const enriched = await Promise.all(products.map(enrichProduct));
    res.status(200).json(enriched);
  } catch (err) {
    console.error("❌ getProductsBySeller error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ POST — Ajouter un produit (auth requis)
// ==========================================
exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, category, images } = req.body;
    const sellerId = req.user?._id;

    if (!sellerId)
      return res.status(401).json({ message: "Utilisateur non authentifié" });

    if (!name || !price)
      return res
        .status(400)
        .json({ message: "Nom et prix obligatoires" });

    const User = require("../models/user.model");
    const seller = await User.findById(sellerId);

    const product = new Product({
      name,
      description,
      price,
      category,
      seller: sellerId,
      images: [],
      shopName: seller?.shopName || "",
      country: seller?.country || "",
      status: "actif", // ✅ PAYABLE PAR DÉFAUT
    });

    // 🔹 Upload images Cloudinary
    if (Array.isArray(images)) {
      for (const img of images) {
        const upload = await cloudinary.uploader.upload(img, {
          folder: "products",
        });
        product.images.push(upload.secure_url);
      }
    }

    await product.save();

    res.status(201).json(await enrichProduct(product));
  } catch (err) {
    console.error("❌ addProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✏️ PUT — Modifier un produit (auth requis)
// ==========================================
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.user?._id;
    const { name, description, price, category, images } = req.body;

    const product = await Product.findOne({
      _id: productId,
      seller: sellerId,
    });

    if (!product)
      return res
        .status(404)
        .json({ message: "Produit introuvable ou non autorisé" });

    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) product.category = category;

    const User = require("../models/user.model");
    const seller = await User.findById(sellerId);
    if (seller) {
      product.shopName = seller.shopName || "";
      product.country = seller.country || "";
    }

    if (Array.isArray(images) && images.length > 0) {
      const uploaded = [];
      for (const img of images) {
        const up = await cloudinary.uploader.upload(img, {
          folder: "products",
        });
        uploaded.push(up.secure_url);
      }
      product.images = uploaded;
    }

    await product.save();

    res.status(200).json(await enrichProduct(product));
  } catch (err) {
    console.error("❌ updateProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ❌ DELETE — Supprimer un produit (auth requis)
// ==========================================
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.user?._id;

    const deleted = await Product.findOneAndDelete({
      _id: productId,
      seller: sellerId,
    });

    if (!deleted)
      return res
        .status(404)
        .json({ message: "Produit non trouvé ou non autorisé" });

    res.status(200).json({ message: "Produit supprimé avec succès" });
  } catch (err) {
    console.error("❌ deleteProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ ADMIN — Valider un produit (PAYABLE)
// ==========================================
exports.validateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ message: "Produit introuvable" });

    product.status = "actif"; // 🔥 PAYABLE
    await product.save();

    res.status(200).json({
      message: "Produit validé et activé",
      product: await enrichProduct(product),
    });
  } catch (err) {
    console.error("❌ validateProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 🚫 ADMIN — Bloquer un produit (NON PAYABLE)
// ==========================================
exports.blockProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ message: "Produit introuvable" });

    product.status = "bloqué";
    await product.save();

    res.status(200).json({
      message: "Produit bloqué avec succès",
      product: await enrichProduct(product),
    });
  } catch (err) {
    console.error("❌ blockProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};
