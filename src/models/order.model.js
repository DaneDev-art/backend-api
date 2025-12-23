const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    // 👤 Client
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🏪 Vendeur
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller", // ✅ référence correcte
      required: true,
      index: true,
    },

    // 📦 Produits commandés
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],

    // 💰 Montants
    totalAmount: {
      type: Number,
      required: true,
    },

    // 💰 Montant net vendeur
    netAmount: {
      type: Number,
      required: true,
    },

    // 💰 Frais de livraison
    shippingFee: {
      type: Number,
      default: 0,
    },

    // 💳 Identifiant transaction CinetPay
    cinetpayTransactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // 💳 Transaction CinetPay
    payinTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayinTransaction",
    },

    // 🚚 Livraison
    deliveryAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryAssignment",
    },

    // 📦 Statut commande
    status: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "ASSIGNED",
        "SHIPPED",
        "DELIVERED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "PAID",
      index: true,
    },

    // ✅ Confirmation client
    isConfirmedByClient: {
      type: Boolean,
      default: false,
    },

    confirmedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/* ======================================================
   🔹 VIRTUALS
====================================================== */

// Nom vendeur (sécurité si non peuplé)
OrderSchema.virtual("sellerName").get(function () {
  if (this.seller && typeof this.seller === "object") {
    return this.seller.name || "Vendeur inconnu";
  }
  return "Vendeur inconnu";
});

/* ======================================================
   🔹 INDEXES (performance prod)
====================================================== */
OrderSchema.index({ client: 1, createdAt: -1 });
OrderSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model("Order", OrderSchema);
