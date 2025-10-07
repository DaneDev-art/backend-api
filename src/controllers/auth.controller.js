// src/routes/authRoutes.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");
const authMiddleware = require("../middleware/auth.middleware"); // ✅ correction du chemin (middleware au singulier)

const router = express.Router();

// ----------------------------------------
// 🔹 Génération du JWT
// ----------------------------------------
const signToken = (user) =>
  jwt.sign(
    {
      id: user._id, // utilisé dans req.user.id
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ----------------------------------------
// 🔹 REGISTER
// ----------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { role, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Cet utilisateur existe déjà" });
    }

    let userData = { email, password, role };

    // 🔸 Buyer
    if (role === "buyer") {
      const { fullName, phone, address, zone, country, city } = req.body;
      userData = { ...userData, fullName, phone, address, zone, country, city };
    }

    // 🔸 Seller
    else if (role === "seller") {
      const { ownerName, shopName, phone, address, country } = req.body;
      userData = { ...userData, ownerName, shopName, phone, address, country };
    }

    // 🔸 Delivery
    else if (role === "delivery") {
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

    // ✅ Création de l’utilisateur
    const user = new User(userData);
    await user.save();

    // ✅ Génération du token
    const token = signToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.fullName || user.ownerName || "",
        shopName: user.shopName || null,
      },
    });
  } catch (err) {
    logger.error("❌ Register error:", err);
    res.status(500).json({ message: "Erreur serveur lors de l’inscription" });
  }
});

// ----------------------------------------
// 🔹 LOGIN
// ----------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.fullName || user.ownerName || "",
        shopName: user.shopName || null,
      },
    });
  } catch (err) {
    logger.error("❌ Login error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la connexion" });
  }
});

// ----------------------------------------
// 🔹 PROFILE (protégé)
// ----------------------------------------
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    res.json({ user });
  } catch (err) {
    logger.error("❌ Profile error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
