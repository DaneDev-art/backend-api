const ReferralService = require("../services/referral.service");

class ReferralController {
  /**
   * Appliquer un code de parrainage
   * POST /api/referral/apply
   */
  static async applyReferral(req, res, next) {
    try {
      const userId = req.user.id;
      const { referralCode } = req.body;

      if (!referralCode) {
        return res.status(400).json({
          success: false,
          message: "Code de parrainage requis",
        });
      }

      const referral = await ReferralService.applyReferralCode({
        userId,
        referralCode,
      });

      return res.status(201).json({
        success: true,
        message: "Parrainage appliqué avec succès",
        data: referral,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Liste des filleuls de l'utilisateur connecté
   * GET /api/referral/my-referrals
   */
  static async getMyReferrals(req, res, next) {
    try {
      const userId = req.user.id;

      const referrals = await ReferralService.getUserReferrals(userId);

      return res.status(200).json({
        success: true,
        count: referrals.length,
        data: referrals,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReferralController;
