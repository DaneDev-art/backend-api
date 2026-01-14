//src/models/Seller
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
    fullNumber: { type: String }, // ❌ PLUS UNIQUE

    address: { type: String, default: "" },
    country: { type: String, default: "" },
    shopDescription: { type: String, default: "" },
    logoUrl: { type: String, default: "" },

    cinetpay_contact_added: { type: Boolean, default: false },
    cinetpay_contact_id: { type: String, default: null },
    cinetpay_contact_meta: { type: Object, default: {} },

    payout_method: {
      type: String,
      enum: ["MOBILE_MONEY", "BANK"],
      default: "MOBILE_MONEY",
    },
    payout_account: { type: String, default: "" },

    balance_locked: { type: Number, default: 0 },
    balance_available: { type: Number, default: 0 },

    role: { type: String, default: "seller" },
  },
  { timestamps: true }
);

// auto fullNumber
SellerSchema.pre("save", function (next) {
  if (this.prefix && this.phone) {
    this.fullNumber = `${this.prefix}${this.phone}`;
  }
  next();
});

SellerSchema.index({ email: 1 });
