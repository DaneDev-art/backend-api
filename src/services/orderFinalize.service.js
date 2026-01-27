// ==========================================
// services/orderFinalize.service.js
// ==========================================

const Order = require("../models/order.model");
const ReferralCommissionService = require("./referralCommission.service");

/* ======================================================
   🔹 FINALISER UNE COMMANDE
   - status → COMPLETED
   - débloque l’escrow
   - applique la commission de parrainage
====================================================== */
async function finalizeOrder(orderId, source = "SYSTEM") {
  // ===== CHARGER LA COMMANDE =====
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order introuvable");

  // ===== INITIALISER LES FLAGS =====
  order.escrow = order.escrow || {};
  order.commissionReleased = order.commissionReleased || false;

  // ===== METTRE A JOUR STATUS SI NECESSAIRE =====
  if (order.status !== "COMPLETED") {
    order.status = "COMPLETED";
    order.confirmedAt = new Date();
    order.escrow.isLocked = false;
    order.escrow.releasedAt = new Date();

    await order.save();
    console.log("✅ Order finalisée depuis:", source);
  } else {
    console.log("⚠️ Order déjà finalisée");
  }

  // ===== APPLIQUER COMMISSION DE PARRAINAGE SI PAS ENCORE FAITE =====
  if (!order.commissionReleased) {
    await ReferralCommissionService.handleOrderCompleted(order);
    order.commissionReleased = true;
    await order.save();
    console.log("✅ Commission de parrainage appliquée");
  } else {
    console.log("⚠️ Commission déjà appliquée");
  }

  return order;
}

module.exports = { finalizeOrder };
