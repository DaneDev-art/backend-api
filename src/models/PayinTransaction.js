// src/models/PayinTransaction.js
const mongoose = require("mongoose");

const PayinTransactionSchema = new mongoose.Schema({
  // 🧍‍♂️ Références
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // 💰 Montants
  amount: { type: Number, required: true }, // Montant total payé
  netAmount: { type: Number, required: true }, // Montant net reversé au vendeur
  fees: { type: Number, default: 0 },
  fees_breakdown: { type: Object, default: {} },
  currency: { type: String, default: "XOF" },

  // 🔗 Identifiants de transaction
  transaction_id: { type: String, required: true }, // ID généré côté CinetPay
  payment_token: { type: String }, // Token unique renvoyé par CinetPay
  payment_method: { type: String }, // Mobile Money, Carte, etc.
  api_response_id: { type: String }, // ID de réponse CinetPay (facultatif)

  // 📦 Statut
  status: {
    type: String,
    enum: ["PENDING", "SUCCESS", "FAILED", "CANCELED"],
    default: "PENDING"
  },
  cinetpay_status: { type: String, default: null }, // statut brut côté CinetPay
  verifiedAt: { type: Date, default: null },

  // 👤 Informations client
  customer: { 
    email: { type: String },
    phone_number: { type: String },
    name: { type: String },
  },

  // 🧾 Métadonnées et logs
  raw_response: { type: Object, default: null }, // réponse brute de CinetPay
  message: { type: String }, // message de confirmation ou erreur CinetPay
}, { timestamps: true });

module.exports = mongoose.model("PayinTransaction", PayinTransactionSchema);
