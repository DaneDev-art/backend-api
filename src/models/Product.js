const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    description: { type: String, default: "" }, // Description du produit
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 }, // Quantité disponible
    image: { type: String }, // URL de l’image (Cloudinary)
    category: { type: String, index: true },

    // 🔹 Référence au vendeur
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    shopName: { type: String }, // Nom de la boutique du vendeur
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
