// src/models/Seller.js
const mongoose = require("mongoose");

const SellerSchema = new mongoose.Schema(
  {
    // 🔹 Lien UNIQUE vers User
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // 🔹 Infos principales
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // 🔹 Téléphone
    phone: { type: String, required: true, trim: true },
    prefix: { type: String, required: true, trim: true },
    fullNumber: { type: String, unique: true, sparse: true },

    // 🔹 Infos boutique
    address: { type: String, default: "" },
    country: { type: String, default: "" },
    shopDescription: { type: String, default: "" },
    logoUrl: { type: String, default: "" },

    // 🔹 CinetPay
    cinetpay_contact_added: { type: Boolean, default: false },
    cinetpay_contact_id: { type: String, default: null },
    cinetpay_contact_meta: { type: Object, default: {} },

    // 🔹 Paiement
    payout_method: {
      type: String,
      enum: ["MOBILE_MONEY", "BANK"],
      default: "MOBILE_MONEY",
    },
    payout_account: { type: String, default: "" },

    // 🔹 Soldes
    balance_locked: { type: Number, default: 0 },
    balance_available: { type: Number, default: 0 },

    // 🔹 Compatibilité controller
    role: { type: String, default: "seller" },
  },
  { timestamps: true }
);

// 🔹 Génération automatique fullNumber
SellerSchema.pre("save", function (next) {
  if (this.prefix && this.phone) {
    this.fullNumber = `${this.prefix}${this.phone}`;
  }
  next();
});

SellerSchema.index({ email: 1, fullNumber: 1 });

module.exports = mongoose.model("Seller", SellerSchema);
