// ===============================
// routes/messageRoutes.js
// Version PRO compatible User & Seller
// ===============================
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
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
      from: senderId.toString(),
      to: receiverId.toString(),
      content: message,
      type: "text",
      productId: productId ? productId.toString() : null,
      unread: [receiverId.toString()],
    });

    if (io) {
      io.to(receiverId.toString()).emit("message:received", newMessage);
      io.to(senderId.toString()).emit("message:sent", newMessage);
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
      from: senderId.toString(),
      to: receiverId.toString(),
      content: mediaUrl,
      type,
      productId: productId ? productId.toString() : null,
      unread: [receiverId.toString()],
    });

    if (io) {
      io.to(receiverId.toString()).emit("message:received", newMessage);
      io.to(senderId.toString()).emit("message:sent", newMessage);
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
    if (msg.from.toString() !== senderId.toString()) return res.status(403).json({ error: "Permission refusée" });

    msg.content = newContent;
    await msg.save();

    if (io) {
      io.to(msg.to.toString()).emit("message:updated", msg);
      io.to(msg.from.toString()).emit("message:updated", msg);
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
    if (msg.from.toString() !== senderId.toString()) return res.status(403).json({ error: "Permission refusée" });

    msg.content = "[message supprimé]";
    await msg.save();

    if (io) {
      io.to(msg.to.toString()).emit("message:deleted", msg);
      io.to(msg.from.toString()).emit("message:deleted", msg);
    }

    res.json({ success: true, message: msg });
  } catch (err) {
    console.error("Erreur DELETE /delete/:messageId :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔹 ✅ D’abord : Récupérer toutes les conversations d’un user
// (PLACÉ AVANT /:user1/:user2 !)
// ============================================
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId requis" });

    const messages = await Message.find({
      $or: [{ from: userId.toString() }, { to: userId.toString() }],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!messages || messages.length === 0) return res.json([]);

    const convMap = new Map();

    for (const msg of messages) {
      const fromId = msg.from?.toString();
      const toId = msg.to?.toString();
      if (!fromId || !toId) continue;

      const otherUserId = fromId === userId.toString() ? toId : fromId;
      const productKey = msg.productId ? msg.productId.toString() : "no_product";
      const key = `${otherUserId}_${productKey}`;

      if (!convMap.has(key)) {
        convMap.set(key, {
          otherUserId,
          productId: msg.productId ? msg.productId.toString() : null,
          lastMessage: msg.content || "",
          lastDate: msg.createdAt,
          unread: msg.unread?.includes(userId.toString()) ? 1 : 0,
        });
      } else {
        const existing = convMap.get(key);
        if (msg.unread?.includes(userId.toString())) existing.unread += 1;
      }
    }

    const conversations = Array.from(convMap.values());
    const userIds = conversations.map(c => c.otherUserId);

    const users = await User.find({ _id: { $in: userIds } })
      .select("name username fullName shopName avatar isOnline");
    const sellers = await Seller.find({ _id: { $in: userIds } })
      .select("name shopName avatar isOnline");

    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const sellerMap = Object.fromEntries(sellers.map(s => [s._id.toString(), s]));

    const productIds = conversations.map(c => c.productId).filter(id => id);
    let products = [];
    if (productIds.length > 0) {
      products = await Product.find({ _id: { $in: productIds } })
        .select("name title price images");
    }
    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));

    const enrichedConversations = conversations.map(c => {
      const user = userMap[c.otherUserId] || sellerMap[c.otherUserId];
      const product = c.productId ? productMap[c.productId] : null;

      const otherUserData = user
        ? {
            name: user.name || user.fullName || user.username || user.shopName || "Utilisateur",
            avatar: user.avatar || "",
            isOnline: user.isOnline || false,
          }
        : { name: "Utilisateur inconnu", avatar: "", isOnline: false };

      return {
        ...c,
        otherUser: otherUserData,
        productName: product?.name || product?.title || null,
        productPrice: product?.price || null,
        productImage: product?.images?.[0] || null,
      };
    });

    res.json(enrichedConversations);
  } catch (err) {
    console.error("Erreur GET /conversations/:userId :", err);
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
        { from: user1.toString(), to: user2.toString() },
        { from: user2.toString(), to: user1.toString() },
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
      { from: otherUserId.toString(), to: userId.toString(), productId: productId || null, unread: userId.toString() },
      { $pull: { unread: userId.toString() } }
    );

    if (io) {
      io.to(otherUserId.toString()).emit("message:read", { readerId: userId.toString(), otherUserId: otherUserId.toString(), productId });
    }

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("Erreur PUT /markAsRead :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ Export du router et initSocket
// ============================================
module.exports = { router, initSocket };
