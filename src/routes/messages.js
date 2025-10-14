const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const Message = require("../models/Message");

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

    // 🧹 Protection : ignorer les messages sans from/to
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

module.exports = router;
