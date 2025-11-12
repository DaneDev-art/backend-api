// ===============================
// routes/messageRoutes.js (Version PRO compatible User & Seller)
// ===============================
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Message = require("../models/Message");
const User = require("../models/user.model");
const Seller = require("../models/Seller");
const Product = require("../models/Product");

// ============================================
// ⚙️ Configuration Socket.IO (injection depuis server.js)
// ============================================
let io;
function initSocket(socketInstance) {
  io = socketInstance;
}

// ============================================
// 🔹 Configuration Multer pour upload fichiers
// ============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./uploads/messages";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ============================================
// 🔹 Envoyer un message texte
// ============================================
router.post("/", async (req, res) => {
  try {
    const { senderId, receiverId, message, productId } = req.body;
    if (!senderId || !receiverId || !message?.trim())
      return res.status(400).json({ error: "Champs manquants ou invalides" });

    const newMessage = await Message.create({
      from: senderId,
      to: receiverId,
      content: message,
      type: "text",
      productId: productId || null,
      unread: [receiverId],
    });

    if (io) {
      io.to(receiverId).emit("message:received", newMessage);
      io.to(senderId).emit("message:sent", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Erreur POST /messages :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 Envoyer un message media (image/audio)
// ============================================
router.post("/media", upload.single("file"), async (req, res) => {
  try {
    const { senderId, receiverId, productId, type } = req.body;
    if (!senderId || !receiverId || !req.file || !["image", "audio"].includes(type))
      return res.status(400).json({ error: "Champs manquants ou type invalide" });

    const mediaUrl = `/uploads/messages/${req.file.filename}`;

    const newMessage = await Message.create({
      from: senderId,
      to: receiverId,
      content: mediaUrl,
      type,
      productId: productId || null,
      unread: [receiverId],
    });

    if (io) {
      io.to(receiverId).emit("message:received", newMessage);
      io.to(senderId).emit("message:sent", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Erreur POST /messages/media :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 Modifier un message
// ============================================
router.put("/update/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { senderId, newContent } = req.body;
    if (!senderId || !newContent?.trim())
      return res.status(400).json({ error: "Champs manquants ou invalides" });

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message non trouvé" });
    if (msg.from !== senderId) return res.status(403).json({ error: "Permission refusée" });

    msg.content = newContent;
    await msg.save();

    if (io) {
      io.to(msg.to).emit("message:updated", msg);
      io.to(msg.from).emit("message:updated", msg);
    }

    res.json(msg);
  } catch (err) {
    console.error("Erreur PUT /update/:messageId :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 Supprimer un message
// ============================================
router.delete("/delete/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { senderId } = req.body;
    if (!senderId) return res.status(400).json({ error: "Champs manquants" });

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message non trouvé" });
    if (msg.from !== senderId) return res.status(403).json({ error: "Permission refusée" });

    msg.content = "[message supprimé]";
    await msg.save();

    if (io) {
      io.to(msg.to).emit("message:deleted", msg);
      io.to(msg.from).emit("message:deleted", msg);
    }

    res.json({ success: true, message: msg });
  } catch (err) {
    console.error("Erreur DELETE /delete/:messageId :", err);
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
    console.error("Erreur GET /messages :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 Marquer messages comme lus
// ============================================
router.put("/markAsRead", async (req, res) => {
  try {
    const { userId, otherUserId, productId } = req.body;

    const result = await Message.updateMany(
      { from: otherUserId, to: userId, productId: productId || null, unread: userId },
      { $pull: { unread: userId } }
    );

    if (io) {
      io.to(otherUserId).emit("message:read", { readerId: userId, otherUserId, productId });
    }

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("Erreur PUT /markAsRead :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 Récupérer toutes les conversations d’un user (version corrigée)
// ============================================
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId requis" });

    // 🔹 Récupérer tous les messages où l'utilisateur est impliqué
    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
    }).sort({ createdAt: -1 }).lean();

    const convMap = new Map();

    // 🔹 Construire les conversations
    for (const msg of messages) {
      const fromId = msg.from?.toString();
      const toId = msg.to?.toString();
      if (!fromId || !toId) continue;

      const otherUserId = fromId === userId ? toId : fromId;
      const productKey = msg.productId ? msg.productId.toString() : "no_product";
      const key = `${otherUserId}_${productKey}`;

      if (!convMap.has(key)) {
        convMap.set(key, {
          otherUserId,
          productId: msg.productId ? msg.productId.toString() : null,
          lastMessage: msg.content || "",
          lastDate: msg.createdAt,
          unread: msg.unread?.includes(userId) ? 1 : 0,
        });
      } else {
        const existing = convMap.get(key);
        if (msg.unread?.includes(userId)) existing.unread += 1;
      }
    }

    const conversations = Array.from(convMap.values());

    // 🔹 Récupérer tous les utilisateurs impliqués (User ou Seller)
    const userIds = conversations.map(c => c.otherUserId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name username fullName shopName nom email avatar profileImage isOnline");

    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    // 🔹 Récupérer les produits liés
    const productIds = conversations
      .map(c => c.productId)
      .filter(id => id);
    
    let products = [];
    if (productIds.length > 0) {
      products = await Product.find({ _id: { $in: productIds } })
        .select("name title price images");
    }
    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));

    // 🔹 Enrichir les conversations avec user et product
    const enrichedConversations = conversations.map(c => {
      const user = userMap[c.otherUserId];
      const product = productMap[c.productId];

      return {
        ...c,
        otherUser: user ? {
          name: user.name || user.fullName || user.username || user.shopName || "Utilisateur",
          avatar: user.avatar || user.profileImage || "",
          isOnline: user.isOnline || false,
        } : { name: "Utilisateur inconnu", avatar: "", isOnline: false },
        productName: product?.name || product?.title || null,
        productPrice: product?.price || null,
        productImage: product?.images?.[0] || null,
      };
    });

    res.json(enrichedConversations);
  } catch (err) {
    console.error("Erreur GET /conversations :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ Export du router et initSocket
// ============================================
module.exports = { router, initSocket };
