const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const Message = require("../models/Message");
const User = require("../models/user.model");

// =============================================
// 🔹 GET tous les messages entre deux utilisateurs
// =============================================
router.get("/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params; // autre utilisateur
    const currentUserId = req.user.id; // utilisateur connecté via token

    if (!userId || !currentUserId) {
      return res.status(400).json({ message: "IDs utilisateur manquants" });
    }

    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: userId },
        { from: userId, to: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("❌ Erreur GET /messages/:userId :", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// =============================================
// 🔹 GET toutes les conversations d’un utilisateur
// =============================================
router.get("/conversations/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params; // identifiant transmis dans l’URL
    const currentUserId = req.user?.id || userId; // sécurité : fallback si JWT absent

    if (!currentUserId) {
      return res.status(400).json({ message: "ID utilisateur manquant" });
    }

    // 🔹 Récupérer tous les messages liés à l’utilisateur connecté
    const messages = await Message.find({
      $or: [{ from: currentUserId }, { to: currentUserId }],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!messages || messages.length === 0) {
      return res.json([]); // Aucun message trouvé
    }

    const conversationsMap = new Map();

    // 🔹 Extraire tous les autres utilisateurs
    const otherUserIds = [
      ...new Set(
        messages.map((msg) =>
          msg.from.toString() === currentUserId
            ? msg.to.toString()
            : msg.from.toString()
        )
      ),
    ];

    // 🔹 Charger les infos des autres utilisateurs en une seule requête
    const users = await User.find({ _id: { $in: otherUserIds } }).select(
      "name username fullName shopName avatar isOnline"
    );
    const usersMap = new Map(users.map((u) => [u._id.toString(), u]));

    // 🔹 Construire les conversations
    for (const msg of messages) {
      const fromId = msg.from?.toString();
      const toId = msg.to?.toString();
      if (!fromId || !toId) continue;

      const otherUserId = fromId === currentUserId ? toId : fromId;
      if (!otherUserId) continue;

      const key = `${otherUserId}_${msg.productId || "none"}`;
      const userInfo = usersMap.get(otherUserId);

      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          otherUserId,
          otherUser: userInfo
            ? {
                name:
                  userInfo.name ||
                  userInfo.fullName ||
                  userInfo.username ||
                  userInfo.shopName ||
                  "Utilisateur",
                avatar: userInfo.avatar || "",
                isOnline: userInfo.isOnline || false,
              }
            : { name: "Utilisateur", avatar: "", isOnline: false },
          lastMessage: msg.content || msg.text || "",
          lastDate: msg.createdAt,
          productId: msg.productId || "",
          productName: msg.productName || "",
          productImage: msg.productImage || "",
          productPrice: msg.productPrice || null,
        });
      }
    }

    return res.json([...conversationsMap.values()]);
  } catch (err) {
    console.error("❌ Erreur GET /messages/conversations/:userId :", err.message);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
