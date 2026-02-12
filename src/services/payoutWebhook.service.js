// services/payoutWebhook.service.js
const mongoose = require("mongoose");
const PayoutTransaction = require("../models/PayoutTransaction");
const Seller = require("../models/Seller");
const chalk = require("chalk");

class PayoutWebhookService {

  // ✅ SUCCESS = débit final
  static async handleSuccess({ payoutId, providerTxId }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const payout = await PayoutTransaction.findOne({
        transaction_id: payoutId,
      }).session(session);

      if (!payout) {
        console.warn(chalk.yellow(`⚠️ Payout introuvable: ${payoutId}`));
        await session.abortTransaction();
        return;
      }

      // 🔒 Idempotence
      if (payout.status === "SUCCESS") {
        await session.commitTransaction();
        return;
      }

      const seller = await Seller.findById(payout.seller).session(session);
      if (!seller) throw new Error("SELLER_NOT_FOUND");

      // 💰 Débit FINAL ici (et seulement ici)
      seller.balance_available -= payout.amount;
      await seller.save({ session });

      payout.status = "SUCCESS";
      payout.provider_transaction_id = providerTxId;
      payout.webhook_received = true;
      payout.webhook_received_at = new Date();
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

  // ❌ FAILED = pas de débit, juste marquer
  static async handleFailure({ payoutId, providerTxId, reason }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const payout = await PayoutTransaction.findOne({
        transaction_id: payoutId,
      }).session(session);

      if (!payout) {
        await session.abortTransaction();
        return;
      }

      if (payout.status === "FAILED") {
        await session.commitTransaction();
        return;
      }

      payout.status = "FAILED";
      payout.provider_transaction_id = providerTxId;
      payout.webhook_received = true;
      payout.webhook_received_at = new Date();
      payout.message = reason || "PAYOUT_FAILED_PROVIDER";

      await payout.save({ session });

      await session.commitTransaction();
      console.log(chalk.red(`❌ PAYOUT FAILED confirmé: ${payoutId}`));
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
