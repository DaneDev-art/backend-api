const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth.middleware");
const aiConversationController = require("../controllers/aiConversation.controller");

// Créer une conversation
router.post("/", verifyToken, aiConversationController.createConversation);

// Historique utilisateur
router.get("/history", verifyToken, aiConversationController.getUserHistory);

// Thread complet par conversationId
router.get("/:conversationId", verifyToken, aiConversationController.getConversationById);

// Supprimer conversations
router.delete("/", verifyToken, aiConversationController.deleteConversations);

module.exports = router;
