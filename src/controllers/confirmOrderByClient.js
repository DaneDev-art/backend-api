// ==========================================
// services/confirmOrderByClient.service.js
// ==========================================

const mongoose = require("mongoose");
const Order = require("../models/order.model");
const PayinTransaction = require("../models/PayinTransaction");
const Seller = require("../models/Seller");
const { finalizeOrder } = require("./orderFinalize.service");

async function confirmOrderByClient(orderId, clientId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`🔹 [ConfirmOrder] orderId=${orderId} | clientId=${clientId}`);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("orderId invalide");
    }
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new Error("clientId invalide");
    }

    const order = await Order.findById(orderId)
      .populate("payinTransaction")
      .session(session);

    if (!order) throw new Error("Commande introuvable");

    if (order.client.toString() !== clientId.toString()) {
      throw new Error("Non autorisé à confirmer cette commande");
    }

    const payinTx = order.payinTransaction;
    if (!payinTx) throw new Error("PayinTransaction introuvable");

    if (payinTx.status !== "SUCCESS") {
      throw new Error("Paiement non validé");
    }

    // 🔒 IDEMPOTENCE WALLET
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

    const seller = await Seller.findById(order.seller).session(session);
    if (!seller) throw new Error("Vendeur introuvable");

    const netAmount = Number(order.netAmount || payinTx.netAmount);
    if (!netAmount || netAmount <= 0) {
      throw new Error("Montant net invalide");
    }

    // 🔓 DÉBLOCAGE ESCROW WALLET
    seller.balance_locked = Math.max(
      0,
      (seller.balance_locked || 0) - netAmount
    );
    seller.balance_available =
      (seller.balance_available || 0) + netAmount;

    await seller.save({ session });

    // 🔐 MARQUER PAYIN CRÉDITÉ
    payinTx.sellerCredited = true;
    payinTx.creditedAt = new Date();
    await payinTx.save({ session });

    // 📦 CONFIRMATION CLIENT (PAS DE COMPLETED ICI)
    order.isConfirmedByClient = true;
    order.confirmedAt = new Date();
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // ✅ FINALISATION UNIQUE (status + commissions)
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
