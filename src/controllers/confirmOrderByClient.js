const mongoose = require("mongoose");
const Order = require("../models/order.model");
const PayinTransaction = require("../models/PayinTransaction");
const Seller = require("../models/Seller");
const ReferralCommissionService = require("./referralCommission.service"); // 🔹 import ajouté

async function confirmOrderByClient(orderId, clientId) {
  console.log(`🔹 [ConfirmOrder] Début confirmation | orderId=${orderId} | clientId=${clientId}`);

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
  console.log(`🔹 [ConfirmOrder] Order trouvé | status=${order.status} | isConfirmedByClient=${order.isConfirmedByClient}`);

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
    console.log("⚠️ [ConfirmOrder] Commande déjà confirmée");
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
  console.log(`🔹 [ConfirmOrder] Déblocage montant net pour seller | netAmount=${netAmount}`);
  
  seller.balance_locked = (seller.balance_locked || 0) - netAmount;
  seller.balance_available = (seller.balance_available || 0) + netAmount;
  await seller.save();
  console.log(`✅ [ConfirmOrder] Seller mis à jour | balance_locked=${seller.balance_locked} | balance_available=${seller.balance_available}`);

  // ==============================
  // 🔹 Mise à jour commande
  // ==============================
  order.isConfirmedByClient = true;
  order.confirmedAt = new Date();
  order.status = "COMPLETED";
  await order.save();
  console.log(`✅ [ConfirmOrder] Order status passé à COMPLETED`);

  // ==============================
  // 🔹 🔥 Génération de la commission de parrainage
  // ==============================
  try {
    console.log(`🔹 [ConfirmOrder] Appel ReferralCommissionService.handleOrderCompleted`);
    await ReferralCommissionService.handleOrderCompleted(order);
    console.log(`✅ [ConfirmOrder] Commission de parrainage traitée`);
  } catch (err) {
    console.error("❌ [ConfirmOrder] Erreur génération commission :", err);
  }

  return {
    success: true,
    message: "Commande confirmée, fonds débloqués pour le vendeur",
    orderId: order._id,
    netAmount,
  };
}

module.exports = confirmOrderByClient;
