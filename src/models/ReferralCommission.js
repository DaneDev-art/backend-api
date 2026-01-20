const mongoose = require("mongoose");

const referralCommissionSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    referred: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
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

    // 🔹 Ajout SELLER_SALE_LEVEL2 pour le parrain du parrain
    commissionType: {
      type: String,
      enum: ["SELLER_SALE", "SELLER_SALE_LEVEL2", "USER_EARNING"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "AVAILABLE", "PAID", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    availableAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// 🔒 Anti-duplication : referrer + sourceId + sourceType
referralCommissionSchema.index(
  { referrer: 1, sourceId: 1, sourceType: 1 },
  { unique: true }
);

// 📊 Requêtes fréquentes : referrer + status + recent
referralCommissionSchema.index({
  referrer: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "ReferralCommission",
  referralCommissionSchema,
  "referral_commissions"
);
