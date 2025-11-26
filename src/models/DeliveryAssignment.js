const mongoose = require("mongoose");

const DeliveryAssignmentSchema = new mongoose.Schema(
  {
    // 🔹 Produit
    productId: { type: String, required: true, trim: true },
    productName: { type: String, trim: true },
    productImage: { type: String, trim: true },

    // 🔹 Vendeur
    sellerId: { type: String, required: true, trim: true },
    sellerName: { type: String, trim: true },

    // 🔹 Client
    clientId: { type: String, required: true, trim: true },
    clientName: { type: String, trim: true },
    clientPhone: { type: String, trim: true },
    clientAddress: { type: String, trim: true },

    // 🔹 Livreur
    deliveryManId: { type: String, required: true, trim: true },
    deliveryManName: { type: String, trim: true },

    // 🔹 Statut
    status: {
      type: String,
      enum: ["pending", "accepted", "delivered", "cancelled"],
      default: "pending",
    },

    // 🔹 Date d’assignation
    assignedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // ajoute createdAt + updatedAt automatiquement
    collection: "delivery_assignments", // nom propre dans Mongo
  }
);

module.exports = mongoose.model(
  "DeliveryAssignment",
  DeliveryAssignmentSchema
);
