// services/payoutWebhook.service.js
const mongoose = require("mongoose");
const PayoutTransaction = require("../models/PayoutTransaction");
const Wallet = require("../models/Wallet");
const chalk = require("chalk");

class PayoutWebhookService {

  // ✅ SUCCESS = confirmation uniquement
  static async handleSuccess({ payoutId, providerTxId }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const payout = await PayoutTransaction.findOne({
        client_transaction_id: payoutId,
      }).session(session);

      if (!payout) {
        console.warn(chalk.yellow(`⚠️ Payout introuvable: ${payoutId}`));
        await session.abortTransaction();
        return;
      }

      // 🔒 Idempotence
      if (payout.status === "SUCCESS") {
        console.log(chalk.blue(`ℹ️ Payout déjà confirmé: ${payoutId}`));
        await session.commitTransaction();
        return;
      }

      payout.status = "SUCCESS";
      payout.cinetpay_transaction_id =
        providerTxId || payout.cinetpay_transaction_id;
      payout.message = "PAYOUT_CONFIRMED_BY_WEBHOOK";

      await payout.save({ session });

      await session.commitTransaction();
      console.log(chalk.green(`✅ PAYOUT SUCCESS confirmé: ${payoutId}`));
    } catch (err) {
      await session.abortTransaction();
      console.error(chalk.red("❌ handleSuccess error:"), err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ❌ FAILED = remboursement vendeur
  static async handleFailure({ payoutId, providerTxId, reason }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const payout = await PayoutTransaction.findOne({
        client_transaction_id: payoutId,
      }).session(session);

      if (!payout) {
        console.warn(chalk.yellow(`⚠️ Payout introuvable: ${payoutId}`));
        await session.abortTransaction();
        return;
      }

      // 🔒 Idempotence
      if (["FAILED", "CANCELED"].includes(payout.status)) {
        await session.commitTransaction();
        return;
      }

      payout.status = "FAILED";
      payout.cinetpay_transaction_id =
        providerTxId || payout.cinetpay_transaction_id;
      payout.message = reason || "PAYOUT_FAILED_PROVIDER";

      await payout.save({ session });

      // 🔁 Remboursement wallet vendeur
      const wallet = await Wallet.findOne({
        seller: payout.seller,
      }).session(session);

      if (!wallet) throw new Error("WALLET_NOT_FOUND");

      wallet.balance += payout.amount;
      await wallet.save({ session });

      await session.commitTransaction();
      console.log(chalk.red(`❌ PAYOUT FAILED + REMBOURSÉ: ${payoutId}`));
    } catch (err) {
      await session.abortTransaction();
      console.error(chalk.red("❌ handleFailure error:"), err);
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = PayoutWebhookService;
