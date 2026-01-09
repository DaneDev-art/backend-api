// src/services/CinetPayService.js
/**
 * CinetPayService (production-ready)
 *
 * Expose:
 *  - createPayIn({ amount, currency, email, phone_number, description, return_url, notify_url, sellerId, clientId, customer })
 *  - verifyPayIn(transaction_id)
 *  - createPayOutForSeller({ sellerId, amount, currency, notifyUrl })
 *  - verifyPayOut(transaction_id)
 *  - handleWebhook(webhookPayload, headers)
 *
 * Lit la config depuis ../config/cinetpay si présent, sinon process.env.
 */

const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const PayinTransaction = require("../models/PayinTransaction");
const PayoutTransaction = require("../models/PayoutTransaction");
const PlatformRevenue = require("../models/PlatformRevenue");

// load config (fallback to env)
const config = (() => {
  try {
    return require("../config/cinetpay");
  } catch (e) {
    return {
      CINETPAY_API_KEY: process.env.CINETPAY_API_KEY,
      CINETPAY_SITE_ID: process.env.CINETPAY_SITE_ID,
      CINETPAY_BASE_URL: process.env.CINETPAY_BASE_URL,
      CINETPAY_PAYOUT_URL: process.env.CINETPAY_PAYOUT_URL,
      CINETPAY_API_PASSWORD: process.env.CINETPAY_API_PASSWORD,
      NGROK_URL: process.env.NGROK_URL,
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
      FRONTEND_URL: process.env.FRONTEND_URL,
      BASE_URL: process.env.BASE_URL,
    };
  }
})();

const {
  CINETPAY_API_KEY,
  CINETPAY_SITE_ID,
  CINETPAY_BASE_URL = "https://api-checkout.cinetpay.com/v2",
  CINETPAY_PAYOUT_URL = "https://client.cinetpay.com/v1",
  CINETPAY_API_PASSWORD,
  NGROK_URL,
  WEBHOOK_SECRET,
  FRONTEND_URL,
  BASE_URL,
} = config;

// ✅ Définir CINETPAY_PAYIN_URL (évite l'erreur "is not defined")
const CINETPAY_PAYIN_URL =
  config.CINETPAY_PAYIN_URL ||
  process.env.CINETPAY_PAYIN_URL ||
  (CINETPAY_BASE_URL
    ? `${CINETPAY_BASE_URL.replace(/\/+$/, "")}/payment`
    : "https://api-checkout.cinetpay.com/v2/payment");

// =================== FRAIS ===================
const FEES = {
  payinCinetPay: 0.035,   // 3,5% sur le prix du produit
  payoutCinetPay: 0.015,  // 1,5% sur le prix du produit
  appFlutter: 0.02,       // 2% sur le prix du produit
};

/**
 * Calcul des frais uniquement sur le prix du produit
 * @param {number} productPrice - prix du produit
 * @param {number} shippingFee - frais d’envoi éventuels par le vendeur
 * @returns {object} { totalFees, netToSeller }
 */
function calculateFees(productPrice, shippingFee = 0) {
  const payinFee = roundCFA(productPrice * FEES.payinCinetPay);
  const payoutFee = roundCFA(productPrice * FEES.payoutCinetPay);
  const flutterFee = roundCFA(productPrice * FEES.appFlutter);

  const totalFees = roundCFA(payinFee + payoutFee + flutterFee);

  // montant net que le vendeur reçoit = prix produit - total frais + frais expédition
  const netToSeller = roundCFA(productPrice - totalFees + (shippingFee || 0));

  return { totalFees, netToSeller, breakdown: { payinFee, payoutFee, flutterFee } };
}

// 🔹 utilitaire arrondi
function roundCFA(value) {
  return Number(Number(value || 0).toFixed(2));
}

class CinetPayService {
  static authToken = null;
  static authTokenExpiresAt = 0;
  static contactLocks = new Map();

  // ----------------------------- helpers -----------------------------
  static generateTransactionId(prefix = "TX") {
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(4).toString("hex");
    return `${prefix}-${timestamp}-${randomPart}`;
  }

  static async resolveClientObjectId(clientIdCandidate, fallbackEmailOrPhone) {
    if (!clientIdCandidate && !fallbackEmailOrPhone) {
      throw new Error(
        "clientId (ou email/phone) requis pour associer la transaction au client"
      );
    }

    if (clientIdCandidate instanceof mongoose.Types.ObjectId) return clientIdCandidate;

    if (
      typeof clientIdCandidate === "string" &&
      /^[0-9a-fA-F]{24}$/.test(clientIdCandidate)
    ) {
      return new mongoose.Types.ObjectId(clientIdCandidate);
    }

    const candidate = String(clientIdCandidate || fallbackEmailOrPhone || "").trim();

    if (/@/.test(candidate)) {
      const u = await User.findOne({ email: candidate }).select("_id").lean();
      if (u && u._id) return u._id;
      throw new Error(
        `Impossible de trouver un utilisateur avec l'email ${candidate}. Passe l'_id ou crée l'utilisateur.`
      );
    }

    if (/^\+?\d{6,15}$/.test(candidate)) {
      const u = await User.findOne({ phone: candidate }).select("_id").lean();
      if (u && u._id) return u._id;
      throw new Error(
        `Impossible de trouver un utilisateur avec le numéro ${candidate}. Passe l'_id ou crée l'utilisateur.`
      );
    }

    throw new Error(
      "clientId non résoluble en ObjectId. Passe l'_id mongoose du user ou son email/phone existant."
    );
  }
}

  // ============================ AUTH (PAYOUT API) ============================
CinetPayService.getAuthToken = async function() {
  const axios = require("axios");

  // cached
  if (this.authToken && Date.now() + 5000 < this.authTokenExpiresAt) return this.authToken;

  const CINETPAY_PAYOUT_URL = this.CINETPAY_PAYOUT_URL || process.env.CINETPAY_PAYOUT_URL;
  const CINETPAY_API_KEY = this.CINETPAY_API_KEY || process.env.CINETPAY_API_KEY;
  const CINETPAY_API_PASSWORD = this.CINETPAY_API_PASSWORD || process.env.CINETPAY_API_PASSWORD;

  if (!CINETPAY_PAYOUT_URL || !CINETPAY_API_KEY || !CINETPAY_API_PASSWORD) {
    throw new Error("Missing CinetPay payout auth config (CINETPAY_PAYOUT_URL / API KEY / API PASSWORD).");
  }

  const params = new URLSearchParams();
  params.append("apikey", CINETPAY_API_KEY);
  params.append("password", CINETPAY_API_PASSWORD);

  let resp;
  try {
    resp = await axios.post(`${CINETPAY_PAYOUT_URL.replace(/\/+$/, "")}/auth/login`, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });
  } catch (err) {
    const body = err.response?.data || err.message;
    if (body && (body.code === "708" || body.code === 708 || body.message === "NOT_ALLOWED")) {
      console.error("[CinetPay][Auth] NOT_ALLOWED (708):", body);
      const e = new Error("CinetPay auth refused (NOT_ALLOWED) — vérifie tes credentials et l'état du compte CinetPay (activation Payout).");
      e.cinetpay = body;
      throw e;
    }
    console.error("[CinetPay][Auth] request failed:", body);
    const e = new Error("CinetPay auth request failed: " + (body?.message || body));
    e.cinetpay = body;
    throw e;
  }

  const data = resp.data;
  const ok =
    data &&
    (data.code === 0 ||
      data.code === "0" ||
      data.code === "00" ||
      data.message === "OPERATION_SUCCES" ||
      data.status === "success");

  if (!ok) {
    console.error("[CinetPay][Auth] invalid response:", data);
    const e = new Error("CinetPay auth échouée: " + JSON.stringify(data));
    e.cinetpay = data;
    throw e;
  }

  const token = data.data?.token || data.token || data?.access_token;
  if (!token) throw new Error("Token absent dans réponse auth CinetPay");

  // expiry
  let expiresAt = Date.now() + 5 * 60 * 1000;
  if (data.data?.expire_at) {
    const t = Date.parse(data.data.expire_at);
    if (!Number.isNaN(t)) expiresAt = t;
  } else if (data.data?.expires_in) {
    const s = Number(data.data.expires_in);
    if (!Number.isNaN(s)) expiresAt = Date.now() + s * 1000;
  }

  this.authToken = token;
  this.authTokenExpiresAt = expiresAt;
  return token;
};

CinetPayService.getTransferAuthToken = async function() {
  return this.getAuthToken();
};

  // ============================ ENSURE / CREATE SELLER CONTACT ============================
/**
 * Assure qu'un vendeur a un contact CinetPay.
 * Si le contact n'existe pas, le crée.
 *
 * @param {string|ObjectId} mongoSellerId - _id du seller ou user
 * @returns {Promise<string>} contact_id CinetPay
 */
CinetPayService.ensureSellerContact = async function (mongoSellerId) {
  if (!mongoSellerId) throw new Error("sellerId requis pour créer contact CinetPay");

  // Cherche d'abord dans Seller
  let seller = await Seller.findById(mongoSellerId);

  // Sinon cherche dans User (compatibilité)
  if (!seller) {
    const userSeller = await User.findById(mongoSellerId);
    if (userSeller && userSeller.role === "seller") {
      // création d'un objet compatible Seller à la volée
      seller = {
        _id: userSeller._id,
        name: userSeller.name || userSeller.fullName || userSeller.shopName || "",
        surname: userSeller.surname || "",
        email: userSeller.email,
        phone: userSeller.phone,
        prefix: userSeller.prefix || userSeller.countryPrefix || "+228",
        balance_available: userSeller.balance_available || 0,
        balance_locked: userSeller.balance_locked || 0,
        save: async () => await userSeller.save(),
        cinetpay_contact_added: userSeller.cinetpayContactAdded || userSeller.cinetpay_contact_added || false,
        cinetpay_contact_id: userSeller.cinetpay_contact_id || null,
        cinetpay_contact_meta: userSeller.cinetpayContactMeta || userSeller.cinetpay_contact_meta || null,
      };
    } else {
      throw new Error("Seller introuvable");
    }
  }

  // ✅ Si déjà ajouté et meta existante, retourne l'id
  if (seller.cinetpay_contact_added && seller.cinetpay_contact_meta?.id) {
    return seller.cinetpay_contact_meta.id;
  }

  // ------------------ LOCK simple pour éviter les appels concurrents ------------------
  if (!CinetPayService.contactLocks) CinetPayService.contactLocks = new Map();
  const lockKey = `${seller.prefix}:${seller.phone}`;

  // Fonction interne async pour attendre un contact existant
  async function waitForExistingContact() {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 200)); // pause 200ms
      const s = await Seller.findById(mongoSellerId).lean();
      if (s && s.cinetpay_contact_added && s.cinetpay_contact_meta?.id) {
        return s.cinetpay_contact_meta.id; // contact déjà créé
      }
    }
    return null;
  }

  if (CinetPayService.contactLocks.get(lockKey)) {
    const existingId = await waitForExistingContact();
    if (existingId) return existingId;
  }

  CinetPayService.contactLocks.set(lockKey, true);

  try {
    const contactId = await CinetPayService.createSellerContact(seller);
    return contactId;
  } finally {
    CinetPayService.contactLocks.delete(lockKey);
  }
};

/**
 * Crée le contact vendeur sur CinetPay
 * @param {Object} seller - objet vendeur (Seller ou User converti)
 * @returns {Promise<string>} contact_id CinetPay
 */
CinetPayService.createSellerContact = async function(seller) {
  if (!seller) throw new Error("Seller manquant pour création de contact");

  const axios = require("axios");

  // Nettoyage et validation des champs requis
  const prefix = (seller.prefix || "228").replace("+", "").trim();
  const phone = (seller.phone || "").replace(/^\+/, "").trim();
  const email = seller.email?.trim() || "";
  const name = seller.name?.trim() || "";
  const surname = seller.surname?.trim() || name || "Shop";

  if (!phone || !email) throw new Error("Numéro de téléphone ou email manquant pour le vendeur");

  const payload = [{ prefix, phone, name, surname, email }];
  console.log("[CinetPay][createSellerContact] payload:", payload);

  try {
    const token = await this.getAuthToken(); // auth Payout

    const paramsBody = new URLSearchParams();
    paramsBody.append("data", JSON.stringify(payload));

    const resp = await axios.post(
      `${CINETPAY_PAYOUT_URL.replace(/\/+$/, "")}/transfer/contact`,
      paramsBody.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        params: { token },
        timeout: 20000,
      }
    );

    const respData = resp.data;
    console.log("[CinetPay][createSellerContact] response:", respData);

    if (!respData || respData.code !== 0) {
      throw new Error(`Echec création contact CinetPay: ${respData.message || "réponse invalide"}`);
    }

    const contactInfo = Array.isArray(respData.data) ? respData.data[0] : respData.data;

    // Sauvegarde du contact dans la base
    seller.cinetpay_contact_added = true;
    seller.cinetpay_contact_id = contactInfo.id;
    seller.cinetpay_contact_meta = contactInfo;

    if (typeof seller.save === "function") await seller.save();

    console.log(`[CinetPay] Contact ajouté: ${contactInfo.id} (${seller.email})`);
    return contactInfo.id;
  } catch (err) {
    console.error("[CinetPay][createSellerContact] request failed:", err.response?.data || err.message);
    throw new Error("Echec création contact CinetPay");
  }
};

  CinetPayService.authCheckoutCredentials = async function() {
  if (!CINETPAY_BASE_URL || !CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    throw new Error("CINETPAY_BASE_URL / CINETPAY_API_KEY / CINETPAY_SITE_ID non configurés");
  }

  const url = `${CINETPAY_BASE_URL.replace(/\/+$/, "")}/payment`;
  const payload = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id: this.generateTransactionId("CHK"),
    amount: 1,
    currency: "XOF",
    description: "credentials-check",
    customer_email: "check@example.com",
    customer_phone_number: "90000000",
    notify_url: NGROK_URL ? `${NGROK_URL}/api/cinetpay/webhook` : (BASE_URL ? `${BASE_URL}/api/cinetpay/webhook` : undefined),
    return_url: FRONTEND_URL ? `${FRONTEND_URL}/success` : undefined,
  };

  try {
    const axios = require("axios");
    const res = await axios.post(url, payload, { headers: { "Content-Type": "application/json" }, timeout: 10000 });
    return res.data;
  } catch (err) {
    const body = err.response?.data || err.message;
    console.error("[CinetPay][authCheckoutCredentials] error:", body);
    const e = new Error("Checkout credential check failed");
    e.cinetpay = body;
    throw e;
  }
};

/// ============================
// PAYIN — ESCROW VERSION (FINAL STABLE – PANIER SAFE)
// ============================

CinetPayService.createPayIn = async function (payload) {
  const mongoose = require("mongoose");
  const axios = require("axios");

  const Seller = require("../models/Seller");
  const Product = require("../models/Product");
  const PayinTransaction = require("../models/PayinTransaction");
  const Order = require("../models/order.model");

  // ==============================
  // EXTRACTION PAYLOAD (PANIER INTACT)
  // ==============================
  const {
    items,
    shippingFee = 0,
    currency = "XOF",
    buyerEmail,
    buyerPhone,
    buyerAddress,
    description,
    returnUrl,
    notifyUrl,
    sellerId,
    clientId,
  } = payload;

  // ==============================
  // VALIDATIONS
  // ==============================
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("Panier vide");

  if (!mongoose.Types.ObjectId.isValid(sellerId))
    throw new Error("sellerId invalide");

  if (!mongoose.Types.ObjectId.isValid(clientId))
    throw new Error("clientId invalide");

  const shippingFeeAmount = Number(shippingFee);
  if (!Number.isFinite(shippingFeeAmount) || shippingFeeAmount < 0)
    throw new Error("shippingFee invalide");

  // ==============================
  // VENDEUR
  // ==============================
  const seller = await Seller.findById(sellerId).lean();
  if (!seller) throw new Error("Vendeur introuvable");

  // ==============================
  // PRODUITS (SOURCE DE VÉRITÉ)
  // ==============================
  const productIds = items.map(i => i.productId);

  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id name images price seller")
    .lean();

  if (products.length !== items.length)
    throw new Error("Certains produits sont introuvables");

  for (const p of products) {
    if (p.seller.toString() !== sellerId.toString())
      throw new Error(`Produit ${p._id} n'appartient pas au vendeur`);
  }

  // ==============================
  // SNAPSHOT PANIER (INCHANGÉ)
  // ==============================
  const productMap = Object.fromEntries(
    products.map(p => [p._id.toString(), p])
  );

  let productTotal = 0;

  const frozenItems = items.map(i => {
    const product = productMap[i.productId];
    const qty = Math.max(1, Number(i.quantity) || 1);

    productTotal += product.price * qty;

    return {
      product: product._id,
      productId: product._id.toString(),
      productName: product.name,
      productImage: product.images?.[0] || null,
      quantity: qty,
      price: product.price,
    };
  });

  const totalAmount = Math.round(productTotal + shippingFeeAmount);

  // ==============================
  // FEES & NET
  // ==============================
  const { totalFees, netToSeller, breakdown } =
    calculateFees(productTotal, 0);

  const netAmount = Math.round(netToSeller + shippingFeeAmount);

  // ==============================
// IDS & URLS (SAFE — NO undefined)
// ==============================
const transaction_id = this.generateTransactionId("PAYIN");

// 🔒 Sécurité absolue sur BASE_URL
if (!BASE_URL || typeof BASE_URL !== "string" || !BASE_URL.startsWith("http")) {
  throw new Error(
    "❌ BASE_URL invalide ou non défini. Vérifie la configuration environnement."
  );
}

const cleanBaseUrl = BASE_URL.replace(/\/+$/, "");

// 🔗 RETURN URL (REDIRECT USER)
const finalReturnUrl =
  typeof returnUrl === "string" && returnUrl.startsWith("http")
    ? returnUrl
    : `${cleanBaseUrl}/api/cinetpay/payin/return?transaction_id=${transaction_id}`;

// 🔔 NOTIFY URL (WEBHOOK SERVER ↔ SERVER)
const finalNotifyUrl =
  typeof notifyUrl === "string" && notifyUrl.startsWith("http")
    ? notifyUrl
    : `${cleanBaseUrl}/api/cinetpay/payin/verify`;


  // ==============================
  // ORDER (SCHEMA COMPATIBLE)
  // ==============================
  const order = await Order.create({
    client: clientId,
    seller: seller._id,
    items: frozenItems,
    totalAmount,
    netAmount,
    shippingFee: shippingFeeAmount,
    deliveryAddress: buyerAddress || "Adresse inconnue",
    status: "PAYMENT_PENDING",            // ✅ ENUM OK
    cinetpayTransactionId: transaction_id, // ✅ REQUIRED
    isConfirmedByClient: false,
  });

  // ==============================
  // PAYIN TRANSACTION (ESCROW)
  // ==============================
  const tx = await PayinTransaction.create({
    transaction_id,
    order: order._id,
    seller: seller._id,
    client: clientId, // ✅ FIX SCHEMA
    amount: totalAmount,
    netAmount,
    fees: totalFees,
    fees_breakdown: breakdown,
    currency,
    status: "PENDING",
    sellerCredited: false,
    customer: {
      email: buyerEmail || "client@emarket.tg",
      phone_number: buyerPhone || "",
      address: buyerAddress || "Adresse inconnue",
    },
  });

  order.payinTransaction = tx._id;
  await order.save();

  // ==============================
  // CINETPAY PAYLOAD
  // ==============================
  const cpPayload = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id,
    amount: totalAmount,
    currency,
    description: description || "Paiement eMarket",
    return_url: finalReturnUrl,
    notify_url: finalNotifyUrl,
    customer_email: tx.customer.email,
    customer_phone_number: tx.customer.phone_number,
    customer_address: tx.customer.address,
    items: frozenItems.map(i => ({
      name: i.productName,
      quantity: i.quantity,
      price: i.price,
    })),
    channels: "MOBILE_MONEY",
  };

  // ==============================
  // APPEL CINETPAY
  // ==============================
  const resp = await axios.post(
    `${CINETPAY_BASE_URL.replace(/\/+$/, "")}/payment`,
    cpPayload,
    { timeout: 20000 }
  );

  if (!resp.data || resp.data.code !== "201")
    throw new Error(`CinetPay error: ${JSON.stringify(resp.data)}`);

  tx.paymentUrl = resp.data?.data?.payment_url || null;
  tx.raw_response = resp.data;
  await tx.save();

  return {
    success: true,
    orderId: order._id,
    transaction_id,
    payment_url: tx.paymentUrl,
    totalAmount,
    netAmount,
  };
};


//=====================================================
// VERIFY PAYIN — CLEAN ESCROW VERSION (SAFE)
//=====================================================

CinetPayService.verifyPayIn = async function (transaction_id) {
  if (!transaction_id) {
    throw new Error("transaction_id est requis");
  }

  const axios = require("axios");
  const PayinTransaction = require("../models/PayinTransaction");
  const Seller = require("../models/Seller");
  const PlatformRevenue = require("../models/PlatformRevenue");
  const Order = require("../models/order.model");

  // ==============================
  // CINETPAY CHECK URL
  // ==============================
  let verifyUrl = (CINETPAY_BASE_URL || "https://api-checkout.cinetpay.com/v2")
    .replace(/\/+$/, "");

  if (!verifyUrl.endsWith("/payment/check")) {
    verifyUrl += "/payment/check";
  }

  // ==============================
  // CALL CINETPAY
  // ==============================
  let resp;
  try {
    resp = await axios.post(
      verifyUrl,
      {
        apikey: CINETPAY_API_KEY,
        site_id: CINETPAY_SITE_ID,
        transaction_id,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );
  } catch (err) {
    throw new Error("Erreur lors de la vérification PayIn (CinetPay unreachable)");
  }

  const data = resp.data?.data || {};
  const status = String(data.status || "").toUpperCase();
  const paidAmount = Number(data.amount || 0);

  // ==============================
  // LOCAL TRANSACTION
  // ==============================
  const tx = await PayinTransaction.findOne({ transaction_id });
  if (!tx) {
    return {
      success: false,
      message: "Transaction introuvable",
      transaction_id,
    };
  }

  // ==============================
  // IDEMPOTENCE HARD GUARD
  // ==============================
  if (tx.status === "SUCCESS" && tx.sellerCredited === true) {
    return {
      success: true,
      message: "Transaction déjà traitée",
      transaction_id,
      status: tx.status,
    };
  }

  tx.cinetpay_status = status;
  tx.raw_response = data;

  // ==============================
  // SUCCESS PAYIN
  // ==============================
  if (["ACCEPTED", "SUCCESS", "PAID"].includes(status)) {
    // 🔐 Sécurité montant
    if (Math.round(paidAmount) !== Math.round(Number(tx.amount))) {
      tx.status = "FAILED";
      tx.verifiedAt = new Date();
      await tx.save();
      throw new Error("Montant payé incohérent");
    }

    // ==========================
    // ORDER (OBLIGATOIRE)
    // ==========================
    const order = await Order.findOne({ payinTransaction: tx._id });
    if (!order) {
      throw new Error("Commande associée introuvable");
    }

    // ==========================
    // CREDIT SELLER (ESCROW SAFE)
    // ==========================
    if (!tx.sellerCredited) {
      // ✅ UPDATE ATOMIQUE — PAS DE seller.save()
      const result = await Seller.updateOne(
        { _id: tx.seller },
        { $inc: { balance_locked: Number(tx.netAmount || 0) } }
      );

      if (result.matchedCount === 0) {
        throw new Error("Vendeur introuvable");
      }

      // ======================
      // PLATFORM REVENUE (IDEMPOTENT)
      // ======================
      if (Number(tx.fees || 0) > 0) {
        const exists = await PlatformRevenue.findOne({
          payinTransactionId: tx._id,
        });

        if (!exists) {
          await PlatformRevenue.create({
            payinTransactionId: tx._id,
            currency: tx.currency || "XOF",
            amount: tx.fees,
            breakdown: tx.fees_breakdown,
          });
        }
      }

      tx.sellerCredited = true;
    }

    // ==========================
    // FINAL STATES
    // ==========================
    tx.status = "SUCCESS";
    tx.verifiedAt = new Date();

    if (order.status !== "PAID") {
      order.status = "PAID";
      await order.save();
    }

    await tx.save();

    return {
      success: true,
      message: "Paiement confirmé – fonds bloqués en escrow",
      transaction_id,
      orderId: order._id,
      status: "SUCCESS",
    };
  }

  // ==============================
  // FAILURE STATES
  // ==============================
  if (["FAILED", "CANCELLED", "CANCELED", "REFUSED"].includes(status)) {
    tx.status = "FAILED";
    tx.verifiedAt = new Date();
    await tx.save();

    return {
      success: false,
      message: `Paiement ${status.toLowerCase()}`,
      transaction_id,
      status,
    };
  }

  // ==============================
  // PENDING / UNKNOWN
  // ==============================
  await tx.save();

  return {
    success: false,
    message: "Paiement en attente",
    transaction_id,
    status,
  };
};


  //=====================================================
  // 			PAYOUT
  // =====================================================
  CinetPayService.createPayOutForSeller = async function({ sellerId, amount, currency = "XOF", notifyUrl = null }) {
  const Seller = require("../models/Seller");
  const PayoutTransaction = require("../models/PayoutTransaction");
  const PlatformRevenue = require("../models/PlatformRevenue");
  const axios = require("axios");

  if (!sellerId || typeof amount !== "number" || isNaN(amount)) {
    throw new Error("sellerId et amount (numérique) sont requis");
  }

  // 🔍 1. Vérifier le vendeur
  const seller = await Seller.findById(sellerId);
  if (!seller) throw new Error("Vendeur introuvable");
  if (!seller.phone || !seller.prefix) {
    throw new Error("Vendeur invalide : numéro ou préfixe manquant");
  }

  // 💰 2. Vérifier solde disponible
  const available = Number(seller.balance_available || 0);
  if (available < amount) {
    throw new Error("Solde insuffisant pour le retrait demandé");
  }

  // 💵 3. Calcul des frais
  const payoutFeeAmount = roundCFA(amount * FEES.payoutCinetPay);
  const netToSend = roundCFA(amount - payoutFeeAmount);
  if (netToSend <= 0) throw new Error("Montant net à envoyer invalide");

  // 💳 4. Débit optimiste du solde vendeur
  seller.balance_available = roundCFA(available - amount);
  await seller.save();

  // 🆔 5. Création de l'ID de transaction
  const client_transaction_id = this.generateTransactionId("PAYOUT");

  // ✅ 6. Enregistrement initial en base
  const payoutTx = await PayoutTransaction.create({
    seller: seller._id,
    sellerId: seller._id,
    client_transaction_id,
    amount,
    currency,
    sent_amount: netToSend,
    fees: payoutFeeAmount,
    status: "PENDING",
    createdAt: new Date(),
    prefix: seller.prefix.toString().replace(/^\+/, ""),
    phone: String(seller.phone),
  });

  // ⚙️ 7. Vérifier si l’API CinetPay est configurée
  if (!CINETPAY_PAYOUT_URL || !CINETPAY_API_KEY || !CINETPAY_API_PASSWORD) {
    console.warn("[CinetPay][Payout] API non configurée → traitement manuel requis.");
    return { client_transaction_id, txId: payoutTx._id, netToSend, fees: payoutFeeAmount };
  }

  try {
    // 👤 8. Vérifier ou créer le contact CinetPay du vendeur
    const contactId = await this.ensureSellerContact(seller._id);
    if (!contactId) {
      throw new Error("Impossible de créer ou récupérer le contact CinetPay");
    }

    // 🔐 9. Authentification API
    const token = await this.getAuthToken();
    if (!token) throw new Error("Échec d'obtention du token CinetPay");

    // 🌍 10. Construction du payload
    const dataArray = [
      {
        amount: String(netToSend),
        phone: String(seller.phone),
        prefix: String(seller.prefix).replace(/^\+/, ""),
        notify_url:
          notifyUrl ||
          (NGROK_URL
            ? `${NGROK_URL}/api/cinetpay/payout-webhook`
            : BASE_URL
            ? `${BASE_URL}/api/cinetpay/payout-webhook`
            : ""),
        client_transaction_id,
      },
    ];

    const paramsBody = new URLSearchParams();
    paramsBody.append("data", JSON.stringify(dataArray));

    const url = `${CINETPAY_PAYOUT_URL.replace(/\/+$/, "")}/transfer/money/send/contact`;

    // 🚀 11. Envoi de la requête CinetPay
    let resp;
    try {
      resp = await axios.post(url, paramsBody.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        params: { token, transaction_id: client_transaction_id },
        timeout: 20000,
      });
    } catch (err) {
      const errBody = err.response?.data || err.message;
      console.error("[CinetPay][Payout] Erreur requête API:", errBody);

      payoutTx.status = "FAILED";
      payoutTx.raw_response = errBody;
      await payoutTx.save();

      // 🩹 Restaure le solde
      seller.balance_available = roundCFA((seller.balance_available || 0) + amount);
      await seller.save();

      const e = new Error("Échec de la requête PayOut CinetPay");
      e.cinetpay = errBody;
      throw e;
    }

    const respData = resp.data || {};
    payoutTx.raw_response = respData;

    // 🧾 12. Vérification de la réponse
    const ok =
      respData &&
      (respData.code === 0 ||
        respData.code === "0" ||
        respData.message === "OPERATION_SUCCES" ||
        respData.status?.toLowerCase() === "success" ||
        (Array.isArray(respData.data) &&
          respData.data[0]?.status?.toLowerCase() === "success"));

    if (ok) {
      payoutTx.status = "PENDING"; // reste en attente de vérif asynchrone
      await payoutTx.save();

      // 💰 Enregistrement revenu plateforme
      if (payoutFeeAmount > 0) {
        try {
          await PlatformRevenue.create({
            transaction: payoutTx._id,
            amount: payoutFeeAmount,
            note: "Commission sur payout",
          });
        } catch (err) {
          console.warn("[CinetPay][Payout] Enregistrement PlatformRevenue échoué:", err.message);
        }
      }

      return {
        success: true,
        client_transaction_id,
        txId: payoutTx._id,
        data: respData,
        netToSend,
        fees: payoutFeeAmount,
      };
    } else {
      payoutTx.status = "FAILED";
      await payoutTx.save();

      seller.balance_available = roundCFA((seller.balance_available || 0) + amount);
      await seller.save();

      const e = new Error("Réponse CinetPay non valide");
      e.cinetpay = respData;
      throw e;
    }
  } catch (err) {
    // 🔁 Sécurité : restauration du solde si erreur
    try {
      const s = await Seller.findById(seller._id);
      if (s && s.balance_available < 0) {
        s.balance_available = roundCFA((s.balance_available || 0) + amount);
        await s.save();
      }
    } catch (inner) {
      console.error("[CinetPay][Payout] Échec de restauration du solde:", inner.message);
    }
    throw err;
  }
};

  // ============================ WEBHOOK (ESCROW SAFE) ============================

CinetPayService.handleWebhook = async function (webhookPayload, headers = {}) {
  const crypto = require("crypto");
  const Order = require("../models/order.model");
  const PayoutTransaction = require("../models/PayoutTransaction");
  const PayinTransaction = require("../models/PayinTransaction");
  const Seller = require("../models/Seller");

  /* ========================== SIGNATURE ========================== */
  if (process.env.WEBHOOK_SECRET) {
    const signature =
      headers["x-cinetpay-signature"] || headers["signature"];

    if (signature) {
      const computed = crypto
        .createHmac("sha256", process.env.WEBHOOK_SECRET)
        .update(JSON.stringify(webhookPayload))
        .digest("hex");

      if (computed !== signature) {
        throw new Error("Invalid webhook signature");
      }
    }
  }

  /* ========================== TRANSACTION ID ========================== */
  const client_transaction_id =
    webhookPayload.client_transaction_id ||
    webhookPayload.data?.client_transaction_id ||
    webhookPayload.transaction_id ||
    webhookPayload.data?.transaction_id;

  if (!client_transaction_id) {
    throw new Error("Webhook: transaction_id manquant");
  }

  const statusFromWebhook = (
    webhookPayload.status ||
    webhookPayload.data?.status ||
    webhookPayload.message ||
    ""
  )
    .toString()
    .toUpperCase();

  /* ======================================================
     🔁 PAYOUT WEBHOOK
  ====================================================== */
  const payoutTx = await PayoutTransaction.findOne({
    client_transaction_id,
  });

  if (payoutTx) {
    if (payoutTx.status === "SUCCESS") {
      return { ok: true, txType: "payout", tx: payoutTx };
    }

    if (statusFromWebhook.includes("SUCCESS")) {
      payoutTx.status = "SUCCESS";
      payoutTx.completedAt = new Date();
    } else if (
      ["FAILED", "CANCEL"].some((s) => statusFromWebhook.includes(s))
    ) {
      payoutTx.status = "FAILED";

      // rollback vendeur
      const seller = await Seller.findById(payoutTx.seller);
      if (seller) {
        seller.balance_available =
          (seller.balance_available || 0) + Number(payoutTx.amount || 0);
        await seller.save();
      }
    }

    payoutTx.raw_response = webhookPayload;
    payoutTx.updatedAt = new Date();
    await payoutTx.save();

    return { ok: true, txType: "payout", tx: payoutTx };
  }

  /* ======================================================
     🔁 PAYIN WEBHOOK (ESCROW LOCK)
  ====================================================== */
  const payinTx = await PayinTransaction.findOne({
    transaction_id: client_transaction_id,
  });

  if (payinTx) {
    payinTx.cinetpay_status = statusFromWebhook;
    payinTx.raw_response = webhookPayload;
    payinTx.updatedAt = new Date();
    await payinTx.save();

    // 🔥 PAYIN SUCCESS → VERROUILLER ESCROW
    if (statusFromWebhook.includes("SUCCESS")) {
      const order = await Order.findById(payinTx.order);

      if (
        order &&
        order.status !== "PAID" &&
        !order.escrow?.isLocked
      ) {
        // 💰 Calcul net vendeur (ex: 10% commission)
        const commissionRate = Number(process.env.PLATFORM_FEE_PERCENT || 10);
        const commission =
          (order.totalAmount * commissionRate) / 100;

        const netAmount = order.totalAmount - commission;

        order.status = "PAID";
        order.netAmount = netAmount;

        order.escrow = {
          isLocked: true,
          lockedAt: new Date(),
          releasedAt: null,
        };

        await order.save();
      }
    }

    return { ok: true, txType: "payin", tx: payinTx };
  }

  return { ok: false, message: "Transaction inconnue" };
};

module.exports = CinetPayService;