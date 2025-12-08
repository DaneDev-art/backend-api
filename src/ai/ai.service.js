// ===========================================
// src/ai/ai.service.js
// Service central pour les fonctionnalités IA côté backend (texte-only)
// ===========================================

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

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
    { key: ["passer commande", "faire une commande"], reply: "Pour passer une commande, Cliquez sur le produit; sur la page de détails du produit, vous avez le choix de dicuter avec le vendeur pour conclure un prix avant d'ajouter le produit au Panier soit d'ajouter directement le produit au Panier. De toutes les façons vos fonds sont sécurisés. Retournez à votre tableau de Bord et procéder au paiement" },
    { key: ["commande", "mes commandes"], reply: "Vous pouvez accéder à toutes vos commandes (Commandes soumises pour livraison, ou commandes après achat d'un ou des produit(s)) à partir de votre tableau de bord" },
    { key: ["suivi commande", "statut commande", "où est ma commande"], reply: "Pour suivre votre commande, allez à votre tableau de bord > Mes commandes ou mes commandes soumises. Attendez toujours de recevoir votre commande achetée ou soumise pour livraison, avant de confirmer la reception. Très important pour ne pas perdre vos fonds surtout lorsque vous avez acheté un ou plusieurs produits." },
    { key: ["annuler commande"], reply: "Pour annuler une commande dejà payée, veuilez demander à l'Assistant E-Market de vous donner les coordonnées de l'équipe en charge. C'est cette équipe qui vas procéder à la vérification, à la suite de laquelle vos fonds vous seront retournés" },

    // -------------------------
    // LIVRAISON
    // -------------------------
    { key: ["livraison", "delai de livraison", "temps de livraison"], reply: "Pour un vendeur le délai maximal pour livrer les produits aux client est de 5 jours. Pour un livreur, le délai pour livrer des produits est de 48 heures maximum" },
    { key: ["prix livraison", "frais livraison"], reply: "Les frais de livraison dépendent de la distance; et le montant à payer est conclu entre les deux utilsateurs: le livreur et son client" },
    { key: ["modifier adresse", "changer adresse"], reply: "Vous pouvez modifier votre adresse, c'est une discussion entre les deux parties." },

    // -------------------------
    // PAYMENT
    // -------------------------
    { key: ["paiement", "payer", "acheter"], reply: "Vous pouvez payer via Mobile Money uniquement pour le moment. Paiements 100% sécurisés 🔒" },
    { key: ["sécurisé", "sécurite paiement"], reply: "Oui, tous les paiements sont sécurisés. L'argent est bloqué jusqu'à confirmation de la livraison." },
    { key: ["remboursement"], reply: "Pour demander un remboursement, ouvrez la commande concernée et cliquez sur « Demander un remboursement »." },

    // -------------------------
    // PRODUITS
    // -------------------------
    { key: ["produit", "publier un produit"], reply: "Découvrez nos produits dans Boutique 🛍️ Cliquez sur un produit pour voir photos, description, prix…" },
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
    if (intent.key.some(k => msg.includes(k))) return intent.reply;
  }

  const suggestions = [
    "👉 Vous cherchez à passer une commande ?",
    "👉 Vous voulez devenir vendeur ?",
    "👉 Besoin d'aide pour un paiement ?",
    "👉 Vous voulez savoir où est votre commande ?",
    "👉 Vous voulez devenir livreur ?"
  ];

  return (
    "Je suis Asseham, votre assistant E-Market 🤖.\n" +
    "Je n'ai pas bien compris votre question 😕\n\n" +
    suggestions[Math.floor(Math.random() * suggestions.length)]
  );
}

// ===========================================
// Vision (analyse image placeholder)
// ===========================================
async function vision({ buffer, mimetype }) {
  return { message: `Image reçue (${buffer.length} bytes, type ${mimetype}) — mode démo.` };
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
// Export
// ===========================================
module.exports = {
  chat,
  vision,
  generateTutorial,
  summarizeConversation,
  saveBufferToFile,
  downloadToFile
};
