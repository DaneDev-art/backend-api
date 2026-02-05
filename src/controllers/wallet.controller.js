// ==========================================
// controllers/wallet.controller.js
// ==========================================

const mongoose = require("mongoose");

const WalletTransaction = require("../models/WalletTransaction");
const QosPayService = require("../services/QosPayService");
const User = require("../models/User"); // ⚠️ modèle générique utilisateur

/* ======================================================
   💰 GET BALANCE
====================================================== */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).lean();

    // Assurer que chaque utilisateur a des champs balance_available et commission
    const balance_available = Number(user?.balance_available || 0);
    const commission = Number(user?.commission || 0);

    return res.json({
      success: true,
      balance_available,
      commission,
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
   🔁 TRANSFERT COMMISSIONS → SOLDE DISPONIBLE
====================================================== */
exports.transferCommission = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;

    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("Utilisateur introuvable");

    const commission = Number(user.commission || 0);

    if (commission < 1000) {
      return res.status(400).json({
        success: false,
        message: "Minimum 1000 FCFA requis pour le transfert",
      });
    }

    const balanceBefore = Number(user.balance_available || 0);

    // 🔁 TRANSFERT TOTAL
    user.commission = 0;
    user.balance_available = balanceBefore + commission;
    await user.save({ session });

    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: commission,
          balanceBefore,
          balanceAfter: user.balance_available,
          type: "SALE_INCOME",
          meta: {
            source: "REFERRAL_COMMISSION_TRANSFER",
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: "Commissions transférées avec succès",
      transferred: commission,
      balance_available: user.balance_available,
      commission: 0,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ transferCommission:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Erreur transfert commission",
    });
  }
};

/* ======================================================
   🔵 PAYOUT (RETRAIT)
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

    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("Utilisateur introuvable");

    const available = Number(user.balance_available || 0);
    const withdrawAmount = Number(amount);

    if (available < withdrawAmount) {
      throw new Error("Solde insuffisant");
    }

    const payout = await QosPayService.createPayOutForUser({
      userId: user._id,
      amount: withdrawAmount,
      operator,
    });

    if (!payout.success) {
      throw new Error("Échec du payout QOSPAY");
    }

    const balanceBefore = available;
    const balanceAfter = balanceBefore - withdrawAmount;

    user.balance_available = balanceAfter;
    await user.save({ session });

    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: withdrawAmount,
          balanceBefore,
          balanceAfter,
          type: "WITHDRAWAL",
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
