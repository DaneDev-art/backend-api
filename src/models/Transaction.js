const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["PAYIN", "PAYOUT"], required: true },
  
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // PayIn
  
  amount: { type: Number, required: true },
  currency: { type: String, default: "XOF" },

  // Frais de la transaction
  fees: { type: Number, default: 0 },       // montant en FCFA
  feesPercent: { type: Number, default: 0 }, // pourcentage appliqué
  netAmount: { type: Number, default: 0 }, // montant après frais

  // Informations CinetPay
  transactionId: { type: String },           // ID CinetPay PayIn ou PayOut
  clientTransactionId: { type: String },     // ID généré côté backend (PayOut)
  paymentToken: { type: String },           // token temporaire PayIn si nécessaire
  paymentUrl: { type: String },             // URL de paiement pour PayIn

  status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
  description: { type: String },

  // Pour les callbacks et logs
  responseData: { type: Object },
  callbackAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", transactionSchema);
