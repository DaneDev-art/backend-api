const crypto = require("crypto");
const User = require("../models/user.model");

/**
 * Générer un code de parrainage unique
 * @param {Number} length - longueur du code (6-8 recommandé)
 * @param {Number} maxAttempts - nombre max de tentatives pour générer un code unique
 * @returns {String} code unique
 */
const generateReferralCode = async (length = 6, maxAttempts = 10) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  let attempt = 0;

  while (attempt < maxAttempts) {
    code = Array.from({ length }, () =>
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).join("");

    // Vérifier unicité
    const existingUser = await User.findOne({ referralCode: code }).lean();
    if (!existingUser) return code;

    attempt++;
  }

  throw new Error("Impossible de générer un code de parrainage unique après plusieurs tentatives");
};

module.exports = generateReferralCode;
