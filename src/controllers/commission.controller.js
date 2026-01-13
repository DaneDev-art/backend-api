const ReferralCommission = require("../models/ReferralCommission");
const CommissionService = require("../services/commission.service");

class CommissionController {
  /**
   * Mes commissions de parrainage
   * GET /api/commissions/my
   */
  static async getMyCommissions(req, res, next) {
    try {
      const userId = req.user.id;

      const commissions = await ReferralCommission.find({
        referrer: userId,
      })
        .populate("referred", "fullName email role")
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: commissions.length,
        data: commissions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Libérer une commission (ADMIN ou CRON)
   * POST /api/commissions/:id/release
   */
  static async releaseCommission(req, res, next) {
    try {
      const { id } = req.params;

      const commission =
        await CommissionService.releaseCommission(id);

      return res.status(200).json({
        success: true,
        message: "Commission libérée et créditée",
        data: commission,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CommissionController;
