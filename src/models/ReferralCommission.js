const mongoose = require("mongoose");

// ==========================================
// 🔹 Schéma des commissions de parrainage
// ==========================================
const referralCommissionSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // index pour requêtes rapides par parrain
    },

    referred: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true, // index pour rechercher par source (order, gain...)
      // Exemple: orderId, deliveryId, payoutId...
    },

    sourceType: {
      type: String,
      enum: ["ORDER", "DELIVERY", "USER_GAIN"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    percentage: {
      type: Number,
      required: true,
    },

    commissionType: {
      type: String,
      enum: ["SELLER_SALE", "USER_EARNING"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "AVAILABLE", "PAID", "CANCELLED"],
      default: "PENDING",
      index: true, // index pour recherches rapides sur le statut
    },

    availableAt: {
      type: Date, // date à partir de laquelle la commission peut être libérée
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ==========================================
// 🔍 Index composé pour éviter doublons
// referrer + sourceId + sourceType
// ==========================================
referralCommissionSchema.index(
  { referrer: 1, sourceId: 1, sourceType: 1 },
  { unique: true }
);

// ==========================================
// ✅ Export
// ==========================================
module.exports = mongoose.model(
  "ReferralCommission",
  referralCommissionSchema,
  "referral_commissions"
);
