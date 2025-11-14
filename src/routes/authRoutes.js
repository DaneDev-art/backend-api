const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const logger = require("../utils/logger");
const { verifyToken, verifyAdmin, verifyRole } = require("../middleware/auth.middleware");

const router = express.Router();

// 🔹 Génération du JWT
const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// 🔹 REGISTER
router.post("/register", async (req, res) => {
  try {
    const { role, email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(409).json({ message: "Cet utilisateur existe déjà" });

    let userData = { email, password, role };

    if (role === "buyer") {
      const { fullName, phone, address, zone, country, city, avatarUrl } = req.body;
      userData = { ...userData, fullName, phone, address, zone, country, city, avatarUrl };
    } else if (role === "seller") {
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
    } else if (role === "delivery") {
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
    } else {
      userData.role = "buyer";
    }

    // ✅ Création de l'utilisateur
    const user = new User(userData);
    await user.save();
    console.log(`✅ Utilisateur créé : ${user.email}`);

    // 🔹 Synchronisation Seller si role === "seller"
    if (user.role === "seller") {
      const Seller = require("../models/Seller");
      try {
        let seller = await Seller.findOne({ email: user.email });
        const prefix = "228"; // Exemple fixe, peut être dynamique
        const fullNumber = user.phone ? prefix + user.phone : "";

        if (!seller) {
          seller = await Seller.create({
            _id: user._id,
            name: user.ownerName || user.shopName || user.email.split("@")[0],
            surname: "",
            email: user.email,
            phone: user.phone || "",
            fullNumber,
            prefix,
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
          seller.fullNumber = fullNumber;
          await seller.save();
          console.log(`🔄 Seller mis à jour automatiquement pour ${user.email}`);
        }
      } catch (err) {
        console.error(`❌ Erreur synchronisation Seller pour ${user.email}:`, err.message);
      }
    }

    const token = signToken(user);
    res.status(201).json({ token, user: user.toPublicJSON() });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Erreur serveur lors de l’inscription" });
  }
});

// 🔹 LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    const isMatch = await user.comparePassword(password); // Assure-toi que comparePassword existe
    if (!isMatch) return res.status(401).json({ message: "Mot de passe incorrect" });

    const token = signToken(user);
    res.json({ token, user: user.toPublicJSON() });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la connexion" });
  }
});

// 🔹 UPDATE PROFILE
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const updates = { ...req.body };
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    if (updates.password) {
      user.password = updates.password;
      delete updates.password;
    }

    Object.assign(user, updates);
    await user.save();

    if (user.role === "seller") {
      const Seller = require("../models/Seller");
      try {
        let seller = await Seller.findById(user._id);
        if (!seller) {
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
        } else {
          seller.name = user.ownerName || user.shopName || seller.name;
          seller.phone = user.phone || seller.phone;
          await seller.save();
        }
      } catch (err) {
        console.error(`❌ Erreur synchronisation Seller pour ${user.email}:`, err.message);
      }
    }

    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    logger.error("❌ Update profile error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour du profil" });
  }
});

// 🔹 GET PROFILE
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    logger.error("❌ Get profile error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération du profil" });
  }
});

// 🔹 Route admin protégée
router.get("/admin-data", verifyToken, verifyAdmin, async (req, res) => {
  res.json({ message: "✅ Accès admin autorisé", user: req.user });
});

module.exports = router;
