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
       🏪 DELIVERY
    ====================================================== */
    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ======================================================
       📦 PRODUITS (SNAPSHOT IMMUTABLE)
    ====================================================== */
    items: [
      {
        // 🔗 Référence produit (optionnelle)
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },

        // 📸 Snapshot sécurisé
        productId: {
          type: String,
          required: true,
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
      // produits + livraison
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
      // commission marketplace (optionnelle)
      type: Number,
      default: 0,
      min: 0,
    },

    netAmount: {
      // montant vendeur (total - platformFee)
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "XOF",
    },

    /* ======================================================
       💳 PAIEMENT (PAYIN)
    ====================================================== */
    cinetpayTransactionId: {
      type: String,
      unique: true,
      sparse: true, // 🔥 CRUCIAL
      index: true,
    },

    payinTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayinTransaction",
    },

    /* ======================================================
       🚚 LIVRAISON
    ====================================================== */
    deliveryAddress: {
      type: String,
      default: "Adresse non fournie",
    },

    deliveryAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryAssignment",
    },

    /* ======================================================
       📦 STATUT (ESCROW)
    ====================================================== */
    status: {
      type: String,
      enum: [
        "CREATED",          // commande créée
        "PAYMENT_PENDING", // redirection CinetPay
        "PAID",             // PayIn OK → fonds BLOQUÉS
        "ASSIGNED",
        "SHIPPED",
        "DELIVERED",
        "COMPLETED",        // client confirme → fonds LIBÉRÉS
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
