// ===============================
// models/Message.js
// ===============================
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, required: true }, // expéditeur
    to: { type: String, required: true }, // destinataire
    content: { type: String }, // contenu texte du message
    productId: { type: String }, // optionnel : produit concerné par le chat
    unread: { type: [String], default: [] }, // liste des utilisateurs n'ayant pas lu le message
    type: { 
      type: String, 
      enum: ["text", "image", "audio"], 
      default: "text" 
    }, // type de message
    mediaUrl: { type: String }, // URL pour l'image ou l'audio
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

module.exports = mongoose.model("Message", messageSchema);
