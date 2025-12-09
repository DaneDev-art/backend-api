const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user.model");
const logger = require("../utils/logger");
const authMiddleware = require("../middleware/auth.middleware");
const sendEmail = require("../utils/sendEmail");

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
// 🔹 REGISTER + Envoi Email de Vérification
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
    // Default Buyer
    else {
      userData.role = "buyer";
    }

    // 📌 Génération du token de vérification
    const verificationToken = crypto.randomBytes(32).toString("hex");
    userData.verificationToken = verificationToken;
    userData.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;

    // 🔥 Création utilisateur
    const user = new User(userData);
    await user.save();
    console.log(`✅ Utilisateur créé : ${user.email}`);

    // 📩 Envoi de l’email de confirmation
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: "Confirmez votre adresse email",
      html: `
        <h2>E-Market vous souhaite la bienvenue !</h2>
        <p>Merci de vous être inscrit. Veuillez confirmer votre email :</p>
        <a href="${verificationUrl}" style="padding:10px 20px; background:#4CAF50; color:white;">Confirmer mon email</a>
      `,
    });

    // 🔹 Synchronisation Seller
    if (user.role === "seller") {
      const Seller = require("../models/Seller");

      try {
        let seller = await Seller.findOne({ email: user.email });

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
          console.log(`✅ Seller créé automatiquement pour ${user.email}`);
        } else {
          seller.name = user.ownerName || user.shopName || seller.name;
          seller.phone = user.phone || seller.phone;
          await seller.save();
          console.log(`🔄 Seller mis à jour automatiquement pour ${user.email}`);
        }
      } catch (err) {
        console.error(`❌ Erreur sync Seller :`, err.message);
      }
    }

    res.status(201).json({
      message: "Inscription réussie. Veuillez vérifier votre email.",
    });

  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Erreur serveur lors de l’inscription" });
  }
});

// ======================================================
// 🔹 CONFIRMATION EMAIL
// ======================================================
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Token invalide ou expiré." });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;

    await user.save();

    res.json({ message: "Email vérifié avec succès." });

  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ======================================================
// 🔹 LOGIN (avec vérification email)
// ======================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "Identifiants invalides" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Identifiants invalides" });

    // 🚨 Email pas encore confirmé
    if (!user.isVerified) {
      return res.status(403).json({
        message: "Veuillez confirmer votre email avant de vous connecter."
      });
    }

    // Vérification rôle
    if (role && user.role !== role) {
      return res.status(401).json({ message: "Rôle invalide pour cet utilisateur" });
    }

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
// 🔹 UPDATE PROFILE + sync Seller
// ======================================================
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    // Sync Seller
    if (user.role === "seller") {
      const Seller = require("../models/Seller");

      try {
        let seller = await Seller.findById(user._id);
        if (!seller) {
          seller = await Seller.create({
            _id: user._id,
            name: user.ownerName || user.shopName || user.email.split("@")[0],
            email: user.email,
            phone: user.phone || "",
            prefix: "228",
          });
        } else {
          seller.name = user.ownerName || user.shopName || seller.name;
          seller.phone = user.phone || seller.phone;
          await seller.save();
        }
      } catch (err) {
        console.error("❌ Seller sync error:", err.message);
      }
    }

    res.json({ user: user.toPublicJSON() });

  } catch (err) {
    logger.error("❌ Update profile error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour du profil" });
  }
});

// ======================================================
// 🔹 CREATE ADMIN (clé secrète)
// ======================================================
router.post("/admin/create", async (req, res) => {
  try {
    if (req.headers["x-admin-secret"] !== process.env.ADMIN_CREATION_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Cet administrateur existe déjà" });
    }

    const admin = new User({
      email,
      password,
      role: "admin",
      status: "approved",
      isVerified: true,
    });

    await admin.save();

    res.status(201).json({
      message: "Administrateur créé avec succès",
      admin: admin.toPublicJSON(),
    });

  } catch (err) {
    console.error("❌ Admin creation error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la création de l'admin" });
  }
});

module.exports = router;
