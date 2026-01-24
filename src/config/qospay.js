export const QOSPAY = {
  TM: {
    REQUEST: "https://api.qosic.net/QosicBridge/tm/v1/requestpayment",
    STATUS: "https://api.qosic.net/QosicBridge/tm/v1/gettransactionstatus",
    DEPOSIT: "https://api.qosic.net/QosicBridge/tm/v1/deposit",
    CLIENT_ID: process.env.QOS_TM_CLIENT_ID, // pour TOGOCEL / TM
  },

  TG: {
    REQUEST: "https://api.qosic.net/QosicBridge/tg/v1/requestpayment",
    STATUS: "https://api.qosic.net/QosicBridge/tg/v1/gettransactionstatus",
    DEPOSIT: "https://api.qosic.net/QosicBridge/tg/v1/deposit",
    CLIENT_ID: process.env.QOS_TG_CLIENT_ID, // pour MOOV / TG
  },

  CARD: {
    CLIENT_ID: process.env.QOS_CARD_CLIENT_ID, // pour les paiements par carte
  },
};
