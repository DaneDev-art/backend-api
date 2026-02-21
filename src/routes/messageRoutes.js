// ===============================
// routes/messageRoutes.js
// Version PRO corrigée : Conversation + Cloudinary + Compatibilité ancien front
// ===============================

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/user.model");
const Seller = require("../models/Seller");
const Product = require("../models/Product");

const cloudinary = require("cloudinary").v2;

// ============================================
// Cloudinary config
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================
// Socket.IO
// ============================================
let io;
function initSocket(socketInstance) {
  io = socketInstance;
}

// ============================================
// Multer upload
// ============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./uploads/messages";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "_" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ============================================
// POST / - Envoyer un message texte
// ============================================
router.post("/", async (req, res) => {
  try {
    const { conversationId, senderId, receiverId, message, productId } = req.body;
    if (!senderId || !receiverId || !message?.trim())
      return res.status(400).json({ error: "Champs manquants ou invalides" });

    // -- Trouver ou créer conversation
    let conversation = null;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    } else {
      conversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId], $size: 2 },
        "product.productId": productId ? productId : { $exists: true },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, receiverId],
          product: productId ? { productId } : {},
        });
      }
    }

    // -- Créer message
    const newMessage = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      receiver: receiverId,
      text: message,
      type: "TEXT",
      productId: productId || null,
      readBy: [senderId],
    });

    // -- Mettre à jour conversation
    const otherUser = conversation.participants.find((id) => id.toString() !== senderId);
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message,
      lastDate: new Date(),
      $inc: { [`unreadCounts.${otherUser}`]: 1 },
    });

    // -- Socket
    if (io) {
      io.to(conversation._id.toString()).emit("message:new", newMessage);
      io.to(senderId.toString()).emit("message:sent", newMessage);
      io.to(receiverId.toString()).emit("message:received", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Erreur POST /messages :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /media - Envoyer un média
// ============================================
router.post("/media", upload.single("file"), async (req, res) => {
  try {
    const { conversationId, senderId, receiverId, type, productId } = req.body;
    if (!req.file || !senderId || !receiverId)
      return res.status(400).json({ error: "Champs manquants ou fichier manquant" });

    const resourceType = type === "audio" ? "raw" : "image";

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: `messages/${senderId}_${receiverId}`,
      resource_type: resourceType,
    });
    fs.unlinkSync(req.file.path);

    const newMessage = await Message.create({
      conversation: conversationId,
      sender: senderId,
      receiver: receiverId,
      type: type === "audio" ? "AUDIO" : "IMAGE",
      mediaUrl: uploadResult.secure_url,
      productId: productId || null,
      readBy: [senderId],
    });

    // -- Socket
    if (io) {
      io.to(conversationId).emit("message:new", newMessage);
      io.to(senderId.toString()).emit("message:sent", newMessage);
      io.to(receiverId.toString()).emit("message:received", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Erreur POST /messages/media :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PUT /update/:messageId - Modifier un message
// ============================================
router.put("/update/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { senderId, newContent } = req.body;
    if (!senderId || !newContent?.trim())
      return res.status(400).json({ error: "Champs manquants ou invalides" });

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message non trouvé" });
    if (msg.sender.toString() !== senderId) return res.status(403).json({ error: "Non autorisé" });

    msg.text = newContent;
    await msg.save();

    if (io) {
      io.to(msg.conversation.toString()).emit("message:updated", msg);
      io.to(msg.sender.toString()).emit("message:updated", msg);
      io.to(msg.receiver.toString()).emit("message:updated", msg);
    }

    res.json(msg);
  } catch (err) {
    console.error("Erreur PUT /update/:messageId :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DELETE /delete/:messageId - Supprimer un message
// ============================================
router.delete("/delete/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message non trouvé" });

    msg.text = "[message supprimé]";
    await msg.save();

    if (io) {
      io.to(msg.conversation.toString()).emit("message:deleted", msg);
      io.to(msg.sender.toString()).emit("message:deleted", msg);
      io.to(msg.receiver.toString()).emit("message:deleted", msg);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur DELETE /delete/:messageId :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /conversations/:userId - Lister conversations
// ============================================
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    }).sort({ createdAt: -1 }).lean();

    if (!messages || messages.length === 0) return res.json([]);

    // -- Grouper messages par conversation (ancien front)
    const convMap = new Map();
    for (const msg of messages) {
      const otherUserId = msg.sender.toString() === userId ? msg.receiver.toString() : msg.sender.toString();
      const productKey = msg.productId ? msg.productId.toString() : "no_product";
      const key = `${otherUserId}_${productKey}`;

      if (!convMap.has(key)) {
        convMap.set(key, {
          otherUserId,
          productId: msg.productId ? msg.productId.toString() : null,
          lastMessage: msg.text || msg.content || "",
          lastDate: msg.createdAt,
          unread: msg.readBy?.includes(userId) ? 0 : 1,
        });
      } else {
        const existing = convMap.get(key);
        if (!msg.readBy?.includes(userId)) existing.unread += 1;
      }
    }

    const conversations = Array.from(convMap.values());

    // -- Récupérer info utilisateurs et produits
    const userIds = conversations.map(c => c.otherUserId);
    const users = await User.find({ _id: { $in: userIds } }).select("name fullName username avatar isOnline");
    const sellers = await Seller.find({ _id: { $in: userIds } }).select("shopName name avatar isOnline");
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const sellerMap = Object.fromEntries(sellers.map(s => [s._id.toString(), s]));

    const productIds = conversations.map(c => c.productId).filter(Boolean);
    const products = productIds.length > 0 ? await Product.find({ _id: { $in: productIds } }).select("name title price images") : [];
    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));

    const enrichedConversations = conversations.map(c => {
      const user = userMap[c.otherUserId] || sellerMap[c.otherUserId];
      const product = c.productId ? productMap[c.productId] : null;

      return {
        ...c,
        otherUser: user ? {
          name: user.name || user.fullName || user.username || user.shopName || "Utilisateur",
          avatar: user.avatar || "",
          isOnline: user.isOnline || false,
        } : { name: "Utilisateur inconnu", avatar: "", isOnline: false },
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
// GET /conversation/:conversationId - Messages d'une conversation
// ============================================
router.get("/conversation/:conversationId", async (req, res) => {
  try {
    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate("sender")
      .populate("receiver")
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error("Erreur GET /conversation/:conversationId :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PUT /markAsRead - Marquer messages lus
// ============================================
router.put("/markAsRead", async (req, res) => {
  try {
    const { userId, otherUserId, productId } = req.body;

    const result = await Message.updateMany(
      { sender: otherUserId, receiver: userId, productId: productId || null, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    if (io) {
      io.to(otherUserId.toString()).emit("message:read", { readerId: userId, otherUserId, productId });
    }

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("Erreur PUT /markAsRead :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// Export router & initSocket
// ============================================
module.exports = { router, initSocket };