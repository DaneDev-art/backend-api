// ===========================================
// src/ai/ai.service.js
// Service central pour les fonctionnalités IA côté backend
// ===========================================

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const googleTTS = require('google-tts-api'); 
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const FormData = require('form-data'); 
const logger = require('../config/logger'); 

ffmpeg.setFfmpegPath(ffmpegPath);

const OPENAI_BASE = 'https://api.openai.com/v1';
const OPENAI_KEY = process.env.OPENAI_KEY;
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH, { recursive: true });

// ===========================================
// SYSTEM PROMPT D'ASSEHAM
// ===========================================
const systemPrompt = `
Je suis Asseham, l’assistant intelligent de E-Market.

🎯 Objectif général :
Répondre avec professionnalisme, clarté et empathie.
Aider les utilisateurs à naviguer sur la plateforme E-Market, résoudre leurs problèmes et donner des conseils utiles.

🔐 Règles de sécurité :
- Ne jamais donner d'informations sensibles (API keys, données personnelles internes, mots de passe).
- Ne jamais générer ou conseiller des activités illégales.
- Ne jamais inciter à contourner les politiques d'E-Market.
- Toujours rappeler les limites lorsque la demande dépasse tes permissions.

👥 Règles métier selon les rôles :
1️⃣ role: buyer (acheteur) :
  - Aide à comprendre les produits, commandes, paiements, livraisons.
  - Rassure et guide toujours vers les étapes suivantes.

2️⃣ role: seller (vendeur) :
  - Explique comment gérer les produits, stocks, frais, ventes.
  - Guide pour bien publier, modifier ou suivre les commandes.

3️⃣ role: delivery (livreur) :
  - Explique comment accepter, mettre à jour et livrer les commandes.
  - Rappelle toujours les bonnes pratiques et horaires.

💬 Style :
- Poli, clair, pro, positif.
- Réponses structurées et utiles.
- Répondre en français par défaut.
`;

// ===========================================
// Helpers
// ===========================================
async function saveBufferToFile(buffer, filename) {
  const filepath = path.join(STORAGE_PATH, filename);
  await fs.promises.writeFile(filepath, buffer);
  return filepath;
}

async function downloadToFile(url, filename) {
  const filepath = path.join(STORAGE_PATH, filename);
  const resp = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.promises.writeFile(filepath, resp.data);
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

// ===========================================
// Chat completion avec injection automatique Asseham
// ===========================================
async function chatCompletion({ messages, model = 'gpt-4o-mini', temperature = 0.2, max_tokens = 800, userId = null }) {
  if (!OPENAI_KEY) throw new Error('OPENAI_KEY not configured');

  try {
    const finalMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const payload = { model, messages: finalMessages, temperature, max_tokens };
    if (userId) payload.user = String(userId);

    const resp = await axios.post(
      `${OPENAI_BASE}/chat/completions`,
      payload,
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );

    return resp.data?.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    logger?.error('chatCompletion error', err?.response?.data || err.message);
    throw err;
  }
}

// ===========================================
// Fonction "chat" utilisée par le controller
// ===========================================
async function chat({ message, conversationId, userId }) {
  const messages = [
    ...(conversationId ? [{ role: 'system', content: `Conversation ID: ${conversationId}` }] : []),
    { role: 'user', content: message }
  ];
  return await chatCompletion({ messages, userId });
}

// ===========================================
// Vision (analyse image placeholder)
// ===========================================
async function vision({ buffer, mimetype }) {
  // Ici placeholder, tu peux intégrer OpenAI Vision ou autre
  return { message: `Image reçue (${buffer.length} bytes, type ${mimetype})` };
}

// ===========================================
// speechToText
// ===========================================
async function speechToText({ filePath, model = 'whisper-1', provider = 'openai', language = null }) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('filePath not found');

  if (provider === 'deepgram' && DEEPGRAM_KEY) {
    try {
      const url = `https://api.deepgram.com/v1/listen?punctuate=true&language=${language || ''}`.replace(/=$/, '');
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));

      const resp = await axios.post(url, form, {
        headers: { Authorization: `Token ${DEEPGRAM_KEY}`, ...form.getHeaders() },
        maxBodyLength: Infinity
      });

      return resp.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
    } catch (err) {
      logger?.error('Deepgram STT error', err?.response?.data || err.message);
      throw err;
    }
  }

  if (!OPENAI_KEY) throw new Error('OPENAI_KEY not configured for speechToText');

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', model);
    if (language) form.append('language', language);

    const resp = await axios.post(`${OPENAI_BASE}/audio/transcriptions`, form, {
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, ...form.getHeaders() },
      maxBodyLength: Infinity,
      timeout: 120000
    });

    return resp.data?.text ?? '';
  } catch (err) {
    logger?.error('OpenAI Whisper STT error', err?.response?.data || err.message);
    throw err;
  }
}

// ===========================================
// textToSpeech
// ===========================================
async function textToSpeech({ text, lang = 'fr', slow = false, filename = null }) {
  if (!text) throw new Error('text required for TTS');

  try {
    const url = googleTTS.getAudioUrl(text, { lang, slow, host: 'https://translate.google.com' });
    const finalName = filename || `tts-${Date.now()}-${uuidv4()}.mp3`;
    const filepath = await downloadToFile(url, finalName);

    return { filepath, url: `/uploads/${path.basename(filepath)}` };
  } catch (err) {
    logger?.error('textToSpeech error', err?.response?.data || err.message);
    throw err;
  }
}

// ===========================================
// generateTutorial
// ===========================================
async function generateTutorial({ page = 'unknown', role = 'user', userId = null }) {
  const tutorialPrompt = `
Tu es un assistant qui génère des tutoriels pas-à-pas pour une application Marketplace.
Format de sortie souhaité : JSON strict avec la clé "steps" c'est un tableau d'objets
{ "title": "...", "desc": "...", "target": "element_key" }.
Génère entre 3 et 8 étapes pour la page : ${page} et le rôle : ${role}.
Répond uniquement en JSON si possible.
  `.trim();

  const messages = [
    { role: 'system', content: tutorialPrompt },
    { role: 'user', content: `Génère le tutoriel pour un ${role} sur la page "${page}".` }
  ];

  const text = await chatCompletion({ messages, userId });

  try {
    return JSON.parse(text);
  } catch (err) {
    logger?.warn('generateTutorial: réponse non JSON, renvoi brut');
    return { raw: text };
  }
}

// ===========================================
// summarizeConversation
// ===========================================
async function summarizeConversation({ messages, userId = null }) {
  const system = 'Tu es un assistant qui résume succinctement une conversation entre utilisateur et assistant.';
  const messagesPayload = [
    { role: 'system', content: system },
    { role: 'user', content: `Résume la conversation suivante en 2-4 phrases :\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}` }
  ];

  return await chatCompletion({ messages: messagesPayload, userId });
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
  chat,                 // ← pour controller
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
