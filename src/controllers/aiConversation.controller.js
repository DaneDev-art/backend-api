// ==========================================
// src/controllers/aiConversation.controller.js
// Contrôleur pour gérer les conversations IA
// ==========================================

const AiConversation = require("../models/AiConversation");

/**
 * Crée une nouvelle conversation IA
 * @param {Object} req.body { conversationId, type, userMessage, aiResponse, metadata }
 */
exports.createConversation = async (req, res) => {
  try {
    const { conversationId, type, userMessage, aiResponse, metadata } = req.body;

    if (!conversationId || !userMessage || !aiResponse) {
      return res.status(400).json({ error: "conversationId, userMessage et aiResponse sont requis." });
    }

    const conversation = await AiConversation.create({
      user: req.user.id,
      conversationId,
      type: type || "chat",
      userMessage,
      aiResponse,
      metadata: metadata || {},
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error("❌ [Create Conversation Error]", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Récupère l'historique complet d'un utilisateur
 * avec pagination
 * Query params : page=1, limit=20
 */
exports.getUserHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const conversations = await AiConversation.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AiConversation.countDocuments({ user: req.user.id });

    res.json({
      page,
      limit,
      total,
      conversations,
    });
  } catch (error) {
    console.error("❌ [Get User History Error]", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Récupère toutes les conversations d'une conversationId (thread)
 */
exports.getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId est requis." });
    }

    const conversations = await AiConversation.find({
      user: req.user.id,
      conversationId,
    }).sort({ createdAt: 1 }); // tri chronologique

    res.json({ conversationId, messages: conversations });
  } catch (error) {
    console.error("❌ [Get Conversation By ID Error]", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Supprime toutes les conversations d'un utilisateur
 * ou d'une conversationId spécifique
 */
exports.deleteConversations = async (req, res) => {
  try {
    const { conversationId } = req.query;

    const filter = { user: req.user.id };
    if (conversationId) filter.conversationId = conversationId;

    const result = await AiConversation.deleteMany(filter);

    res.json({
      message: "Conversations supprimées.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ [Delete Conversations Error]", error);
    res.status(500).json({ error: error.message });
  }
};
