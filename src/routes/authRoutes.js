// src/routes/authRoutes.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Seller = require("../models/Seller");
const logger = require("../utils/logger");
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

// 🔹 Génération du JWT
const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ======================================================
// 🔹 REGISTER
// ======================================================
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
      try {
        const prefix = "228";
        const fullNumber = user.phone ? prefix + user.phone : "";

        let seller = await Seller.findById(user._id);
        if (!seller) {
          seller = await Seller.create({
            _id: user._id,
            name: user.ownerName || user.shopName || user.email.split("@")[0],
            surname: "",
            email: user.email,
            phone: user.phone || "",
            prefix,
            fullNumber,
            balance_locked: 0,
            balance_available: 0,
            payout_method: "MOBILE_MONEY",
            cinetpay_contact_added: false,
            cinetpay_contact_meta: {},
          });
          console.log(`✅ Seller créé automatiquement pour ${user.email}`);
        } else {
          seller.name = user.ownerName || user.shopName || seller.name;
          seller.phone = user.phone || seller.phone;
          seller.prefix = prefix;
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

// ======================================================
// 🔹 LOGIN
// ======================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Mot de passe incorrect" });

    const token = signToken(user);
    res.json({ token, user: user.toPublicJSON() });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la connexion" });
  }
});

// ======================================================
// 🔹 UPDATE PROFILE
// ======================================================
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

    // 🔹 Synchronisation Seller
    if (user.role === "seller") {
      try {
        const prefix = "228";
        const fullNumber = user.phone ? prefix + user.phone : "";

        let seller = await Seller.findById(user._id);
        if (!seller) {
          seller = await Seller.create({
            _id: user._id,
            name: user.ownerName || user.shopName || user.email.split("@")[0],
            surname: "",
            email: user.email,
            phone: user.phone || "",
            prefix,
            fullNumber,
            balance_locked: 0,
            balance_available: 0,
            payout_method: "MOBILE_MONEY",
            cinetpay_contact_added: false,
            cinetpay_contact_meta: {},
          });
        } else {
          seller.name = user.ownerName || user.shopName || seller.name;
          seller.phone = user.phone || seller.phone;
          seller.prefix = prefix;
          seller.fullNumber = fullNumber;
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

// ======================================================
// 🔹 GET PROFILE
// ======================================================
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

// ======================================================
// 🔹 GET USER BY ID (users + sellers)
// ======================================================
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Cherche dans users
    let user = await User.findById(id).lean();

    // 2️⃣ Si pas trouvé, cherche dans sellers
    if (!user) {
      const seller = await Seller.findById(id).lean();
      if (!seller) return res.status(404).json({ message: "Utilisateur non trouvé" });

      return res.json({
        _id: seller._id,
        email: seller.email,
        role: "seller",
        shopName: seller.name || "",
        country: seller.country || "",
      });
    }

    // 3️⃣ Si trouvé dans users, enrichis si seller
    let sellerInfo = {};
    if (user.role === "seller") {
      const seller = await Seller.findById(user._id).lean();
      sellerInfo = {
        shopName: seller?.name || user.shopName || "",
        country: seller?.country || user.country || "",
      };
    }

    res.json({
      ...user,
      ...sellerInfo,
    });
  } catch (err) {
    console.error("❌ GET /users/:id error:", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// ======================================================
// 🔹 Route admin protégée
// ======================================================
router.get("/admin-data", verifyToken, verifyAdmin, async (req, res) => {
  res.json({ message: "✅ Accès admin autorisé", user: req.user });
});

/// 🔥 Route sécurisée pour créer les admins
const ADMINS = [
  { role: "admin_general", email: "admin_general@gmail.com", password: "AdminGen123!", fullName: "Admin Général" },
  { role: "admin_seller", email: "admin_seller@gmail.com", password: "AdminSell123!", fullName: "Admin Vendeur" },
  { role: "admin_buyer", email: "admin_buyer@gmail.com", password: "AdminBuy123!", fullName: "Admin Acheteur" },
  { role: "admin_delivery", email: "admin_delivery@gmail.com", password: "AdminDel123!", fullName: "Admin Livreur" },
];

router.get("/create-admins", async (req, res) => {
  try {
    // 🔐 Protection par clé secrète
    const secret = req.headers["x-admin-secret"];
    if (!secret || secret !== process.env.ADMIN_CREATION_SECRET) {
      return res.status(401).json({ message: "Unauthorized: invalid secret" });
    }

    const results = [];

    for (const adminData of ADMINS) {
      const existing = await User.findOne({ email: adminData.email });

      if (existing) {
        results.push({
          email: adminData.email,
          status: "already_exists",
        });
        continue;
      }

      // Crée le nouvel admin
      const newAdmin = new User(adminData);
      await newAdmin.save();

      results.push({
        email: adminData.email,
        status: "created",
      });
    }

    return res.status(201).json({
      message: "Admins processing completed",
      admins: results,
    });
  } catch (err) {
    console.error("❌ /create-admins error:", err.message);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
