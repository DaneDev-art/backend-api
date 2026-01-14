const ReferralService = require("../services/referral.service");
const User = require("../models/user.model");

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
   * Liste des filleuls + stats + code de parrainage
   * GET /api/referral/my-referrals
   */
  static async getMyReferrals(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId).lean();

      if (!user) return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });

      // Récupérer les filleuls
      const referralsRaw = await ReferralService.getUserReferrals(userId);

      // Transformer pour Flutter
      const referrals = referralsRaw.map(r => ({
        name: r.referred?.fullName || r.referred?.email || "Utilisateur",
        commissionEarned: r.commissionEarned || 0,
        createdAt: r.referred?.createdAt || r.createdAt,
      }));

      return res.status(200).json({
        success: true,
        myReferralCode: user.referralCode || "",
        referralLink: `${process.env.FRONTEND_URL}/register?ref=${user.referralCode || ""}`,
        totalReferrals: user.referralStats?.totalReferrals || 0,
        totalCommissionEarned: user.referralStats?.totalCommissionEarned || 0,
        referrals,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer uniquement le code de parrainage et le lien
   * GET /api/referral/my-code
   */
  static async getMyReferralCode(req, res, next) {
    try {
      const user = await User.findById(req.user.id).lean();
      if (!user) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
      }

      const referralCode = user.referralCode;
      const referralLink = `${process.env.FRONTEND_URL}/register?ref=${referralCode}`;

      return res.status(200).json({
        success: true,
        data: {
          referralCode,
          referralLink,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ReferralController;
