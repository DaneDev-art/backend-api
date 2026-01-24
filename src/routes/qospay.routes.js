const express = require("express");
const router = express.Router();
const controller = require("../controllers/qospayController");

// ======================================================
// 🟢 PAYIN
// ======================================================

// Création PayIn (USSD / SIM Toolkit)
router.post("/payin/create", controller.createPayIn);

// Vérification PayIn (polling Flutter + Postman)
router.post("/payin/verify", controller.verifyPayIn);
router.get("/payin/verify", controller.verifyPayIn);

// ======================================================
// 🔵 PAYOUT
// ======================================================

// Retrait vendeur
router.post("/payout/create", controller.createPayOut);

// ======================================================
// 🔔 WEBHOOK QOSPAY
// ======================================================

// Endpoint dédié QOSPAY
router.post("/webhook/qospay", controller.handleWebhook);

module.exports = router;
