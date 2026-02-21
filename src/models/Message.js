// ===============================
// models/Message.js
// ===============================
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // utilisateur qui envoie
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // conversation liée
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    // texte du message
    text: {
      type: String,
      default: "",
      trim: true,
    },

    // type message
    type: {
      type: String,
      enum: ["TEXT", "IMAGE", "AUDIO", "CUSTOM_ORDER"],
      default: "TEXT",
      index: true,
    },

    // lien vers CustomOrder
    customOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomOrder",
      index: true,
    },

    // image ou audio
    mediaUrl: {
      type: String,
      default: null,
    },

    // utilisateurs ayant lu
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // utile pour suppression soft future
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// index critique pour chargement rapide du chat
messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);