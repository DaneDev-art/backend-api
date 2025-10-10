const mongoose = require("mongoose");

// ==========================================
// 🔹 Schéma du modèle Product
// ==========================================
const ProductSchema = new mongoose.Schema(
  {
    // 🔸 Nom du produit
    name: {
      type: String,
      required: [true, "Le nom du produit est obligatoire"],
      index: true,
      trim: true,
    },

    // 🔸 Description du produit
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // 🔸 Prix
    price: {
      type: Number,
      required: [true, "Le prix du produit est obligatoire"],
      min: [0, "Le prix ne peut pas être négatif"],
    },

    // 🔸 Stock disponible
    stock: {
      type: Number,
      default: 0,
      min: [0, "Le stock ne peut pas être négatif"],
    },

    // 🔸 Images (URLs Cloudinary, max 3)
    images: {
      type: [String],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length <= 3;
        },
        message: "Un produit ne peut pas avoir plus de 3 images.",
      },
      default: [],
    },

    // 🔸 Catégorie
    category: {
      type: String,
      index: true,
      trim: true,
      default: "Autre",
    },

    // 🔸 Référence au vendeur (User)
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Un produit doit être associé à un vendeur"],
    },

    // 🔸 Nom de la boutique du vendeur (dérivé du User)
    shopName: {
      type: String,
      trim: true,
      default: "",
    },

    // 🔸 Pays du vendeur ou d’origine du produit 🌍
    country: {
      type: String,
      default: "",
      trim: true,
    },

    // 🔸 Statut (utile si tu veux filtrer ou modérer les produits)
    status: {
      type: String,
      enum: ["actif", "inactif", "en_attente"],
      default: "actif",
    },

    // 🔸 Note moyenne (facultatif)
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    // 🔸 Nombre d’avis (facultatif)
    numReviews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// ==========================================
// ✅ Index pour la recherche texte
// ==========================================
ProductSchema.index({ name: "text", category: 1 });

// ==========================================
// ✅ Export du modèle
// ==========================================
module.exports = mongoose.model("Product", ProductSchema);
