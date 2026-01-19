const express = require("express");
const router = express.Router();

const ReferralController = require("../controllers/referral.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { validateReferral } = require("../middleware/referral.middleware");

const ReferralCommission = require("../models/ReferralCommission");

// ============================
// 🤝 ROUTES PARRAINAGE
// ============================

/**
 * Appliquer un code de parrainage
 * POST /api/referral/apply
 */
router.post(
  "/apply",
  verifyToken,
  validateReferral, // ✅ protection métier
  ReferralController.applyReferral
);

/**
 * Mes filleuls
 * GET /api/referral/my-referrals
 */
router.get(
  "/my-referrals",
  verifyToken,
  ReferralController.getMyReferrals
);

/**
 * Mon code de parrainage + lien
 * GET /api/referral/my-code
 */
router.get(
  "/my-code",
  verifyToken,
  ReferralController.getMyReferralCode
);

/**
 * 💰 Mes commissions de parrainage
 * GET /api/referral/my-commissions
 */
router.get("/my-commissions", verifyToken, async (req, res) => {
  try {
    const commissions = await ReferralCommission.find({
      referrer: req.user._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: commissions.map((c) => ({
        _id: c._id,
        amount: c.amount,
        commissionType: c.commissionType,
        sourceId: c.sourceId,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error("❌ GET /referral/my-commissions:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur récupération commissions",
    });
  }
});

module.exports = router;
