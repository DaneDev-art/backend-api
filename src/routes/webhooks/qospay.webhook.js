// =============================================
// routes/webhooks/qospay.webhook.js
// QOSPAY PAYOUT WEBHOOK — PROD SAFE (FIXED)
// =============================================

const express = require("express");
const router = express.Router();

const PayoutWebhookService = require("../../services/payoutWebhook.service");
const PayoutTransaction = require("../../models/PayoutTransaction");

router.post("/payout", async (req, res) => {
  console.log("📥 QOSPay webhook reçu :", req.body);

  const status = String(req.body?.status || "").toUpperCase();

  // 🔑 TON ID interne
  const payoutRef =
    req.body?.transref ||
    req.body?.client_transaction_id ||
    null;

  // 🔑 ID provider QOSPAY
  const providerTxId = req.body?.transaction_id || null;

  if (!payoutRef || !status) {
    console.warn("⚠️ Webhook QOSPay incomplet", req.body);
    return res.status(200).json({ ok: false });
  }

  try {
    const payout = await PayoutTransaction.findOne({
      transaction_id: payoutRef,
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
        payout,
        providerTxId,
        raw: req.body,
      });
      console.log(`✅ QOSPay PAYOUT SUCCESS : ${payoutRef}`);
    } else {
      await PayoutWebhookService.handleFailure({
        payout,
        providerTxId,
        reason: status,
        raw: req.body,
      });
      console.log(`❌ QOSPay PAYOUT FAILED : ${payoutRef} (${status})`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Erreur webhook QOSPay :", err);
    return res.status(200).json({ ok: false });
  }
});

module.exports = router;
