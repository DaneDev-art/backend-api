const mongoose = require("mongoose");

// ==========================================
// 🔹 Schéma des transactions du wallet
// ==========================================
const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // index pour recherches rapides par utilisateur
    },

    amount: {
      type: Number,
      required: true,
    },

    balanceBefore: {
      type: Number,
      required: true,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "REFERRAL_COMMISSION", // commission parrainage
        "SALE_INCOME",         // vente du seller
        "DELIVERY_INCOME",     // revenu livreur
        "WITHDRAWAL",          // retrait
        "COMMISSION_TRANSFER", // transfert de commission vers solde disponible
      ],
      required: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId, // orderId, deliveryId, referralCommissionId
    },

    referenceType: {
      type: String,
      enum: ["ORDER", "DELIVERY", "REFERRAL", "TRANSFER"],
    },

    meta: {
      type: Object, // stocke des informations additionnelles
      default: {},
    },
  },
  { timestamps: true }
);

// ==========================================
// 🔍 Indexs pour optimisation
// ==========================================
walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ referenceId: 1, referenceType: 1 });

// ==========================================
// ✅ Export
// ==========================================
module.exports = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema,
  "wallet_transactions"
);
