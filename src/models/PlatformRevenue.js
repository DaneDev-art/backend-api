// src/models/PlatformRevenue.js
const mongoose = require("mongoose");

const PlatformRevenueSchema = new mongoose.Schema({
  payinTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "PayinTransaction", required: true },
  amount: { type: Number, required: true }, // montant que la plateforme a perçu comme commission
  currency: { type: String, required: true },
  description: { type: String, default: "Commission plateforme" },
}, { timestamps: true });

module.exports = mongoose.model("PlatformRevenue", PlatformRevenueSchema);
