export const QOSPAY = {
  TM: {
    REQUEST: process.env.QOS_TM_REQUEST,
    STATUS: process.env.QOS_TM_STATUS,
    DEPOSIT: process.env.QOS_TM_DEPOSIT,

    USERNAME: process.env.QOS_TM_USERNAME, // QSUSR5297
    PASSWORD: process.env.QOS_TM_PASSWORD, // mot de passe TOGOCEL
  },

  TG: {
    REQUEST: process.env.QOS_TG_REQUEST,
    STATUS: process.env.QOS_TG_STATUS,
    DEPOSIT: process.env.QOS_TG_DEPOSIT,

    USERNAME: process.env.QOS_TG_USERNAME, // QSUSR5297
    PASSWORD: process.env.QOS_TG_PASSWORD, // mot de passe MOOV
  },

  CARD: {
    USERNAME: process.env.QOS_CARD_USERNAME, // QSUSR5297
    PASSWORD: process.env.QOS_CARD_PASSWORD, // mot de passe CARD
  },
};
