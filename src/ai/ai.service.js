// ===========================================
// src/ai/ai.service.js
// Service central pour les fonctionnalités IA côté backend (mode démo)
// ===========================================

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../config/logger'); 

// On utilisera Google TTS modifié pour voix homme "Pro"
const googleTTS = require('google-tts-api'); 

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
// 🤖 Chatbot Marketplace PRO – Version Avancée
// ===========================================
async function chat({ message }) {
  if (!message) return "Je n'ai reçu aucun message.";

  const msg = message.toLowerCase().trim();

  const intents = [
    // -------------------------
    // SALUTATION
    // -------------------------
    { key: ["bonjour", "salut", "hey", "coucou"], reply: "Bonjour 👋 ! Comment puis-je vous aider aujourd’hui ?" },
    { key: ["bonsoir"], reply: "Bonsoir 🌙 ! Comment puis-je vous aider ?" },
    { key: ["ça va", "tu vas bien"], reply: "Je vais très bien 😊 Merci ! Et vous ?" },

    // -------------------------
    // REMERCIEMENT
    // -------------------------
    { key: ["merci"], reply: "Avec plaisir 😊 N’hésitez pas si vous avez d’autres questions." },

    // -------------------------
    // COMMANDES
    // -------------------------
    { key: ["passer commande", "faire une commande"], reply: "Pour passer une commande, choisissez un produit puis cliquez sur « Acheter ». Simple et rapide 😊" },
    { key: ["commande", "mes commandes"], reply: "Vous pouvez voir toutes vos commandes dans : Profil > Mes commandes." },
    { key: ["suivi commande", "statut commande", "où est ma commande"], reply: "Pour suivre votre commande, allez dans Profil > Mes commandes. Vous y verrez : En attente, Acceptée, En cours de livraison, Livrée." },
    { key: ["annuler commande"], reply: "Vous pouvez annuler une commande uniquement si elle n’a pas encore été acceptée par le vendeur ou le livreur." },

    // -------------------------
    // LIVRAISON
    // -------------------------
    { key: ["livraison"], reply: "La livraison prend généralement **24 à 48h**, selon votre position. Vous êtes notifié à chaque étape." },
    { key: ["prix livraison", "frais livraison"], reply: "Les frais de livraison dépendent de la distance. Le montant exact apparaît avant le paiement." },
    { key: ["modifier adresse", "changer adresse"], reply: "Vous pouvez modifier votre adresse dans Profil > Paramètres > Adresses." },

    // -------------------------
    // PAYMENT
    // -------------------------
    { key: ["paiement", "payer"], reply: "Vous pouvez payer via **CinetPay**, **Mobile Money** ou **carte bancaire**. Paiements 100% sécurisés 🔒" },
    { key: ["sécurisé", "sécurite paiement"], reply: "Oui, tous les paiements sont sécurisés. L'argent est bloqué jusqu'à confirmation de la livraison." },
    { key: ["remboursement"], reply: "Pour demander un remboursement, ouvrez la commande concernée et cliquez sur « Demander un remboursement »." },

    // -------------------------
    // PRODUITS
    // -------------------------
    { key: ["produit"], reply: "Découvrez nos produits dans Boutique 🛍️ Cliquez sur un produit pour voir photos, description, prix…" },
    { key: ["publier produit", "ajouter produit"], reply: "Pour ajouter un produit, vous devez d’abord devenir vendeur, puis aller dans Vendeur > Ajouter un produit." },
    { key: ["photo produit"], reply: "Ajoutez plusieurs photos claires et réelles pour attirer plus d’acheteurs 📸" },

    // -------------------------
    // DEVENIR VENDEUR
    // -------------------------
    { key: ["devenir vendeur", "comment vendre", "vendeur"], reply: "Pour devenir vendeur, allez dans Profil > Devenir Vendeur et remplissez le formulaire. Une fois validé, vous pourrez publier vos produits." },
    { key: ["commission", "frais vendeur"], reply: "Les vendeurs paient une commission de **2.5%** sur chaque vente. Vous recevez **97.5%** du montant." },

    // -------------------------
    // DEVENIR LIVREUR
    // -------------------------
    { key: ["devenir livreur", "comment livrer", "livreur"], reply: "Pour devenir livreur, allez dans Profil > Devenir Livreur. Une fois validé, vous recevrez des missions de livraison." },
    { key: ["gagner livreur", "paiement livreur"], reply: "Les livreurs sont payés pour chaque livraison. Le montant dépend de la distance." },

    // -------------------------
    // COMPTE & CONNEXION
    // -------------------------
    { key: ["connexion", "connecter"], reply: "Si vous avez un problème de connexion, vérifiez votre réseau et assurez-vous que vos identifiants sont corrects." },
    { key: ["mot de passe", "mdp"], reply: "Vous pouvez réinitialiser votre mot de passe depuis l'écran de connexion via « Mot de passe oublié »." },
    { key: ["supprimer compte"], reply: "Pour supprimer votre compte, contactez le support via l'onglet Assistance." },

    // -------------------------
    // NOTIFICATIONS
    // -------------------------
    { key: ["notification"], reply: "Assurez-vous que les notifications sont activées dans votre téléphone ET dans l’application." },

    // -------------------------
    // SUPPORT
    // -------------------------
    { key: ["help", "aide", "support", "assistance"], reply: "Notre équipe est disponible pour vous aider. Contactez-nous dans l’onglet Support 📩" },

    // -------------------------
    // AVIS
    // -------------------------
    { key: ["avis", "notation"], reply: "Vous pouvez noter un produit après l’avoir reçu. Cela aide toute la communauté 👍" },

    // -------------------------
    // PROBLÈMES TECHNIQUES
    // -------------------------
    { key: ["bug", "problème", "erreur"], reply: "Oups 😅 ! Pouvez-vous expliquer le problème ? Je vais vous aider." },
  ];

  for (let intent of intents) {
    if (intent.key.some(k => msg.includes(k))) {
      return intent.reply;
    }
  }

  const suggestions = [
    "👉 Vous cherchez à passer une commande ?",
    "👉 Vous voulez devenir vendeur ?",
    "👉 Besoin d'aide pour un paiement ?",
    "👉 Vous voulez savoir où est votre commande ?",
    "👉 Vous voulez devenir livreur ?"
  ];

  const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

  return (
    "Je suis Asseham, votre assistant E-Market 🤖.\n" +
    "Je n'ai pas bien compris votre question 😕\n\n" +
    suggestion
  );
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
// textToSpeech (Google TTS — voix Homme "Pro")
// ===========================================
async function textToSpeech({ text, lang = 'fr', slow = false, filename = null }) {
  if (!text) throw new Error('text required for TTS');

  try {
    // Utilisation d'une tonalité masculine en TTS (simulateur Google TTS)
    const url = googleTTS.getAudioUrl(text, { lang, slow, host: 'https://translate.google.com' });
    const finalName = filename || `tts-${Date.now()}-${uuidv4()}-male-pro.mp3`;
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
  vision,
  speechToText,
  textToSpeech,
  convertAudio,
  generateTutorial,
  summarizeConversation,
  saveBufferToFile,
  saveUploadedAudio
};
