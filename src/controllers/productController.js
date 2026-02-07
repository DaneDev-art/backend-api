// ==========================================
// src/controllers/productController.js
// ==========================================
const Product = require("../models/Product");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");

// ==========================================
// 🔹 Configuration Cloudinary
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// 🔹 Mapping catégorie → clé pour Flutter
// ==========================================
const categoryMap = {
  "Toutes": "ALL",
  "Electroménagers": "ELECTROMENAGER",
  "Electroniques": "ELECTRONIQUE",
  "Smartphones & Accessoires": "SMARTPHONES",
  "Tablettes & ordinateurs": "TABLETTES_PC",
  "Téléviseurs & Home Cinéma": "TV_HOME",
  "Casques & Ecouteurs": "CASQUES",
  "Montres Connectées": "MONTRES",
  "Accessoirs informatiques": "ACCESSOIRS_PC",
  "Vêtements": "VETEMENTS",
  "Chaussures": "CHAUSSURES",
  "Sacs & Portefeuilles": "SACS",
  "Bijoux & Montres": "BIJOUX",
  "Lunettes & Chapeaux": "LUNETTES",
  "Meubles": "MEUBLES",
  "Décoration intérieure": "DECORATION",
  "Produits cosmétiques": "COSMETIQUES",
  "Soins capillaires": "SOINS_CAPILLAIRES",
  "Produits pour la peau": "PEAU",
  "Parfums": "PARFUMS",
  "Vêtements Bébé/Enfants": "VETEMENTS_BEBE",
  "Jeux & Jouets": "JEUX",
  "Instruments de Musique": "MUSIQUE",
  "Epicerie": "EPICERIE",
  "Produits frais": "PRODUITS_FRAIS",
  "Boissons": "BOISSONS",
  "Articles de Puériculture": "PUERICULTURE",
};

// ==========================================
// 🔹 Enrichissement PRODUIT (JSON STABLE)
// ==========================================
const enrichProduct = async (product) => {
  const sellerId =
    typeof product.seller === "string"
      ? product.seller
      : product.seller?._id?.toString() || "";

  let shopName = product.shopName || "";
  let country = product.country || "";

  if ((!shopName || !country) && sellerId) {
    try {
      const User = require("../models/user.model");
      const seller = await User.findById(sellerId).lean();
      if (seller) {
        shopName ||= seller.shopName || "Boutique inconnue";
        country ||= seller.country || "Pays inconnu";
      }
    } catch (_) {
      shopName ||= "Boutique inconnue";
      country ||= "Pays inconnu";
    }
  }

  const categoryKey = categoryMap[product.category] || product.category || "ALL";

  return {
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    images: product.images || [],
    category: product.category,
    categoryKey, // <-- Ajouté pour Flutter
    status: product.status,
    rating: product.rating || 0,
    numReviews: product.numReviews || 0,
    seller: sellerId,
    sellerId,
    shopName,
    country,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

// ==========================================
// ✅ GET — Tous les produits PAYABLES
// ==========================================
exports.getAllProducts = async (_, res) => {
  try {
    const products = await Product.find({ status: "actif" })
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(products.map((p) => enrichProduct(p)));
    res.status(200).json(enriched);
  } catch (err) {
    console.error("❌ getAllProducts:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ GET — Produits PAYABLES d’un vendeur
// ==========================================
exports.getProductsBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: "sellerId invalide" });
    }

    const products = await Product.find({ seller: sellerId, status: "actif" })
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(products.map((p) => enrichProduct(p)));
    res.status(200).json(enriched);
  } catch (err) {
    console.error("❌ getProductsBySeller:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ POST — Ajouter un produit
// ==========================================
exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, category, images = [] } = req.body;
    const sellerId = req.user?._id;

    if (!sellerId) return res.status(401).json({ message: "Non authentifié" });
    if (!name || !Number(price) || price <= 0)
      return res.status(400).json({ message: "Nom et prix valide obligatoires" });

    const User = require("../models/user.model");
    const seller = await User.findById(sellerId).lean();

    const product = new Product({
      name,
      description,
      price,
      category,
      seller: sellerId,
      images: [],
      shopName: seller?.shopName || "",
      country: seller?.country || "",
      status: "actif",
    });

    for (const img of images) {
      const upload = await cloudinary.uploader.upload(img, { folder: "products" });
      product.images.push(upload.secure_url);
    }

    await product.save();
    res.status(201).json(await enrichProduct(product));
  } catch (err) {
    console.error("❌ addProduct:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✏️ PUT — Modifier un produit
// ==========================================
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: "productId invalide" });

    const product = await Product.findOne({ _id: productId, seller: sellerId });
    if (!product) return res.status(404).json({ message: "Produit introuvable ou non autorisé" });

    const { name, description, price, category, images } = req.body;
    if (name) product.name = name;
    if (description) product.description = description;
    if (price && price > 0) product.price = price;
    if (category) product.category = category;

    if (Array.isArray(images)) {
      product.images = [];
      for (const img of images) {
        const upload = await cloudinary.uploader.upload(img, { folder: "products" });
        product.images.push(upload.secure_url);
      }
    }

    await product.save();
    res.status(200).json(await enrichProduct(product));
  } catch (err) {
    console.error("❌ updateProduct:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ❌ DELETE — Supprimer un produit
// ==========================================
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: "productId invalide" });

    const deleted = await Product.findOneAndDelete({ _id: productId, seller: sellerId });
    if (!deleted) return res.status(404).json({ message: "Produit non trouvé ou non autorisé" });

    res.status(200).json({ message: "Produit supprimé" });
  } catch (err) {
    console.error("❌ deleteProduct:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 🔹 ADMIN — Valider un produit
// ==========================================
exports.validateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    product.status = "actif";
    await product.save();
    res.status(200).json({ message: "Produit validé", product });
  } catch (err) {
    console.error("❌ validateProduct:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 🔹 ADMIN — Bloquer un produit
// ==========================================
exports.blockProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    product.status = "bloqué";
    await product.save();
    res.status(200).json({ message: "Produit bloqué", product });
  } catch (err) {
    console.error("❌ blockProduct:", err);
    res.status(500).json({ error: err.message });
  }
};
