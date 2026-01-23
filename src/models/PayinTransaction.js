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

    operator: {
      type: String,
      enum: ["TM", "TG"],
      default: null,
      index: true,
    },

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
      required: true, // montant net vendeur (bloqué en ESCROW)
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
      type: String, // ID interne (transref / UUID)
      required: true,
      unique: true,
      index: true,
    },

    provider_transaction_id: {
      type: String, // ID renvoyé par le provider (si dispo)
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

    // 🔹 spécifique CinetPay (conservé pour compatibilité)
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
       💡 Fonds bloqués tant que client non confirmé
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
   🔹 INDEXES (PRODUCTION)
====================================================== */
PayinTransactionSchema.index({ order: 1 });
PayinTransactionSchema.index({ seller: 1, createdAt: -1 });
PayinTransactionSchema.index({ client: 1, createdAt: -1 });
PayinTransactionSchema.index({ provider: 1, status: 1, createdAt: -1 });
PayinTransactionSchema.index({ transaction_id: 1 });
PayinTransactionSchema.index({ provider_transaction_id: 1 });

module.exports = mongoose.model("PayinTransaction", PayinTransactionSchema);
