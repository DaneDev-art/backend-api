const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    // 👤 Client
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🏪 Vendeur
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
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
      default: 0,
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
      default: "PENDING",
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 🔹 Virtual pour sellerName (utile pour Flutter)
OrderSchema.virtual("sellerName").get(function () {
  // si la référence est peuplée
  return this.seller?.name || "Vendeur inconnu";
});

// 🔹 Virtual pour netAmount (depuis PayinTransaction)
OrderSchema.virtual("netAmount").get(function () {
  return this.payinTransaction?.netAmount || 0;
});

module.exports = mongoose.model("Order", OrderSchema);
