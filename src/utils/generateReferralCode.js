const crypto = require("crypto");
const User = require("../models/user.model");

/**
 * Générer un code de parrainage unique
 * @param {Number} length - longueur du code (6-8 recommandé)
 * @returns {String} code unique
 */
const generateReferralCode = async (length = 6) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  let code;
  let exists = true;

  while (exists) {
    // Génération aléatoire
    code = Array.from({ length }, () =>
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).join('');

    // Vérifier unicité
    exists = await User.exists({ referralCode: code });
  }

  return code;
};

module.exports = generateReferralCode;
