const express = require("express");
const router = express.Router();
const controller = require("../controllers/qospayController");

// 📥 PayIn
router.post("/payin/create", controller.createPayIn);
router.post("/payin/verify", controller.verifyPayIn);

// 📤 PayOut
router.post("/payout/create", controller.createPayOut);

// 🔔 Webhook
router.post("/webhook", controller.handleWebhook);

module.exports = router;
