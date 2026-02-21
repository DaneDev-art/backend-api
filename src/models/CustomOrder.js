const mongoose = require("mongoose");

const CustomOrderSchema = new mongoose.Schema(
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
     💬 CONVERSATION
     Lien vers la conversation entre vendeur et client
  ====================================================== */
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true,
  },

  /* ======================================================
     📦 PRODUITS
  ====================================================== */
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      productId: { type: String, required: true },
      productName: { type: String, required: true },
      productImage: { type: String },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 },
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

  currency: {
    type: String,
    default: "XOF",
  },

  /* ======================================================
     📦 STATUT DE LA COMMANDE
  ====================================================== */
  status: {
    type: String,
    enum: [
      "DRAFT",           // brouillon côté vendeur
      "SUBMITTED",       // envoyé au client
      "PAYMENT_PENDING", // client clique payer
      "PAID",            // paiement confirmé
      "CANCELLED",       // annulé
      "EXPIRED",         // expiré
    ],
    default: "SUBMITTED",
    index: true,
  },

  /* ======================================================
     🔗 LIEN VERS ORDER
     Une fois payé, Order créé
  ====================================================== */
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    index: true,
  },

  /* ======================================================
     ⏱ EXPIRATION
     Optionnel : expiré si non payé
  ====================================================== */
  expiresAt: {
    type: Date,
    index: true,
  },

},
{ timestamps: true }
);

/* ======================================================
   🔹 EXPORT
====================================================== */
module.exports = mongoose.model("CustomOrder", CustomOrderSchema);