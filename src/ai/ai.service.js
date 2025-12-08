// ===========================================
// src/ai/ai.service.js
// Service central pour les fonctionnalités IA côté backend (mode démo)
// ===========================================

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const googleTTS = require('google-tts-api'); 
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../config/logger'); 

ffmpeg.setFfmpegPath(ffmpegPath);

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH, { recursive: true });

// ===========================================
// Helpers
// ===========================================
async function saveBufferToFile(buffer, filename) {
  const filepath = path.join(STORAGE_PATH, filename);
  await fs.promises.writeFile(filepath, buffer);
  return filepath;
}

function convertAudio(inputPath, { format = 'wav' } = {}) {
  return new Promise((resolve, reject) => {
    const outName = `${Date.now()}-${uuidv4()}.${format}`;
    const outPath = path.join(STORAGE_PATH, outName);

    ffmpeg(inputPath)
      .toFormat(format)
      .on('error', (err) => {
        logger?.error('ffmpeg convert error', err);
        reject(err);
      })
      .on('end', () => resolve(outPath))
      .save(outPath);
  });
}

async function downloadToFile(url, filename) {
  // placeholder pour TTS, on ne télécharge plus depuis OpenAI
  return path.join(STORAGE_PATH, filename);
}

// ===========================================
// Chat completion (mode démo)
// ===========================================
async function chatCompletion({ messages }) {
  // Réponse fixe pour le mode démo
  return "Bonjour ! Ceci est un exemple de réponse automatique pour montrer l'utilisation de l'application.";
}

async function chat({ message }) {
  // On peut adapter des réponses simples selon le message
  const lower = message.toLowerCase();
  let response = "Ceci est un message de démonstration pour guider l'utilisateur.";

  if (lower.includes('commande')) response = "Pour passer une commande, cliquez sur le produit puis sur 'Acheter'.";
  else if (lower.includes('paiement')) response = "Vous pouvez payer via CinetPay ou Mobile Money.";
  else if (lower.includes('livraison')) response = "La livraison se fait dans les 48h après confirmation de paiement.";

  return response;
}

// ===========================================
// Vision (analyse image placeholder)
// ===========================================
async function vision({ buffer, mimetype }) {
  return { message: `Image reçue (${buffer.length} bytes, type ${mimetype}) — mode démo.` };
}

// ===========================================
// speechToText (placeholder)
// ===========================================
async function speechToText({ filePath }) {
  return "Ceci est une transcription de démonstration (mode démo).";
}

// ===========================================
// textToSpeech (utilisation Google TTS toujours valide)
// ===========================================
async function textToSpeech({ text, lang = 'fr', slow = false, filename = null }) {
  if (!text) throw new Error('text required for TTS');
  try {
    const url = googleTTS.getAudioUrl(text, { lang, slow, host: 'https://translate.google.com' });
    const finalName = filename || `tts-${Date.now()}-${uuidv4()}.mp3`;
    const filepath = path.join(STORAGE_PATH, finalName);
    return { filepath, url: `/uploads/${finalName}` };
  } catch (err) {
    logger?.error('textToSpeech error', err.message);
    throw err;
  }
}

// ===========================================
// generateTutorial (mode démo)
// ===========================================
async function generateTutorial({ page = 'unknown', role = 'user' }) {
  // Réponse JSON statique pour la démo
  return {
    steps: [
      { title: "Ouvrir la page", desc: `Allez sur la page ${page}.`, target: "page_main" },
      { title: "Cliquer sur un élément", desc: "Sélectionnez le produit que vous voulez tester.", target: "product_item" },
      { title: "Voir les détails", desc: "Découvrez les informations du produit et les options disponibles.", target: "product_detail" },
    ]
  };
}

// ===========================================
// summarizeConversation (mode démo)
// ===========================================
async function summarizeConversation({ messages }) {
  return "Résumé de la conversation (mode démo) : L'utilisateur a testé le chat démo.";
}

// ===========================================
// saveUploadedAudio
// ===========================================
async function saveUploadedAudio({ buffer, originalName = 'audio' }) {
  const filename = `${Date.now()}-${uuidv4()}-${originalName}`;
  const filepath = path.join(STORAGE_PATH, filename);
  await fs.promises.writeFile(filepath, buffer);
  return filepath;
}

// ===========================================
// Export
// ===========================================
module.exports = {
  chat,
  chatCompletion,
  vision,
  speechToText,
  textToSpeech,
  convertAudio,
  generateTutorial,
  summarizeConversation,
  saveBufferToFile,
  saveUploadedAudio
};
