// src/models/PayoutTransaction.js
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
       💳 PROVIDER
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
      type: Number,
      required: true, // montant débité du wallet vendeur
      min: 0,
    },

    sent_amount: {
      type: Number,
      default: 0, // montant réellement envoyé (après frais)
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
    },

    /* ======================================================
       🔗 IDENTIFIANTS TRANSACTION
    ====================================================== */
    transaction_id: {
      type: String,
      required: true, // ID interne (client_transaction_id)
      unique: true,
      index: true,
    },

    provider_transaction_id: {
      type: String,
      default: null, // ID retourné par CINETPAY / QOSPAY
      index: true,
    },

    /* ======================================================
       🔔 WEBHOOK (IDEMPOTENCE)
    ====================================================== */
    webhook_received: {
      type: Boolean,
      default: false, // empêche double traitement webhook
      index: true,
    },

    webhook_received_at: {
      type: Date,
      default: null,
    },

    /* ======================================================
       📱 DESTINATAIRE
    ====================================================== */
    prefix: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    operator: {
      type: String,
      enum: ["TM", "TG"],
      required: true,
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
      default: null, // payload provider / webhook
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

module.exports = mongoose.model(
  "PayoutTransaction",
  PayoutTransactionSchema
);
