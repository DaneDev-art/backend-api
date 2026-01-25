// ==========================================
// services/confirmOrderByClient.service.js
// ==========================================

const mongoose = require("mongoose");
const Order = require("../models/order.model");
const PayinTransaction = require("../models/PayinTransaction");
const Seller = require("../models/Seller");
const { finalizeOrder } = require("../services/orderFinalize.service"); // ⚡ chemin corrigé

/**
 * Confirme une commande par le client
 * - Débloque le wallet du vendeur
 * - Marque le paiement comme crédité
 * - Déclenche la finalisation de l'ordre
 *
 * @param {string} orderId - ID de la commande
 * @param {string} clientId - ID du client
 * @returns {Promise<Object>} - résultat de la confirmation
 */
async function confirmOrderByClient(orderId, clientId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`🔹 [ConfirmOrder] orderId=${orderId} | clientId=${clientId}`);

    // ✅ Validation des IDs
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("orderId invalide");
    }
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new Error("clientId invalide");
    }

    // ✅ Récupération de la commande avec transaction de paiement
    const order = await Order.findById(orderId)
      .populate("payinTransaction")
      .session(session);

    if (!order) throw new Error("Commande introuvable");

    // ✅ Vérification que le client est bien propriétaire de la commande
    if (order.client.toString() !== clientId.toString()) {
      throw new Error("Non autorisé à confirmer cette commande");
    }

    const payinTx = order.payinTransaction;
    if (!payinTx) throw new Error("PayinTransaction introuvable");

    if (payinTx.status !== "SUCCESS") {
      throw new Error("Paiement non validé");
    }

    // 🔒 Idempotence : si déjà débloqué, on ne fait rien
    if (payinTx.sellerCredited === true) {
      console.log("⚠️ [ConfirmOrder] Fonds déjà débloqués");
      await session.commitTransaction();
      session.endSession();
      return {
        success: true,
        message: "Commande déjà confirmée",
        orderId,
      };
    }

    // ✅ Déblocage du wallet du vendeur
    const seller = await Seller.findById(order.seller).session(session);
    if (!seller) throw new Error("Vendeur introuvable");

    const netAmount = Number(order.netAmount || payinTx.netAmount);
    if (!netAmount || netAmount <= 0) {
      throw new Error("Montant net invalide");
    }

    seller.balance_locked = Math.max(0, (seller.balance_locked || 0) - netAmount);
    seller.balance_available = (seller.balance_available || 0) + netAmount;
    await seller.save({ session });

    // ✅ Marquer le paiement comme crédité
    payinTx.sellerCredited = true;
    payinTx.creditedAt = new Date();
    await payinTx.save({ session });

    // ✅ Marquer la commande comme confirmée par le client
    order.isConfirmedByClient = true;
    order.confirmedAt = new Date();
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // ✅ Finalisation unique (status + commissions)
    await finalizeOrder(order._id, "CLIENT_CONFIRMATION");

    return {
      success: true,
      message: "Commande confirmée et finalisée",
      orderId: order._id,
      netAmount,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ [ConfirmOrder] ERREUR :", error);
    throw error;
  }
}

module.exports = confirmOrderByClient;
