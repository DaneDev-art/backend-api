// ===============================
// controllers/messageController.js
// Version PRO compatible User & Seller
// ===============================
const Message = require("../models/Message");
const User = require("../models/user.model");
const Seller = require("../models/Seller");
const Product = require("../models/Product");

// ============================================
// 🔹 Envoyer un message (texte, image ou audio)
// ============================================
exports.sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, message, productId, type, mediaUrl } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: "Champs manquants: senderId ou receiverId" });
    }

    const newMessage = new Message({
      from: senderId.toString(),
      to: receiverId.toString(),
      content: message || (mediaUrl || ""),
      productId: productId || null,
      type: type || "text",
      mediaUrl: mediaUrl || null,
      unread: [receiverId.toString()],
    });

    const savedMessage = await newMessage.save();
    return res.status(201).json(savedMessage);
  } catch (err) {
    console.error("Erreur sendMessage:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ============================================
// 🔹 Modifier un message (texte uniquement)
// ============================================
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { editorId, newContent } = req.body;

    if (!newContent) return res.status(400).json({ error: "Le nouveau contenu est requis" });

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message non trouvé" });

    if (msg.from.toString() !== editorId.toString()) {
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

// ============================================
// 🔹 Supprimer un message
// ============================================
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message non trouvé" });

    if (msg.from.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres messages" });
    }

    msg.content = "[message supprimé]";
    await msg.save();

    return res.json({ success: true, message: msg });
  } catch (err) {
    console.error("Erreur deleteMessage:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ============================================
// 🔹 Marquer les messages comme lus
// ============================================
exports.markAsRead = async (req, res) => {
  try {
    const { userId, otherUserId, productId } = req.body;

    if (!userId || !otherUserId) return res.status(400).json({ error: "Champs manquants" });

    await Message.updateMany(
      { from: otherUserId.toString(), to: userId.toString(), productId: productId || null },
      { $pull: { unread: userId.toString() } }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Erreur markAsRead:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ============================================
// 🔹 Récupérer les conversations d'un utilisateur
// ============================================
exports.getConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId requis" });

    const messages = await Message.find({
      $or: [{ from: userId.toString() }, { to: userId.toString() }],
    }).sort({ createdAt: -1 }).lean();

    if (!messages || messages.length === 0) return res.json([]);

    const convMap = new Map();

    for (const msg of messages) {
      const fromId = msg.from.toString();
      const toId = msg.to.toString();
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

    // 🔹 Récupérer les utilisateurs et sellers
    const userIds = conversations.map(c => c.otherUserId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name username fullName shopName avatar isOnline");
    const sellers = await Seller.find({ _id: { $in: userIds } })
      .select("name shopName avatar isOnline");

    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const sellerMap = Object.fromEntries(sellers.map(s => [s._id.toString(), s]));

    // 🔹 Récupérer les produits liés
    const productIds = conversations.map(c => c.productId).filter(id => id);
    let products = [];
    if (productIds.length > 0) {
      products = await Product.find({ _id: { $in: productIds } })
        .select("name title price images");
    }
    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));

    // 🔹 Enrichir conversations
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

    return res.json(enrichedConversations);
  } catch (err) {
    console.error("Erreur getConversations:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ============================================
// 🔹 Récupérer l'historique entre deux utilisateurs
// ============================================
exports.getMessages = async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    if (!userId || !otherUserId) return res.status(400).json({ error: "Champs manquants" });

    const messages = await Message.find({
      $or: [
        { from: userId.toString(), to: otherUserId.toString() },
        { from: otherUserId.toString(), to: userId.toString() },
      ],
    }).sort({ createdAt: 1 });

    return res.json(messages);
  } catch (err) {
    console.error("Erreur getMessages:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
