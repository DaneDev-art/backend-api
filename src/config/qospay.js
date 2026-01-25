// =============================================
// config/qospay.js
// QOSPAY CONFIG — PROD READY
// =============================================

export const QOS_USERNAME = process.env.QOS_USERNAME; // QSUSR5297

export const QOSPAY = {
  /* ==========================
     TOGOCEL / TM
  ========================== */
  TM: {
    CLIENT_ID: process.env.QOS_TM_CLIENT_ID, // TG_EMARrpd

    PASSWORD: process.env.QOS_TM_PASSWORD, // mot de passe TOGOCEL

    REQUEST: process.env.QOS_TM_REQUEST,
    STATUS: process.env.QOS_TM_STATUS,
    DEPOSIT: process.env.QOS_TM_DEPOSIT,
  },

  /* ==========================
     MOOV / TG
  ========================== */
  TG: {
    CLIENT_ID: process.env.QOS_TG_CLIENT_ID, // TG_EMARQCT

    PASSWORD: process.env.QOS_TG_PASSWORD, // mot de passe MOOV

    REQUEST: process.env.QOS_TG_REQUEST,
    STATUS: process.env.QOS_TG_STATUS,
    DEPOSIT: process.env.QOS_TG_DEPOSIT,
  },

  /* ==========================
     CARD (OPTIONNEL)
  ========================== */
  CARD: {
    CLIENT_ID: process.env.QOS_CARD_CLIENT_ID, // QOSPAYTG1140
    PASSWORD: process.env.QOS_CARD_PASSWORD,
  },
};
