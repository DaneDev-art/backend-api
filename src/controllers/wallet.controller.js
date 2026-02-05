// ==========================================
// controllers/wallet.controller.js
// ==========================================

const mongoose = require("mongoose");

const WalletTransaction = require("../models/WalletTransaction");
const QosPayService = require("../services/QosPayService");
const User = require("../models/user.model");
const ReferralCommission = require("../models/ReferralCommission");

/* ======================================================
   💰 GET BALANCE
====================================================== */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable",
      });
    }

    const balance_available = Number(user.balance_available || 0);

    // 🔥 TOTAL COMMISSIONS DISPONIBLES
    const result = await ReferralCommission.aggregate([
      {
        $match: {
          referrer: new mongoose.Types.ObjectId(userId),
          status: "AVAILABLE",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const commission = Number(result[0]?.total || 0);

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
   🔁 TRANSFERT COMMISSIONS REFERRAL → SOLDE DISPONIBLE
====================================================== */
exports.transferCommission = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;

    const user = await User.findById(userId).session(session);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable",
      });
    }

    // 🔥 CALCUL COMMISSIONS DISPONIBLES
    const result = await ReferralCommission.aggregate([
      {
        $match: {
          referrer: new mongoose.Types.ObjectId(userId),
          status: "AVAILABLE",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const commission = Number(result[0]?.total || 0);

    if (commission < 1000) {
      return res.status(400).json({
        success: false,
        message: "Minimum 1000 FCFA requis pour le transfert",
      });
    }

    const balanceBefore = Number(user.balance_available || 0);
    const balanceAfter = balanceBefore + commission;

    // 💰 AJOUT AU SOLDE
    user.balance_available = balanceAfter;
    await user.save({ session });

    // 🔒 MARQUER COMMISSIONS COMME PAYÉES
    await ReferralCommission.updateMany(
      {
        referrer: user._id,
        status: "AVAILABLE",
      },
      {
        $set: { status: "PAID" },
      },
      { session }
    );

    // 🧾 TRANSACTION WALLET
    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: commission,
          balanceBefore,
          balanceAfter,
          type: "REFERRAL_COMMISSION",
          meta: {
            source: "REFERRAL_COMMISSION_TRANSFER",
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.json({
      success: true,
      message: "Commissions transférées avec succès",
      transferred: commission,
      balance_available: balanceAfter,
      commission: 0,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ transferCommission:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Erreur transfert commission",
    });
  } finally {
    session.endSession();
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

    return res.json({
      success: true,
      message: "Retrait en cours de traitement",
      amount: withdrawAmount,
      balanceAfter,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ payout:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur payout",
    });
  } finally {
    session.endSession();
  }
};
