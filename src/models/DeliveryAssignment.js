const mongoose = require("mongoose");

const DeliveryAssignmentSchema = new mongoose.Schema({
  // 🔹 Produit
  productId: { type: String, required: true },
  productName: String,
  productImage: String,

  // 🔹 Vendeur
  sellerId: { type: String, required: true },
  sellerName: String,

  // 🔹 Client (celui qui soumet la commande au livreur)
  clientId: { type: String, required: true },
  clientName: String,
  clientPhone: String,
  clientAddress: String,

  // 🔹 Livreur
  deliveryManId: { type: String, required: true },
  deliveryManName: String,

  // 🔹 Statut
  status: { type: String, default: "pending" },

  assignedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DeliveryAssignment", DeliveryAssignmentSchema);
