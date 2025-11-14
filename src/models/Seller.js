// src/models/Seller.js
const mongoose = require("mongoose");

const SellerSchema = new mongoose.Schema(
  {
    // 🔹 Informations de base
    name: { type: String, required: true, trim: true },
    surname: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // 🔹 Téléphone et identifiants
    phone: { type: String, required: true, trim: true },     // Numéro sans préfixe
    prefix: { type: String, required: true, trim: true },    // Exemple : "228"
    fullNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // 🔹 Intégration CinetPay
    cinetpay_contact_added: { type: Boolean, default: false },
    cinetpay_contact_id: { type: String, default: null },
    cinetpay_contact_meta: { type: Object, default: {} },

    // 🔹 Type de compte pour PayOut
    payout_method: {
      type: String,
      enum: ["MOBILE_MONEY", "BANK", null],
      default: "MOBILE_MONEY",
    },
    payout_account: { type: String, trim: true },

    // 🔹 Solde
    balance_locked: { type: Number, default: 0 },
    balance_available: { type: Number, default: 0 },

    // 🔹 Role ajouté pour compatibilité controller
    role: { type: String, default: "seller" },
  },
  { timestamps: true }
);

// 🔹 Middleware pour générer automatiquement fullNumber
SellerSchema.pre("save", function (next) {
  if (this.prefix && this.phone) {
    this.fullNumber = `${this.prefix}${this.phone}`;
  }
  next();
});

// 🔹 Index pour recherche rapide sur email ou fullNumber
SellerSchema.index({ email: 1, fullNumber: 1 });

module.exports = mongoose.model("Seller", SellerSchema);
