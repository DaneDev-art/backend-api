// models/Conversation.js
const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const conversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: String,
      default: "",
    },
    lastDate: {
      type: Date,
      default: Date.now,
    },
    unreadCounts: {
      type: Map, // clé = userId, valeur = nombre de messages non lus
      of: Number,
      default: {},
    },
    product: {
      productId: {
        type: String,
      },
      productName: {
        type: String,
      },
      productImage: {
        type: String,
      },
      productPrice: {
        type: Number,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);