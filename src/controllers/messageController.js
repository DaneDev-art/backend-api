// ===============================
// controllers/messageController.js
// ===============================
const Message = require("../models/Message");
const User = require("../models/user.model");
const Seller = require("../models/Seller");

// 🔹 Envoyer un message (texte, image ou audio)
exports.sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, message, productId, type, mediaUrl } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: "Champs manquants: senderId ou receiverId" });
    }

    const newMessage = new Message({
      from: senderId,
      to: receiverId,
      content: message || "",
      productId: productId || null,
      type: type || "text",
      mediaUrl: mediaUrl || null,
      unread: [receiverId],
    });

    const savedMessage = await newMessage.save();
    return res.status(201).json(savedMessage);
  } catch (err) {
    console.error("Erreur sendMessage:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// 🔹 Modifier un message (texte uniquement)
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { newContent, editorId } = req.body;

    if (!newContent) return res.status(400).json({ error: "Le nouveau contenu est requis" });

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message non trouvé" });

    if (msg.from.toString() !== editorId) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres messages" });
    }

    msg.content = newContent;
    await msg.save();

    return res.json(msg);
  } catch (err) {
    console.error("Erreur editMessage:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// 🔹 Supprimer un message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message non trouvé" });

    if (msg.from.toString() !== userId) {
      return res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres messages" });
    }

    await Message.findByIdAndDelete(messageId);
    return res.json({ success: true });
  } catch (err) {
    console.error("Erreur deleteMessage:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// 🔹 Marquer les messages comme lus
exports.markAsRead = async (req, res) => {
  try {
    const { userId, otherUserId, productId } = req.body;

    if (!userId || !otherUserId) return res.status(400).json({ error: "Champs manquants" });

    await Message.updateMany(
      { from: otherUserId, to: userId, productId: productId || null },
      { $pull: { unread: userId } }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Erreur markAsRead:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// 🔹 Récupérer les conversations d'un utilisateur (Users et Sellers)
exports.getConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId requis" });

    // 🧩 Récupère tous les messages liés à cet utilisateur
    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!messages || messages.length === 0) return res.json([]);

    const conversationsMap = new Map();

    for (const msg of messages) {
      if (!msg.from || !msg.to) continue;

      const fromId = msg.from.toString();
      const toId = msg.to.toString();
      const otherUserId = fromId === userId ? toId : fromId;

      // ✅ Regrouper uniquement par participant (sans bloquer sur productId)
      if (!otherUserId) continue;
      const key = otherUserId;

      if (!conversationsMap.has(key)) {
        // 🔹 Cherche l'utilisateur ou le vendeur correspondant
        let otherUser =
          (await User.findById(otherUserId).select("name username fullName avatar isOnline")) ||
          (await Seller.findById(otherUserId).select("storeName name logo isOnline"));

        const isSeller = !!(await Seller.findById(otherUserId));

        const otherUserData = otherUser
          ? {
              name:
                otherUser.storeName ||
                otherUser.name ||
                otherUser.fullName ||
                otherUser.username ||
                "Utilisateur",
              avatar: otherUser.avatar || otherUser.logo || "",
              isOnline: otherUser.isOnline || false,
              isSeller,
            }
          : { name: "Utilisateur", avatar: "", isOnline: false, isSeller: false };

        conversationsMap.set(key, {
          otherUserId,
          otherUser: otherUserData,
          lastMessage: msg.content || msg.mediaUrl || "",
          lastDate: msg.createdAt,
          productId: msg.productId || "",
          unread: msg.unread?.includes(userId) ? 1 : 0,
        });
      } else {
        // cumule les non-lus si plusieurs messages de cette conversation
        const existing = conversationsMap.get(key);
        if (msg.unread?.includes(userId)) existing.unread += 1;
      }
    }

    // ✅ Retourne la liste des conversations triée par date
    const result = [...conversationsMap.values()].sort(
      (a, b) => new Date(b.lastDate) - new Date(a.lastDate)
    );

    return res.json(result);
  } catch (err) {
    console.error("Erreur getConversations:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// 🔹 Récupérer l'historique entre deux utilisateurs (ou seller)
exports.getMessages = async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    if (!userId || !otherUserId) return res.status(400).json({ error: "Champs manquants" });

    const messages = await Message.find({
      $or: [
        { from: userId, to: otherUserId },
        { from: otherUserId, to: userId },
      ],
    }).sort({ createdAt: 1 });

    return res.json(messages);
  } catch (err) {
    console.error("Erreur getMessages:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
