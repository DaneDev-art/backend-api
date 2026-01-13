const User = require("../models/user.model");
const WalletTransaction = require("../models/WalletTransaction");

class WalletService {
  /**
   * 🔹 Créditer le wallet d'un utilisateur
   * @param {Object} params
   * @param {String} params.userId - ID de l'utilisateur
   * @param {Number} params.amount - Montant à créditer
   * @param {String} params.type - Type de transaction (ex: REFERRAL_COMMISSION)
   * @param {ObjectId} [params.referenceId] - ID source (order, referral...)
   * @param {String} [params.referenceType] - Type de source (ORDER, REFERRAL...)
   * @param {Object} [params.meta] - Données additionnelles
   */
  static async credit({
    userId,
    amount,
    type,
    referenceId,
    referenceType,
    meta = {},
  }) {
    if (amount <= 0) throw new Error("Montant invalide");

    const user = await User.findById(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    const balanceBefore = user.balance_available;
    const balanceAfter = balanceBefore + amount;

    user.balance_available = balanceAfter;
    await user.save();

    await WalletTransaction.create({
      user: userId,
      amount,
      balanceBefore,
      balanceAfter,
      type,
      referenceId,
      referenceType,
      meta,
    });

    return balanceAfter;
  }

  /**
   * 🔹 Débiter le wallet d'un utilisateur
   * @param {Object} params
   * @param {String} params.userId - ID de l'utilisateur
   * @param {Number} params.amount - Montant à débiter
   * @param {String} params.type - Type de transaction (ex: WITHDRAWAL)
   * @param {ObjectId} [params.referenceId] - ID source
   * @param {String} [params.referenceType] - Type de source
   * @param {Object} [params.meta] - Données additionnelles
   */
  static async debit({
    userId,
    amount,
    type,
    referenceId,
    referenceType,
    meta = {},
  }) {
    if (amount <= 0) throw new Error("Montant invalide");

    const user = await User.findById(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    if (user.balance_available < amount) {
      throw new Error("Solde insuffisant");
    }

    const balanceBefore = user.balance_available;
    const balanceAfter = balanceBefore - amount;

    user.balance_available = balanceAfter;
    await user.save();

    await WalletTransaction.create({
      user: userId,
      amount: -amount,
      balanceBefore,
      balanceAfter,
      type,
      referenceId,
      referenceType,
      meta,
    });

    return balanceAfter;
  }

  /**
   * 🔹 Historique wallet pour un utilisateur
   */
  static async getTransactions(userId, limit = 50, skip = 0) {
    return WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }
}

module.exports = WalletService;
