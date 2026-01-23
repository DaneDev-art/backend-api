// routes/webhooks/qospay.webhook.js
const express = require("express");
const router = express.Router();
const PayoutWebhookService = require("../../services/payoutWebhook.service");

// Middleware JSON déjà dans app.js
// router.use(express.json());

router.post("/payout", async (req, res) => {
  console.log("📥 QOSPay webhook reçu :", req.body);

  const { client_transaction_id, transaction_id, status } = req.body;

  if (!client_transaction_id || !transaction_id || !status) {
    console.warn("⚠️ Données manquantes dans le webhook QOSPay", req.body);
    return res.status(200).json({ ok: false, message: "Données manquantes" });
  }

  try {
    if (status === "SUCCESS") {
      await PayoutWebhookService.handleSuccess({
        payoutId: client_transaction_id,
        providerTxId: transaction_id
      });
      console.log(`✅ QOSPay paiement SUCCESS traité: ${client_transaction_id}`);
    } else {
      await PayoutWebhookService.handleFailure({
        payoutId: client_transaction_id,
        providerTxId: transaction_id,
        reason: status
      });
      console.log(`❌ QOSPay paiement échoué: ${client_transaction_id}, status: ${status}`);
    }

    // Toujours renvoyer 200 pour éviter les retries
    res.status(200).json({ ok: true, message: "Webhook reçu" });

  } catch (err) {
    console.error("❌ Erreur lors du traitement QOSPay webhook :", err);
    res.status(200).json({
      ok: false,
      message: "Erreur interne lors du traitement",
      error: err.message
    });
  }
});

module.exports = router;
