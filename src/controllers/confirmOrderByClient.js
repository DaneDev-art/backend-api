const mongoose = require("mongoose");
const Order = require("../models/order.model");
const PayinTransaction = require("../models/PayinTransaction");
const Seller = require("../models/Seller");
const ReferralCommissionService = require("../services/referralCommission.service");

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

    // 🔒 IDEMPOTENCE ESCROW
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
    if (netAmount <= 0) {
      throw new Error("Montant net invalide");
    }

    // 🔓 DÉBLOCAGE ESCROW
    seller.balance_locked = (seller.balance_locked || 0) - netAmount;
    seller.balance_available = (seller.balance_available || 0) + netAmount;
    await seller.save({ session });

    // 🔐 VERROUILLAGE PAYIN
    payinTx.sellerCredited = true;
    payinTx.creditedAt = new Date();
    await payinTx.save({ session });

    // 📦 MISE À JOUR COMMANDE
    order.isConfirmedByClient = true;
    order.confirmedAt = new Date();
    order.status = "COMPLETED";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // 🔥 COMMISSION (hors transaction DB)
    try {
      await ReferralCommissionService.handleOrderCompleted(order);
    } catch (err) {
      console.error("❌ Erreur commission parrainage :", err);
    }

    return {
      success: true,
      message: "Commande confirmée, fonds débloqués",
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
