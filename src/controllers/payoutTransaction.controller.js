const PayoutTransaction = require("../models/PayoutTransaction");

/**
 * GET /api/me/payout-transactions
 * Retraits du vendeur connecté
 */
exports.getMyPayoutTransactions = async (req, res) => {
  try {
    const sellerId = req.user.sellerId;

    if (!sellerId) {
      return res.json({ success: true, transactions: [] });
    }

    const transactions = await PayoutTransaction.find({ seller: sellerId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      transactions,
    });
  } catch (err) {
    console.error("❌ getMyPayoutTransactions", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
