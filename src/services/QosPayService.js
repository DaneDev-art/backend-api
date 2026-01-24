// =============================================
// services/QosPayService.js
// QOSPAY REAL (TM / TG)
// ESCROW SAFE — PROD READY
// =============================================

const axios = require("axios");
const crypto = require("crypto");

const PayinTransaction = require("../models/PayinTransaction");
const PayoutTransaction = require("../models/PayoutTransaction");
const Order = require("../models/order.model");
const Seller = require("../models/Seller");

const { QOSPAY } = require("../config/qospay");

/* ======================================================
   📞 NORMALIZE PHONE (TG / TM SAFE)
====================================================== */
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (!p.startsWith("228")) p = "228" + p;
  return p;
}

class QosPayService {
  /* ======================================================
     🔹 TRANSACTION REF
  ====================================================== */
  static generateTransactionRef(prefix = "QOS") {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /* ======================================================
     🔹 RESOLVE OPERATOR (TM / TG)
     👉 AUTO autorisé ici
  ====================================================== */
  static resolveOperator(operator, phone) {
    if (operator && ["TM", "TG"].includes(operator.toUpperCase())) {
      return operator.toUpperCase();
    }
    if (!phone) throw new Error("CANNOT_RESOLVE_OPERATOR_NO_PHONE");

    const p = normalizePhone(phone);

    if (p.startsWith("22890")) return "TM";
    if (p.startsWith("22891")) return "TG";

    return "TM"; // fallback
  }

  /* ======================================================
     🔹 GET CLIENT_ID FOR OPERATOR
  ====================================================== */
  static getClientId(op) {
    if (op === "TM") return QOSPAY.TM.CLIENT_ID;
    if (op === "TG") return QOSPAY.TG.CLIENT_ID;
    if (op === "CARD") return QOSPAY.CARD.CLIENT_ID;
    throw new Error("INVALID_OPERATOR_FOR_CLIENT_ID");
  }

  /* ======================================================
     🟢 PAYIN (ESCROW — ANY USER)
  ====================================================== */
  static async createPayIn({ orderId, amount, buyerPhone, operator }) {
    if (!orderId) throw new Error("ORDER_ID_REQUIRED");
    if (!buyerPhone) throw new Error("BUYER_PHONE_REQUIRED");

    const phone = normalizePhone(buyerPhone);
    const order = await Order.findById(orderId).populate("seller client");
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const op = this.resolveOperator(operator, phone);
    const transref = this.generateTransactionRef("PAY");
    const clientId = this.getClientId(op);

    const url = op === "TM" ? QOSPAY.TM.REQUEST : QOSPAY.TG.REQUEST;

    const payload = {
      msisdn: phone,
      amount: String(amount),
      transref,
      clientid: clientId,
    };

    const response = await axios.post(url, payload, { timeout: 20000 });
    const status = (response?.data?.status || "PENDING").toUpperCase();

    if (!["PENDING", "SUCCESS"].includes(status)) {
      throw new Error(`QOSPAY_PAYIN_REJECTED_${status}`);
    }

    const payin = await PayinTransaction.create({
      order: order._id,
      seller: order.seller._id,
      client: order.client._id,
      provider: "QOSPAY",
      operator: op,
      amount: Number(amount),
      currency: order.currency || "XOF",
      transaction_id: transref,
      phone,
      status,
      raw_response: response.data,
    });

    order.payinTransaction = payin._id;
    order.status = "PAYMENT_PENDING";
    await order.save();

    return {
      success: true,
      transaction_id: transref,
      payinTransactionId: payin._id,
      payment_url: null,
      netAmount: Number(amount),
      totalFees: 0,
      provider: "QOSPAY",
    };
  }

  /* ======================================================
     🔁 VERIFY PAYIN
  ====================================================== */
  static async verifyPayIn(transactionId) {
    const transaction = await PayinTransaction.findOne({
      transaction_id: transactionId,
      provider: "QOSPAY",
    }).populate("order");

    if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");

    if (transaction.status === "SUCCESS") {
      return {
        transaction_id: transactionId,
        status: "SUCCESS",
        provider: "QOSPAY",
        success: true,
      };
    }

    const op = transaction.operator;
    const clientId = this.getClientId(op);
    const url = op === "TM" ? QOSPAY.TM.STATUS : QOSPAY.TG.STATUS;

    const response = await axios.post(
      url,
      { transref: transactionId, clientid: clientId },
      { timeout: 15000 }
    );

    const status = (response?.data?.status || "PENDING").toUpperCase();
    transaction.status = ["SUCCESS", "FAILED"].includes(status) ? status : "PENDING";

    await transaction.save();

    return {
      transaction_id: transactionId,
      status,
      provider: "QOSPAY",
      success: status === "SUCCESS",
    };
  }

  /* ======================================================
     🔵 PAYOUT SELLER
  ====================================================== */
  static async createPayOutForSeller({ sellerId, amount, operator }) {
    const seller = await Seller.findById(sellerId);
    if (!seller || !seller.phone) throw new Error("SELLER_PHONE_REQUIRED");

    const phone = normalizePhone(seller.phone);
    const op = this.resolveOperator(operator, phone);
    const transref = this.generateTransactionRef("WD");
    const clientId = this.getClientId(op);

    const url = op === "TM" ? QOSPAY.TM.DEPOSIT : QOSPAY.TG.DEPOSIT;

    const payload = {
      msisdn: phone,
      amount: String(amount),
      transref,
      clientid: clientId,
    };

    const response = await axios.post(url, payload, { timeout: 20000 });
    const status = (response?.data?.status || "PENDING").toUpperCase();

    await PayoutTransaction.create({
      seller: seller._id,
      provider: "QOSPAY",
      operator: op,
      amount: Number(amount),
      currency: "XOF",
      client_transaction_id: transref,
      phone,
      status,
      raw_response: response.data,
    });

    return {
      success: status === "SUCCESS",
      transaction_id: transref,
      status,
      provider: "QOSPAY",
    };
  }
}

module.exports = QosPayService; // ✅ CommonJS
