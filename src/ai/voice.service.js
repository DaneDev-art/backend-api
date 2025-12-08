// ================================================
// src/ai/voice.service.js
// Gestion audio supprimée — mode démo sans voix
// ================================================

// Ce module ne gère plus l’audio.
// Les fonctions sont présentes pour compatibilité, mais ne font rien.

async function audioToTextWorkflow({ buffer = null, filePath = null }) {
  // Plus de traitement audio
  return { text: "Mode démo : audio désactivé" };
}

async function textToAudioWorkflow({ text, lang = "fr", slow = false }) {
  // Plus de TTS
  return { text, url: null, filepath: null };
}

async function deleteFileIfExists(filePath) {
  // Plus de fichiers à supprimer
  return;
}

async function cleanTempFiles(files = []) {
  // Plus de nettoyage nécessaire
  return;
}

module.exports = {
  audioToTextWorkflow,
  textToAudioWorkflow,
  deleteFileIfExists,
  cleanTempFiles
};
