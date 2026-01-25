// =============================================
// models/PayoutTransaction.js
// ESCROW • MULTI-PROVIDER • PRODUCTION READY (FIXED)
// =============================================

const mongoose = require("mongoose");

const PayoutTransactionSchema = new mongoose.Schema(
  {
    /* ======================================================
       🔗 SELLER (SOURCE UNIQUE)
    ====================================================== */
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },

    /* ======================================================
       🏦 PROVIDER
    ====================================================== */
    provider: {
      type: String,
      enum: ["CINETPAY", "QOSPAY"],
      required: true,
      index: true,
    },

    /* ======================================================
       💰 MONTANTS
    ====================================================== */
    amount: {
      type: Number, // montant débité du wallet vendeur
      required: true,
      min: 0,
    },

    sent_amount: {
      type: Number, // montant réellement envoyé au vendeur
      required: true,
      min: 0,
    },

    fees: {
      type: Number,
      default: 0,
      min: 0,
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
      type: String, // ID interne (WD_xxx)
      required: true,
      unique: true,
      index: true,
    },

    provider_transaction_id: {
      type: String, // ID retourné par QOSPAY / CINETPAY
      default: null,
      index: true,
    },

    /* ======================================================
       🔔 WEBHOOK / IDEMPOTENCE
    ====================================================== */
    webhook_received: {
      type: Boolean,
      default: false,
      index: true,
    },

    webhook_received_at: {
      type: Date,
      default: null,
    },

    /* ======================================================
       📱 DESTINATAIRE
    ====================================================== */
    phone: {
      type: String,
      required: true,
      index: true,
    },

    operator: {
      type: String,
      enum: [
        // QOSPAY
        "TM",
        "TG",
        "CARD",

        // CINETPAY / futur
        "MTN",
        "MOOV",
        "ORANGE",
        "WAVE",
      ],
      required: true,
      index: true,
    },

    /* ======================================================
       📦 STATUT
    ====================================================== */
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "CANCELED"],
      default: "PENDING",
      index: true,
    },

    message: {
      type: String,
      default: null,
    },

    raw_response: {
      type: Object,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* ======================================================
   🔹 INDEXES STRATÉGIQUES
====================================================== */
PayoutTransactionSchema.index({ seller: 1, createdAt: -1 });
PayoutTransactionSchema.index({ status: 1, createdAt: -1 });
PayoutTransactionSchema.index({ provider: 1, createdAt: -1 });
PayoutTransactionSchema.index({ webhook_received: 1 });
PayoutTransactionSchema.index({ transaction_id: 1 });
PayoutTransactionSchema.index({ provider_transaction_id: 1 });

module.exports = mongoose.model(
  "PayoutTransaction",
  PayoutTransactionSchema
);
