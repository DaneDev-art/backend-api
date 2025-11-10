// ===============================
// controllers/messageController.js
// ===============================
const Message = require("../models/Message");

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

    if (msg.from !== editorId) {
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

    if (msg.from !== userId) {
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

// 🔹 Récupérer les conversations d'un utilisateur
exports.getConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) return res.status(400).json({ error: "userId requis" });

    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
    }).sort({ createdAt: -1 });

    // Regrouper par (otherUser + productId)
    const conversations = {};
    messages.forEach((msg) => {
      const otherUserId = msg.from === userId ? msg.to : msg.from;
      const key = `${otherUserId}_${msg.productId || "none"}`;
      if (!conversations[key]) {
        conversations[key] = {
          otherUserId,
          productId: msg.productId,
          lastMessage: msg.content,
          lastDate: msg.createdAt,
          unread: msg.unread.includes(userId) ? 1 : 0,
        };
      }
    });

    return res.json(Object.values(conversations));
  } catch (err) {
    console.error("Erreur getConversations:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// 🔹 Récupérer l'historique entre deux utilisateurs
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
