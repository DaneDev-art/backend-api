// =============================================
// services/QosPayService.js
// QOSPAY REAL (TM / TG)
// PROD READY – ESCROW SAFE + STATUS FIX
// =============================================

const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");

const PayinTransaction = require("../models/PayinTransaction");
const PayoutTransaction = require("../models/PayoutTransaction");
const Order = require("../models/order.model");
const Seller = require("../models/Seller");
const Product = require("../models/Product");
const PlatformRevenue = require("../models/PlatformRevenue");

const { QOSPAY } = require("../config/qospay");

// =================== FRAIS ===================
const FEES = {
  payinQosPay: 0.025,
  payoutQosPay: 0.01,
  appFlutter: 0.05,
  commissionsParrainage: 0.015,
};

// =================== UTILS ===================
function roundCFA(v) {
  return Number(Number(v || 0).toFixed(2));
}

function calculateFees(productPrice, shippingFee = 0) {
  const payinFee = roundCFA(productPrice * FEES.payinQosPay);
  const payoutFee = roundCFA(productPrice * FEES.payoutQosPay);
  const flutterFee = roundCFA(productPrice * FEES.appFlutter);
  const referralFee = roundCFA(productPrice * FEES.commissionsParrainage);

  const totalFees = roundCFA(
    payinFee + payoutFee + flutterFee + referralFee
  );

  const netToSeller = roundCFA(
    productPrice - totalFees + shippingFee
  );

  return {
    totalFees,
    netToSeller,
    breakdown: { payinFee, payoutFee, flutterFee, referralFee },
  };
}

function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, "");
  if (p.startsWith("+228")) p = p.slice(1);
  if (!p.startsWith("228")) p = "228" + p;
  return p;
}

function generateTransactionRef(prefix = "QOS") {
  return `${prefix}_${Date.now()}_${crypto
    .randomBytes(4)
    .toString("hex")}`;
}

function resolveOperator(operator, phone) {
  if (operator && ["TM", "TG"].includes(operator.toUpperCase())) {
    return operator.toUpperCase();
  }

  const p = normalizePhone(phone);
  const prefix = p.slice(3, 5);

  const togocel = ["70", "71", "72", "73", "90", "91", "92", "93"];
  const moov = ["78", "79", "96", "97", "98", "99"];

  if (togocel.includes(prefix)) return "TM";
  if (moov.includes(prefix)) return "TG";

  throw new Error("UNSUPPORTED_OPERATOR");
}

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
    headers: { "Content-Type": "application/json" },
  };
}

// ============================================
// EXPORT
// ============================================
module.exports = {

  // ========================= PAYIN =========================
  createPayIn: async ({
    buyerPhone,
    operator,
    items,
    shippingFee = 0,
    clientId,
    sellerId,
    currency = "XOF",
  }) => {
    if (!buyerPhone) throw new Error("BUYER_PHONE_REQUIRED");
    if (!mongoose.Types.ObjectId.isValid(clientId))
      throw new Error("clientId invalide");
    if (!mongoose.Types.ObjectId.isValid(sellerId))
      throw new Error("sellerId invalide");

    const phone = normalizePhone(buyerPhone);
    const op = resolveOperator(operator, phone);

    const seller = await Seller.findById(sellerId).lean();
    if (!seller) throw new Error("Vendeur introuvable");

    const productIds = items.map(i => i.productId);
    const products = await Product.find({
      _id: { $in: productIds },
    }).lean();

    if (products.length !== items.length) {
      throw new Error("Produits invalides");
    }

    let productTotal = 0;
    const productMap = Object.fromEntries(
      products.map(p => [p._id.toString(), p])
    );

    const frozenItems = items.map(i => {
      const p = productMap[i.productId];
      const qty = Math.max(1, Number(i.quantity) || 1);
      productTotal += p.price * qty;

      return {
        productId: p._id,
        productName: p.name,
        productImage: p.images?.[0] || null,
        quantity: qty,
        price: p.price,
      };
    });

    const totalAmount = Math.round(productTotal + shippingFee);
    const { totalFees, netToSeller, breakdown } =
      calculateFees(productTotal, shippingFee);

    const transaction_id = generateTransactionRef("PAYIN");

    const order = await Order.create({
      client: clientId,
      seller: seller._id,
      items: frozenItems,
      totalAmount,
      netAmount: Math.round(netToSeller),
      shippingFee,
      status: "PAYMENT_PENDING",
    });

    const tx = await PayinTransaction.create({
      transaction_id,
      order: order._id,
      seller: seller._id,
      client: clientId,
      provider: "QOSPAY",
      operator: op, // ✅ OPÉRATEUR CORRECT
      amount: totalAmount,
      netAmount: Math.round(netToSeller),
      fees: totalFees,
      fees_breakdown: breakdown,
      currency,
      status: "PENDING",
      sellerCredited: false,
      customer: {
        phone_number: phone,
      },
    });

    order.payinTransaction = tx._id;
    await order.save();

    const payload = {
      msisdn: phone,
      amount: String(totalAmount),
      transref: transaction_id,
      clientid: QOSPAY[op].CLIENT_ID,
    };

    const response = await axios.post(
      QOSPAY[op].REQUEST,
      payload,
      getAxiosConfig(op)
    );

    tx.raw_response = response.data;
    await tx.save();

    return {
      success: true,
      transaction_id,
      orderId: order._id,
    };
  },

  // ========================= VERIFY PAYIN =========================
  verifyPayIn: async (transactionId) => {
    if (!transactionId) {
      throw new Error("transaction_id requis");
    }

    const tx = await PayinTransaction.findOne({
      transaction_id: transactionId,
    });
    if (!tx) throw new Error("Transaction introuvable");

    if (tx.status === "SUCCESS" && tx.sellerCredited) {
      return {
        success: true,
        transaction_id: transactionId,
        status: "SUCCESS",
      };
    }

    const response = await axios.post(
      QOSPAY[tx.operator].STATUS,
      { transref: transactionId },
      getAxiosConfig(tx.operator)
    );

    const raw = response?.data || {};
    const code = String(raw.responsecode || "").toUpperCase();

    let status = "PENDING";
    if (code === "00") status = "SUCCESS";
    else if (code && code !== "01") status = "FAILED";

    tx.raw_response = raw;

    if (status === "SUCCESS") {
      const order = await Order.findById(tx.order);
      if (!order) throw new Error("Commande introuvable");

      if (!tx.sellerCredited) {
        await Seller.updateOne(
          { _id: tx.seller },
          { $inc: { balance_locked: tx.netAmount } }
        );

        const exists = await PlatformRevenue.findOne({
          payinTransactionId: tx._id,
        });

        if (!exists && tx.fees > 0) {
          await PlatformRevenue.create({
            payinTransactionId: tx._id,
            currency: tx.currency,
            amount: tx.fees,
            breakdown: tx.fees_breakdown,
          });
        }

        tx.sellerCredited = true;
      }

      tx.status = "SUCCESS";
      tx.verifiedAt = new Date();

      if (order.status !== "PAID") {
        order.status = "PAID";
        order.paidAt = new Date();
        await order.save();
      }

      await tx.save();

      return {
        success: true,
        transaction_id: transactionId,
        orderId: order._id,
        status: "SUCCESS",
      };
    }

    if (status === "FAILED") {
      tx.status = "FAILED";
      tx.verifiedAt = new Date();
      await tx.save();

      return {
        success: false,
        transaction_id: transactionId,
        status: "FAILED",
      };
    }

    tx.lastCheckedAt = new Date();
    await tx.save();

    return {
      success: false,
      transaction_id: transactionId,
      status: "PENDING",
      retry: true,
    };
  },

  // ========================= PAYOUT =========================
  createPayOutForSeller: async ({ sellerId, amount, operator }) => {
    if (!mongoose.Types.ObjectId.isValid(sellerId))
      throw new Error("sellerId invalide");

    const seller = await Seller.findById(sellerId).lean();
    if (!seller?.phone) throw new Error("Téléphone vendeur requis");

    const phone = normalizePhone(seller.phone);
    const op = resolveOperator(operator, phone);

    const transref = generateTransactionRef("WD");

    const response = await axios.post(
      QOSPAY[op].DEPOSIT,
      {
        msisdn: phone,
        amount: String(amount),
        transref,
        clientid: QOSPAY[op].CLIENT_ID,
      },
      getAxiosConfig(op)
    );

    const code = response?.data?.responsecode;
    const status = code === "00" ? "SUCCESS" : "PENDING";

    await PayoutTransaction.create({
      seller: seller._id,
      provider: "QOSPAY",
      operator: op,
      amount,
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
    };
  },
};
