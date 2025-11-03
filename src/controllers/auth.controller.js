const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const logger = require("../utils/logger");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// 🔹 Génération du JWT
// ======================================================
const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ======================================================
// 🔹 REGISTER (avec synchronisation automatique des Sellers)
// ======================================================
router.post("/register", async (req, res) => {
  try {
    const { role, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Cet utilisateur existe déjà" });
    }

    let userData = { email, password, role };

    // 🔸 Buyer
    if (role === "buyer") {
      const { fullName, phone, address, zone, country, city, avatarUrl } = req.body;
      userData = { ...userData, fullName, phone, address, zone, country, city, avatarUrl };
    }
    // 🔸 Seller
    else if (role === "seller") {
      const { ownerName, shopName, phone, address, country, shopDescription, logoUrl } = req.body;
      userData = {
        ...userData,
        ownerName,
        shopName,
        phone,
        address,
        country,
        shopDescription,
        logoUrl,
        status: "approved",
      };
    }
    // 🔸 Delivery
    else if (role === "delivery") {
      const {
        fullName, phone, address, zone, country, city,
        plate, idNumber, guarantee, transportMode,
        idCardFrontUrl, idCardBackUrl, selfieUrl
      } = req.body;
      userData = {
        ...userData,
        fullName, phone, address, zone, country, city,
        plate, idNumber, guarantee, transportMode,
        idCardFrontUrl, idCardBackUrl, selfieUrl,
        status: "pending",
      };
    }
    // 🔸 Par défaut : Buyer
    else {
      userData.role = "buyer";
    }

    // ✅ Création de l'utilisateur
    const user = new User(userData);
    await user.save();
    console.log(`✅ Utilisateur créé : ${user.email}`);

    // ==========================
    // 🔹 Synchronisation Sellers
    // ==========================
    if (user.role === "seller") {
      const Seller = require("../models/Seller");

      try {
        let seller = await Seller.findOne({ email: user.email });

        if (!seller) {
          // ⚠️ On fixe le _id du seller identique à celui du user
          seller = await Seller.create({
            _id: user._id,
            name: user.ownerName || user.shopName || user.email.split("@")[0],
            surname: "",
            email: user.email,
            phone: user.phone || "",
            prefix: "228",
            balance_locked: 0,
            balance_available: 0,
            payout_method: "MOBILE_MONEY",
            cinetpay_contact_added: false,
            cinetpay_contact_meta: [],
          });
          console.log(`✅ Seller créé automatiquement pour ${user.email}`);
        } else {
          // Mise à jour automatique
          seller.name = user.ownerName || user.shopName || seller.name;
          seller.phone = user.phone || seller.phone;
          await seller.save();
          console.log(`🔄 Seller mis à jour automatiquement pour ${user.email}`);
        }
      } catch (err) {
        console.error(`❌ Erreur lors de la synchronisation du Seller pour ${user.email}:`, err.message);
      }
    }

    // ✅ Génération du JWT
    const token = signToken(user);
    res.status(201).json({ token, user: user.toPublicJSON() });

  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Erreur serveur lors de l’inscription" });
  }
});

// ======================================================
// 🔹 LOGIN
// ======================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "Identifiants invalides" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Identifiants invalides" });

    const token = signToken(user);
    res.json({ token, user: user.toPublicJSON() });
  } catch (err) {
    logger.error("❌ Login error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la connexion" });
  }
});

// ======================================================
// 🔹 PROFILE (protégé)
// ======================================================
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    logger.error("❌ Profile error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ======================================================
// 🔹 UPDATE PROFILE (protégé + synchronisation Sellers)
// ======================================================
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    // 🔹 Synchronisation Seller si role === "seller"
    if (user.role === "seller") {
      const Seller = require("../models/Seller");
      try {
        let seller = await Seller.findById(user._id);
        if (!seller) {
          // ⚠️ On fixe le _id du seller identique à celui du user
          seller = await Seller.create({
            _id: user._id,
            name: user.ownerName || user.shopName || user.email.split("@")[0],
            surname: "",
            email: user.email,
            phone: user.phone || "",
            prefix: "228",
            balance_locked: 0,
            balance_available: 0,
            payout_method: "MOBILE_MONEY",
            cinetpay_contact_added: false,
            cinetpay_contact_meta: [],
          });
          console.log(`✅ Seller créé automatiquement pour ${user.email}`);
        } else {
          seller.name = user.ownerName || user.shopName || seller.name;
          seller.phone = user.phone || seller.phone;
          await seller.save();
          console.log(`🔄 Seller mis à jour automatiquement pour ${user.email}`);
        }
      } catch (err) {
        console.error(`❌ Erreur lors de la synchronisation du Seller pour ${user.email}:`, err.message);
      }
    }

    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    logger.error("❌ Update profile error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour du profil" });
  }
});

module.exports = router;
