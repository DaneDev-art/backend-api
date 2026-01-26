// =============================================
// config/qospay.js
// QOSPAY CONFIG — PROD READY (TM / TG / CARD)
// =============================================

// 🔐 USERNAME GLOBAL QOSPAY (fourni par QOSIC)
// Ex: QSUSR5297
export const QOS_USERNAME = process.env.QOS_USERNAME;

export const QOSPAY = {
  /* ==========================
     TOGOCEL / TM
     Prefixes: 70,71,72,73,90,91,92,93
  ========================== */
  TM: {
    // 🔐 BASIC AUTH
    USERNAME: process.env.QOS_USERNAME,          // 👈 OBLIGATOIRE
    PASSWORD: process.env.QOS_TM_PASSWORD,       // mot de passe TOGOCEL

    // 🆔 CLIENT ID (fourni par QOSIC)
    CLIENT_ID: process.env.QOS_TM_CLIENT_ID,     // ex: TG_EMARrpd

    // 🌐 ENDPOINTS
    REQUEST: process.env.QOS_TM_REQUEST,         // payin
    STATUS: process.env.QOS_TM_STATUS,           // check status
    DEPOSIT: process.env.QOS_TM_DEPOSIT,         // payout vendeur
  },

  /* ==========================
     MOOV TOGO / TG
     Prefixes: 78,79,96,97,98,99
  ========================== */
  TG: {
    // 🔐 BASIC AUTH
    USERNAME: process.env.QOS_USERNAME,          // 👈 OBLIGATOIRE
    PASSWORD: process.env.QOS_TG_PASSWORD,       // mot de passe MOOV

    // 🆔 CLIENT ID
    CLIENT_ID: process.env.QOS_TG_CLIENT_ID,     // ex: TG_EMARQCT

    // 🌐 ENDPOINTS
    REQUEST: process.env.QOS_TG_REQUEST,
    STATUS: process.env.QOS_TG_STATUS,
    DEPOSIT: process.env.QOS_TG_DEPOSIT,
  },

  /* ==========================
     CARD (OPTIONNEL)
     (pas encore utilisé côté payout)
  ========================== */
  CARD: {
    USERNAME: process.env.QOS_USERNAME,
    PASSWORD: process.env.QOS_CARD_PASSWORD,
    CLIENT_ID: process.env.QOS_CARD_CLIENT_ID,   // ex: QOSPAYTG1140
  },
};
