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

  // 🔹 Récupération sellerId
  if (product.seller) {
    if (typeof product.seller === "string") {
      sellerId = product.seller;
    } else if (product.seller._id) {
      sellerId = product.seller._id.toString();
    }
  } else if (product.sellerId) {
    sellerId = product.sellerId.toString();
  }

  // 🔹 Récupération shopName et country
  if (product.shopName && product.shopName.trim() !== "") {
    shopName = product.shopName;
  }

  if (product.country && product.country.trim() !== "") {
    country = product.country;
  }

  // 🔹 Si les champs sont encore vides, tenter de récupérer depuis la collection users
  if ((!shopName || !country) && sellerId) {
    try {
      const User = require("../models/user.model");
      const seller = await User.findById(sellerId);
      if (seller) {
        if (!shopName) shopName = seller.shopName || "Boutique inconnue";
        if (!country) country = seller.country || "Pays inconnu";
      }
    } catch (err) {
      console.error("❌ enrichProduct fetch user error:", err);
      if (!shopName) shopName = "Boutique inconnue";
      if (!country) country = "Pays inconnu";
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
    shopName: shopName || "Boutique inconnue",
    country: country || "Pays inconnu",
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

// ==========================================
// ✅ Obtenir tous les produits
// ==========================================
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const enriched = await Promise.all(products.map(enrichProduct));

    res.status(200).json(enriched);
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

    const products = await Product.find({ seller: sellerId }).sort({
      createdAt: -1,
    });

    const enriched = await Promise.all(products.map(enrichProduct));

    res.status(200).json(enriched);
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
    const sellerId = req.user._id;

    if (!sellerId)
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    if (!name || !price)
      return res.status(400).json({ message: "Nom et prix du produit sont obligatoires" });

    // 🔹 Récupérer shopName et country depuis la collection "users"
    const User = require("../models/user.model"); // Assurez-vous que le modèle User est importé
    const seller = await User.findById(sellerId);

    const shopName = seller?.shopName || "";
    const country = seller?.country || "";

    // 🔹 Créer le produit avec shopName et country du vendeur
    const product = new Product({
      name,
      description,
      price,
      category,
      seller: sellerId,
      images: [],
      shopName,
      country,
      status: "actif",
    });

    // 🔹 Upload Cloudinary si images fournies
    if (images && images.length > 0) {
      for (const img of images) {
        const uploadRes = await cloudinary.uploader.upload(img, { folder: "products" });
        product.images.push(uploadRes.secure_url);
      }
    }

    await product.save();

    const enriched = await enrichProduct(product);
    res.status(201).json(enriched);
  } catch (err) {
    console.error("❌ addProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✏️ Modifier un produit (auth requis)
// ==========================================
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.user._id;
    const { name, description, price, category, images } = req.body;

    const product = await Product.findOne({
      _id: productId,
      seller: sellerId,
    });

    if (!product)
      return res
        .status(404)
        .json({ message: "Produit introuvable ou non autorisé" });

    // 🔹 Mettre à jour les champs classiques
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) product.category = category;

    // 🔹 Récupérer shopName et country depuis la collection "users"
    const User = require("../models/user.model");
    const seller = await User.findById(sellerId);
    if (seller) {
      product.shopName = seller.shopName || "";
      product.country = seller.country || "";
    }

    // 🔹 Upload Cloudinary si images fournies
    if (images && images.length > 0) {
      const uploaded = [];
      for (const img of images) {
        const up = await cloudinary.uploader.upload(img, { folder: "products" });
        uploaded.push(up.secure_url);
      }
      product.images = uploaded;
    }

    await product.save();

    const enriched = await enrichProduct(product);
    res.status(200).json(enriched);
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
    const sellerId = req.user._id;

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
// ✅ Valider un produit (admin)
// ==========================================
exports.validateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product)
      return res.status(404).json({ message: "Produit introuvable" });

    product.status = "validé";

    await product.save();

    res
      .status(200)
      .json({ message: "Produit validé avec succès", product: await enrichProduct(product) });
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

    if (!product)
      return res.status(404).json({ message: "Produit introuvable" });

    product.status = "bloqué";
    await product.save();

    res
      .status(200)
      .json({ message: "Produit bloqué avec succès", product: await enrichProduct(product) });
  } catch (err) {
    console.error("❌ blockProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};
