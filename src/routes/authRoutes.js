const express = require("express");
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware");
const authController = require("../controllers/auth.controller");

const router = express.Router();

// ======================================================
// 🔹 AUTH ROUTES
// ======================================================
router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/verify-email", authController.verifyEmail);
router.post(
  "/resend-verification-email",
  authController.resendVerificationEmail
);

// ======================================================
// 🔹 PROFILE ROUTES
// ======================================================
router.get("/profile", verifyToken, authController.getProfile);
router.put("/profile", verifyToken, authController.updateProfile);

// ======================================================
// 🔹 USER ROUTES
// ======================================================
router.get("/users/:id", authController.getUserById);
router.get("/users/role/:role", verifyToken, verifyAdmin, authController.getUsersByRole);
router.get("/users/role/:role/public", authController.getUsersByRolePublic);

// ======================================================
// 🔹 ADMIN ROUTES
// ======================================================
router.get("/admin-data", verifyToken, verifyAdmin, (req, res) => {
  res.json({ message: "✅ Accès admin autorisé", user: req.user });
});

router.get("/create-admins", authController.createAdmins);

module.exports = router;
