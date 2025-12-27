// src/models/PayinTransaction.js
const mongoose = require("mongoose");

const PayinTransactionSchema = new mongoose.Schema(
  {
    /* ======================================================
       🧍‍♂️ RÉFÉRENCES
    ====================================================== */
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ======================================================
       📦 PANIER (SNAPSHOT SÉCURISÉ)
    ====================================================== */
    items: [
      {
        // 🔗 Référence produit (optionnelle)
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },

        // 📸 Snapshot produit (OBLIGATOIRE)
        productId: {
          type: String,
          required: true,
        },
        productName: {
          type: String,
          required: true,
        },
        productImage: {
          type: String,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        price: {
          type: Number,
          required: true, // prix unitaire au moment du paiement
          min: 0,
        },
      },
    ],

    /* ======================================================
       💰 MONTANTS
    ====================================================== */
    amount: {
      type: Number,
      required: true, // Montant total payé
      min: 0,
    },

    netAmount: {
      type: Number,
      required: true, // Montant net vendeur
      min: 0,
    },

    fees: {
      type: Number,
      default: 0,
      min: 0,
    },

    fees_breakdown: {
      type: Object,
      default: {},
    },

    currency: {
      type: String,
      default: "XOF",
    },

    /* ======================================================
       🔗 IDENTIFIANTS CINETPAY
    ====================================================== */
    transaction_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
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

    /* ======================================================
       📦 STATUT TRANSACTION
    ====================================================== */
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "CANCELED"],
      default: "PENDING",
      index: true,
    },

    cinetpay_status: {
      type: String,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    /* ======================================================
       🔐 SÉCURITÉ ESCROW (IDEMPOTENCE)
    ====================================================== */
    sellerCredited: {
      type: Boolean,
      default: false,
    },

    /* ======================================================
       👤 INFORMATIONS CLIENT (SNAPSHOT)
    ====================================================== */
    customer: {
      email: { type: String },
      phone_number: { type: String },
      name: { type: String },
      address: {
        type: String,
        default: "Adresse inconnue",
      },
    },

    /* ======================================================
       🧾 LOGS / DEBUG
    ====================================================== */
    raw_response: {
      type: Object,
      default: null,
    },

    message: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

/* ======================================================
   🔹 INDEXES (PROD)
====================================================== */
PayinTransactionSchema.index({ seller: 1, createdAt: -1 });
PayinTransactionSchema.index({ clientId: 1, createdAt: -1 });
PayinTransactionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("PayinTransaction", PayinTransactionSchema);
