// ===============================
// routes/messageRoutes.js
// ===============================
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// ============================================
// ⚙️ Configuration Socket.IO (injection depuis server.js)
// ============================================
let io;
function initSocket(socketInstance) {
  io = socketInstance;
}

// ============================================
// 🔹 Envoyer / sauvegarder un message
// ============================================
router.post("/", async (req, res) => {
  try {
    const { senderId, receiverId, message, productId } = req.body;

    if (!senderId || !receiverId || !message) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    const newMessage = await Message.create({
      from: senderId,
      to: receiverId,
      content: message,
      productId,
      unread: [receiverId],
    });

    // 🔴 Émettre l’événement Socket.IO (si socket actif)
    if (io) {
      io.to(receiverId).emit("message:received", newMessage);
      io.to(senderId).emit("message:sent", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("❌ Erreur POST /messages :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 Récupérer toutes les conversations d’un user
// ============================================
// ⚠️ Doit venir avant /:user1/:user2
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
    }).sort({ createdAt: -1 });

    const convMap = new Map();

    messages.forEach((msg) => {
      const otherUserId = msg.from === userId ? msg.to : msg.from;
      const key = `${otherUserId}_${msg.productId || "no_product"}`;

      if (!convMap.has(key)) {
        convMap.set(key, {
          otherUserId,
          productId: msg.productId,
          lastMessage: msg.content,
          lastDate: msg.createdAt,
          unread: msg.unread?.includes(userId),
        });
      }
    });

    res.json(Array.from(convMap.values()));
  } catch (err) {
    console.error("❌ Erreur GET /conversations :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 Récupérer tous les messages entre 2 utilisateurs
// ============================================
router.get("/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const messages = await Message.find({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("❌ Erreur GET /messages :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 Marquer les messages comme lus
// ============================================
router.put("/markAsRead", async (req, res) => {
  try {
    const { userId, otherUserId, productId } = req.body;

    if (!userId || !otherUserId) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    await Message.updateMany(
      {
        from: otherUserId,
        to: userId,
        productId: productId || null,
        unread: userId,
      },
      { $pull: { unread: userId } }
    );

    // 🔴 Émission socket (notification de lecture)
    if (io) {
      io.to(otherUserId).emit("message:read", {
        readerId: userId,
        otherUserId,
        productId,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur PUT /markAsRead :", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, initSocket };
