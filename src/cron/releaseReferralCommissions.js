const mongoose = require("mongoose");
const cron = require("node-cron");
const ReferralCommission = require("../models/ReferralCommission");
const WalletService = require("../services/wallet.service");
const User = require("../models/User");

/**
 * 🔹 Fonction principale
 * Libère toutes les commissions dont la date de disponibilité est passée
 */
async function releasePendingCommissions() {
  try {
    const now = new Date();

    // Trouver toutes les commissions PENDING disponibles
    const commissions = await ReferralCommission.find({
      status: "PENDING",
      availableAt: { $lte: now },
    });

    if (!commissions.length) {
      console.log(`[Referral CRON] Aucune commission à libérer à ${now}`);
      return;
    }

    console.log(`[Referral CRON] ${commissions.length} commission(s) à libérer.`);

    for (const commission of commissions) {
      try {
        // Mettre à jour le statut de la commission
        commission.status = "AVAILABLE";
        await commission.save();

        // Créditer le wallet du parrain
        await WalletService.credit({
          userId: commission.referrer,
          amount: commission.amount,
          type: "REFERRAL_COMMISSION",
          referenceId: commission._id,
          referenceType: "REFERRAL",
        });

        // Mettre à jour les stats du parrain
        await User.findByIdAndUpdate(commission.referrer, {
          $inc: { "referralStats.totalCommissionEarned": commission.amount },
        });

        console.log(
          `[Referral CRON] Commission ${commission._id} libérée pour l'utilisateur ${commission.referrer}`
        );
      } catch (err) {
        console.error(
          `[Referral CRON] Erreur lors de la libération de la commission ${commission._id}:`,
          err.message
        );
      }
    }
  } catch (err) {
    console.error("[Referral CRON] Erreur globale:", err.message);
  }
}

// ==========================================
// 🔹 Planification CRON
// Exécute chaque jour à 02:00 AM
// ==========================================
cron.schedule("0 2 * * *", () => {
  console.log("[Referral CRON] Démarrage du job de libération des commissions");
  releasePendingCommissions();
});

module.exports = { releasePendingCommissions };
