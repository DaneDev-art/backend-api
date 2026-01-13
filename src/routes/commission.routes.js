const express = require("express");
const router = express.Router();

const CommissionController = require("../controllers/commission.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// ============================
// 💰 ROUTES COMMISSIONS
// ============================

/**
 * Mes commissions
 * GET /api/commissions/my
 */
router.get(
  "/my",
  verifyToken,
  CommissionController.getMyCommissions
);

/**
 * Libérer une commission
 * POST /api/commissions/:id/release
 * ⚠️ À protéger par rôle ADMIN ou CRON
 */
router.post(
  "/:id/release",
  verifyToken,
  CommissionController.releaseCommission
);

module.exports = router;
