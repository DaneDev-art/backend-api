const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
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
      unique: true, // 🔒 un seul parrain possible
    },

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

// 🔒 Anti auto-parrainage
referralSchema.index(
  { referrer: 1, referred: 1 },
  { unique: true }
);

module.exports = mongoose.model("Referral", referralSchema);
