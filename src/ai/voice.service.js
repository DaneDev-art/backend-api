// ================================================
// src/ai/voice.service.js
// Gestion audio — mode démo
// ================================================

const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const { textToSpeech, convertAudio } = require("./ai.service");

ffmpeg.setFfmpegPath(ffmpegPath);

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH, { recursive: true });

// 🔧 Helper : Get audio duration
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

// 🔧 Helper : Validate audio
async function validateAudio(filePath, { maxDuration = 120 } = {}) {
  if (!fs.existsSync(filePath)) throw new Error("Audio file not found");

  const duration = await getAudioDuration(filePath);
  if (duration > maxDuration) {
    throw new Error(`Audio trop long : ${duration}s. Max autorisé : ${maxDuration}s`);
  }

  return true;
}

// 🔧 Save buffer → file
async function saveAudioFromBuffer(buffer, extension = "mp3") {
  const fileName = `audio-${Date.now()}-${uuidv4()}.${extension}`;
  const filePath = path.join(STORAGE_PATH, fileName);

  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

// 🔧 Normalize audio → wav
async function normalizeAudioForSTT(filePath) {
  const wavPath = await convertAudio(filePath, { format: "wav" });
  return wavPath;
}

// 🎤 → 📝 Speech-to-Text (DEMO)
async function audioToTextWorkflow({ buffer = null, filePath = null }) {
  let savedPath = filePath;
  if (!savedPath && buffer) {
    savedPath = await saveAudioFromBuffer(buffer, "mp3");
  }
  if (!savedPath) throw new Error("No audio provided");

  await validateAudio(savedPath);
  const wavFile = await normalizeAudioForSTT(savedPath);

  // 🔹 Mode démo : on renvoie un texte fixe
  const dummyText = "Texte démo généré depuis l'audio (mode démo)";

  return {
    text: dummyText,
    file_saved: savedPath,
    file_converted: wavFile
  };
}

// 📝 → 🔊 Text-to-Speech (Google TTS)
async function textToAudioWorkflow({ text, lang = "fr", slow = false }) {
  if (!text) throw new Error("Le texte est obligatoire");

  const result = await textToSpeech({ text, lang, slow });
  return result; // { filepath, url }
}

// 🗑 Delete audio files
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

// 🧹 Clean temp files
async function cleanTempFiles(files = []) {
  for (const f of files) {
    await deleteFileIfExists(f);
  }
}

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
