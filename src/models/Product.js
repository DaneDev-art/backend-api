const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    // 🔹 Informations principales
    name: { type: String, required: true, index: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },

    // 🔹 Images (max 3)
    images: {
      type: [String], // URLs Cloudinary
      validate: {
        validator: function (arr) {
          return arr.length <= 3;
        },
        message: "Un produit ne peut pas avoir plus de 3 images.",
      },
      default: [],
    },

    // 🔹 Catégorie
    category: { type: String, index: true },

    // 🔹 Référence au vendeur (User)
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔹 Nom de la boutique du vendeur
    shopName: { type: String, trim: true },

    // 🔹 Pays du vendeur ou d’origine du produit 🌍
    country: { type: String, default: "" },
  },
  { timestamps: true }
);

// ✅ Index utile pour recherche combinée
ProductSchema.index({ name: "text", category: 1 });

module.exports = mongoose.model("Product", ProductSchema);
