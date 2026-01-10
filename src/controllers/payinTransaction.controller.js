const PayinTransaction = require("../models/PayinTransaction");

/**
 * GET /api/me/payin-transactions
 * Transactions d'entrée de l'utilisateur connecté
 */
exports.getMyPayinTransactions = async (req, res) => {
  try {
    const userId = req.user.id;

    const transactions = await PayinTransaction.find({ client: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      transactions,
    });
  } catch (err) {
    console.error("❌ getMyPayinTransactions", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
