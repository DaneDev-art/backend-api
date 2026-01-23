const mongoose = require("mongoose");
const User = require("../models/user.model");
const WalletTransaction = require("../models/WalletTransaction");

class WalletService {

  static async credit({
    userId,
    amount,
    type,
    referenceId,
    referenceType,
    meta = {},
  }) {
    if (amount <= 0) throw new Error("Montant invalide");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new Error("Utilisateur introuvable");

      // 🔁 IDEMPOTENCE
      if (referenceId && referenceType) {
        const exists = await WalletTransaction.findOne({
          user: userId,
          referenceId,
          referenceType,
        }).session(session);

        if (exists) {
          await session.commitTransaction();
          session.endSession();
          return user.balance_available;
        }
      }

      const balanceBefore = user.balance_available || 0;
      const balanceAfter = balanceBefore + amount;

      user.balance_available = balanceAfter;
      await user.save({ session });

      await WalletTransaction.create([{
        user: userId,
        amount,
        balanceBefore,
        balanceAfter,
        type,
        referenceId,
        referenceType,
        meta,
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return balanceAfter;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  static async debit({
    userId,
    amount,
    type,
    referenceId,
    referenceType,
    meta = {},
  }) {
    if (amount <= 0) throw new Error("Montant invalide");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new Error("Utilisateur introuvable");

      // 🔁 IDEMPOTENCE
      if (referenceId && referenceType) {
        const exists = await WalletTransaction.findOne({
          user: userId,
          referenceId,
          referenceType,
        }).session(session);

        if (exists) {
          await session.commitTransaction();
          session.endSession();
          return user.balance_available;
        }
      }

      if ((user.balance_available || 0) < amount) {
        throw new Error("Solde insuffisant");
      }

      const balanceBefore = user.balance_available;
      const balanceAfter = balanceBefore - amount;

      user.balance_available = balanceAfter;
      await user.save({ session });

      await WalletTransaction.create([{
        user: userId,
        amount: -amount,
        balanceBefore,
        balanceAfter,
        type,
        referenceId,
        referenceType,
        meta,
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return balanceAfter;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  static async getTransactions(userId, limit = 50, skip = 0) {
    return WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }
}

module.exports = WalletService;
