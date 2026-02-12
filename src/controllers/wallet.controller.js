// ==========================================
// controllers/wallet.controller.js
// ==========================================

const mongoose = require("mongoose");

const WalletTransaction = require("../models/WalletTransaction");
const QosPayService = require("../services/QosPayService");
const User = require("../models/user.model");
const Seller = require("../models/Seller");
const ReferralCommission = require("../models/ReferralCommission");
const PayoutTransaction = require("../models/PayoutTransaction");

/* ======================================================
   🔵 PAYOUT VENDEUR (VENTES MARKETPLACE)
   ⚠️ NE DÉBITE PAS ICI — Débit fait par webhook
====================================================== */
exports.payoutSeller = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sellerId = req.user.id;
    const { amount, operator, phone, provider = "QOSPAY" } = req.body;

    if (!amount || Number(amount) <= 0) {
      throw new Error("Montant invalide");
    }

    const seller = await Seller.findById(sellerId).session(session);
    if (!seller) throw new Error("Vendeur introuvable");

    const available = Number(seller.balance_available || 0);
    const withdrawAmount = Number(amount);

    if (available < withdrawAmount) {
      throw new Error(
        `Solde insuffisant (disponible: ${available}, demandé: ${withdrawAmount})`
      );
    }

    // 🔥 Appel QOSPAY (deposit = withdraw)
    const payout = await QosPayService.createPayOutForSeller({
      sellerId: seller._id,
      amount: withdrawAmount,
      operator,
      phone,
      provider,
    });

    if (!payout.success) {
      throw new Error("Échec du payout fournisseur");
    }

    // ✅ ON NE DÉBITE PAS ICI
    // Le débit sera fait dans le webhook SUCCESS

    await PayoutTransaction.create(
      [
        {
          seller: seller._id,
          provider,
          amount: withdrawAmount,
          currency: "XOF",
          transaction_id: payout.transactionId,
          operator,
          prefix: "+228",
          phone,
          status: "PENDING",
          raw_response: payout.raw || null,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.json({
      success: true,
      message: "Retrait vendeur en cours de traitement",
      amount: withdrawAmount,
      balance_available: available, // inchangé
      status: "PENDING",
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ payoutSeller:", err);

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  } finally {
    session.endSession();
  }
};

/* ======================================================
   🔵 PAYOUT USER (RETRAIT REFERRAL)
   ⚠️ NE DÉBITE PAS ICI — webhook fera le débit
====================================================== */
exports.payout = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { amount, operator, phone } = req.body;

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
      phone,
    });

    if (!payout.success) {
      throw new Error("Échec du payout QOSPAY");
    }

    // ✅ PAS DE DÉBIT ICI

    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: withdrawAmount,
          balanceBefore: available,
          balanceAfter: available, // inchangé
          type: "WITHDRAWAL_REQUEST",
          meta: {
            provider: "QOSPAY",
            operator,
            transaction_id: payout.transactionId,
            status: "PENDING",
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
      balance_available: available,
      status: "PENDING",
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
