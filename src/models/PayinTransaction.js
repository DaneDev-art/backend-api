// src/models/PayinTransaction.js
const mongoose = require("mongoose");

const PayinTransactionSchema = new mongoose.Schema(
  {
    // 🧍‍♂️ Références
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 📦 PANIER (🔥 AJOUT CRITIQUE)
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true, // prix unitaire au moment du paiement
        },
      },
    ],

    // 💰 Montants
    amount: {
      type: Number,
      required: true, // Montant total payé
    },
    netAmount: {
      type: Number,
      required: true, // Montant net reversé au vendeur
    },
    fees: {
      type: Number,
      default: 0,
    },
    fees_breakdown: {
      type: Object,
      default: {},
    },
    currency: {
      type: String,
      default: "XOF",
    },

    // 🔗 Identifiants de transaction
    transaction_id: {
      type: String,
      required: true,
      unique: true, // 🔐 évite doublons
    },
    payment_token: {
      type: String,
    },
    payment_method: {
      type: String,
    },
    api_response_id: {
      type: String,
    },

    // 📦 Statut
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "CANCELED"],
      default: "PENDING",
    },
    cinetpay_status: {
      type: String,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },

    // 🔐 Sécurité crédit vendeur (idempotence)
    sellerCredited: {
      type: Boolean,
      default: false,
    },

    // 👤 Informations client
    customer: {
      email: { type: String },
      phone_number: { type: String },
      name: { type: String },
      address: {
        type: String,
        default: "Adresse inconnue",
      },
    },

    // 🧾 Métadonnées et logs
    raw_response: {
      type: Object,
      default: null,
    },
    message: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PayinTransaction", PayinTransactionSchema);
