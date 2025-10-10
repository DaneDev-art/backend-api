// ===============================
// models/Message.js
// ===============================
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, required: true }, // expéditeur
    to: { type: String, required: true }, // destinataire
    content: { type: String, required: true }, // contenu du message
    productId: { type: String }, // optionnel : produit concerné par le chat
    unread: { type: [String], default: [] }, // liste des utilisateurs n'ayant pas lu le message
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

module.exports = mongoose.model("Message", messageSchema);
