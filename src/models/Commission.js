const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
  
  // Type de commission
  type: { 
    type: String, 
    enum: ["MARKETPLACE_FEE", "SERVICE_FEE", "CINETPAY_FEE"], 
    required: true 
  },
  
  amount: { type: Number, required: true },     // Montant de la commission en FCFA
  percentage: { type: Number },                 // Pourcentage appliqué
  
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Commission", commissionSchema);
