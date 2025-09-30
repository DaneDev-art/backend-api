const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const Message = require("../models/Message");

// 🔹 GET messages entre deux utilisateurs
router.get("/:userId", auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: userId },
        { from: userId, to: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
