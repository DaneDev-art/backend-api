// routes/messages.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const Message = require("../models/Message");
const User = require("../models/user.model");

// =============================================
// 🔹 GET tous les messages entre deux utilisateurs
// =============================================
router.get("/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (!userId || !currentUserId) {
      return res.status(400).json({ message: "IDs utilisateur manquants" });
    }

    const messages = await Message.find({
      $and: [
        { from: { $ne: null } },
        { to: { $ne: null } },
        {
          $or: [
            { from: currentUserId, to: userId },
            { from: userId, to: currentUserId },
          ],
        },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("❌ Erreur GET /messages/:userId :", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// =============================================
// 🔹 GET toutes les conversations d’un utilisateur
// =============================================
router.get("/conversations/:userId", auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    if (!currentUserId) {
      return res.status(400).json({ message: "ID utilisateur manquant" });
    }

    // Récupérer tous les messages de cet utilisateur, triés par date décroissante
    const messages = await Message.find({
      $or: [{ from: currentUserId }, { to: currentUserId }],
    }).sort({ createdAt: -1 });

    const conversationsMap = new Map();

    for (const msg of messages) {
      const otherUserId = msg.from.toString() === currentUserId ? msg.to.toString() : msg.from.toString();

      if (!conversationsMap.has(otherUserId)) {
        // Récupérer infos de l'autre utilisateur
        const otherUser = await User.findById(otherUserId).select("name username fullName shopName avatar isOnline");

        conversationsMap.set(otherUserId, {
          otherUserId,
          otherUser: otherUser ? {
            name: otherUser.name || otherUser.fullName || otherUser.username || otherUser.shopName || "Utilisateur",
            avatar: otherUser.avatar || "",
            isOnline: otherUser.isOnline || false,
          } : { name: "Utilisateur", avatar: "", isOnline: false },
          lastMessage: msg.text || "",
          lastDate: msg.createdAt,
          productId: msg.productId || "",
          productName: msg.productName || "",
          productImage: msg.productImage || "",
          productPrice: msg.productPrice || null,
        });
      }
    }

    res.json([...conversationsMap.values()]);
  } catch (err) {
    console.error("❌ Erreur GET /messages/conversations/:userId :", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
