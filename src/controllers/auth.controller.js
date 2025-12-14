// controllers/authController.js

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user.model");
const Seller = require("../models/Seller");
const logger = require("../utils/logger");
const { sendEmailJob } = require("../services/emailService");

// 🔹 Génération de JWT
const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ======================================================
// 🔹 REGISTER
// ======================================================
exports.register = async (req, res) => {
  try {
    const { role, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email et mot de passe requis",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "Cet utilisateur existe déjà",
      });
    }

    let userData = { email, password, role };

    // 🔹 Gestion des rôles
    switch (role) {
      case "buyer": {
        const {
          fullName,
          phone,
          address,
          zone,
          country,
          city,
          avatarUrl,
        } = req.body;
        Object.assign(userData, {
          fullName,
          phone,
          address,
          zone,
          country,
          city,
          avatarUrl,
        });
        break;
      }

      case "seller": {
        const {
          ownerName,
          shopName,
          phone: sPhone,
          address: sAddress,
          country: sCountry,
          shopDescription,
          logoUrl,
        } = req.body;
        Object.assign(userData, {
          ownerName,
          shopName,
          phone: sPhone,
          address: sAddress,
          country: sCountry,
          shopDescription,
          logoUrl,
          status: "approved",
        });
        break;
      }

      case "delivery": {
        const {
          fullName: dFullName,
          phone: dPhone,
          address: dAddress,
          zone: dZone,
          country: dCountry,
          city: dCity,
          plate,
          idNumber,
          guarantee,
          transportMode,
          idCardFrontUrl,
          idCardBackUrl,
          selfieUrl,
        } = req.body;
        Object.assign(userData, {
          fullName: dFullName,
          phone: dPhone,
          address: dAddress,
          zone: dZone,
          country: dCountry,
          city: dCity,
          plate,
          idNumber,
          guarantee,
          transportMode,
          idCardFrontUrl,
          idCardBackUrl,
          selfieUrl,
          status: "pending",
        });
        break;
      }

      default:
        userData.role = "buyer";
    }

    // 🔐 Email verification
    const verificationToken = crypto.randomBytes(32).toString("hex");
    userData.verificationToken = verificationToken;
    userData.verificationTokenExpires =
      Date.now() + 24 * 60 * 60 * 1000; // 24h
    userData.isVerified = false;

    const user = new User(userData);
    await user.save();

    // 🔹 URL BACKEND pour confirmation email
    const backendUrl =
      process.env.BACKEND_URL || "https://backend-api-m0tf.onrender.com";

    const verificationUrl = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

    // 📧 Envoi email de confirmation
    await sendEmailJob({
      to: user.email,
      subject: "Confirmez votre adresse email",
      template: "verify_email",
      templateVars: {
        verificationUrl,
        fullName: user.fullName || user.ownerName || user.email,
        year: new Date().getFullYear(),
      },
    });

    // 🔁 Synchronisation seller
    if (user.role === "seller") {
      await syncSeller(user);
    }

    res.status(201).json({
      message: "Inscription réussie. Veuillez vérifier votre email.",
      user: user.toPublicJSON(),
    });
  } catch (err) {
    logger.error("Register error:", err);
    res.status(500).json({
      message: "Erreur serveur lors de l’inscription",
    });
  }
};

// ======================================================
// 🔹 LOGIN (CORRIGÉ)
// ======================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email et mot de passe requis",
      });
    }

    const user = await User.findOne({ email }).select(
      "+password +isVerified +verificationToken +role"
    );

    if (!user) {
      return res.status(404).json({
        message: "Utilisateur non trouvé",
      });
    }

    // 🔐 Vérification mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Mot de passe incorrect",
      });
    }

    /**
     * ✅ Vérification email requise UNIQUEMENT pour :
     * - buyer / seller / delivery
     * - NOUVEAUX comptes (verificationToken existe)
     * - isVerified === false
     *
     * ❌ PAS requise pour :
     * - admins
     * - anciens utilisateurs
     */
    const rolesRequiringVerification = ["buyer", "seller", "delivery"];

    if (
      rolesRequiringVerification.includes(user.role) &&
      user.verificationToken &&
      user.isVerified === false
    ) {
      return res.status(403).json({
        message:
          "Veuillez confirmer votre adresse email avant de vous connecter",
      });
    }

    // 🔑 Génération du token
    const token = signToken(user);

    res.json({
      token,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    logger.error("Login error:", err);
    res.status(500).json({
      message: "Erreur serveur lors de la connexion",
    });
  }
};

// ======================================================
// 🔹 VERIFY EMAIL
// ======================================================
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Token invalide ou expiré.",
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;

    await user.save();

    res.json({
      message: "Email vérifié avec succès.",
    });
  } catch (err) {
    logger.error("Verify-email error:", err);
    res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ======================================================
// 🔹 PROFILE
// ======================================================
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        message: "Utilisateur introuvable",
      });
    }
    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    logger.error("Get profile error:", err);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération du profil",
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "Utilisateur introuvable",
      });
    }

    if (updates.password) {
      user.password = updates.password;
      delete updates.password;
    }

    Object.assign(user, updates);
    await user.save();

    if (user.role === "seller") {
      await syncSeller(user);
    }

    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    logger.error("Update profile error:", err);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour du profil",
    });
  }
};

// ======================================================
// 🔹 UTILITAIRE — Sync Seller
// ======================================================
const syncSeller = async (user) => {
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
    console.error(
      `Erreur synchronisation Seller pour ${user.email}:`,
      err.message
    );
  }
};
