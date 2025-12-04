const mongoose = require("mongoose");

const DeliveryAssignmentSchema = new mongoose.Schema(
  {
    // ===================================================================
    // 🔹 PRODUIT
    // ===================================================================
    productId: { type: String, required: true, trim: true },
    productName: { type: String, trim: true },
    productImage: { type: String, trim: true },

    // Quantité envoyée au livreur (NOUVEAU)
    quantity: { type: Number, default: 1 },

    // Prix total correspondant à la quantité envoyée (optionnel)
    totalPrice: { type: Number, default: 0 },

    // ===================================================================
    // 🔹 VENDEUR
    // ===================================================================
    sellerId: { type: String, required: true, trim: true },
    sellerName: { type: String, trim: true },
    sellerPhone: { type: String, trim: true, default: "" },
    sellerAddress: { type: String, trim: true, default: "" },
    sellerCity: { type: String, trim: true, default: "" },
    sellerZone: { type: String, trim: true, default: "" },
    sellerCountry: { type: String, trim: true, default: "" },

    // ===================================================================
    // 🔹 CLIENT
    // ===================================================================
    clientId: { type: String, required: true, trim: true },
    clientName: { type: String, trim: true },
    clientPhone: { type: String, trim: true },
    clientAddress: { type: String, trim: true },
    clientCity: { type: String, trim: true, default: "" },
    clientZone: { type: String, trim: true, default: "" },
    clientCountry: { type: String, trim: true, default: "" },

    // ===================================================================
    // 🔹 LIVREUR
    // ===================================================================
    deliveryManId: { type: String, required: true, trim: true },
    deliveryManName: { type: String, trim: true },

    // ➕ Infos complètes (déjà présentes + normalisées)
    deliveryManPhone: { type: String, trim: true, default: "" },
    deliveryManCity: { type: String, trim: true, default: "" },
    deliveryManZone: { type: String, trim: true, default: "" },
    deliveryManCountry: { type: String, trim: true, default: "" },
    deliveryManAvatar: { type: String, trim: true, default: "" },

    // ===================================================================
    // 🔹 STATUT
    // ===================================================================
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

    // ===================================================================
    // 🔹 DATE D'ASSIGNATION
    // ===================================================================
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
