// routes/webhooks/cinetpay.webhook.js
const express = require("express");
const router = express.Router();
const PayoutWebhookService = require("../../services/payoutWebhook.service");

// Middleware JSON déjà dans app.js
// router.use(express.json());

router.post("/payout", async (req, res) => {
  console.log("📥 CinetPay webhook reçu :", req.body);

  const { cpm_trans_id, cpm_result, cpm_error_message } = req.body;

  // Validation minimale
  if (!cpm_trans_id || !cpm_result) {
    console.warn("⚠️ Données manquantes dans le webhook CinetPay", req.body);
    return res.status(200).json({ ok: false, message: "Données manquantes" });
  }

  try {
    if (cpm_result === "00") {
      // Succès
      await PayoutWebhookService.handleSuccess({
        payoutId: cpm_trans_id,
        providerTxId: cpm_trans_id,
      });
      console.log(`✅ CinetPay paiement SUCCESS traité: ${cpm_trans_id}`);
    } else {
      // Échec
      await PayoutWebhookService.handleFailure({
        payoutId: cpm_trans_id,
        providerTxId: cpm_trans_id,
        reason: cpm_error_message || cpm_result || "Erreur inconnue",
      });
      console.log(
        `❌ CinetPay paiement échoué: ${cpm_trans_id}, reason: ${cpm_error_message || cpm_result}`
      );
    }

    // Toujours renvoyer 200 pour éviter les retries du provider
    res.status(200).json({ ok: true, message: "Webhook reçu" });
  } catch (err) {
    console.error("❌ Erreur lors du traitement CinetPay webhook :", err);

    // Toujours renvoyer 200 pour éviter les retries du provider
    res.status(200).json({
      ok: false,
      message: "Erreur interne lors du traitement",
      error: err.message,
    });
  }
});

module.exports = router;
