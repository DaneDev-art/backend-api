const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    // 🔹 Le parrain (TOUJOURS un User)
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🔹 Le filleul (TOUJOURS un User, même si c'est un seller)
    referred: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // 🔒 un seul parrain possible par utilisateur
    },

    // 🔹 Rôle du filleul (informatif)
    referredRole: {
      type: String,
      enum: ["buyer", "seller", "delivery"],
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "BLOCKED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

// 🔒 Anti auto-parrainage (referrer !== referred)
referralSchema.pre("validate", function (next) {
  if (this.referrer.toString() === this.referred.toString()) {
    return next(new Error("Un utilisateur ne peut pas se parrainer lui-même"));
  }
  next();
});

// 🔒 Anti doublon logique (sécurité supplémentaire)
referralSchema.index(
  { referrer: 1, referred: 1 },
  { unique: true }
);

module.exports = mongoose.model("Referral", referralSchema);
