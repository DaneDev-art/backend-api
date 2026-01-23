const express = require("express");
const router = express.Router();
const controller = require("../controllers/qospayController");

router.post("/payin", controller.createPayIn);
router.post("/payin/verify", controller.verifyPayIn);

router.post("/payout", controller.createPayOut);

router.post("/webhook", controller.handleWebhook);

module.exports = router;
