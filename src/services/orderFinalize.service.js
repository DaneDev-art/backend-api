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

  // ===== VERIFIER SI DEJA FINALISEE =====
  if (order.status === "COMPLETED") {
    console.log("⚠️ Order déjà finalisée");
    return order;
  }

  // ===== METTRE A JOUR STATUS =====
  order.status = "COMPLETED";
  order.confirmedAt = new Date();
  order.escrow.isLocked = false;
  order.escrow.releasedAt = new Date();

  await order.save();

  // ===== APPLIQUER COMMISSION DE PARRAINAGE =====
  await ReferralCommissionService.handleOrderCompleted(order);

  console.log("✅ Order finalisée depuis:", source);
  return order;
}

module.exports = { finalizeOrder };
