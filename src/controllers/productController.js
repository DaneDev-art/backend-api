// ==========================================
// src/controllers/productController.js
// ==========================================
const Product = require("../models/Product");
const Order = require("../models/order.model");
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
// 🔢 Calcul quantité vendue (COMPLETED)
// ==========================================
const getSoldCountForProduct = async (productId) => {
  const result = await Order.aggregate([
    { $match: { status: "COMPLETED" } },
    { $unwind: "$items" },
    {
      $match: {
        "items.productId": productId.toString(),
      },
    },
    {
      $group: {
        _id: null,
        totalSold: { $sum: "$items.quantity" },
      },
    },
  ]);

  return result[0]?.totalSold || 0;
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
  let sellerAddress = "";

  let seller = null;
  if (sellerId) {
    try {
      const User = require("../models/user.model");
      seller = await User.findById(sellerId).lean();
      if (seller) {
        shopName ||= seller.shopName || "Boutique inconnue";
        country ||= seller.country || "Pays inconnu";
        sellerAddress = seller.address || "";
      }
    } catch (_) {
      shopName ||= "Boutique inconnue";
      country ||= "Pays inconnu";
    }
  }

  const soldCount = await getSoldCountForProduct(product._id);

  const categoryKey =
    categoryMap[product.category] || product.category || "ALL";

  return {
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    soldCount,
    sellerAddress,
    images: product.images || [],
    category: product.category,
    categoryKey,
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

    const enriched = await Promise.all(products.map(enrichProduct));
    res.status(200).json(enriched);
  } catch (err) {
    console.error("❌ getAllProducts:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// ✅ GET — Produits PAYABLES par CATÉGORIE
// ==========================================
exports.getProductsByCategory = async (req, res) => {
  try {
    const { categoryKey } = req.params;
    let query = { status: "actif" };

    if (categoryKey !== "ALL") {
      const categoryName = Object.keys(categoryMap).find(
        (key) => categoryMap[key] === categoryKey
      );

      query.$or = [
        { category: categoryKey },
        ...(categoryName ? [{ category: categoryName }] : []),
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(products.map(enrichProduct));
    res.status(200).json(enriched);
  } catch (err) {
    console.error("❌ getProductsByCategory:", err);
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

    const products = await Product.find({
      seller: sellerId,
      status: "actif",
    })
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(products.map(enrichProduct));
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
    const {
      name,
      description,
      price,
      category,
      stock,
      images = [],
    } = req.body;

    const sellerId = req.user?._id;

    if (!sellerId)
      return res.status(401).json({ message: "Non authentifié" });

    if (!name || !Number(price) || price <= 0)
      return res
        .status(400)
        .json({ message: "Nom et prix valide obligatoires" });

    const parsedStock =
      stock !== undefined && stock !== null && stock !== ""
        ? Number(stock)
        : 0;

    const User = require("../models/user.model");
    const seller = await User.findById(sellerId).lean();

    const product = new Product({
      name,
      description,
      price,
      stock: parsedStock,
      category,
      seller: sellerId,
      images: [],
      shopName: seller?.shopName || "",
      country: seller?.country || "",
      status: "actif",
    });

    for (const img of images) {
      const upload = await cloudinary.uploader.upload(img, {
        folder: "products",
      });
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
// ✏️ PUT — Modifier un produit (FIX FINAL)
// ==========================================
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "productId invalide" });
    }

    if (!req.user?._id) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const sellerId = new mongoose.Types.ObjectId(req.user._id);

    const product = await Product.findOne({
      _id: productId,
      seller: sellerId,
    });

    if (!product) {
      return res
        .status(403)
        .json({ message: "Produit introuvable ou non autorisé" });
    }

    const { name, description, price, category, stock, images } = req.body;

    // 🔹 Champs simples
    if (typeof name === "string") product.name = name.trim();
    if (typeof description === "string")
      product.description = description.trim();

    // ✅ FIX PRICE
    if (price !== undefined && !isNaN(price)) {
      product.price = Number(price);
    }

    if (typeof category === "string") product.category = category;

    // ✅ FIX STOCK
    if (stock !== undefined && !isNaN(stock)) {
      product.stock = Number(stock);
    }

    // 🔹 Images
    if (Array.isArray(images)) {
      const finalImages = [];

      for (const img of images) {
        if (typeof img === "string" && img.startsWith("http")) {
          finalImages.push(img);
        } else if (typeof img === "string") {
          const upload = await cloudinary.uploader.upload(img, {
            folder: "products",
          });
          finalImages.push(upload.secure_url);
        }
      }

      product.images = finalImages;
    }

    await product.save();

    return res.status(200).json(await enrichProduct(product));
  } catch (err) {
    console.error("❌ updateProduct:", err);
    return res.status(500).json({ error: err.message });
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

    const deleted = await Product.findOneAndDelete({
      _id: productId,
      seller: sellerId,
    });

    if (!deleted)
      return res
        .status(404)
        .json({ message: "Produit non trouvé ou non autorisé" });

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

    if (!product)
      return res.status(404).json({ message: "Produit introuvable" });

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

    if (!product)
      return res.status(404).json({ message: "Produit introuvable" });

    product.status = "bloqué";
    await product.save();

    res.status(200).json({ message: "Produit bloqué", product });
  } catch (err) {
    console.error("❌ blockProduct:", err);
    res.status(500).json({ error: err.message });
  }
};
