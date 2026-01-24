// =============================================
// routes/webhooks/qospay.webhook.js
// QOSPAY PAYOUT WEBHOOK — PROD SAFE
// =============================================

const express = require("express");
const router = express.Router();
const PayoutWebhookService = require("../../services/payoutWebhook.service");
const PayoutTransaction = require("../../models/PayoutTransaction");

// Middleware JSON déjà global dans app.js

router.post("/payout", async (req, res) => {
  console.log("📥 QOSPay webhook reçu :", req.body);

  const rawStatus = req.body?.status;
  const status = String(rawStatus || "").toUpperCase();

  const payoutRef =
    req.body?.client_transaction_id ||
    req.body?.transref ||
    req.body?.transaction_id;

  const providerTxId = req.body?.transaction_id || null;

  if (!payoutRef || !status) {
    console.warn("⚠️ Webhook QOSPay incomplet", req.body);
    return res.status(200).json({ ok: false, message: "Payload incomplet" });
  }

  try {
    const payout = await PayoutTransaction.findOne({
      client_transaction_id: payoutRef,
      provider: "QOSPAY",
    });

    if (!payout) {
      console.warn(`⚠️ Payout introuvable : ${payoutRef}`);
      return res.status(200).json({ ok: true });
    }

    // 🔒 Idempotence
    if (["SUCCESS", "FAILED"].includes(payout.status)) {
      console.log(`ℹ️ Webhook déjà traité : ${payoutRef}`);
      return res.status(200).json({ ok: true });
    }

    if (status === "SUCCESS") {
      await PayoutWebhookService.handleSuccess({
        payoutId: payoutRef,
        providerTxId,
      });
      console.log(`✅ QOSPay PAYOUT SUCCESS : ${payoutRef}`);
    } else {
      await PayoutWebhookService.handleFailure({
        payoutId: payoutRef,
        providerTxId,
        reason: status,
      });
      console.log(`❌ QOSPay PAYOUT FAILED : ${payoutRef} (${status})`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Erreur webhook QOSPay :", err);
    return res.status(200).json({
      ok: false,
      message: "Erreur interne",
    });
  }
});

module.exports = router;
