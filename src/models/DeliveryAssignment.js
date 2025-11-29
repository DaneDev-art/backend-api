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
    clientCity: { type: String, trim: true, default: "" },
    clientZone: { type: String, trim: true, default: "" },

    // 🔹 Livreur
    deliveryManId: { type: String, required: true, trim: true },
    deliveryManName: { type: String, trim: true },
    
    // ➕ AJOUT IMPORTANT : Informations complètes du livreur
    deliveryManPhone: { type: String, trim: true, default: "" },
    deliveryManCity: { type: String, trim: true, default: "" },
    deliveryManZone: { type: String, trim: true, default: "" },
    deliveryManCountry: { type: String, trim: true, default: "" },
    deliveryManAvatar: { type: String, trim: true, default: "" },

    // 🔹 Statut
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "in_delivery",
        "client_received",
        "delivery_completed",
      ],
      default: "pending",
    },

    // 🔹 Date d’assignation
    assignedAt: { type: Date, default: Date.now },
  },

  {
    timestamps: true,
    collection: "delivery_assignments",
  }
);

module.exports = mongoose.model(
  "DeliveryAssignment",
  DeliveryAssignmentSchema
);
