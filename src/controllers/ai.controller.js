// ================================================
// src/controllers/ai.controller.js
// Contrôleur global pour les fonctionnalités IA (mode démo)
// ================================================

const aiService = require("../ai/ai.service");

// =====================================================
// 1️⃣ Chat IA
// =====================================================
exports.chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message manquant." });
    }

    // Appel au service IA mode démo
    const result = await aiService.chat({ message });

    // 🔥 Retour corrigé pour correspondre à Flutter
    res.json({ response: result });

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

    // Mode démo : transcription fixe
    const result = await aiService.speechToText({ filePath: req.file.path });

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
    const { text, language = "fr" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texte manquant." });
    }

    const { filepath } = await aiService.textToSpeech({
      text,
      lang: language,
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.sendFile(filepath);
  } catch (error) {
    console.error("❌ [TTS Controller Error]", error);
    res.status(500).json({ error: error.message });
  }
};

// =====================================================
// 5️⃣ TTS Streaming (mode démo)
// =====================================================
exports.ttsStream = async (req, res) => {
  try {
    const { text = "Ceci est un flux TTS démo", language = "fr" } = req.query;

    const { filepath } = await aiService.textToSpeech({
      text,
      lang: language,
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.sendFile(filepath);
  } catch (error) {
    console.error("❌ [TTS Stream Controller Error]", error);
    res.status(500).json({ error: error.message });
  }
};

// =====================================================
// 6️⃣ Endpoint test
// =====================================================
exports.ping = (req, res) => {
  res.json({ message: "AI Controller OK 🔥 — mode démo" });
};
