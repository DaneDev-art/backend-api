const mongoose = require("mongoose");
const cron = require("node-cron");
const ReferralCommission = require("../models/ReferralCommission");
const WalletService = require("../services/wallet.service");
const User = require("../models/user.model");

// ==========================================
// 🔹 Fonction principale
// Libère toutes les commissions dont la date de disponibilité est passée
// ==========================================
async function releasePendingCommissions() {
  const now = new Date();

  try {
    const commissions = await ReferralCommission.find({
      status: "PENDING",
      availableAt: { $lte: now },
    });

    if (!commissions.length) {
      console.log(`[Referral CRON][${now.toISOString()}] Aucune commission à libérer`);
      return;
    }

    console.log(`[Referral CRON][${now.toISOString()}] ${commissions.length} commission(s) à libérer`);

    for (const commission of commissions) {
      try {
        // 🔹 Mettre à jour le statut de la commission
        commission.status = "AVAILABLE";
        await commission.save();

        // 🔹 Créditer le wallet du parrain
        await WalletService.credit({
          userId: commission.referrer,
          amount: commission.amount,
          type: "REFERRAL_COMMISSION",
          referenceId: commission._id,
          referenceType: "REFERRAL",
        });

        // 🔹 Mettre à jour les stats du parrain
        await User.findByIdAndUpdate(commission.referrer, {
          $inc: { "referralStats.totalCommissionEarned": commission.amount },
        });

        console.log(
          `[Referral CRON][${now.toISOString()}] Commission ${commission._id} libérée pour l'utilisateur ${commission.referrer}`
        );
      } catch (err) {
        console.error(
          `[Referral CRON][${now.toISOString()}] Erreur lors de la libération de la commission ${commission._id}:`,
          err.message
        );
      }
    }
  } catch (err) {
    console.error(`[Referral CRON][${now.toISOString()}] Erreur globale:`, err.message);
  }
}

// ==========================================
// 🔹 Planification CRON
// Exécute chaque jour à 02:00 AM
// ==========================================
cron.schedule("0 2 * * *", async () => {
  console.log(`[Referral CRON][${new Date().toISOString()}] Démarrage du job de libération des commissions`);
  await releasePendingCommissions();
});

// ==========================================
// 🔹 Export pour exécution manuelle ou tests
// ==========================================
module.exports = { releasePendingCommissions };
