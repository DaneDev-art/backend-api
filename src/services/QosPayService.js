// =============================================
// services/QosPayService.js
// QOSPAY REAL (TM / TG)
// ESCROW SAFE — PROD READY
// =============================================

import axios from "axios";
import crypto from "crypto";

import PayinTransaction from "../models/PayinTransaction.js";
import PayoutTransaction from "../models/PayoutTransaction.js";
import Order from "../models/order.model.js";
import Seller from "../models/Seller.js";

import { QOSPAY } from "../config/qospay.js";

class QosPayService {
  /* ======================================================
     🔹 TRANSACTION REF
  ====================================================== */
  static generateTransactionRef(prefix = "QOS") {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /* ======================================================
     🔹 RESOLVE OPERATOR (TM / TG)
     👉 AUTO autorisé ici, PAS côté API
  ====================================================== */
  static resolveOperator(operator, phone) {
    if (operator && ["TM", "TG"].includes(operator.toUpperCase())) {
      return operator.toUpperCase();
    }

    if (!phone) {
      throw new Error("CANNOT_RESOLVE_OPERATOR_NO_PHONE");
    }

    // 🇹🇬 Règles QOSPAY Togo
    if (phone.startsWith("22890") || phone.startsWith("+22890")) return "TM";
    if (phone.startsWith("22891") || phone.startsWith("+22891")) return "TG";

    // fallback sécurisé
    return "TM";
  }

  /* ======================================================
     🟢 PAYIN (ESCROW)
  ====================================================== */
  static async createPayIn({ orderId, amount, buyerPhone, operator }) {
    if (!orderId) throw new Error("ORDER_ID_REQUIRED");
    if (!buyerPhone) throw new Error("BUYER_PHONE_REQUIRED");

    const order = await Order.findById(orderId).populate("seller client");
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const op = this.resolveOperator(operator, buyerPhone);
    const transref = this.generateTransactionRef("PAY");

    const url =
      op === "TM"
        ? QOSPAY.TM.REQUEST
        : QOSPAY.TG.REQUEST;

    const payload = {
      msisdn: buyerPhone,
      amount: String(amount),
      transref,
      clientid: QOSPAY.CLIENT_ID,
    };

    const response = await axios.post(url, payload, { timeout: 20000 });
    const status = response?.data?.status?.toUpperCase() || "PENDING";

    if (!["PENDING", "SUCCESS"].includes(status)) {
      throw new Error("QOSPAY_PAYIN_REJECTED");
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
      payment_url: null, // ⚠️ QOSPAY = validation USSD / SIM Toolkit
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

    const url =
      transaction.operator === "TM"
        ? QOSPAY.TM.STATUS
        : QOSPAY.TG.STATUS;

    const response = await axios.post(
      url,
      {
        transref: transactionId,
        clientid: QOSPAY.CLIENT_ID,
      },
      { timeout: 15000 }
    );

    const status = response?.data?.status?.toUpperCase() || "PENDING";

    transaction.status = ["SUCCESS", "FAILED"].includes(status)
      ? status
      : "PENDING";

    await transaction.save();

    if (status === "SUCCESS" && transaction.order) {
      const order = await Order.findById(transaction.order._id);
      if (order) {
        order.status = "PAID";
        order.escrow.isLocked = true;
        await order.save();
      }
    }

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
    if (!seller) throw new Error("SELLER_NOT_FOUND");

    const op = this.resolveOperator(operator, seller.phone);
    const transref = this.generateTransactionRef("WD");

    const url =
      op === "TM"
        ? QOSPAY.TM.DEPOSIT
        : QOSPAY.TG.DEPOSIT;

    const payload = {
      msisdn: seller.phone,
      amount: String(amount),
      transref,
      clientid: QOSPAY.CLIENT_ID,
    };

    const response = await axios.post(url, payload, { timeout: 20000 });
    const status = response?.data?.status?.toUpperCase() || "PENDING";

    await PayoutTransaction.create({
      seller: seller._id,
      sellerId: seller._id,
      provider: "QOSPAY",
      operator: op,
      amount: Number(amount),
      currency: "XOF",
      client_transaction_id: transref,
      phone: seller.phone,
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

export default QosPayService;
