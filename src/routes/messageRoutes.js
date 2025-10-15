// ===============================
// routes/messageRoutes.js (Version Debug/Améliorée)
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

    // Vérifications détaillées
    if (!senderId) return res.status(400).json({ error: "Champs manquant: senderId" });
    if (!receiverId) return res.status(400).json({ error: "Champs manquant: receiverId" });
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Champs manquant ou invalide: message" });
    }

    const newMessage = await Message.create({
      from: senderId,
      to: receiverId,
      content: message,
      productId: productId && productId !== "" ? productId : null,
      unread: [receiverId],
    });

    // 🔴 Émettre l’événement Socket.IO
    if (io) {
      io.to(receiverId).emit("message:received", newMessage);
      io.to(senderId).emit("message:sent", newMessage);
    }

    console.log(`✅ Nouveau message créé: ${newMessage._id} de ${senderId} à ${receiverId}`);
    res.status(201).json(newMessage);

  } catch (err) {
    console.error("❌ Erreur POST /messages :", err);
    res.status(500).json({ error: "Erreur serveur lors de l'envoi du message", details: err.message });
  }
});

// ============================================
// 🔹 Récupérer toutes les conversations d’un user
// ============================================
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) return res.status(400).json({ error: "Champs manquant: userId" });

    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
    }).sort({ createdAt: -1 });

    const convMap = new Map();

    messages.forEach((msg) => {
      if (!msg.from || !msg.to) return;
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
    console.error("❌ Erreur GET /conversations :", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des conversations", details: err.message });
  }
});

// ============================================
// 🔹 Récupérer tous les messages entre 2 utilisateurs
// ============================================
router.get("/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    if (!user1 || !user2) return res.status(400).json({ error: "Champs manquants: user1 et user2" });

    const messages = await Message.find({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("❌ Erreur GET /messages :", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des messages", details: err.message });
  }
});

// ============================================
// 🔹 Marquer les messages comme lus
// ============================================
router.put("/markAsRead", async (req, res) => {
  try {
    const { userId, otherUserId, productId } = req.body;

    if (!userId) return res.status(400).json({ error: "Champs manquant: userId" });
    if (!otherUserId) return res.status(400).json({ error: "Champs manquant: otherUserId" });

    const result = await Message.updateMany(
      { from: otherUserId, to: userId, productId: productId || null, unread: userId },
      { $pull: { unread: userId } }
    );

    if (io) {
      io.to(otherUserId).emit("message:read", { readerId: userId, otherUserId, productId });
    }

    console.log(`✅ Messages marqués comme lus: ${result.modifiedCount}`);
    res.json({ success: true, modifiedCount: result.modifiedCount });

  } catch (err) {
    console.error("❌ Erreur PUT /markAsRead :", err);
    res.status(500).json({ error: "Erreur serveur lors du marquage des messages", details: err.message });
  }
});

// ============================================
// ✅ Export du router et initSocket
// ============================================
module.exports = { router, initSocket };
