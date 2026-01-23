import axios from "axios";
import crypto from "crypto";

import PayinTransaction from "../models/PayinTransaction.js";
import PayoutTransaction from "../models/PayoutTransaction.js";
import Order from "../models/order.model.js";
import Seller from "../models/Seller.js";

import { QOSPAY } from "../config/qospay.js";

class QosPayService {
  static generateTransactionRef(prefix = "QOS") {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /* ======================================================
     🟢 PAYIN - MARKETPLACE (ESCROW)
  ====================================================== */
  static async createPayIn({
    orderId,
    amount,
    buyerPhone,
    operator, // "TM" | "TG"
  }) {
    if (!orderId) throw new Error("ORDER_ID_REQUIRED");

    const order = await Order.findById(orderId);
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const transref = this.generateTransactionRef("PAY");

    const url =
      operator === "TM"
        ? QOSPAY.TM.REQUEST
        : QOSPAY.TG.REQUEST;

    const payload = {
      msisdn: buyerPhone,
      amount: String(amount),
      transref,
      clientid: QOSPAY.CLIENT_ID,
    };

    const response = await axios.post(url, payload, { timeout: 20000 });

    const status = response?.data?.status?.toUpperCase();

    if (!["PENDING", "SUCCESS"].includes(status)) {
      throw new Error("QOSPAY_PAYIN_REJECTED");
    }

    // 🔐 Création PayinTransaction
    const payin = await PayinTransaction.create({
      order: order._id,
      seller: order.seller,
      client: order.client,

      provider: "QOSPAY",
      operator,

      amount,
      currency: order.currency || "XOF",

      transaction_id: transref,
      status: status === "SUCCESS" ? "SUCCESS" : "PENDING",

      raw_response: response.data,
    });

    // 🔗 Lien fort Order <-> Payin
    order.payinTransaction = payin._id;
    order.status = "PAYMENT_PENDING"; // ⛔ PAS PAID ICI
    await order.save();

    return {
      success: true,
      transactionId: transref,
      status,
    };
  }

  /* ======================================================
     🟡 VERIFY PAYIN
     ➜ déclenche le PAID + ESCROW
  ====================================================== */
  static async verifyPayIn(transref) {
    const transaction = await PayinTransaction.findOne({
      transaction_id: transref,
      provider: "QOSPAY",
    }).populate("order");

    if (!transaction) {
      throw new Error("TRANSACTION_NOT_FOUND");
    }

    if (transaction.status === "SUCCESS") {
      return { success: true, status: "SUCCESS" };
    }

    const url =
      transaction.operator === "TM"
        ? QOSPAY.TM.STATUS
        : QOSPAY.TG.STATUS;

    const response = await axios.post(
      url,
      {
        transref,
        clientid: QOSPAY.CLIENT_ID,
      },
      { timeout: 15000 }
    );

    const status = response?.data?.status?.toUpperCase();

    if (status === "SUCCESS") {
      transaction.status = "SUCCESS";
      await transaction.save();

      // 🔐 ESCROW LOCK
      const order = await Order.findById(transaction.order);
      order.status = "PAID";
      order.escrow.isLocked = true;
      await order.save();

      return { success: true, status };
    }

    if (["FAILED", "CANCELLED", "ERROR"].includes(status)) {
      transaction.status = "FAILED";
      await transaction.save();
      return { success: false, status };
    }

    return { success: false, status: "PENDING" };
  }

  /* ======================================================
     🔵 PAYOUT - RETRAIT VENDEUR
  ====================================================== */
  static async createPayOutForSeller({
    sellerId,
    amount,
    operator,
  }) {
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error("SELLER_NOT_FOUND");

    const transref = this.generateTransactionRef("WD");

    const url =
      operator === "TM"
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

      amount,
      currency: "XOF",

      client_transaction_id: transref,
      sent_amount: amount,

      prefix: seller.prefix,
      phone: seller.phone,

      status,
      raw_response: response.data,
    });

    return {
      success: status === "SUCCESS",
      transactionId: transref,
      status,
    };
  }
}

export default QosPayService;
