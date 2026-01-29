// =============================================
// models/PayinTransaction.js
// ESCROW • MULTI-PROVIDER • PRODUCTION READY
// CINETPAY + QOSPAY (REDIRECT SAFE)
// =============================================

const mongoose = require("mongoose");

const PayinTransactionSchema = new mongoose.Schema(
  {
    /* ======================================================
       🔗 COMMANDE (SOURCE UNIQUE DE VÉRITÉ)
    ====================================================== */
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    /* ======================================================
       🧍‍♂️ RÉFÉRENCES
    ====================================================== */
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ======================================================
       🏦 FOURNISSEUR DE PAIEMENT
    ====================================================== */
    provider: {
      type: String,
      enum: ["CINETPAY", "QOSPAY"],
      required: true,
      index: true,
    },

    /* ======================================================
       📱 OPÉRATEUR / CANAL
       - QOSPAY : connu avant paiement
       - CINETPAY : choisi après redirection
    ====================================================== */
    operator: {
      type: String,
      enum: [
        // QOSPAY
        "TM",
        "TG",
        "CARD",

        // CINETPAY (réel)
        "MTN",
        "MOOV",
        "ORANGE",
        "WAVE",

        // 🔧 TECHNIQUE (CINETPAY REDIRECT)
        "CINETPAY_REDIRECT",
      ],
      required: true,
      index: true,
    },

    /* ======================================================
       💰 MONTANTS
    ====================================================== */
    amount: {
      type: Number, // total payé par le client
      required: true,
      min: 0,
    },

    netAmount: {
      type: Number, // montant net vendeur (ESCROW)
      required: true,
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
      index: true,
    },

    /* ======================================================
       🔗 IDENTIFIANTS TRANSACTION
    ====================================================== */
    transaction_id: {
      type: String, // ID interne
      required: true,
      unique: true,
      index: true,
    },

    provider_transaction_id: {
      type: String, // ID QOSPAY / CINETPAY
      default: null,
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
       🔐 ESCROW
    ====================================================== */
    sellerCredited: {
      type: Boolean,
      default: false,
      index: true,
    },

    creditedAt: {
      type: Date,
      default: null,
    },

    /* ======================================================
       👤 SNAPSHOT CLIENT (AUDIT)
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
   🔹 INDEXES
====================================================== */
PayinTransactionSchema.index({ order: 1 });
PayinTransactionSchema.index({ seller: 1, createdAt: -1 });
PayinTransactionSchema.index({ client: 1, createdAt: -1 });
PayinTransactionSchema.index({ provider: 1, status: 1, createdAt: -1 });
PayinTransactionSchema.index({ transaction_id: 1 });
PayinTransactionSchema.index({ provider_transaction_id: 1 });

module.exports = mongoose.model(
  "PayinTransaction",
  PayinTransactionSchema
);
