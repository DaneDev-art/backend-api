// src/models/PayoutTransaction.js
const mongoose = require("mongoose");

const PayoutTransactionSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },

  // 💰 Détails du paiement
  amount: { type: Number, required: true },
  currency: { type: String, default: "XOF" },
  client_transaction_id: { type: String, required: true }, // ID interne (UUID)
  cinetpay_transaction_id: { type: String }, // ID renvoyé par CinetPay après succès
  sent_amount: { type: Number, default: 0 },
  fees: { type: Number, default: 0 },

  // 📱 Informations du destinataire
  prefix: { type: String, required: true }, // ex: +228
  phone: { type: String, required: true },

  // 📦 Statut et métadonnées
  status: {
    type: String,
    enum: ["PENDING", "SUCCESS", "FAILED", "CANCELED"],
    default: "PENDING"
  },
  message: { type: String }, // message explicatif (succès, erreur API, etc.)
  raw_response: { type: Object, default: null }, // réponse brute de CinetPay
}, { timestamps: true });

module.exports = mongoose.model("PayoutTransaction", PayoutTransactionSchema);
