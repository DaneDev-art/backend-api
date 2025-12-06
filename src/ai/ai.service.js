// src/ai/ai.service.js
/**
 * ai.service.js
 * Service central pour les fonctionnalités IA côté backend :
 *  - chatCompletion (OpenAI)
 *  - speechToText (OpenAI Whisper | Deepgram)
 *  - textToSpeech (google-tts-api)
 *  - conversion audio (ffmpeg)
 *  - sauvegarde / lecture audio
 *
 * Dépendances attendues (voir package.json) :
 *  axios, google-tts-api, fluent-ffmpeg, @ffmpeg-installer/ffmpeg, uuid, form-data (optionnel),
 *  fs, path
 *
 * Variables d'environnement utilisées :
 *  - OPENAI_KEY
 *  - DEEPGRAM_API_KEY (optionnel)
 *  - STORAGE_PATH (ex: ./uploads)
 *
 * Adapter les endpoints / options selon ton fournisseur TTS/STT préféré.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const googleTTS = require('google-tts-api'); // pour TTS rapide
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const FormData = require('form-data'); // si absent : npm install form-data
const logger = require('../config/logger'); // ton logger Winston/pino si tu veux

ffmpeg.setFfmpegPath(ffmpegPath);

const OPENAI_BASE = 'https://api.openai.com/v1';
const OPENAI_KEY = process.env.OPENAI_KEY;
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH, { recursive: true });

/**
 * Helper: write buffer to disk
 */
async function saveBufferToFile(buffer, filename) {
  const filepath = path.join(STORAGE_PATH, filename);
  await fs.promises.writeFile(filepath, buffer);
  return filepath;
}

/**
 * Helper: download binary from url and save to file
 */
async function downloadToFile(url, filename) {
  const filepath = path.join(STORAGE_PATH, filename);
  const resp = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.promises.writeFile(filepath, resp.data);
  return filepath;
}

/**
 * Convert audio file to desired format (e.g., mp3 -> wav) using ffmpeg
 * returns path to converted file
 */
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

/**
 * Chat completion via OpenAI REST API (simple wrapper).
 * messages: array[{role: 'system'|'user'|'assistant', content: '...'}]
 * options: { model, temperature, max_tokens }
 */
async function chatCompletion({ messages, model = 'gpt-4o-mini', temperature = 0.2, max_tokens = 800, userId = null }) {
  if (!OPENAI_KEY) throw new Error('OPENAI_KEY not configured');

  try {
    const payload = {
      model,
      messages,
      temperature,
      max_tokens
    };
    if (userId) payload.user = String(userId);

    const resp = await axios.post(
      `${OPENAI_BASE}/chat/completions`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    // Defensive: try to extract assistant text
    const content = resp.data?.choices?.[0]?.message?.content ?? '';
    return content;
  } catch (err) {
    logger?.error('chatCompletion error', err?.response?.data || err.message);
    // Remonter erreur
    throw err;
  }
}

/**
 * speechToText:
 * - filePath: chemin vers le fichier audio sur le serveur
 * - provider: 'openai' | 'deepgram' (default 'openai')
 *
 * Retourne la transcription texte.
 */
async function speechToText({ filePath, model = 'whisper-1', provider = 'openai', language = null }) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('filePath not found');

  if (provider === 'deepgram' && DEEPGRAM_KEY) {
    // Deepgram via REST
    try {
      const url = `https://api.deepgram.com/v1/listen?punctuate=true&language=${language || ''}`.replace(/=$/, '');
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));

      const resp = await axios.post(url, form, {
        headers: {
          Authorization: `Token ${DEEPGRAM_KEY}`,
          ...form.getHeaders()
        },
        maxBodyLength: Infinity
      });

      // Deepgram returns { results: { channels: [ { alternatives: [ { transcript } ] } ] } }
      const transcript = resp.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
      return transcript;
    } catch (err) {
      logger?.error('Deepgram STT error', err?.response?.data || err.message);
      throw err;
    }
  }

  // Default: OpenAI Whisper (REST multipart)
  if (!OPENAI_KEY) throw new Error('OPENAI_KEY not configured for speechToText');

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', model);
    if (language) form.append('language', language);

    const resp = await axios.post(
      `${OPENAI_BASE}/audio/transcriptions`,
      form,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        timeout: 120000
      }
    );

    const text = resp.data?.text ?? '';
    return text;
  } catch (err) {
    logger?.error('OpenAI Whisper STT error', err?.response?.data || err.message);
    throw err;
  }
}

/**
 * textToSpeech:
 * - text: texte à convertir
 * - options: { lang, slow, filename (optionnel) }
 *
 * Utilise google-tts-api pour générer une URL audio -> télécharge et sauvegarde,
 * retourne { filepath, urlPublic (internal path) }
 */
async function textToSpeech({ text, lang = 'fr', slow = false, filename = null }) {
  if (!text) throw new Error('text required for TTS');

  // google-tts-api fournit une URL (Google Translate TTS). Pour usage production, privilégier un TTS payant.
  try {
    const url = googleTTS.getAudioUrl(text, {
      lang,
      slow,
      host: 'https://translate.google.com'
    });

    // télécharger et sauvegarder le fichier
    const finalName = filename || `tts-${Date.now()}-${uuidv4()}.mp3`;
    const filepath = await downloadToFile(url, finalName);

    return { filepath, url: `/uploads/${path.basename(filepath)}` };
  } catch (err) {
    logger?.error('textToSpeech error', err?.response?.data || err.message);
    throw err;
  }
}

/**
 * generateTutorial:
 * - page, role
 * Appelle chatCompletion avec prompt system spécialisé pour générer JSON de steps.
 * Retourne l'objet JSON parsé si possible, sinon raw text.
 */
async function generateTutorial({ page = 'unknown', role = 'user', userId = null }) {
  const systemPrompt = `
Tu es un assistant qui génère des tutoriels pas-à-pas pour une application Marketplace.
Format de sortie souhaité : JSON strict avec la clé "steps" c'est un tableau d'objets
{ "title": "...", "desc": "...", "target": "element_key" }.
Génère entre 3 et 8 étapes pour la page : ${page} et le rôle : ${role}.
Répond uniquement en JSON si possible.
  `.trim();

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Génère le tutoriel pour un ${role} sur la page "${page}".` }
  ];

  const text = await chatCompletion({ messages, userId });

  // try parse JSON
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    // si pas JSON, retourne la string brute (frontend devra parser)
    logger?.warn('generateTutorial: réponse non JSON, renvoi brut');
    return { raw: text };
  }
}

/**
 * summarizeConversation : prendre un array de messages, demander un résumé court
 */
async function summarizeConversation({ messages, userId = null }) {
  const system = 'Tu es un assistant qui résume succinctement une conversation entre utilisateur et assistant.';
  const messagesPayload = [
    { role: 'system', content: system },
    { role: 'user', content: `Résume la conversation suivante en 2-4 phrases :\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}` }
  ];

  const summary = await chatCompletion({ messages: messagesPayload, userId });
  return summary;
}

/**
 * small util: accept an uploaded audio (buffer) and save to file
 */
async function saveUploadedAudio({ buffer, originalName = 'audio' }) {
  const filename = `${Date.now()}-${uuidv4()}-${originalName}`;
  const filepath = path.join(STORAGE_PATH, filename);
  await fs.promises.writeFile(filepath, buffer);
  return filepath;
}

module.exports = {
  chatCompletion,
  speechToText,
  textToSpeech,
  convertAudio,
  generateTutorial,
  summarizeConversation,
  saveBufferToFile,
  saveUploadedAudio
};
