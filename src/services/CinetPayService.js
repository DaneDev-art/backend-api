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

// ============================ PAYIN (FINAL & MONGOOSE-SAFE) ============================
 CinetPayService.createPayIn = async function ({
  productPrice,
  shippingFee = 0,
  currency = "XOF",
  buyerEmail,
  buyerPhone,
  buyerAddress, // <-- nouvelle variable
  description,
  returnUrl,
  notifyUrl,
  sellerId,
  clientId,
}) {
  const mongoose = require("mongoose");
  const Seller = require("../models/Seller");
  const PayinTransaction = require("../models/PayinTransaction");
  const axios = require("axios");

  // =============================
  // 🔹 VALIDATION MONTANTS
  // =============================
  productPrice = Number(productPrice);
  shippingFee = Number(shippingFee ?? 0);

  if (!Number.isFinite(productPrice) || productPrice <= 0) throw new Error("productPrice invalide");
  if (!Number.isFinite(shippingFee) || shippingFee < 0) throw new Error("shippingFee invalide");
  if (!sellerId) throw new Error("sellerId manquant");

  // =============================
  // 🔹 VENDEUR
  // =============================
  const seller = await Seller.findById(sellerId);
  if (!seller) throw new Error("Vendeur introuvable");

  // =============================
  // 🔹 CALCUL DES FRAIS
  // =============================
  const { totalFees, netToSeller: netAmount, breakdown } = calculateFees(productPrice, shippingFee);
  const { payinFee, payoutFee, flutterFee } = breakdown;

  if (!Number.isFinite(netAmount) || netAmount < 0) throw new Error("Montant net vendeur invalide");

  // =============================
  // 🔹 IDS & URLS
  // =============================
  const transaction_id = this.generateTransactionId("PAYIN");
  returnUrl = returnUrl || `${BASE_URL}/api/cinetpay/payin/verify`;
  notifyUrl = notifyUrl || `${BASE_URL}/api/cinetpay/payin/verify`;

  // =============================
  // 🔹 CLIENT
  // =============================
  buyerEmail = buyerEmail?.trim() || null;
  buyerPhone = buyerPhone?.replace(/\D/g, "") || null;
  const customerName = buyerEmail ? buyerEmail.split("@")[0] : "client";

  let resolvedClientId = clientId || null;
  if (!resolvedClientId && (buyerEmail || buyerPhone)) {
    resolvedClientId = await this.resolveClientObjectId(null, buyerEmail || buyerPhone);
  }
  if (!resolvedClientId) resolvedClientId = new mongoose.Types.ObjectId();

  // =============================
  // 🔹 CRÉATION TRANSACTION PENDING
  // =============================
  const tx = await PayinTransaction.create({
    seller: seller._id,
    sellerId: seller._id,
    clientId: resolvedClientId,
    transaction_id,
    amount: productPrice,
    netAmount,
    shippingFee,
    fees: totalFees,
    fees_breakdown: { payinFee, payoutFee, flutterFee },
    currency,
    description: description || `Paiement vendeur ${seller.name || seller._id}`,
    customer: {
      email: buyerEmail,
      phone_number: buyerPhone,
      name: customerName,
      address: buyerAddress || "Adresse inconnue", // <-- ici on stocke l'adresse réelle
    },
    status: "PENDING",
  });

  console.log("🟡 [PayIn] Transaction créée:", { transaction_id, amount: productPrice, netAmount, seller: seller._id });

  // =============================
  // 🔹 PAYLOAD CINETPAY
  // =============================
  const payinUrl = `${CINETPAY_BASE_URL.replace(/\/+$/, "")}/payment`;
  const payload = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id,
    amount: productPrice,
    currency,
    description: description || "Paiement eMarket",
    return_url: returnUrl,
    notify_url: notifyUrl,
    customer_name: customerName,
    customer_surname: "achat",
    customer_email: buyerEmail || "client@emarket.tg",
    customer_phone_number: buyerPhone || "",
    customer_address: buyerAddress || "Adresse inconnue",
    channels: "MOBILE_MONEY",
    metadata: JSON.stringify({ sellerId: seller._id.toString(), shippingFee }),
  };

  console.log("📤 [CinetPay][createPayIn] Payload:", payload);

  // =============================
  // 🔹 APPEL API CINETPAY
  // =============================
  try {
    const resp = await axios.post(payinUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 20000,
    });

    const respData = resp.data;
    tx.raw_response = respData;

    const isSuccess = respData?.code === 0 || respData?.code === "0" || respData?.code === 201 || respData?.code === "201" || !!respData.data?.payment_url;

    if (!isSuccess) {
      tx.status = "FAILED";
      tx.message = respData?.message || respData?.description || "Erreur CinetPay";
      await tx.save();
      throw new Error(`CinetPay erreur: ${tx.message}`);
    }

    // =============================
    // 🔹 SUCCÈS
    // =============================
    tx.payment_token = respData.data?.payment_token || null;
    tx.paymentUrl = respData.data?.payment_url || null;
    tx.message = respData.message || "Transaction créée";
    await tx.save();

    console.log("✅ [CinetPay] PAYIN OK:", { transaction_id, payment_url: tx.paymentUrl });

    return {
      success: true,
      transaction_id,
      payment_url: tx.paymentUrl,
      netAmount,
      totalFees,
      fees_breakdown: { payinFee, payoutFee, flutterFee },
    };
  } catch (err) {
    const body = err.response?.data || err.message;
    console.error("❌ [CinetPay][createPayIn] Erreur:", body);

    tx.status = "FAILED";
    tx.raw_response = body;
    tx.message = body?.message || body?.description || body || "Erreur interne CinetPay";
    await tx.save();

    throw new Error(tx.message);
  }
};

   //=====================================================
  // 			VERFYPAYIN
  // =====================================================

CinetPayService.verifyPayIn = async function (transaction_id) {
  if (!transaction_id) throw new Error("transaction_id est requis");

  const axios = require("axios");
  const PayinTransaction = require("../models/PayinTransaction");
  const Seller = require("../models/Seller");
  const PlatformRevenue = require("../models/PlatformRevenue");

  let verifyUrl = (CINETPAY_BASE_URL || "https://api-checkout.cinetpay.com/v2")
    .replace(/\/+$/, "");
  if (!verifyUrl.endsWith("/payment/check")) verifyUrl += "/payment/check";

  console.log("🔍 [VerifyPayIn] TX:", transaction_id);

  let response;
  try {
    response = await axios.post(
      verifyUrl,
      { apikey: CINETPAY_API_KEY, site_id: CINETPAY_SITE_ID, transaction_id },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
  } catch (err) {
    console.error("❌ [VerifyPayIn] API error:", err.response?.data || err.message);
    throw new Error("Erreur lors de la vérification PayIn");
  }

  const respData = response.data || {};
  const status = (respData.data?.status || "").toUpperCase();
  const paidAmount = Number(respData.data?.amount || 0);

  console.log("🧾 [VerifyPayIn] Statut:", status, "Montant:", paidAmount);

  const tx = await PayinTransaction.findOne({ transaction_id });
  if (!tx) return { success: false, message: "Transaction introuvable", raw: respData };

  // Idempotence stricte
  if (tx.status === "SUCCESS" && tx.sellerCredited === true) {
    return { success: true, message: "Transaction déjà traitée", transaction_id, status };
  }

  tx.cinetpay_status = status;
  tx.raw_response = respData;

  // SUCCESS → fonds bloqués
  if (["ACCEPTED", "SUCCESS", "PAID"].includes(status)) {
    if (paidAmount !== Number(tx.amount)) {
      console.error("❌ [VerifyPayIn] Montant incohérent:", paidAmount, tx.amount);
      tx.status = "FAILED";
      await tx.save();
      throw new Error("Montant payé incohérent");
    }

    if (!tx.sellerCredited) {
      const seller = await Seller.findById(tx.sellerId);
      if (!seller) throw new Error("Vendeur introuvable");

      const net = Number(tx.netAmount || 0);
      seller.balance_locked = (seller.balance_locked || 0) + net;
      await seller.save();

      // Commission plateforme
      if (tx.fees > 0) {
        const exists = await PlatformRevenue.findOne({ transaction: tx._id });
        if (!exists) {
          await PlatformRevenue.create({
            transaction: tx._id,
            amount: tx.fees,
            breakdown: tx.fees_breakdown,
            createdAt: new Date(),
          });
        }
      }

      tx.sellerCredited = true;
    }

    tx.status = "SUCCESS";
    tx.verifiedAt = new Date();
    await tx.save();

    return { success: true, message: "Paiement validé – fonds bloqués", transaction_id, status };
  }

  // Échec / Annulation
  if (["FAILED", "CANCELLED", "CANCELED", "REFUSED"].includes(status)) {
    tx.status = "FAILED";
    tx.verifiedAt = new Date();
    await tx.save();

    return { success: false, message: `Paiement ${status.toLowerCase()}`, transaction_id, status };
  }

  // En attente
  await tx.save();
  return { success: false, message: "Paiement en attente", transaction_id, status };
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

  // ============================ WEBHOOK ============================
CinetPayService.handleWebhook = async function(webhookPayload, headers = {}) {
  const crypto = require("crypto");
  const PayoutTransaction = require("../models/PayoutTransaction");
  const PayinTransaction = require("../models/PayinTransaction");
  const Seller = require("../models/Seller");

  // 🔐 Vérification signature
  if (WEBHOOK_SECRET) {
    const signature = headers["x-cinetpay-signature"] || headers["signature"];
    if (signature) {
      const computed = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(JSON.stringify(webhookPayload))
        .digest("hex");

      if (computed !== signature) {
        throw new Error("Invalid webhook signature");
      }
    }
  }

  const client_transaction_id =
    webhookPayload.client_transaction_id ||
    webhookPayload.data?.client_transaction_id ||
    webhookPayload.transaction_id ||
    webhookPayload.data?.transaction_id;

  if (!client_transaction_id) {
    throw new Error("webhook: client_transaction_id/transaction_id absent");
  }

  // ======================================================
  // 🔁 PAYOUT WEBHOOK
  // ======================================================
  const payoutTx = await PayoutTransaction.findOne({ client_transaction_id });
  if (payoutTx) {
    const statusFromWebhook = (
      webhookPayload.status ||
      webhookPayload.data?.status ||
      webhookPayload.message ||
      ""
    ).toString().toUpperCase();

    // ⛔ Bloquer toute modification après SUCCESS
    if (payoutTx.status === "SUCCESS") {
      return { ok: true, txType: "payout", tx: payoutTx };
    }

    if (statusFromWebhook.includes("SUCCESS")) {
      payoutTx.status = "SUCCESS";
      payoutTx.completedAt = new Date();
    } else if (
      (statusFromWebhook.includes("FAILED") || statusFromWebhook.includes("CANCEL")) &&
      payoutTx.status !== "FAILED"
    ) {
      payoutTx.status = "FAILED";

      // 🔁 Remboursement UNIQUE
      const seller = await Seller.findById(payoutTx.seller || payoutTx.sellerId);
      if (seller) {
        seller.balance_available = roundCFA(
          (seller.balance_available || 0) + (payoutTx.amount || 0)
        );
        await seller.save();
      }
    }

    payoutTx.raw_response = webhookPayload;
    payoutTx.updatedAt = new Date();
    await payoutTx.save();

    return { ok: true, txType: "payout", tx: payoutTx };
  }

  // ======================================================
  // 🔁 PAYIN WEBHOOK (CONFIRMATION UNIQUEMENT)
  // ======================================================
  const payinTx = await PayinTransaction.findOne({
    transaction_id: client_transaction_id,
  });

  if (payinTx) {
    const statusFromWebhook = (
      webhookPayload.status ||
      webhookPayload.data?.status ||
      webhookPayload.message ||
      ""
    ).toString().toUpperCase();

    // 🔒 NE JAMAIS toucher aux soldes ici
    if (
      (statusFromWebhook.includes("SUCCESS") ||
        statusFromWebhook.includes("ACCEPTED") ||
        statusFromWebhook.includes("PAID")) &&
      payinTx.status !== "SUCCESS"
    ) {
      payinTx.status = "SUCCESS";
      payinTx.verifiedAt = new Date();
    } else if (
      (statusFromWebhook.includes("FAILED") || statusFromWebhook.includes("CANCEL")) &&
      payinTx.status !== "FAILED"
    ) {
      payinTx.status = "FAILED";
    }

    payinTx.raw_response = webhookPayload;
    await payinTx.save();

    return { ok: true, txType: "payin", tx: payinTx };
  }

  return { ok: false, message: "Transaction inconnue" };
};

module.exports = CinetPayService;