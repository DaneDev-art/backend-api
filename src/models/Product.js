const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },

    // ✅ Plusieurs images (3 max)
    images: {
      type: [String], // tableau d’URLs Cloudinary
      validate: {
        validator: function (arr) {
          return arr.length <= 3;
        },
        message: "Un produit ne peut pas avoir plus de 3 images.",
      },
      default: [],
    },

    category: { type: String, index: true },

    // 🔹 Référence au vendeur
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    shopName: { type: String }, // Nom de la boutique du vendeur
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
