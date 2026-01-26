// =============================================
// services/QosPayService.js
// QOSPAY REAL (TM / TG / CARD)
// BASIC AUTH — PROD READY (FINAL FIX)
// =============================================

const axios = require("axios");
const crypto = require("crypto");

const PayinTransaction = require("../models/PayinTransaction");
const PayoutTransaction = require("../models/PayoutTransaction");
const Order = require("../models/order.model");
const Seller = require("../models/Seller");

const { QOSPAY } = require("../config/qospay");

/* ======================================================
   📞 NORMALIZE PHONE (TG SAFE)
====================================================== */
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, "");
  if (p.startsWith("+228")) p = p.slice(1);
  if (!p.startsWith("228")) p = "228" + p;
  return p;
}

/* ======================================================
   🔹 TRANSACTION REF
====================================================== */
function generateTransactionRef(prefix = "QOS") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

/* ======================================================
   🔹 RESOLVE OPERATOR (TM / TG / CARD)
   - Togocel : 70, 71, 72, 73, 90, 91, 92, 93 → TM
   - Moov   : 78, 79, 96, 97, 98, 99       → TG
====================================================== */
function resolveOperator(operator, phone) {
  if (operator && ["TM", "TG", "CARD"].includes(operator.toUpperCase())) {
    return operator.toUpperCase();
  }

  const p = normalizePhone(phone);
  const prefix = p.slice(3, 5); // après 228

  const togocelPrefixes = ["70", "71", "72", "73", "90", "91", "92", "93"];
  const moovPrefixes = ["78", "79", "96", "97", "98", "99"];

  if (togocelPrefixes.includes(prefix)) return "TM";
  if (moovPrefixes.includes(prefix)) return "TG";

  throw new Error("UNSUPPORTED_OPERATOR");
}

/* ======================================================
   🔐 AXIOS AUTH CONFIG (QOSIC REAL)
====================================================== */
function getAxiosConfig(op) {
  const cfg = QOSPAY[op];

  if (!cfg?.USERNAME || !cfg?.PASSWORD) {
    throw new Error(`QOSPAY_AUTH_NOT_DEFINED_FOR_${op}`);
  }

  return {
    timeout: 20000,
    auth: {
      username: cfg.USERNAME,
      password: cfg.PASSWORD,
    },
    headers: {
      "Content-Type": "application/json",
    },
  };
}

module.exports = {
  /* ======================================================
     🟢 PAYIN (ESCROW)
  ====================================================== */
  createPayIn: async ({ orderId, amount, buyerPhone, operator }) => {
    if (!orderId) throw new Error("ORDER_ID_REQUIRED");
    if (!buyerPhone) throw new Error("BUYER_PHONE_REQUIRED");

    const phone = normalizePhone(buyerPhone);

    const order = await Order.findById(orderId).populate("seller client");
    if (!order) throw new Error("ORDER_NOT_FOUND");

    // 🔒 IDEMPOTENCE
    const existing = await PayinTransaction.findOne({
      order: orderId,
      status: { $in: ["PENDING", "SUCCESS"] },
    });

    if (existing) {
      return {
        success: true,
        transaction_id: existing.transaction_id,
        payinTransactionId: existing._id,
        provider: "QOSPAY",
      };
    }

    // 🔹 Resolve operator
    let op;
    try {
      op = resolveOperator(operator, phone);
    } catch {
      return {
        success: false,
        error: "Numéro non supporté ou opérateur invalide",
        operatorDetected: null,
      };
    }

    // 🔹 Config check
    if (
      !QOSPAY[op] ||
      !QOSPAY[op].USERNAME ||
      !QOSPAY[op].PASSWORD ||
      !QOSPAY[op].CLIENT_ID
    ) {
      return {
        success: false,
        error: `Configuration QOSPAY incomplète pour ${op}`,
        operatorDetected: op,
      };
    }

    const transref = generateTransactionRef("PAY");

    // ⭐ PAYLOAD QOSIC COMPLET (clé du push USSD)
    const payload = {
      msisdn: phone,
      amount: String(amount),
      transref,
      clientid: QOSPAY[op].CLIENT_ID,
    };

    let response;
    try {
      response = await axios.post(
        QOSPAY[op].REQUEST,
        payload,
        getAxiosConfig(op)
      );
    } catch (err) {
      console.error("❌ QOSPAY Axios Error:", err.message);
      return {
        success: false,
        error: "Erreur lors de l'appel QOSPAY",
        operatorDetected: op,
        transaction_id: transref,
      };
    }

    console.log("✅ QOSPAY PAYIN SENT", {
      operator: op,
      phone,
      clientid: QOSPAY[op].CLIENT_ID,
      response: response.data,
    });

    const code = response?.data?.responsecode;
    let status = "PENDING";
    if (code === "00") status = "SUCCESS";
    if (code && !["00", "01"].includes(code)) status = "FAILED";

    const payin = await PayinTransaction.create({
      order: order._id,
      seller: order.seller._id,
      client: order.client._id,
      provider: "QOSPAY",
      operator: op,
      amount: Number(amount),
      netAmount: Number(order.netAmount),
      currency: order.currency || "XOF",
      transaction_id: transref,
      status,
      raw_response: response.data,
    });

    order.payinTransaction = payin._id;
    order.status = status === "FAILED" ? "PAYMENT_FAILED" : "PAYMENT_PENDING";
    await order.save();

    return {
      success: status !== "FAILED",
      transaction_id: transref,
      payinTransactionId: payin._id,
      operatorDetected: op,
      provider: "QOSPAY",
    };
  },

  /* ======================================================
     🔁 VERIFY PAYIN
  ====================================================== */
  verifyPayIn: async (transactionId) => {
    const tx = await PayinTransaction.findOne({
      transaction_id: transactionId,
    });

    if (!tx) throw new Error("TRANSACTION_NOT_FOUND");

    if (tx.status === "SUCCESS") {
      return {
        transaction_id: transactionId,
        status: "SUCCESS",
        success: true,
        provider: "QOSPAY",
      };
    }

    const op = tx.operator;

    const response = await axios.post(
      QOSPAY[op].STATUS,
      { transref: transactionId },
      getAxiosConfig(op)
    );

    const code = response?.data?.responsecode;

    let status = "PENDING";
    if (code === "00") status = "SUCCESS";
    if (code && !["00", "01"].includes(code)) status = "FAILED";

    tx.status = status;
    tx.raw_response = response.data;
    await tx.save();

    return {
      transaction_id: transactionId,
      status,
      success: status === "SUCCESS",
      provider: "QOSPAY",
    };
  },

  /* ======================================================
     🔵 PAYOUT SELLER (DEPOSIT)
  ====================================================== */
  createPayOutForSeller: async ({ sellerId, amount, operator }) => {
    const seller = await Seller.findById(sellerId);
    if (!seller?.phone) throw new Error("SELLER_PHONE_REQUIRED");

    const phone = normalizePhone(seller.phone);
    const op = resolveOperator(operator, phone);

    if (op === "CARD") {
      throw new Error("CARD_PAYOUT_NOT_SUPPORTED");
    }

    const transref = generateTransactionRef("WD");

    const payload = {
      msisdn: phone,
      amount: String(amount),
      transref,
      clientid: QOSPAY[op].CLIENT_ID,
    };

    const response = await axios.post(
      QOSPAY[op].DEPOSIT,
      payload,
      getAxiosConfig(op)
    );

    const code = response?.data?.responsecode;

    let status = "PENDING";
    if (code === "00") status = "SUCCESS";
    if (code && !["00", "01"].includes(code)) status = "FAILED";

    await PayoutTransaction.create({
      seller: seller._id,
      provider: "QOSPAY",
      operator: op,
      amount: Number(amount),
      sent_amount: Number(amount),
      fees: 0,
      currency: "XOF",
      transaction_id: transref,
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
  },
};
