const Referral = require("../models/Referral");
const ReferralCommission = require("../models/ReferralCommission");
const WalletService = require("./wallet.service");

const { COMMISSION_PERCENTAGES, COMMISSION_DELAY_DAYS } = require("../config/referral.config");

class CommissionService {
  /**
   * Commission sur vente seller
   */
  static async createSellerCommission({ order }) {
    const sellerId = order.seller;
    const referral = await Referral.findOne({ referred: sellerId });

    if (!referral) return null;

    const percent = COMMISSION_PERCENTAGES.SELLER;
    const amount = (order.totalAmount * percent) / 100;

    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + COMMISSION_DELAY_DAYS);

    return ReferralCommission.create({
      referrer: referral.referrer,
      referred: sellerId,
      sourceId: order._id,
      sourceType: "ORDER",
      amount,
      percentage: percent,
      commissionType: "SELLER_SALE",
      availableAt,
      status: "PENDING",
    });
  }

  /**
   * Commission sur gain utilisateur (buyer / delivery)
   */
  static async createUserEarningCommission({ userId, amount, sourceId }) {
    const referral = await Referral.findOne({ referred: userId });
    if (!referral) return null;

    const percent = COMMISSION_PERCENTAGES.USER;
    const commissionAmount = (amount * percent) / 100;

    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + COMMISSION_DELAY_DAYS);

    return ReferralCommission.create({
      referrer: referral.referrer,
      referred: userId,
      sourceId,
      sourceType: "USER_GAIN",
      amount: commissionAmount,
      percentage: percent,
      commissionType: "USER_EARNING",
      availableAt,
      status: "PENDING",
    });
  }

  /**
   * Libération des commissions (cron / admin)
   */
  static async releaseCommission(commissionId) {
    const commission = await ReferralCommission.findById(commissionId);
    if (!commission) throw new Error("Commission introuvable");

    if (commission.status !== "PENDING") {
      throw new Error("Commission déjà traitée");
    }

    if (commission.availableAt > new Date()) {
      throw new Error("Commission pas encore disponible");
    }

    commission.status = "AVAILABLE";
    await commission.save();

    // Crédit dans le wallet du parrain
    await WalletService.credit({
      userId: commission.referrer,
      amount: commission.amount,
      type: "REFERRAL_COMMISSION",
      referenceId: commission._id,
      referenceType: "REFERRAL",
    });

    return commission;
  }
}

module.exports = CommissionService;
