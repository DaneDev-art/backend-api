// =========================================
// src/ai/tts.service.js
// Service TTS (Text → Speech)
// =========================================

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// 📌 Répertoire local pour mise en cache des audios
const CACHE_DIR = path.join(__dirname, "../../cache/tts");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// =========================================
// 🔧 Config TTS — API IA (OpenAI ou autre)
// =========================================
const TTS_API_URL = process.env.TTS_API_URL; // ex: https://api.openai.com/v1/audio/speech
const TTS_API_KEY = process.env.TTS_API_KEY;

if (!TTS_API_URL || !TTS_API_KEY) {
  console.warn("⚠️ WARNING: Missing TTS_API_URL or TTS_API_KEY in environment variables.");
}

// =========================================
// 🎙️ LISTE DES VOIX DISPONIBLES
// (personnalisable facilement)
// =========================================

const VOICES = {
  male1: "alloy",
  male2: "baritone",
  female1: "verse",
  female2: "soprano",

  // Tu peux ajouter autant de voix que tu veux
};

const LANGUAGES = ["fr", "en", "es", "pt", "de"];

// =========================================
// 🔊 Fonction principale : texte → buffer audio
// =========================================

async function textToSpeech({
  text,
  voice = "female1",
  language = "fr",
  format = "mp3",
}) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Le texte est vide.");
    }

    if (!VOICES[voice]) {
      throw new Error(`Voix '${voice}' non trouvée.`);
    }

    if (!LANGUAGES.includes(language)) {
      throw new Error(`Langue '${language}' non supportée.`);
    }

    // =========================================
    // 📦 Vérifier le cache
    // =========================================

    const hash = crypto
      .createHash("sha256")
      .update(text + voice + language)
      .digest("hex");

    const filePath = path.join(CACHE_DIR, `${hash}.${format}`);

    if (fs.existsSync(filePath)) {
      return {
        audio: fs.readFileSync(filePath),
        fromCache: true,
      };
    }

    // =========================================
    // 🔥 Appel API TTS
    // =========================================

    const payload = {
      model: "gpt-4o-mini-tts",
      input: text,
      voice: VOICES[voice],
      format,
      language,
    };

    const response = await axios.post(TTS_API_URL, payload, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${TTS_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const audioBuffer = Buffer.from(response.data);

    // =========================================
    // 💾 Mise en cache
    // =========================================
    fs.writeFileSync(filePath, audioBuffer);

    return {
      audio: audioBuffer,
      fromCache: false,
    };
  } catch (err) {
    console.error("❌ [TTS] Erreur:", err);
    throw new Error("Impossible de générer l’audio : " + err.message);
  }
}

// =========================================
// 🚀 Fonction Streaming (optionnelle)
// =========================================

async function streamTextToSpeech(res, options) {
  try {
    const { audio } = await textToSpeech(options);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audio.length);
    res.send(audio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  textToSpeech,
  streamTextToSpeech,
  VOICES,
  LANGUAGES,
};
