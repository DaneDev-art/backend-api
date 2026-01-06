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
       🚚 LIVREUR (USER)
       — très important pour ton escrow workflow
    ====================================================== */
    /*delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },*/

    /* ======================================================
       📦 PRODUITS — SNAPSHOT IMMUTABLE
    ====================================================== */
    items: [
      {
        // 🔗 Référence produit (optionnelle pour enrichissement)
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },

        // 📸 SNAPSHOT = SOURCE UNIQUE DE VÉRITÉ FRONTEND
        productId: {
          type: String,
          required: true,
          index: true, // recherche rapide même sans populate
        },

        productName: {
          type: String,
          required: true,
        },

        productImage: {
          type: String,
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
      // ∑ produits + shippingFee
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
       💳 PAYIN — ESCROW LIÉ À CINETPAY
    ====================================================== */
    cinetpayTransactionId: {
      type: String,
      unique: true,
      sparse: true, // 🔥 évite conflits sur null
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
       📦 STATUT MÉTIER + ESCROW
       — Ton workflow :
       PAID → DELIVERED → COMPLETED
    ====================================================== */
    status: {
      type: String,
      enum: [
        "CREATED",
        "PAYMENT_PENDING",
        "PAID",       // toutes commandes frontend déjà payées
        "ASSIGNED",
        "SHIPPED",
        "DELIVERED",  // doit être atteint AVANT confirmation client
        "COMPLETED",  // client confirme → fonds libérés
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ======================================================
   🔹 VIRTUALS
====================================================== */

// 🏪 Nom vendeur (safe)
OrderSchema.virtual("sellerName").get(function () {
  if (this.seller && typeof this.seller === "object") {
    return this.seller.name || "Vendeur inconnu";
  }
  return "Vendeur inconnu";
});

/* ======================================================
   🔹 INDEXES (PERFORMANCE)
====================================================== */

OrderSchema.index({ client: 1, createdAt: -1 });
OrderSchema.index({ seller: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Order", OrderSchema);
