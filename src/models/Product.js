const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 1,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    images: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length <= 3,
        message: "Maximum 3 images autorisées",
      },
      default: [],
    },

    category: {
      type: String,
      trim: true,
      default: "Autre",
      index: true,
    },

    // 🔑 Lien vendeur (clé forte)
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🧠 Snapshot vendeur (sécurité panier / commandes)
    shopName: {
      type: String,
      default: "",
      trim: true,
    },

    country: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["actif", "inactif", "en_attente", "bloqué"],
      default: "en_attente",
      index: true,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    numReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// 🔍 Index optimisés panier / paiement
ProductSchema.index({ seller: 1, status: 1 });
ProductSchema.index({ name: "text", category: 1 });

module.exports = mongoose.model("Product", ProductSchema);
