// services/QosPayService.js
import axios from "axios";
import crypto from "crypto";

import PayinTransaction from "../models/PayinTransaction.js";
import PayoutTransaction from "../models/PayoutTransaction.js";
import Order from "../models/order.model.js";
import Seller from "../models/Seller.js";

import { QOSPAY } from "../config/qospay.js";

class QosPayService {
  // 🔹 Génère un identifiant de transaction unique
  static generateTransactionRef(prefix = "QOS") {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  // 🔹 Détermine automatiquement l'opérateur si AUTO
  static resolveOperator(operator, phone) {
    if (operator && operator.toUpperCase() !== "AUTO") return operator.toUpperCase();
    if (phone?.startsWith("+228") || phone?.startsWith("228")) return "TM"; // Togocel
    return "TG"; // Moov TG par défaut
  }

  /* ======================================================
     🟢 PAYIN - MARKETPLACE (ESCROW)
  ====================================================== */
  static async createPayIn({ orderId, amount, buyerPhone, operator = "AUTO" }) {
    if (!orderId) throw new Error("ORDER_ID_REQUIRED");

    const order = await Order.findById(orderId).populate("seller client");
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const op = this.resolveOperator(operator, buyerPhone);
    const transref = this.generateTransactionRef("PAY");

    // 🔹 URL QOSPAY selon opérateur
    const url = op === "TM" ? QOSPAY.TM.REQUEST : QOSPAY.TG.REQUEST;

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
      seller: order.seller._id,
      client: order.client._id,
      provider: "QOSPAY",
      operator: op,
      amount: Number(amount),
      currency: order.currency || "XOF",
      transaction_id: transref,
      status: status === "SUCCESS" ? "SUCCESS" : "PENDING",
      raw_response: response.data,
    });

    // 🔗 Lien Order <-> Payin
    order.payinTransaction = payin._id;
    order.status = "PAYMENT_PENDING";
    await order.save();

    // 🔹 Lien de paiement pour Flutter
    const paymentUrl = `${QOSPAY.BASE_URL}/pay?transref=${transref}&operator=${op}`;

    return {
      success: true,
      transaction_id: transref,
      payinTransactionId: payin._id,
      payment_url: paymentUrl,
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
        transaction_id: transaction.transaction_id,
        status: "SUCCESS",
        message: "Paiement confirmé",
        provider: "QOSPAY",
        success: true,
      };
    }

    const url = transaction.operator === "TM" ? QOSPAY.TM.STATUS : QOSPAY.TG.STATUS;
    const response = await axios.post(
      url,
      { transref: transaction.transaction_id, clientid: QOSPAY.CLIENT_ID },
      { timeout: 15000 }
    );

    const status = response?.data?.status?.toUpperCase() || "PENDING";
    transaction.status = ["SUCCESS", "FAILED"].includes(status) ? status : "PENDING";
    await transaction.save();

    // 🔐 Si paiement confirmé → lock escrow et PAID
    if (status === "SUCCESS" && transaction.order) {
      const order = await Order.findById(transaction.order._id);
      if (order) {
        order.status = "PAID";
        order.escrow.isLocked = true;
        await order.save();
      }
    }

    return {
      transaction_id: transaction.transaction_id,
      status,
      message: status === "SUCCESS" ? "Paiement confirmé" : "Paiement en attente",
      provider: "QOSPAY",
      success: status === "SUCCESS",
    };
  }

  /* ======================================================
     🔵 PAYOUT - RETRAIT VENDEUR
  ====================================================== */
  static async createPayOutForSeller({ sellerId, amount, operator = "AUTO" }) {
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error("SELLER_NOT_FOUND");

    const op = this.resolveOperator(operator, seller.phone);
    const transref = this.generateTransactionRef("WD");

    const url = op === "TM" ? QOSPAY.TM.DEPOSIT : QOSPAY.TG.DEPOSIT;
    const payload = { msisdn: seller.phone, amount: String(amount), transref, clientid: QOSPAY.CLIENT_ID };

    const response = await axios.post(url, payload, { timeout: 20000 });
    const status = response?.data?.status?.toUpperCase() || "PENDING";

    await PayoutTransaction.create({
      seller: seller._id,
      sellerId: seller._id,
      amount: Number(amount),
      currency: "XOF",
      client_transaction_id: transref,
      sent_amount: Number(amount),
      prefix: seller.prefix,
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
