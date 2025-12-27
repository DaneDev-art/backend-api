const Order = require("../models/order.model");
const PayinTransaction = require("../models/PayinTransaction");

exports.handlePayInSuccess = async (req, res) => {
  try {
    const {
      orderId,
      transaction_id,
      status,
      amount,
      rawResponse,
    } = req.body;

    /* ======================================================
       🔹 VALIDATIONS
    ====================================================== */
    if (!orderId || !transaction_id) {
      return res.status(400).json({ message: "Données PayIn invalides" });
    }

    if (status !== "SUCCESS") {
      return res.status(400).json({ message: "Paiement non confirmé" });
    }

    /* ======================================================
       🔹 ORDER
    ====================================================== */
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    if (order.status !== "CREATED") {
      return res.status(400).json({
        message: "Commande déjà payée ou invalide",
      });
    }

    /* ======================================================
       💳 PAYIN TRANSACTION
    ====================================================== */
    const payin = await PayinTransaction.create({
      order: order._id,
      amount,
      transactionId: transaction_id,
      status: "SUCCESS",
      rawResponse,
    });

    /* ======================================================
       🔒 ESCROW – FONDS BLOQUÉS
    ====================================================== */
    order.payinTransaction = payin._id;
    order.cinetpayTransactionId = transaction_id;
    order.status = "PAID";

    await order.save();

    /* ======================================================
       ✅ RÉPONSE
    ====================================================== */
    return res.status(200).json({
      success: true,
      message: "Paiement confirmé, fonds en escrow",
      orderId: order._id,
    });
  } catch (error) {
    console.error("❌ handlePayInSuccess:", error);
    return res.status(500).json({
      message: "Erreur PayIn",
      error: error.message,
    });
  }
};
