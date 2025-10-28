require("dotenv").config();

// Vérification des variables CinetPay obligatoires
const requiredVars = [
  "CINETPAY_API_KEY",
  "CINETPAY_API_PASSWORD",
  "CINETPAY_SITE_ID",
  "CINETPAY_BASE_URL",
  "CINETPAY_PAYOUT_URL",
];

const missing = requiredVars.filter((v) => !process.env[v]);

if (missing.length > 0) {
  console.error(`❌ Erreur de configuration CinetPay :
Les variables suivantes sont manquantes dans ton .env :
${missing.join(", ")}`);
  process.exit(1); // Stoppe le serveur immédiatement
}

// Export des variables
module.exports = {
  CINETPAY_API_KEY: process.env.CINETPAY_API_KEY,
  CINETPAY_API_PASSWORD: process.env.CINETPAY_API_PASSWORD,
  CINETPAY_SITE_ID: process.env.CINETPAY_SITE_ID,
  CINETPAY_BASE_URL: process.env.CINETPAY_BASE_URL,
  CINETPAY_PAYOUT_URL: process.env.CINETPAY_PAYOUT_URL,
  NGROK_URL: process.env.NGROK_URL || null,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || null,
};
