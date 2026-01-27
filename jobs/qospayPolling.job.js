const PayinTransaction = require("../models/PayinTransaction");
const QosPayService = require("../services/QosPayService");

const MAX_AGE_MINUTES = 10;

async function pollPendingQosPay() {
  console.log("🔁 QOSPAY POLLING START");

  const limitDate = new Date(
    Date.now() - MAX_AGE_MINUTES * 60 * 1000
  );

  const pendingTxs = await PayinTransaction.find({
    provider: "QOSPAY",
    status: "PENDING",
    createdAt: { $gte: limitDate },
  }).limit(20); // anti surcharge

  for (const tx of pendingTxs) {
    try {
      console.log(`🔁 Poll tx: ${tx.transaction_id}`);
      await QosPayService.verifyPayIn(tx.transaction_id);
    } catch (err) {
      console.error(
        `❌ Poll error ${tx.transaction_id}:`,
        err.message
      );
    }
  }

  console.log("✅ QOSPAY POLLING END");
}

module.exports = pollPendingQosPay;
