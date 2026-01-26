// ==========================================
// controllers/wallet.controller.js
// ==========================================

const mongoose = require("mongoose");

const Seller = require("../models/Seller");
const WalletTransaction = require("../models/WalletTransaction");
const QosPayService = require("../services/QosPayService");

/* ======================================================
   💰 GET BALANCE
====================================================== */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const seller = await Seller.findOne({ user: userId }).lean();
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Vendeur introuvable",
      });
    }

    return res.json({
      success: true,
      balance_available: Number(seller.balance_available || 0),
      balance_locked: Number(seller.balance_locked || 0),
    });
  } catch (err) {
    console.error("❌ getBalance:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
};

/* ======================================================
   📜 GET WALLET TRANSACTIONS
====================================================== */
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;

    const transactions = await WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      transactions,
    });
  } catch (err) {
    console.error("❌ getTransactions:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
};

/* ======================================================
   🔵 PAYOUT SELLER (WITHDRAWAL)
====================================================== */
exports.payout = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { amount, operator } = req.body;

    if (!amount || Number(amount) <= 0) {
      throw new Error("Montant invalide");
    }

    // ===== LOAD SELLER =====
    const seller = await Seller.findOne({ user: userId }).session(session);
    if (!seller) throw new Error("Vendeur introuvable");

    const available = Number(seller.balance_available || 0);
    const withdrawAmount = Number(amount);

    if (available < withdrawAmount) {
      throw new Error("Solde insuffisant");
    }

    // ===== CALL QOSPAY PAYOUT =====
    const payout = await QosPayService.createPayOutForSeller({
      sellerId: seller._id,
      amount: withdrawAmount,
      operator,
    });

    if (!payout.success) {
      throw new Error("Échec du payout QOSPAY");
    }

    // ===== BALANCE UPDATE =====
    const balanceBefore = available;
    const balanceAfter = balanceBefore - withdrawAmount;

    seller.balance_available = balanceAfter;
    await seller.save({ session });

    // ===== WALLET TRANSACTION (LEDGER) =====
    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: withdrawAmount,
          balanceBefore,
          balanceAfter,
          type: "WITHDRAWAL",
          referenceId: null,
          referenceType: null,
          meta: {
            provider: "QOSPAY",
            operator,
            transaction_id: payout.transaction_id,
            status: payout.status || "PENDING",
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: "Retrait en cours de traitement",
      amount: withdrawAmount,
      transaction_id: payout.transaction_id,
      balanceAfter,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ payout:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur payout",
    });
  }
};
