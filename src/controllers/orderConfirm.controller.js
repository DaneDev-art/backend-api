// src/controllers/orderConfirm.controller.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const confirmOrderByClient = require("../services/confirmOrderByClient");

// Middleware pour authentifier l'utilisateur (exemple JWT)
const authenticate = require("../middlewares/authenticate");

// ==============================
// 🔹 CONFIRMATION COMMANDE PAR CLIENT
// ==============================
router.post("/api/order/confirm/:orderId", authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;
    const clientId = req.user._id; // récupéré via middleware authenticate

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "orderId invalide" });
    }

    const result = await confirmOrderByClient(orderId, clientId);

    return res.status(200).json({
      success: true,
      message: result.message,
      orderId: result.orderId,
      netAmount: result.netAmount,
    });
  } catch (error) {
    console.error("❌ [ConfirmOrder] Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur lors de la confirmation de la commande",
    });
  }
});

module.exports = router;
