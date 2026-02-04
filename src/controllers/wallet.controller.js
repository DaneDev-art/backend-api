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
      commission: Number(seller.commission || 0),
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

    const seller = await Seller.findOne({ user: userId }).session(session);
    if (!seller) throw new Error("Vendeur introuvable");

    const available = Number(seller.balance_available || 0);
    const withdrawAmount = Number(amount);

    if (available < withdrawAmount) {
      throw new Error("Solde insuffisant");
    }

    const payout = await QosPayService.createPayOutForSeller({
      sellerId: seller._id,
      amount: withdrawAmount,
      operator,
    });

    if (!payout.success) {
      throw new Error("Échec du payout QOSPAY");
    }

    const balanceBefore = available;
    const balanceAfter = balanceBefore - withdrawAmount;

    seller.balance_available = balanceAfter;
    await seller.save({ session });

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

/* ======================================================
   🔁 TRANSFERT COMMISSIONS → SOLDE DISPONIBLE
====================================================== */
exports.transferCommission = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;

    const seller = await Seller.findOne({ user: userId }).session(session);
    if (!seller) throw new Error("Vendeur introuvable");

    const commission = Number(seller.commission || 0);

    if (commission < 1000) {
      return res.status(400).json({
        success: false,
        message: "Minimum 1000 FCFA requis pour le transfert",
      });
    }

    const balanceBefore = Number(seller.balance_available || 0);

    // 🔁 TRANSFERT TOTAL
    seller.commission = 0;
    seller.balance_available = balanceBefore + commission;
    await seller.save({ session });

    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: commission,
          balanceBefore,
          balanceAfter: seller.balance_available,
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
      balance_available: seller.balance_available,
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
