// ==========================================
// src/models/AiConversation.js
// Modèle Mongoose pour stocker les conversations IA
// ==========================================

const mongoose = require("mongoose");

const AiConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["chat", "stt", "tts", "vision"],
      default: "chat",
    },
    userMessage: {
      type: String,
      required: true,
    },
    aiResponse: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed, // pour stocker des infos optionnelles (ex: durée audio, langage TTS, etc.)
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

module.exports = mongoose.model("AiConversation", AiConversationSchema);
