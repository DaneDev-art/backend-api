const express = require("express");
const router = express.Router();

const ReferralController = require("../controllers/referral.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { validateReferral } = require("../middleware/referral.middleware");

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

module.exports = router;
