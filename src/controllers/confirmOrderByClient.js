const mongoose = require("mongoose");
const Order = require("../models/order.model");
const PayinTransaction = require("../models/PayinTransaction");
const Seller = require("../models/Seller");

async function confirmOrderByClient(orderId, clientId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("orderId invalide");
  }
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    throw new Error("clientId invalide");
  }

  // ==============================
  // 🔹 Récupération commande
  // ==============================
  const order = await Order.findById(orderId).populate("payinTransaction");
  if (!order) {
    throw new Error("Commande introuvable");
  }

  // ==============================
  // 🔹 Vérification client
  // ==============================
  if (order.client.toString() !== clientId.toString()) {
    throw new Error("Vous n'êtes pas autorisé à confirmer cette commande");
  }

  // ==============================
  // 🔹 Vérification ESCROW / état Payin
  // ==============================
  const payinTx = order.payinTransaction;
  if (!payinTx) {
    throw new Error("Transaction Payin introuvable pour cette commande");
  }
  if (payinTx.status !== "SUCCESS") {
    throw new Error("Paiement non validé ou en attente");
  }

  if (order.isConfirmedByClient) {
    return { success: true, message: "Commande déjà confirmée", orderId };
  }

  // ==============================
  // 🔹 Déblocage fonds pour le vendeur
  // ==============================
  const seller = await Seller.findById(order.seller);
  if (!seller) {
    throw new Error("Vendeur introuvable");
  }

  const netAmount = Number(payinTx.netAmount || 0);
  seller.balance_locked = (seller.balance_locked || 0) - netAmount;
  seller.balance_available = (seller.balance_available || 0) + netAmount;
  await seller.save();

  // ==============================
  // 🔹 Mise à jour commande
  // ==============================
  order.isConfirmedByClient = true;
  order.confirmedAt = new Date();
  order.status = "COMPLETED";
  await order.save();

  return {
    success: true,
    message: "Commande confirmée, fonds débloqués pour le vendeur",
    orderId: order._id,
    netAmount,
  };
}

module.exports = confirmOrderByClient;
