// ==========================================
// services/subscriptionWebhook.service.js
// ==========================================
const Seller = require("../models/Seller");

/**
 * Helper : ajouter 1 an à une date
 */
const addOneYear = (date) => {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + 1);
  return d;
};

class SubscriptionWebhookService {
  /**
   * ==========================================
   * 🔹 Paiement abonnement SUCCESS
   * ==========================================
   * @param {Object} params
   * @param {String} params.transactionId
   * @param {String} params.providerTxId
   */
  static async handleSuccess({ transactionId, providerTxId }) {
    if (!transactionId) {
      throw new Error("transactionId manquant");
    }

    // Format attendu : SUB_<sellerId>_<timestamp>
    const parts = transactionId.split("_");

    if (parts.length < 3) {
      throw new Error(`Format transactionId invalide: ${transactionId}`);
    }

    const sellerId = parts[1];

    const seller = await Seller.findById(sellerId);

    if (!seller) {
      throw new Error(`Vendeur introuvable pour ${transactionId}`);
    }

    const now = new Date();

    // 🔁 Si abonnement déjà actif, on prolonge à partir de la date de fin
    let startAt = now;

    if (
      seller.subscription?.endAt &&
      seller.subscription.status === "ACTIVE" &&
      seller.subscription.endAt > now
    ) {
      startAt = seller.subscription.endAt;
    }

    seller.subscription.status = "ACTIVE";
    seller.subscription.startAt = startAt;
    seller.subscription.endAt = addOneYear(startAt);
    seller.subscription.lastPaymentAt = now;

    await seller.save();

    console.log(
      `🔐 Abonnement vendeur ACTIVÉ | seller=${seller._id} | jusqu'au=${seller.subscription.endAt.toISOString()}`
    );

    return true;
  }

  /**
   * ==========================================
   * 🔹 Paiement abonnement FAILURE
   * ==========================================
   * @param {Object} params
   * @param {String} params.transactionId
   * @param {String} params.providerTxId
   * @param {String} params.reason
   */
  static async handleFailure({
    transactionId,
    providerTxId,
    reason,
  }) {
    console.warn(
      `⚠️ Abonnement vendeur ÉCHOUÉ | transaction=${transactionId} | reason=${reason}`
    );

    // 👉 Pas de changement d’état vendeur
    // 👉 Log uniquement (audit / monitoring)

    return true;
  }
}

module.exports = SubscriptionWebhookService;
