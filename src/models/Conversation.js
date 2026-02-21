// models/Conversation.js
const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const conversationSchema = new Schema(
  {
    // participants (compatibilité chat)
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // IMPORTANT pour CustomOrder
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },

    lastMessage: {
      type: String,
      default: "",
    },

    lastDate: {
      type: Date,
      default: Date.now,
    },

    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },

    product: {
      productId: String,
      productName: String,
      productImage: String,
      productPrice: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);