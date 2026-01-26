// =============================================
// services/QosPayService.js
// QOSPAY REAL (TM / TG / CARD)
// PROD READY – ESCROW SAFE + STATUS FIX + FEES + COMMISSIONS
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

// ============================================
// MODULE EXPORT
// ============================================
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
    if (!mongoose.Types.ObjectId.isValid(sellerId)) throw new Error("sellerId invalide");
    if (!mongoose.Types.ObjectId.isValid(clientId)) throw new Error("clientId invalide");

    const phone = normalizePhone(buyerPhone);

    // 🔹 récupérer vendeur
    const seller = await Seller.findById(sellerId).lean();
    if (!seller) throw new Error("Vendeur introuvable");

    // 🔹 récupérer produits
    const productIds = items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    if (products.length !== items.length) throw new Error("Certains produits sont introuvables");

    for (const p of products) {
      if (p.seller.toString() !== sellerId.toString())
        throw new Error(`Produit ${p._id} n'appartient pas au vendeur`);
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

    // 🔹 créer order
    const order = await Order.create({
      client: clientId,
      seller: seller._id,
      items: frozenItems,
      totalAmount,
      netAmount,
      shippingFee,
      status: "PAYMENT_PENDING",
    });

    // 🔹 créer transaction payin
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
      customer: { email: "", phone_number: phone, address: "" },
    });

    order.payinTransaction = tx._id;
    await order.save();

    // 🔹 appel QOSPAY
    const op = resolveOperator(operator, phone);
    const payload = { msisdn: phone, amount: String(totalAmount), transref: transaction_id, clientid: QOSPAY[op].CLIENT_ID };

    try {
      const response = await axios.post(QOSPAY[op].REQUEST, payload, getAxiosConfig(op));
      tx.raw_response = response.data;
      await tx.save();
    } catch (err) {
      console.error("❌ QOSPAY Axios Error:", err.message);
      return { success: false, error: "Erreur lors du payin", transaction_id, orderId: order._id };
    }

    return { success: true, transaction_id, orderId: order._id };
  },

  // ========================= VERIFY PAYIN — QOSPAY =========================
verifyPayIn: async (transactionId) => {
  if (!transactionId) throw new Error("transaction_id est requis");

  const tx = await PayinTransaction.findOne({ transaction_id: transactionId });
  if (!tx) {
    return { success: false, message: "Transaction introuvable", transaction_id: transactionId };
  }

  // =========================
  // IDEMPOTENCE HARD
  // =========================
  if (tx.status === "SUCCESS" && tx.sellerCredited === true) {
    return {
      success: true,
      message: "Transaction déjà traitée",
      transaction_id: transactionId,
      status: tx.status,
    };
  }

  // =========================
  // CALL QOSPAY STATUS
  // =========================
  let response;
  try {
    response = await axios.post(
      QOSPAY[tx.operator].STATUS,
      { transref: transactionId },
      getAxiosConfig(tx.operator)
    );
  } catch (err) {
    console.error("❌ QOSPAY verifyPayIn Axios Error:", err.message);
    return {
      success: false,
      message: "Impossible de vérifier le paiement",
      transaction_id: transactionId,
      status: tx.status,
    };
  }

  const raw = response?.data || {};
  const code = String(raw.responsecode || raw.code || "").toUpperCase();
  const remoteStatus = String(raw.status || "").toUpperCase();

  let status = "PENDING";
  if (["00", "SUCCESS", "PAID"].includes(code) || ["SUCCESS", "PAID"].includes(remoteStatus)) {
    status = "SUCCESS";
  } else if (code && !["01"].includes(code)) {
    status = "FAILED";
  }

  tx.qospay_status = status;
  tx.raw_response = raw;

  // =========================
  // SUCCESS PAYIN
  // =========================
  if (status === "SUCCESS") {
    // 🔎 ORDER (BON LIEN)
    const order = await Order.findOne({ payinTransaction: tx._id });
    if (!order) {
      throw new Error("Commande associée introuvable");
    }

    // ======================
    // CREDIT SELLER (ESCROW)
    // ======================
    if (!tx.sellerCredited) {
      const result = await Seller.updateOne(
        { _id: tx.seller },
        { $inc: { balance_locked: Number(tx.netAmount || 0) } }
      );

      if (result.matchedCount === 0) {
        throw new Error("Vendeur introuvable");
      }

      tx.sellerCredited = true;
    }

    // ======================
    // FINAL STATES
    // ======================
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
      message: "Paiement confirmé – fonds bloqués en escrow",
      transaction_id: transactionId,
      orderId: order._id,
      status: "SUCCESS",
    };
  }

  // =========================
  // FAILURE
  // =========================
  if (status === "FAILED") {
    tx.status = "FAILED";
    tx.verifiedAt = new Date();
    await tx.save();

    return {
      success: false,
      message: "Paiement échoué",
      transaction_id: transactionId,
      status,
    };
  }

  // =========================
  // PENDING
  // =========================
  tx.lastCheckedAt = new Date();
  await tx.save();

  return {
    success: false,
    message: "Paiement en attente – vérifier à nouveau",
    transaction_id: transactionId,
    status,
    retry: true,
  };
},

  // ========================= PAYOUT SAFE =========================
  createPayOutForSeller: async ({ sellerId, amount, operator }) => {
    if (!mongoose.Types.ObjectId.isValid(sellerId)) throw new Error("sellerId invalide");
    if (typeof amount !== "number" || amount <= 0) throw new Error("amount invalide");

    const seller = await Seller.findById(sellerId).lean();
    if (!seller || !seller.phone) throw new Error("SELLER_PHONE_REQUIRED");

    const phone = normalizePhone(seller.phone);
    const op = resolveOperator(operator, phone);
    if (op === "CARD") throw new Error("CARD_PAYOUT_NOT_SUPPORTED");

    const transref = generateTransactionRef("WD");
    const payoutFees = roundCFA(amount * FEES.payoutQosPay);
    const sentAmount = roundCFA(amount - payoutFees);

    const payload = { msisdn: phone, amount: String(amount), transref, clientid: QOSPAY[op].CLIENT_ID };

    let response;
    let status = "PENDING";

    try {
      response = await axios.post(QOSPAY[op].DEPOSIT, payload, getAxiosConfig(op));
      const code = response?.data?.responsecode;
      if (code === "00") status = "SUCCESS";
      else if (code && !["00","01"].includes(code)) status = "FAILED";
    } catch (err) {
      console.error("❌ QOSPAY createPayOut Axios Error:", err.message);
      status = "FAILED";
    }

    await PayoutTransaction.create({
      seller: seller._id,
      provider: "QOSPAY",
      operator: op,
      amount: Number(amount),
      sent_amount: sentAmount,
      fees: payoutFees,
      currency: "XOF",
      transaction_id: transref,
      phone,
      status,
      raw_response: response?.data || null,
    });

    return { success: status === "SUCCESS", transaction_id: transref, status, provider: "QOSPAY" };
  },

};
