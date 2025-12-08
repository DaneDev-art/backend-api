// =========================================
// src/ai/tts.service.js
// Service TTS (Text → Speech) — mode démo
// =========================================

const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const googleTTS = require("google-tts-api");

// 📌 Répertoire local pour mise en cache des audios
const CACHE_DIR = path.join(__dirname, "../../cache/tts");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// 🎙️ LISTE DES VOIX DISPONIBLES (pour démo)
const VOICES = {
  female1: "default",
  female2: "soprano",
  male1: "default_male",
  male2: "baritone",
};

const LANGUAGES = ["fr", "en", "es", "pt", "de"];

// =========================================
// 🔊 Fonction principale : texte → fichier audio
// =========================================
async function textToSpeech({ text, voice = "female1", lang = "fr", slow = false }) {
  if (!text || text.trim().length === 0) {
    throw new Error("Le texte est vide.");
  }

  if (!VOICES[voice]) voice = "female1";
  if (!LANGUAGES.includes(lang)) lang = "fr";

  // 📦 Génération TTS via Google TTS (mode démo)
  const url = googleTTS.getAudioUrl(text, { lang, slow, host: "https://translate.google.com" });
  const filename = `tts-${Date.now()}-${uuidv4()}.mp3`;
  const filepath = path.join(CACHE_DIR, filename);

  // Téléchargement de l'audio
  const resp = await fetch(url);
  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(filepath, buffer);

  return { filepath, url: `/cache/tts/${filename}` };
}

// =========================================
// 🚀 Fonction Streaming
// =========================================
async function streamTextToSpeech(res, options) {
  try {
    const { filepath } = await textToSpeech(options);
    res.setHeader("Content-Type", "audio/mpeg");
    res.sendFile(filepath);
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
