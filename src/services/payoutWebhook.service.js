// services/payoutWebhook.service.js
const mongoose = require("mongoose");
const Seller = require("../models/Seller");
const PayoutTransaction = require("../models/PayoutTransaction");
const chalk = require("chalk");

class PayoutWebhookService {

  // 🔹 Gestion paiement réussi
  static async handleSuccess({ payoutId, providerTxId }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Recherche par transaction_id (string) et non _id
      const payout = await PayoutTransaction.findOne({ transaction_id: payoutId }).session(session);
      if (!payout) {
        console.warn(chalk.yellow(`⚠️ Transaction non trouvée: ${payoutId}`));
        await session.abortTransaction();
        return;
      }

      // 🔁 Idempotence
      if (payout.status === "SUCCESS" && payout.webhook_received) {
        console.log(chalk.blue(`ℹ️ Transaction déjà traitée: ${payoutId}`));
        await session.commitTransaction();
        return;
      }

      const seller = await Seller.findById(payout.seller).session(session);
      if (!seller) throw new Error("SELLER_NOT_FOUND");

      // ⚡ Débiter le balance disponible
      seller.balance_available -= payout.amount;
      await seller.save({ session });

      // 🔹 Mettre à jour la transaction
      payout.status = "SUCCESS";
      payout.provider_transaction_id = providerTxId;
      payout.webhook_received = true;
      payout.webhook_received_at = new Date();
      payout.sent_amount = payout.amount;
      payout.message = "PAYOUT_CONFIRMED_BY_WEBHOOK";

      await payout.save({ session });

      await session.commitTransaction();
      console.log(chalk.green(`✅ Transaction ${payoutId} marquée SUCCESS`));

    } catch (err) {
      await session.abortTransaction();
      console.error(chalk.red(`❌ Erreur handleSuccess pour ${payoutId}:`), err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  // 🔹 Gestion paiement échoué
  static async handleFailure({ payoutId, providerTxId, reason }) {
    try {
      const payout = await PayoutTransaction.findOne({ transaction_id: payoutId });

      if (!payout) {
        console.warn(chalk.yellow(`⚠️ Transaction non trouvée: ${payoutId}`));
        return;
      }

      // 🔁 Idempotence
      if (payout.status === "FAILED" && payout.webhook_received) {
        console.log(chalk.blue(`ℹ️ Transaction déjà traitée (FAILED): ${payoutId}`));
        return;
      }

      payout.status = "FAILED";
      payout.provider_transaction_id = providerTxId;
      payout.webhook_received = true;
      payout.webhook_received_at = new Date();
      payout.message = reason || "PAYOUT_FAILED_PROVIDER";

      await payout.save();
      console.log(chalk.red(`❌ Transaction ${payoutId} marquée FAILED`));

    } catch (err) {
      console.error(chalk.red(`❌ Erreur handleFailure pour ${payoutId}:`), err);
      throw err;
    }
  }
}

module.exports = PayoutWebhookService;
