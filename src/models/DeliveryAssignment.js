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
    clientCity: { type: String, trim: true, default: "" },   // <-- Nouveau champ
    clientZone: { type: String, trim: true, default: "" },   // <-- Nouveau champ

    // 🔹 Livreur
    deliveryManId: { type: String, required: true, trim: true },
    deliveryManName: { type: String, trim: true },

    // 🔹 Statut avec workflow étendu
    status: {
      type: String,
      enum: [
        "pending",           // en attente
        "accepted",          // livreur a accepté
        "in_delivery",       // en cours de livraison
        "client_received",   // client a confirmé réception
        "delivery_completed" // livreur a finalisé
      ],
      default: "pending",
    },

    // 🔹 Date d’assignation
    assignedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // createdAt + updatedAt
    collection: "delivery_assignments",
  }
);

module.exports = mongoose.model(
  "DeliveryAssignment",
  DeliveryAssignmentSchema
);
