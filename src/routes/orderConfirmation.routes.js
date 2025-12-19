// =============================================
// routes/orderConfirmation.routes.js
// =============================================
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");

const Order = require("../models/Order");
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");

// ======================================================
// ✅ CONFIRMATION CLIENT — LIBÉRATION DES FONDS (ESCROW)
// ======================================================
router.post(
  "/orders/:orderId/confirm",
  verifyToken,
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const clientId = req.user._id;
      const { orderId } = req.params;

      // 🔍 1. Commande
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        return res.status(404).json({ error: "Commande introuvable" });
      }

      // 🔐 2. Appartenance client
      if (order.client.toString() !== clientId.toString()) {
        await session.abortTransaction();
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      // 🔁 3. Anti double confirmation
      if (order.isConfirmedByClient === true) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Commande déjà confirmée par le client",
        });
      }

      // 📦 4. Statut livraison
      if (order.status !== "DELIVERED") {
        await session.abortTransaction();
        return res.status(400).json({
          error: "La commande n'est pas encore livrée",
        });
      }

      // 💳 5. Transaction PAYIN
      const transaction = await PayinTransaction.findOne({
        _id: order.payinTransaction,
        status: "SUCCESS",
      }).session(session);

      if (!transaction) {
        await session.abortTransaction();
        return res.status(400).json({
          error: "Paiement non confirmé ou transaction invalide",
        });
      }

      // 🔗 6. Sécurité transaction ↔ client ↔ vendeur
      if (
        transaction.clientId.toString() !== clientId.toString() ||
        transaction.sellerId.toString() !== order.seller.toString()
      ) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Incohérence transaction / commande",
        });
      }

      // 🧍‍♂️ 7. Vendeur
      const seller = await Seller.findById(order.seller).session(session);
      if (!seller) {
        await session.abortTransaction();
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      const amountToRelease = transaction.netAmount;

      // 🔒 8. Vérification solde bloqué
      if ((seller.balance_locked || 0) < amountToRelease) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Solde bloqué insuffisant",
        });
      }

      // 💰 9. LIBÉRATION DES FONDS
      seller.balance_locked -= amountToRelease;
      seller.balance_available =
        (seller.balance_available || 0) + amountToRelease;

      await seller.save({ session });

      // 🟢 10. Finalisation commande
      order.isConfirmedByClient = true;
      order.confirmedAt = new Date();
      order.status = "COMPLETED";

      await order.save({ session });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Commande confirmée. Fonds libérés avec succès.",
        releasedAmount: amountToRelease,
      });
    } catch (err) {
      await session.abortTransaction();
      console.error("❌ Confirmation commande:", err);

      return res.status(500).json({
        error: "Erreur lors de la confirmation de la commande",
      });
    } finally {
      session.endSession();
    }
  }
);

module.exports = router;
