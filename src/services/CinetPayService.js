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
  payinCinetPay: 0.035,
  payoutCinetPay: 0.015,
  appFlutter: 0.02,
};
const TOTAL_FEES = FEES.payinCinetPay + FEES.payoutCinetPay + FEES.appFlutter;

function roundCFA(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeResponse(resp) {
  const d = resp?.data ?? resp;
  const status = d?.data?.status || d?.status || d?.message || null;
  return { raw: d, status };
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
      throw new Error("clientId (ou email/phone) requis pour associer la transaction au client");
    }

    if (clientIdCandidate instanceof mongoose.Types.ObjectId) return clientIdCandidate;

    if (typeof clientIdCandidate === "string" && /^[0-9a-fA-F]{24}$/.test(clientIdCandidate)) {
      return new mongoose.Types.ObjectId(clientIdCandidate);
    }

    const candidate = String(clientIdCandidate || fallbackEmailOrPhone || "").trim();

    if (/@/.test(candidate)) {
      const u = await User.findOne({ email: candidate }).select("_id").lean();
      if (u && u._id) return u._id;
      throw new Error(`Impossible de trouver un utilisateur avec l'email ${candidate}. Passe l'_id ou crée l'utilisateur.`);
    }

    if (/^\+?\d{6,15}$/.test(candidate)) {
      const u = await User.findOne({ phone: candidate }).select("_id").lean();
      if (u && u._id) return u._id;
      throw new Error(`Impossible de trouver un utilisateur avec le numéro ${candidate}. Passe l'_id ou crée l'utilisateur.`);
    }

    throw new Error("clientId non résoluble en ObjectId. Passe l'_id mongoose du user ou son email/phone existant.");
  }

  // ============================ AUTH (PAYOUT API) ============================
  static async getAuthToken() {
    // cached
    if (this.authToken && Date.now() + 5000 < this.authTokenExpiresAt) return this.authToken;

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

      // special handling for NOT_ALLOWED (708)
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
  }

  static async getTransferAuthToken() {
    return this.getAuthToken();
  }

  // ============================ ENSURE / CREATE SELLER CONTACT ============================
/**
 * Assure qu'un vendeur a un contact CinetPay.
 * Si le contact n'existe pas, le crée.
 *
 * @param {string|ObjectId} mongoSellerId - _id du seller ou user
 * @returns {Promise<string>} contact_id CinetPay
 */
static async ensureSellerContact(mongoSellerId) {
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
        // sauvegarde shim si besoin
        save: async () => await userSeller.save(),
        // champs CinetPay
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
  if (!this.contactLocks) this.contactLocks = new Map();
  const lockKey = `${seller.prefix}:${seller.phone}`;
  if (this.contactLocks.get(lockKey)) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const s = await Seller.findById(mongoSellerId).lean();
      if (s && s.cinetpay_contact_added && s.cinetpay_contact_meta?.id) return s.cinetpay_contact_meta.id;
    }
  }
  this.contactLocks.set(lockKey, true);

  try {
    // Appel à la méthode interne de création de contact
    const contactId = await this.createSellerContact(seller);
    return contactId;
  } finally {
    this.contactLocks.delete(lockKey);
  }
}

/**
 * Crée le contact vendeur sur CinetPay
 * @param {Object} seller - objet vendeur (Seller ou User converti)
 * @returns {Promise<string>} contact_id CinetPay
 */
static async createSellerContact(seller) {
  if (!seller) throw new Error("Seller manquant pour création de contact");

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
}

  // ============================ CHECKOUT AUTH TEST ============================
  static async authCheckoutCredentials() {
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
      const res = await axios.post(url, payload, { headers: { "Content-Type": "application/json" }, timeout: 10000 });
      return res.data;
    } catch (err) {
      const body = err.response?.data || err.message;
      console.error("[CinetPay][authCheckoutCredentials] error:", body);
      const e = new Error("Checkout credential check failed");
      e.cinetpay = body;
      throw e;
    }
  }

  // ============================ PAYIN (FINAL & MONGOOSE-SAFE) ============================
static async createPayIn({
  amount,
  currency = "XOF",
  buyerEmail,
  buyerPhone,
  description,
  returnUrl,
  notifyUrl,
  sellerId,
  clientId,
}) {
  if (!amount || !sellerId) {
    throw new Error("Champs manquants: amount ou sellerId");
  }

  // 🔹 Vérifie le vendeur
  const seller = await Seller.findById(sellerId);
  if (!seller) throw new Error("Vendeur introuvable");

  // 🔹 Frais et montant net
  const feePercent = FEES.payinCinetPay || 0.03;
  const feeAmount = roundCFA(amount * feePercent);
  const netAmount = roundCFA(amount - feeAmount);

  // 🔹 Génère un ID unique
  const transaction_id = this.generateTransactionId("PAYIN");

  // 🔹 Définit des URLs sûres
  returnUrl = returnUrl || `${BASE_URL}/api/cinetpay/payin/verify`;
  notifyUrl = notifyUrl || `${BASE_URL}/api/cinetpay/payin/verify`;

  // 🔹 Nettoyage infos client
  buyerEmail = (buyerEmail || "").trim() || null;
  buyerPhone = (buyerPhone || "").replace(/\D/g, "") || null; // supprime tout sauf chiffres
  const customerName = buyerEmail ? buyerEmail.split("@")[0] : "client";

  // 🔹 Crée la transaction MongoDB
  const tx = new PayinTransaction({
    seller: seller._id,
    sellerId: seller._id,
    clientId: clientId || new mongoose.Types.ObjectId(),
    amount,
    netAmount,
    fees: feeAmount,
    currency,
    transaction_id,
    description: description || `Paiement vendeur ${seller.name || seller._id}`,
    customer: {
      email: buyerEmail,
      phone_number: buyerPhone,
      name: customerName,
    },
    status: "PENDING",
  });

  await tx.save();

  // 🔹 Construction du payload CinetPay
  const payinUrl = `${CINETPAY_BASE_URL.replace(/\/+$/, "")}/payment`;
  const payload = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id,
    amount,
    currency,
    description: description || "Paiement eMarket",
    return_url: returnUrl,
    notify_url: notifyUrl,
    customer_name: customerName,
    customer_surname: "achat",
    customer_email: buyerEmail,
    customer_phone_number: buyerPhone || "",
    metadata: JSON.stringify({ sellerId }),
  };

  console.log("[CinetPay][createPayIn] Payload:", payload);

  try {
    const resp = await axios.post(payinUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 20000,
    });

    const respData = resp.data;
    tx.raw_response = respData;

    // ✅ Vérifie les différents formats de succès
    const isSuccess =
      respData.code === 0 ||
      respData.code === "0" ||
      respData.code === 201 ||
      respData.code === "201" ||
      (respData.message && respData.message.toUpperCase() === "CREATED");

    if (isSuccess) {
      tx.status = "PENDING";
      tx.payment_token = respData.data?.payment_token;
      tx.message = respData.message || "Transaction créée avec succès";
      await tx.save();

      console.log("✅ [CinetPay] Transaction créée avec succès :", {
        transaction_id,
        payment_url: respData.data?.payment_url,
      });

      return {
        success: true,
        transaction_id,
        payment_url: respData.data?.payment_url,
        netAmount,
        fees: feeAmount,
      };
    } else {
      tx.status = "FAILED";
      tx.message = respData.message || respData.description || "Erreur CinetPay";
      await tx.save();
      throw new Error(`CinetPay erreur: ${tx.message}`);
    }
  } catch (err) {
    const body = err.response?.data || err.message;
    console.error("[CinetPay][createPayIn] API error:", body);
    tx.status = "FAILED";
    tx.raw_response = body;
    tx.message = body?.message || body?.description || body;
    await tx.save();
    throw new Error(`Erreur interne createPayIn: ${tx.message}`);
  }
}

  // ============================ VERIFY PAYIN (FINAL & SAFE) ============================
static async verifyPayIn(transaction_id) {
  if (!transaction_id) throw new Error("transaction_id est requis");

  // 🔹 URL sécurisée pour la vérification
  let verifyUrl = CINETPAY_BASE_URL?.replace(/\/+$/, "") || "https://api-checkout.cinetpay.com/v2";
  if (!verifyUrl.endsWith("/payment/check")) verifyUrl = `${verifyUrl}/payment/check`;

  console.log("🔍 [CinetPay][VerifyPayIn] URL:", verifyUrl);
  console.log("🔍 [CinetPay][VerifyPayIn] Transaction ID:", transaction_id);

  // 🔹 Appel API CinetPay
  let response;
  try {
    response = await axios.post(
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
    console.error("[CinetPay][VerifyPayIn] Erreur requête:", err.response?.data || err.message);
    throw new Error("Erreur lors de la vérification PayIn");
  }

  // 🔹 Analyse de la réponse
  const respData = response.data || {};
  const status = (respData.data?.status || "").toString().toUpperCase();
  console.log("🧾 [CinetPay][VerifyPayIn] Statut reçu:", status);

  // 🔹 Recherche de la transaction Mongo
  const tx = await PayinTransaction.findOne({ transaction_id });
  if (!tx) {
    console.warn(`[CinetPay][VerifyPayIn] Transaction introuvable: ${transaction_id}`);
    return { success: false, message: "Transaction introuvable", raw: respData };
  }

  // 🔹 Sauvegarde du statut brut
  tx.cinetpay_status = status;
  tx.raw_response = respData;

  // =====================================================
  // ✅ CAS SUCCÈS (paiement validé)
  // =====================================================
  if (["ACCEPTED", "SUCCESS", "PAID"].includes(status)) {
    if (tx.status !== "SUCCESS") {
      tx.status = "SUCCESS";
      tx.verifiedAt = new Date();
      await tx.save();

      // 🔸 Créditer le vendeur
      try {
        const seller = await Seller.findById(tx.seller || tx.sellerId);
        if (seller) {
          const net = Number(tx.netAmount || 0);

          // 🔹 Débloquer le montant verrouillé
          seller.balance_locked = Math.max(0, (seller.balance_locked || 0) - net);

          // 🔹 Créditer le solde disponible
          seller.balance_available = roundCFA((seller.balance_available || 0) + net);

          await seller.save();
          console.log(`💰 [CinetPay][VerifyPayIn] Crédité ${net} XOF à ${seller.shopName || seller._id}`);
        } else {
          console.error(`[CinetPay][VerifyPayIn] Vendeur introuvable pour tx ${tx._id}`);
        }
      } catch (err) {
        console.error("[CinetPay][VerifyPayIn] Erreur crédit vendeur:", err.message);
      }

      // 🔸 Enregistrer la commission plateforme
      try {
        if (tx.fees && tx.fees > 0) {
          await PlatformRevenue.create({
            transaction: tx._id,
            amount: tx.fees,
            breakdown: tx.fees_breakdown,
            createdAt: new Date(),
          });
          console.log(`🏦 [CinetPay][VerifyPayIn] Commission enregistrée: ${tx.fees} XOF`);
        }
      } catch (err) {
        console.error("[CinetPay][VerifyPayIn] Erreur enregistrement PlatformRevenue:", err.message);
      }
    }

    return {
      success: true,
      message: "Paiement validé",
      transaction_id,
      status,
    };
  }

  // =====================================================
  // ⚠️ CAS EN ATTENTE / ANNULÉ / REFUSÉ
  // =====================================================
  if (["REFUSED", "CANCELED", "FAILED"].includes(status)) {
    tx.status = "FAILED";
    await tx.save();

    console.warn(`[CinetPay][VerifyPayIn] Paiement refusé ou annulé: ${transaction_id}`);
    return {
      success: false,
      message: `Paiement ${status.toLowerCase()}`,
      transaction_id,
      status,
    };
  }

  // =====================================================
  // ⏳ CAS PAR DÉFAUT (toujours en attente)
  // =====================================================
  tx.status = "PENDING";
  await tx.save();

  console.log(`[CinetPay][VerifyPayIn] Paiement en attente: ${transaction_id}`);
  return {
    success: false,
    message: "Paiement en attente de confirmation",
    transaction_id,
    status,
  };
}

  // =====================================================
  // ❌ CAS ÉCHEC / ANNULATION
  // =====================================================
  else if (statusString.includes("FAILED") || statusString.includes("CANCEL")) {
    if (tx.status !== "FAILED") {
      tx.status = "FAILED";
      await tx.save();

      // 🔸 Libérer le montant verrouillé sans créditer
      try {
        const seller = await Seller.findById(tx.seller || tx.sellerId);
        if (seller) {
          const net = Number(tx.netAmount || 0);
          seller.balance_locked = Math.max(0, (seller.balance_locked || 0) - net);
          await seller.save();
        }
      } catch (err) {
        console.error("[CinetPay][VerifyPayIn] Échec déverrouillage balance vendeur:", err.message);
      }
    }
  }

  // =====================================================
  // ⏳ CAS EN ATTENTE / AUTRE
  // =====================================================
  else {
    tx.status = "PENDING";
    await tx.save();
  }

  return { success: true, normalized };
}

  // ============================ PAYOUT (FINAL PRODUCTION VERSION) ============================
static async createPayOutForSeller({ sellerId, amount, currency = "XOF", notifyUrl = null }) {
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

  // ✅ 6. Enregistrement initial en base (toujours complet)
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
    prefix: seller.prefix.toString().replace(/^\+/, ""), // nettoyage du prefix
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
}

  // ============================ WEBHOOK ============================
  static async handleWebhook(webhookPayload, headers = {}) {
    if (WEBHOOK_SECRET) {
      const signature = headers["x-cinetpay-signature"] || headers["signature"];
      if (signature) {
        const computed = crypto.createHmac("sha256", WEBHOOK_SECRET).update(JSON.stringify(webhookPayload)).digest("hex");
        if (computed !== signature) throw new Error("Invalid webhook signature");
      }
    }

    const client_transaction_id =
      webhookPayload.client_transaction_id ||
      webhookPayload.data?.client_transaction_id ||
      webhookPayload.transaction_id ||
      webhookPayload.data?.transaction_id;
    if (!client_transaction_id) throw new Error("webhook: client_transaction_id/transaction_id absent");

    // Payout webhook handling
    let tx = await PayoutTransaction.findOne({ client_transaction_id });
    if (tx) {
      const statusFromWebhook = (webhookPayload.status || webhookPayload.data?.status || webhookPayload.message || "").toString().toUpperCase();
      if (statusFromWebhook.includes("SUCCESS")) {
        tx.status = "SUCCESS";
        tx.completedAt = new Date();
      } else if (statusFromWebhook.includes("FAILED") || statusFromWebhook.includes("CANCEL")) {
        tx.status = "FAILED";
        const seller = await Seller.findById(tx.seller || tx.sellerId);
        if (seller) {
          seller.balance_available = roundCFA((seller.balance_available || 0) + (tx.amount || 0));
          await seller.save();
        }
      } else {
        tx.status = "PENDING";
      }
      tx.raw_response = webhookPayload;
      tx.updatedAt = new Date();
      await tx.save();
      return { ok: true, txType: "payout", tx };
    }

    // fallback PayIn webhook handling (existing)
    const payinTx = await PayinTransaction.findOne({ transaction_id: client_transaction_id });
    if (payinTx) {
      const statusFromWebhook = (webhookPayload.status || webhookPayload.data?.status || webhookPayload.message || "").toString().toUpperCase();
      if (statusFromWebhook.includes("SUCCESS") || statusFromWebhook.includes("ACCEPTED") || statusFromWebhook.includes("PAID")) {
        if (payinTx.status !== "SUCCESS") {
          payinTx.status = "SUCCESS";
          payinTx.raw_response = webhookPayload;
          payinTx.verifiedAt = new Date();
          await payinTx.save();
        }
      } else if (statusFromWebhook.includes("FAILED") || statusFromWebhook.includes("CANCEL")) {
        payinTx.status = "FAILED";
        payinTx.raw_response = webhookPayload;
        await payinTx.save();
      }
      return { ok: true, txType: "payin", tx: payinTx };
    }

    return { ok: false, message: "Transaction inconnue" };
  }
}

module.exports = CinetPayService;
