// ===============================
// routes/messageRoutes.js (Version PRO)
// ===============================
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const Product = require("../models/Product");

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
// 🔹 Récupérer toutes les conversations d’un user (avec infos vendeur + produit)
// ============================================
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "Champs manquant: userId" });

    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
    }).sort({ createdAt: -1 });

    const convMap = new Map();

    // 🧩 Regrouper par (autre utilisateur + produit)
    for (const msg of messages) {
      if (!msg.from || !msg.to) continue;
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
    }

    const conversations = Array.from(convMap.values());

    // 🧠 Charger les infos utilisateurs
    const userIds = conversations.map((c) => c.otherUserId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name username fullName shopName nom email avatar profileImage isOnline");

    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    // 🧩 Charger les produits associés
    const productIds = conversations
      .map((c) => c.productId)
      .filter((id) => id && id !== "no_product");

    let products = [];
    if (productIds.length > 0) {
      products = await Product.find({ _id: { $in: productIds } })
        .select("name title price images");
    }

    const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

    // 🔗 Enrichir les conversations
    const enrichedConversations = conversations.map((c) => {
      const product = productMap[c.productId];
      return {
        ...c,
        otherUser:
          userMap[c.otherUserId] || {
            name: "Utilisateur inconnu",
            avatar: "",
            isOnline: false,
          },
        productName: product?.name || product?.title || null,
        productPrice: product?.price || null,
        productImage: product?.images?.[0] || null,
      };
    });

    res.json(enrichedConversations);
  } catch (err) {
    console.error("❌ Erreur GET /conversations :", err);
    res.status(500).json({
      error: "Erreur serveur lors de la récupération des conversations",
      details: err.message,
    });
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
