// ==========================================
// src/routes/ai.routes.js
// Routes IA globales : Chat, Vision, STT, TTS
// ==========================================

const express = require("express");
const router = express.Router();
const multer = require("multer");

// Middlewares
const { verifyToken } = require("../middleware/auth.middleware");
const aiRateLimit = require("../middleware/aiRateLimit");

// Controllers
const aiController = require("../controllers/ai.controller");

// Upload (images + audio)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ==========================================
// 1️⃣ Chat IA
// ==========================================
// POST /api/ai/chat
router.post(
  "/chat",
  verifyToken,
  aiRateLimit(), // Anti-spam IA
  aiController.chat
);

// ==========================================
// 2️⃣ Vision IA (analyse image)
// ==========================================
// POST /api/ai/vision
router.post(
  "/vision",
  verifyToken,
  aiRateLimit(),
  upload.single("image"),
  aiController.vision
);

// ==========================================
// 3️⃣ Speech-to-Text (Transcription audio)
// ==========================================
// POST /api/ai/stt
router.post(
  "/stt",
  verifyToken,
  aiRateLimit(),
  upload.single("audio"),
  aiController.stt
);

// ==========================================
// 4️⃣ Text-to-Speech (TTS)
// ==========================================
// POST /api/ai/tts
router.post(
  "/tts",
  verifyToken,
  aiRateLimit(),
  aiController.tts
);

// ==========================================
// 5️⃣ Streaming TTS
// ==========================================
// GET /api/ai/tts/stream
router.get(
  "/tts/stream",
  verifyToken,
  aiRateLimit(),
  aiController.ttsStream
);

// ==========================================
// 6️⃣ Route test simple
// ==========================================
router.get("/ping", (req, res) => {
  res.json({ message: "AI Route OK 🔥" });
});

module.exports = router;
