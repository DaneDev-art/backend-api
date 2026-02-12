const mongoose = require("mongoose");

const SellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    phone: { type: String, required: true, trim: true },
    prefix: { type: String, required: true, trim: true },
    fullNumber: { type: String }, // ❌ PAS UNIQUE

    address: { type: String, default: "" },
    country: { type: String, default: "" },

    balance_locked: { type: Number, default: 0 },
    balance_available: { type: Number, default: 0 },

    role: { type: String, default: "seller" },

    // ==========================================
    // 🔐 ABONNEMENT ANNUEL VENDEUR (AJOUT)
    // ==========================================
    subscription: {
      status: {
        type: String,
        enum: ["FREE", "ACTIVE", "EXPIRED"],
        default: "FREE",
      },

      // Date de la première vente réussie
      firstSaleAt: { type: Date },

      // Période de référence (12 mois)
      startAt: { type: Date },
      endAt: { type: Date },

      // Dernier paiement abonnement
      lastPaymentAt: { type: Date },
    },
  },
  { timestamps: true }
);

SellerSchema.pre("save", function (next) {
  if (this.prefix && this.phone) {
    this.fullNumber = `${this.prefix}${this.phone}`;
  }
  next();
});

// ✅ SEUL index autorisé
SellerSchema.index({ email: 1 });

module.exports = mongoose.model("Seller", SellerSchema);
