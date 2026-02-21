const express = require("express");
const router = express.Router();
const controller = require("../controllers/customOrder.controller");

/* ======================================================
   VENDEUR crée une CustomOrder
   body: { conversationId, items, totalAmount, shippingFee, currency }
====================================================== */
router.post("/", controller.createCustomOrder);

/* ======================================================
   CLIENT clique "PAYER" sur une CustomOrder
   → crée Order et déclenche le flow escrow / paiement
====================================================== */
router.post("/:id/pay", controller.payCustomOrder);

/* ======================================================
   CLIENT récupère ses CustomOrders
   Optionnel: query ?conversationId=xxx pour filtrer
====================================================== */
router.get("/client/:clientId", controller.getClientCustomOrders);

/* ======================================================
   VENDEUR récupère ses CustomOrders
   Optionnel: query ?conversationId=xxx pour filtrer
====================================================== */
router.get("/seller/:sellerId", controller.getSellerCustomOrders);

/* ======================================================
   Récupérer toutes les CustomOrders d'une conversation
   Utile pour afficher les commandes dans le chat
====================================================== */
router.get("/conversation/:conversationId", controller.getConversationCustomOrders);

module.exports = router;