// =============================================
// services/QosPayService.js
// QOSPAY REAL (TM / TG / CARD)
// BASIC AUTH — PROD READY (FINAL CLEAN + FIX STATUS PAID + FEES + COMMISSIONS)
// =============================================

const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");

const PayinTransaction = require("../models/PayinTransaction");
const PayoutTransaction = require("../models/PayoutTransaction");
const Order = require("../models/order.model");
const Seller = require("../models/Seller");
const Product = require("../models/Product");

const { QOSPAY } = require("../config/qospay");

// =================== FRAIS ===================
const FEES = {
  payinQosPay: 0.025,             // 2,5%
  payoutQosPay: 0.01,             // 1%
  appFlutter: 0.05,               // 5%
  commissionsParrainage: 0.015,   // 1,5%
};

// 🔹 utilitaire arrondi
function roundCFA(value) {
  return Number(Number(value || 0).toFixed(2));
}

// 🔹 calcul frais
function calculateFees(productPrice, shippingFee = 0) {
  const payinFee = roundCFA(productPrice * FEES.payinQosPay);
  const payoutFee = roundCFA(productPrice * FEES.payoutQosPay);
  const flutterFee = roundCFA(productPrice * FEES.appFlutter);
  const referralFee = roundCFA(productPrice * FEES.commissionsParrainage);

  const totalFees = roundCFA(payinFee + payoutFee + flutterFee + referralFee);
  const netToSeller = roundCFA(productPrice - totalFees + (shippingFee || 0));

  return { 
    totalFees, 
    netToSeller, 
    breakdown: { payinFee, payoutFee, flutterFee, referralFee } 
  };
}

// 🔹 normalize phone
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, "");
  if (p.startsWith("+228")) p = p.slice(1);
  if (!p.startsWith("228")) p = "228" + p;
  return p;
}

// 🔹 générer transaction ref
function generateTransactionRef(prefix = "QOS") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

// 🔹 résoudre opérateur
function resolveOperator(operator, phone) {
  if (operator && ["TM", "TG", "CARD"].includes(operator.toUpperCase())) {
    return operator.toUpperCase();
  }

  const p = normalizePhone(phone);
  const prefix = p.slice(3, 5);

  const togocelPrefixes = ["70", "71", "72", "73", "90", "91", "92", "93"];
  const moovPrefixes = ["78", "79", "96", "97", "98", "99"];

  if (togocelPrefixes.includes(prefix)) return "TM";
  if (moovPrefixes.includes(prefix)) return "TG";

  throw new Error("UNSUPPORTED_OPERATOR");
}

// 🔹 Axios config
function getAxiosConfig(op) {
  const cfg = QOSPAY[op];
  if (!cfg?.USERNAME || !cfg?.PASSWORD) throw new Error(`QOSPAY_AUTH_NOT_DEFINED_FOR_${op}`);
  return { 
    timeout: 20000, 
    auth: { username: cfg.USERNAME, password: cfg.PASSWORD }, 
    headers: { "Content-Type": "application/json" } 
  };
}

module.exports = {
  // ========================= PAYIN =========================
  createPayIn: async ({
    orderId,
    buyerPhone,
    operator,
    items,
    shippingFee = 0,
    clientId,
    sellerId,
    currency = "XOF",
    description,
    returnUrl,
    notifyUrl
  }) => {
    if (!orderId) throw new Error("ORDER_ID_REQUIRED");
    if (!buyerPhone) throw new Error("BUYER_PHONE_REQUIRED");

    const phone = normalizePhone(buyerPhone);

    // 🔹 Vérification vendeur
    console.log("Payload sellerId:", sellerId);
    const seller = await Seller.findById(sellerId).lean();
    console.log("Seller found:", seller);
    if (!seller) throw new Error("Vendeur introuvable");

    // 🔹 Vérification produits
    const productIds = items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    console.log("Products found:", products.map(p => p._id.toString()));
    if (products.length !== items.length) throw new Error("Certains produits sont introuvables");

    for (const p of products) {
      if (p.seller.toString() !== sellerId.toString()) throw new Error(`Produit ${p._id} n'appartient pas au vendeur`);
    }

    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));
    let productTotal = 0;

    const frozenItems = items.map(i => {
      const product = productMap[i.productId];
      const qty = Math.max(1, Number(i.quantity) || 1);
      productTotal += product.price * qty;
      return {
        productId: product._id.toString(),
        productName: product.name,
        productImage: product.images?.[0] || null,
        quantity: qty,
        price: product.price,
      };
    });

    const totalAmount = Math.round(productTotal + shippingFee);

    const { totalFees, netToSeller, breakdown } = calculateFees(productTotal, shippingFee);
    const netAmount = Math.round(netToSeller);

    const transaction_id = generateTransactionRef("PAYIN");

    // 🔹 Création order
    const order = await Order.create({
      client: clientId,
      seller: seller._id,
      items: frozenItems,
      totalAmount,
      netAmount,
      shippingFee,
      status: "PAYMENT_PENDING",
    });

    // 🔹 Création transaction payin
    const tx = await PayinTransaction.create({
      transaction_id,
      order: order._id,
      seller: seller._id,
      client: clientId,
      provider: "QOSPAY",
      operator,
      amount: totalAmount,
      netAmount,
      fees: totalFees,
      fees_breakdown: breakdown,
      currency,
      status: "PENDING",
      sellerCredited: false,
      customer: {
        email: "",
        phone_number: phone,
        address: "",
      },
    });

    order.payinTransaction = tx._id;
    await order.save();

    // 🔹 Appel API QOSPAY
    const op = resolveOperator(operator, phone);
    const payload = { msisdn: phone, amount: String(totalAmount), transref: transaction_id, clientid: QOSPAY[op].CLIENT_ID };

    let response;
    try {
      response = await axios.post(QOSPAY[op].REQUEST, payload, getAxiosConfig(op));
    } catch (err) {
      console.error("❌ QOSPAY Axios Error:", err.message);
      return { success: false, error: "Erreur lors du payin", transaction_id, orderId: order._id };
    }

    tx.raw_response = response.data;
    await tx.save();

    return { success: true, transaction_id, orderId: order._id };
  },

  // ========================= VERIFY PAYIN =========================
  verifyPayIn: async (transactionId) => {
    if (!transactionId) throw new Error("transaction_id est requis");

    const tx = await PayinTransaction.findOne({ transaction_id: transactionId });
    if (!tx) return { success: false, message: "Transaction introuvable", transaction_id };

    if (tx.status === "SUCCESS" && tx.sellerCredited) {
      return { success: true, message: "Transaction déjà traitée", transaction_id, status: tx.status };
    }

    let response;
    try {
      response = await axios.post(
        QOSPAY[tx.operator].STATUS,
        { transref: transactionId },
        getAxiosConfig(tx.operator)
      );
    } catch (err) {
      console.error("❌ QOSPAY verifyPayIn Axios Error:", err.message);
      return { success: false, message: "Impossible de vérifier le paiement", transaction_id, status: tx.status };
    }

    const code = response?.data?.responsecode;
    let status = "PENDING";
    if (code === "00") status = "SUCCESS";
    else if (code && !["00","01"].includes(code)) status = "FAILED";

    tx.qospay_status = status;
    tx.raw_response = response.data;

    if (status === "SUCCESS") {
      const order = await Order.findById(tx.order);
      if (!order) throw new Error("Commande associée introuvable");

      if (!tx.sellerCredited) {
        await Seller.updateOne({ _id: tx.seller }, { $inc: { balance_locked: Number(tx.netAmount || 0) } });
        tx.sellerCredited = true;
      }

      if (order.status !== "PAID") {
        order.status = "PAID";
        order.paidAt = new Date();
        await order.save();
      }

      tx.status = "SUCCESS";
      tx.verifiedAt = new Date();
      await tx.save();

      return { success: true, message: "Paiement confirmé – fonds bloqués en escrow", transaction_id, orderId: order._id, status: "SUCCESS" };
    }

    if (["FAILED","CANCELLED","CANCELED","REFUSED"].includes(status)) {
      tx.status = "FAILED";
      tx.verifiedAt = new Date();
      await tx.save();
      return { success: false, message: `Paiement ${status.toLowerCase()}`, transaction_id, status };
    }

    // PENDING retry
    tx.lastCheckedAt = new Date();
    await tx.save();
    return { success: false, message: "Paiement en attente – vérifier à nouveau", transaction_id, status, retry: true };
  },

  // ========================= PAYOUT =========================
  createPayOutForSeller: async ({ sellerId, amount, operator }) => {
    const seller = await Seller.findById(sellerId);
    if (!seller?.phone) throw new Error("SELLER_PHONE_REQUIRED");

    const phone = normalizePhone(seller.phone);
    const op = resolveOperator(operator, phone);
    if (op === "CARD") throw new Error("CARD_PAYOUT_NOT_SUPPORTED");

    const transref = generateTransactionRef("WD");
    const payoutFees = roundCFA(amount * FEES.payoutQosPay);

    const payload = { msisdn: phone, amount: String(amount), transref, clientid: QOSPAY[op].CLIENT_ID };

    let response;
    try {
      response = await axios.post(QOSPAY[op].DEPOSIT, payload, getAxiosConfig(op));
    } catch (err) {
      console.error("❌ QOSPAY createPayOut Axios Error:", err.message);
      return { success: false, status: "FAILED", transaction_id: transref };
    }

    let status = "PENDING";
    const code = response?.data?.responsecode;
    if (code === "00") status = "SUCCESS";
    else if (code && !["00","01"].includes(code)) status = "FAILED";

    await PayoutTransaction.create({
      seller: seller._id,
      provider: "QOSPAY",
      operator: op,
      amount: Number(amount),
      sent_amount: Number(amount) - payoutFees,
      fees: payoutFees,
      currency: "XOF",
      transaction_id: transref,
      phone,
      status,
      raw_response: response.data,
    });

    return { success: status === "SUCCESS", transaction_id: transref, status, provider: "QOSPAY" };
  },
};
