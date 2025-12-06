// src/ai/voice.service.js
/**
 * voice.service.js
 * Gestion complète de l'audio pour ton application :
 *  - Sauvegarde audio (upload ou buffer)
 *  - Normalisation audio (ffmpeg)
 *  - Speech-To-Text (via ai.service.js : OpenAI / Deepgram)
 *  - Text-To-Speech (via ai.service.js)
 *  - Nettoyage des fichiers temporaires
 */

const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const {
  speechToText,
  textToSpeech,
  convertAudio,
  saveUploadedAudio
} = require("./ai.service");

ffmpeg.setFfmpegPath(ffmpegPath);

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH, { recursive: true });

/* -------------------------------------------------------
 *  🔧 Helper : Get audio duration
 * ------------------------------------------------------ */
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

/* -------------------------------------------------------
 *  🔧 Helper : Validate audio file (duration & format)
 * ------------------------------------------------------ */
async function validateAudio(filePath, { maxDuration = 120 } = {}) {
  if (!fs.existsSync(filePath)) throw new Error("Audio file not found");

  // Vérifier durée max (en secondes)
  const duration = await getAudioDuration(filePath);
  if (duration > maxDuration) {
    throw new Error(`Audio trop long : ${duration}s. Max autorisé : ${maxDuration}s`);
  }

  return true;
}

/* -------------------------------------------------------
 *  🔧 Save buffer → file
 * ------------------------------------------------------ */
async function saveAudioFromBuffer(buffer, extension = "mp3") {
  const fileName = `audio-${Date.now()}-${uuidv4()}.${extension}`;
  const filePath = path.join(STORAGE_PATH, fileName);

  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

/* -------------------------------------------------------
 *  🔧 Normalize audio → wav (for STT)
 * ------------------------------------------------------ */
async function normalizeAudioForSTT(filePath) {
  // Convertir en WAV pour Whisper/Deepgram
  const wavPath = await convertAudio(filePath, { format: "wav" });
  return wavPath;
}

/* -------------------------------------------------------
 *  🎤 → 📝 Speech-to-Text workflow complet
 * ------------------------------------------------------ */
async function audioToTextWorkflow({
  buffer = null,
  filePath = null,
  provider = "openai",  // 'openai' | 'deepgram'
  language = null
}) {
  try {
    // 1. Sauvegarde audio
    let savedPath = filePath;

    if (!savedPath && buffer) {
      savedPath = await saveAudioFromBuffer(buffer, "mp3");
    }

    if (!savedPath) throw new Error("No audio provided");

    // 2. Validation basique
    await validateAudio(savedPath);

    // 3. Normalisation (WAV)
    const wavFile = await normalizeAudioForSTT(savedPath);

    // 4. Speech-To-Text
    const text = await speechToText({
      filePath: wavFile,
      provider,
      language
    });

    return {
      text,
      file_saved: savedPath,
      file_converted: wavFile
    };
  } catch (err) {
    console.error("audioToTextWorkflow error:", err);
    throw err;
  }
}

/* -------------------------------------------------------
 *  📝 → 🔊 Text-to-Speech (génère fichier MP3)
 * ------------------------------------------------------ */
async function textToAudioWorkflow({
  text,
  lang = "fr",
  slow = false
}) {
  if (!text) throw new Error("Le texte est obligatoire");

  const result = await textToSpeech({ text, lang, slow });
  return result; // { filepath, url }
}

/* -------------------------------------------------------
 *  🗑 Delete audio files
 * ------------------------------------------------------ */
async function deleteFileIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (e) {
    console.warn("deleteFileIfExists error:", e.message);
  }
}

/* -------------------------------------------------------
 *  🧹 Clean temp files (list of paths)
 * ------------------------------------------------------ */
async function cleanTempFiles(files = []) {
  for (const f of files) {
    await deleteFileIfExists(f);
  }
}

/* -------------------------------------------------------
 *  📦 Export public methods
 * ------------------------------------------------------ */
module.exports = {
  getAudioDuration,
  validateAudio,
  saveAudioFromBuffer,
  normalizeAudioForSTT,
  audioToTextWorkflow,
  textToAudioWorkflow,
  deleteFileIfExists,
  cleanTempFiles
};
