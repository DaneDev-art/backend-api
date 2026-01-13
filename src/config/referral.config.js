/**
 * ===============================
 * 🤝 CONFIGURATION PARRAINAGE
 * ===============================
 * Tout est centralisé ici
 */

module.exports = {
  /**
   * 🎯 Taux de commission direct (%)
   * Commission fixe sur chaque gain du filleul
   */
  COMMISSION_PERCENTAGES: {
    SELLER: 1, // 1% sur chaque vente d’un seller parrainé
    USER: 1,   // 1% sur les gains buyer / delivery
  },

  /**
   * ⏱️ Délai avant que la commission soit disponible
   * (anti-fraude / retours / litiges)
   */
  COMMISSION_DELAY_DAYS: 7,

  /**
   * ⛔ Limites & règles de parrainage
   */
  REFERRAL_RULES: {
    MAX_REFERRAL_DAYS_AFTER_SIGNUP: 7, // délai max pour appliquer un code
    ALLOWED_ROLES: ["buyer", "seller", "delivery"], // rôles éligibles
    // plus de limitation du nombre de filleuls
  },
};
