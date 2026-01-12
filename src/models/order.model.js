const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    /* ======================================================
       👤 CLIENT
    ====================================================== */
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ======================================================
       🏪 VENDEUR
    ====================================================== */
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },

    /* ======================================================
       📦 PRODUITS — SNAPSHOT IMMUTABLE
       👉 utilisé par le frontend (client + vendeur)
    ====================================================== */
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },

        // 🔐 Snapshot garanti
        productId: {
          type: String,
          required: true,
          index: true,
        },

        productName: {
          type: String,
          required: true,
        },

        productImage: {
          type: String, // URL ABSOLUE
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    /* ======================================================
       💰 MONTANTS
    ====================================================== */
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    shippingFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "XOF",
      index: true,
    },

    /* ======================================================
       💳 PAYIN — ESCROW
    ====================================================== */
    cinetpayTransactionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    payinTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayinTransaction",
      index: true,
    },

    /* ======================================================
       📍 LIVRAISON
    ====================================================== */
    deliveryAddress: {
      type: String,
      default: "Adresse non fournie",
    },

    deliveryAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryAssignment",
      index: true,
    },

    /* ======================================================
       📦 STATUT MÉTIER
    ====================================================== */
    status: {
      type: String,
      enum: [
        "CREATED",
        "PAYMENT_PENDING",
        "PAID",
        "ASSIGNED",
        "SHIPPED",
        "DELIVERED",
        "COMPLETED",
        "DISPUTED",
        "CANCELLED",
      ],
      default: "CREATED",
      index: true,
    },

    /* ======================================================
       🔐 ESCROW
    ====================================================== */
    escrow: {
      isLocked: {
        type: Boolean,
        default: true,
        index: true,
      },

      releasedAt: {
        type: Date,
      },
    },

    /* ======================================================
       ✅ CONFIRMATION CLIENT
    ====================================================== */
    isConfirmedByClient: {
      type: Boolean,
      default: false,
      index: true,
    },

    confirmedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // ⬅ createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ======================================================
   🔹 VIRTUALS — FRONTEND FRIENDLY
====================================================== */

/**
 * 👤 Nom du client (safe)
 */
OrderSchema.virtual("clientName").get(function () {
  if (this.client && typeof this.client === "object") {
    return (
      this.client.fullName ||
      this.client.name ||
      this.client.email ||
      "Client inconnu"
    );
  }
  return "Client inconnu";
});

/**
 * 🏪 Nom vendeur (safe)
 */
OrderSchema.virtual("sellerName").get(function () {
  if (this.seller && typeof this.seller === "object") {
    return this.seller.name || "Vendeur inconnu";
  }
  return "Vendeur inconnu";
});

/**
 * 📅 Date lisible pour frontend
 */
OrderSchema.virtual("orderDate").get(function () {
  return this.createdAt;
});

/**
 * 🖼️ Image principale de la commande
 * 👉 première image produit
 */
OrderSchema.virtual("orderImage").get(function () {
  if (this.items && this.items.length > 0) {
    return this.items[0].productImage || null;
  }
  return null;
});

/* ======================================================
   🔹 INDEXES (PERFORMANCE)
====================================================== */

OrderSchema.index({ client: 1, createdAt: -1 });
OrderSchema.index({ seller: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Order", OrderSchema);
