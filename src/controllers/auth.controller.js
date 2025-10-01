// src/routes/authRoutes.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // assure-toi du bon chemin
const logger = require("../utils/logger");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Générer un JWT
const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// -------------------
// REGISTER
// -------------------
router.post("/register", async (req, res) => {
  try {
    const { role, email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email & password required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "User already exists" });

    // Création de l'utilisateur selon le rôle
    let userData = { email, password, role };

    if (role === "buyer") {
      const { fullName, phone, address, zone, country, city } = req.body;
      userData = { ...userData, fullName, phone, address, zone, country, city };
    } else if (role === "seller") {
      const { ownerName, shopName, phone, address, country } = req.body;
      userData = { ...userData, ownerName, shopName, phone, address, country };
    } else if (role === "delivery") {
      const {
        fullName,
        phone,
        address,
        zone,
        country,
        city,
        plate,
        idNumber,
        guarantee,
        transportMode,
        idCardFrontUrl,
        idCardBackUrl,
        selfieUrl,
      } = req.body;

      userData = {
        ...userData,
        fullName,
        phone,
        address,
        zone,
        country,
        city,
        plate,
        idNumber,
        guarantee,
        transportMode,
        idCardFrontUrl,
        idCardBackUrl,
        selfieUrl,
      };
    }

    const user = new User(userData);
    await user.save();

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.fullName || user.ownerName || "",
      },
    });
  } catch (err) {
    logger.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------
// LOGIN
// -------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email & password required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.fullName || user.ownerName || "",
      },
    });
  } catch (err) {
    logger.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------
// PROFILE (protected)
// -------------------
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select("-password");
    if (!u) return res.status(404).json({ message: "User not found" });
    res.json({ user: u });
  } catch (err) {
    logger.error("Profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
