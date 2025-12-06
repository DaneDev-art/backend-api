// ================================================
// src/controllers/ai.controller.js
// Contrôleur global pour les fonctionnalités IA
// ================================================

const aiService = require("../ai/ai.service");
const ttsService = require("../ai/tts.service");
const sttService = require("../ai/voice.service");

// =====================================================
// 1️⃣ Chat IA
// =====================================================

exports.chat = async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message manquant." });
    }

    const result = await aiService.chat({
      message,
      conversationId,
      userId: req.user.id,
    });

    res.json(result);
  } catch (error) {
    console.error("❌ [Chat IA Controller Error]", error);
    res.status(500).json({ error: error.message });
  }
};

// =====================================================
// 2️⃣ Vision IA (image → analyse)
// =====================================================

exports.vision = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image non fournie." });
    }

    const result = await aiService.vision({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
    });

    res.json(result);
  } catch (error) {
    console.error("❌ [Vision IA Controller Error]", error);
    res.status(500).json({ error: error.message });
  }
};

// =====================================================
// 3️⃣ Speech-to-Text (STT)
// =====================================================

exports.stt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Fichier audio non fourni." });
    }

    const result = await sttService.transcribeAudio(req.file.buffer);

    res.json({ text: result });
  } catch (error) {
    console.error("❌ [STT Controller Error]", error);
    res.status(500).json({ error: error.message });
  }
};

// =====================================================
// 4️⃣ Text-to-Speech (TTS)
// =====================================================

exports.tts = async (req, res) => {
  try {
    const {
      text,
      voice = "female1",
      language = "fr",
      format = "mp3",
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texte manquant." });
    }

    const { audio } = await ttsService.textToSpeech({
      text,
      voice,
      language,
      format,
    });

    res.setHeader("Content-Type", `audio/${format}`);
    res.send(audio);
  } catch (error) {
    console.error("❌ [TTS Controller Error]", error);
    res.status(500).json({ error: error.message });
  }
};

// =====================================================
// 5️⃣ TTS Streaming (lecture instantanée)
// =====================================================

exports.ttsStream = async (req, res) => {
  try {
    const { text, voice = "female1", language = "fr" } = req.query;

    if (!text) {
      return res.status(400).json({ error: "Texte manquant." });
    }

    await ttsService.streamTextToSpeech(res, {
      text,
      voice,
      language,
    });
  } catch (error) {
    console.error("❌ [TTS Stream Controller Error]", error);
    res.status(500).json({ error: error.message });
  }
};

// =====================================================
// 🔧 Endpoint test
// =====================================================

exports.ping = (req, res) => {
  res.json({ message: "AI Controller OK 🔥" });
};
