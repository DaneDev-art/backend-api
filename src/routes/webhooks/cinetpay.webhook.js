// ==========================================
// routes/webhooks/cinetpay.webhook.js
// ==========================================
const express = require("express");
const router = express.Router();

const PayoutWebhookService = require("../../services/payoutWebhook.service");
const SubscriptionWebhookService = require("../../services/subscriptionWebhook.service"); // 🔥 AJOUT

// Middleware JSON déjà dans app.js
// router.use(express.json());

router.post("/payout", async (req, res) => {
  console.log("📥 CinetPay webhook reçu :", req.body);

  const { cpm_trans_id, cpm_result, cpm_error_message } = req.body;

  // ==========================================
  // 🔎 Validation minimale
  // ==========================================
  if (!cpm_trans_id || !cpm_result) {
    console.warn("⚠️ Données manquantes dans le webhook CinetPay", req.body);
    return res.status(200).json({
      ok: false,
      message: "Données manquantes",
    });
  }

  try {
    // ==========================================
    // 🔹 PAIEMENT RÉUSSI
    // ==========================================
    if (cpm_result === "00") {
      // 🔐 ABONNEMENT VENDEUR
      if (cpm_trans_id.startsWith("SUB_")) {
        await SubscriptionWebhookService.handleSuccess({
          transactionId: cpm_trans_id,
          providerTxId: cpm_trans_id,
        });

        console.log(
          `✅ CinetPay abonnement vendeur SUCCESS: ${cpm_trans_id}`
        );
      }

      // 💸 PAYOUT VENDEUR
      else {
        await PayoutWebhookService.handleSuccess({
          payoutId: cpm_trans_id,
          providerTxId: cpm_trans_id,
        });

        console.log(
          `✅ CinetPay payout SUCCESS traité: ${cpm_trans_id}`
        );
      }
    }

    // ==========================================
    // 🔹 PAIEMENT ÉCHOUÉ
    // ==========================================
    else {
      const reason =
        cpm_error_message || cpm_result || "Erreur inconnue";

      // 🔐 ABONNEMENT VENDEUR
      if (cpm_trans_id.startsWith("SUB_")) {
        await SubscriptionWebhookService.handleFailure({
          transactionId: cpm_trans_id,
          providerTxId: cpm_trans_id,
          reason,
        });

        console.log(
          `❌ CinetPay abonnement vendeur FAILED: ${cpm_trans_id}, reason: ${reason}`
        );
      }

      // 💸 PAYOUT VENDEUR
      else {
        await PayoutWebhookService.handleFailure({
          payoutId: cpm_trans_id,
          providerTxId: cpm_trans_id,
          reason,
        });

        console.log(
          `❌ CinetPay payout FAILED: ${cpm_trans_id}, reason: ${reason}`
        );
      }
    }

    // ⚠️ Toujours répondre 200 pour éviter retry CinetPay
    return res.status(200).json({
      ok: true,
      message: "Webhook reçu et traité",
    });
  } catch (err) {
    console.error(
      "❌ Erreur lors du traitement CinetPay webhook :",
      err
    );

    // ⚠️ Toujours répondre 200 pour éviter retry provider
    return res.status(200).json({
      ok: false,
      message: "Erreur interne lors du traitement",
      error: err.message,
    });
  }
});

module.exports = router;
