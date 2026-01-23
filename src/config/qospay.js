export const QOSPAY = {
  CLIENT_ID: process.env.QOS_CLIENT_ID,

  TM: {
    REQUEST: "https://api.qosic.net/QosicBridge/tm/v1/requestpayment",
    STATUS: "https://api.qosic.net/QosicBridge/tm/v1/gettransactionstatus",
    DEPOSIT: "https://api.qosic.net/QosicBridge/tm/v1/deposit"
  },

  TG: {
    REQUEST: "https://api.qosic.net/QosicBridge/tg/v1/requestpayment",
    STATUS: "https://api.qosic.net/QosicBridge/tg/v1/gettransactionstatus",
    DEPOSIT: "https://api.qosic.net/QosicBridge/tg/v1/deposit"
  }
};
