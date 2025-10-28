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
    prefix: { type: String, required: true, trim: true },    // Exemple : "225"
    full_phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      set: function () {
        return `${this.prefix}${this.phone}`;
      },
    },

    // 🔹 Intégration CinetPay
    cinetpay_contact_added: { type: Boolean, default: false },
    cinetpay_contact_id: { type: String, default: null },    // ID du contact côté CinetPay
    cinetpay_contact_meta: { type: Object, default: null },  // Données brutes CinetPay

    // 🔹 Type de compte pour PayOut
    payout_method: {
      type: String,
      enum: ["MOBILE_MONEY", "BANK", null],
      default: "MOBILE_MONEY",
    },
    payout_account: {
      type: String, // Numéro de compte ou mobile money
      trim: true,
    },

    // 🔹 Solde
    balance_locked: { type: Number, default: 0 },
    balance_available: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Seller", SellerSchema);
