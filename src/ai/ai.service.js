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
  return path.join(STORAGE_PATH, filename);
}

// ===========================================
// Chat (mode démo amélioré)
// ===========================================
async function chat({ message }) {
  if (!message) return "Je n'ai reçu aucun message.";

  const lower = message.toLowerCase();
  let response = "Je suis Asseham, votre assistant IA. Comment puis-je vous aider aujourd'hui ? 😊";

  // Quelques réponses utiles pour ton application marketplace
  if (lower.includes('bonjour') || lower.includes('salut')) {
    response = "Bonjour 👋 ! Comment puis-je vous aider aujourd'hui ?";
  }

  else if (lower.includes('commande')) {
    response = "Pour passer une commande, choisissez un produit puis cliquez sur « Acheter ». 😊";
  }

  else if (lower.includes('livraison')) {
    response = "La livraison prend généralement 24 à 48 heures selon votre position.";
  }

  else if (lower.includes('paiement')) {
    response = "Vous pouvez payer via CinetPay, Mobile Money ou carte bancaire.";
  }

  else if (lower.includes('produit')) {
    response = "Vous pouvez parcourir la liste des produits dans l'onglet Boutique.";
  }

  else if (lower.includes('problème') || lower.includes('bug')) {
    response = "Merci de nous l’avoir signalé. Pouvez-vous préciser le problème ? 🙏";
  }

  else if (lower.includes('merci')) {
    response = "Avec plaisir 😊. N’hésitez pas si vous avez d’autres questions.";
  }

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
// textToSpeech (Google TTS - fonctionne)
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
  return {
    steps: [
      { title: "Ouvrir la page", desc: `Allez sur la page ${page}.`, target: "page_main" },
      { title: "Cliquer sur un élément", desc: "Sélectionnez un élément pour voir plus de détails.", target: "product_item" },
      { title: "Voir les détails", desc: "Découvrez les informations et les options.", target: "product_detail" },
    ]
  };
}

// ===========================================
// summarizeConversation (mode démo)
// ===========================================
async function summarizeConversation({ messages }) {
  return "Résumé de la conversation (mode démo) : L'utilisateur a posé quelques questions et reçu des réponses automatiques.";
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
