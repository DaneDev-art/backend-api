// =============================================
// services/QosPayService.js
// QOSPAY REAL (TM / TG / CARD)
// BASIC AUTH — PROD READY (FIXED)
// =============================================

const axios = require("axios");
const crypto = require("crypto");

const PayinTransaction = require("../models/PayinTransaction");
const PayoutTransaction = require("../models/PayoutTransaction");
const Order = require("../models/order.model");
const Seller = require("../models/Seller");

const { QOSPAY, QOS_USERNAME } = require("../config/qospay");

/* ======================================================
   📞 NORMALIZE PHONE
====================================================== */
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, "");
  if (p.startsWith("+228")) p = p.slice(1);
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
     🔹 RESOLVE OPERATOR
  ====================================================== */
  static resolveOperator(operator, phone) {
    if (operator && ["TM", "TG", "CARD"].includes(operator.toUpperCase())) {
      return operator.toUpperCase();
    }

    const p = normalizePhone(phone);
    if (p.startsWith("22890")) return "TM";
    if (p.startsWith("22891")) return "TG";
    return "TM";
  }

  /* ======================================================
     🔐 AXIOS AUTH CONFIG (CORRECT)
  ====================================================== */
  static getAxiosConfig(op) {
    const cfg = QOSPAY[op];

    if (!QOS_USERNAME || !cfg?.PASSWORD) {
      throw new Error(`QOSPAY_AUTH_NOT_DEFINED_FOR_${op}`);
    }

    return {
      timeout: 20000,
      auth: {
        username: QOS_USERNAME, // ✅ GLOBAL USER
        password: cfg.PASSWORD, // ✅ OPERATOR PASSWORD
      },
      headers: {
        "Content-Type": "application/json",
      },
    };
  }

  /* ======================================================
     🟢 PAYIN
  ====================================================== */
  static async createPayIn({ orderId, amount, buyerPhone, operator }) {
    if (!orderId) throw new Error("ORDER_ID_REQUIRED");
    if (!buyerPhone) throw new Error("BUYER_PHONE_REQUIRED");

    const phone = normalizePhone(buyerPhone);
    const order = await Order.findById(orderId).populate("seller client");
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const op = this.resolveOperator(operator, phone);
    const transref = this.generateTransactionRef("PAY");

    const payload = {
      msisdn: phone,
      amount: String(amount),
      transref,
      clientid: QOSPAY[op].CLIENT_ID, // ✅ IMPORTANT
    };

    const response = await axios.post(
      QOSPAY[op].REQUEST,
      payload,
      this.getAxiosConfig(op)
    );

    const status = (response?.data?.responsecode === "00")
      ? "SUCCESS"
      : "PENDING";

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
      provider: "QOSPAY",
    };
  }

  /* ======================================================
     🔁 VERIFY PAYIN
  ====================================================== */
  static async verifyPayIn(transactionId) {
    const tx = await PayinTransaction.findOne({ transaction_id: transactionId });
    if (!tx) throw new Error("TRANSACTION_NOT_FOUND");

    if (tx.status === "SUCCESS") {
      return { success: true, status: "SUCCESS" };
    }

    const op = tx.operator;

    const response = await axios.post(
      QOSPAY[op].STATUS,
      {
        transref: transactionId,
        clientid: QOSPAY[op].CLIENT_ID,
      },
      this.getAxiosConfig(op)
    );

    const status =
      response?.data?.responsecode === "00" ? "SUCCESS" : "PENDING";

    tx.status = status;
    await tx.save();

    return {
      transaction_id: transactionId,
      status,
      success: status === "SUCCESS",
      provider: "QOSPAY",
    };
  }

  /* ======================================================
     🔵 PAYOUT SELLER
  ====================================================== */
  static async createPayOutForSeller({ sellerId, amount, operator }) {
    const seller = await Seller.findById(sellerId);
    if (!seller?.phone) throw new Error("SELLER_PHONE_REQUIRED");

    const phone = normalizePhone(seller.phone);
    const op = this.resolveOperator(operator, phone);
    const transref = this.generateTransactionRef("WD");

    const payload = {
      msisdn: phone,
      amount: String(amount),
      transref,
      clientid: QOSPAY[op].CLIENT_ID,
    };

    const response = await axios.post(
      QOSPAY[op].DEPOSIT,
      payload,
      this.getAxiosConfig(op)
    );

    const status =
      response?.data?.responsecode === "00" ? "SUCCESS" : "PENDING";

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

module.exports = QosPayService;
