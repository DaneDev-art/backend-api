// src/routes/cinetpayRoutes.js
const express = require("express");
const router = express.Router();

/**
 * Exemple d’endpoint pour initier un paiement
 * (Ici juste un mock — tu pourras brancher l’API CinetPay réelle plus tard)
 */
router.post("/pay", (req, res) => {
  const { amount, currency, description } = req.body;

  if (!amount || !currency) {
    return res.status(400).json({ message: "amount et currency sont requis" });
  }

  // Simuler une réponse CinetPay
  const fakeTransactionId = `txn_${Date.now()}`;
  res.json({
    message: "Paiement initié ✅",
    transaction_id: fakeTransactionId,
    amount,
    currency,
    description: description || "Achat",
  });
});

/**
 * Endpoint de notification (callback CinetPay)
 * → CinetPay appellera ce endpoint pour confirmer le paiement
 */
router.post("/notify", (req, res) => {
  console.log("📩 Notification CinetPay reçue :", req.body);

  // Répondre immédiatement (CinetPay exige une réponse HTTP 200)
  res.json({ message: "Notification reçue ✅" });
});

/**
 * Endpoint de test pour vérifier que la route marche
 */
router.get("/test", (req, res) => {
  res.send("✅ Route CinetPay fonctionnelle !");
});

module.exports = router;
