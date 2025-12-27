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
       📦 PANIER (SNAPSHOT SÉCURISÉ & IMMUTABLE)
       👉 AUCUNE dépendance frontend
    ====================================================== */
    items: [
      {
        // 🔗 Référence produit Mongo (pour populate, optionnelle)
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          index: true,
        },

        // 📸 SNAPSHOT PRODUIT (SOURCE DE VÉRITÉ)
        productId: {
          type: String, // ObjectId stringifié
          required: true,
          index: true,
        },

        productName: {
          type: String,
          required: true,
        },

        productImage: {
          type: String,
          default: null,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        price: {
          type: Number, // prix unitaire figé au moment du paiement
          required: true,
          min: 0,
        },
      },
    ],

    /* ======================================================
       💰 MONTANTS
    ====================================================== */
    amount: {
      type: Number,
      required: true, // total payé par le client
      min: 0,
    },

    netAmount: {
      type: Number,
      required: true, // montant net vendeur
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
      default: null,
    },

    payment_method: {
      type: String,
      default: null,
    },

    api_response_id: {
      type: String,
      default: null,
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
       🔐 SÉCURITÉ ESCROW / IDEMPOTENCE
    ====================================================== */
    sellerCredited: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* ======================================================
       👤 INFORMATIONS CLIENT (SNAPSHOT)
    ====================================================== */
    customer: {
      email: { type: String, default: null },
      phone_number: { type: String, default: null },
      name: { type: String, default: "client" },
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
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* ======================================================
   🔹 INDEXES (PRODUCTION)
====================================================== */
PayinTransactionSchema.index({ seller: 1, createdAt: -1 });
PayinTransactionSchema.index({ clientId: 1, createdAt: -1 });
PayinTransactionSchema.index({ status: 1, createdAt: -1 });
PayinTransactionSchema.index({ transaction_id: 1 });
PayinTransactionSchema.index({ "items.productId": 1 });

module.exports = mongoose.model("PayinTransaction", PayinTransactionSchema);
