// controllers/authController.js

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user.model");
const Seller = require("../models/Seller");
const logger = require("../utils/logger");
const { sendEmailJob } = require("../services/emailService");

// ======================================================
// 🔹 JWT
// ======================================================
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
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Cet utilisateur existe déjà" });
    }

    let userData = { email, password, role };

    // 🔹 Rôles
    switch (role) {
      case "buyer": {
        const { fullName, phone, address, zone, country, city, avatarUrl } = req.body;
        Object.assign(userData, { fullName, phone, address, zone, country, city, avatarUrl });
        break;
      }
      case "seller": {
        const { ownerName, shopName, phone, address, country, shopDescription, logoUrl, prefix } = req.body;
        Object.assign(userData, {
          ownerName,
          shopName,
          phone,
          prefix: prefix || "228",
          address,
          country,
          shopDescription,
          logoUrl,
          status: "approved",
        });
        break;
      }
      case "delivery": {
        const {
          fullName, phone, address, zone, country, city,
          plate, idNumber, guarantee, transportMode,
          idCardFrontUrl, idCardBackUrl, selfieUrl
        } = req.body;
        Object.assign(userData, {
          fullName, phone, address, zone, country, city,
          plate, idNumber, guarantee, transportMode,
          idCardFrontUrl, idCardBackUrl, selfieUrl,
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
    userData.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    userData.isVerified = false;

    const user = await User.create(userData);

    // 🔗 URL BACKEND
    const backendUrl = process.env.BACKEND_URL || "https://backend-api-m0tf.onrender.com";
    const verificationUrl = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

    // 📧 Email
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

    // 🔹 Créer / synchroniser le seller après création du user
    if (user.role === "seller") {
      await syncSeller(user);
    }

    res.status(201).json({
      message: "Inscription réussie. Veuillez vérifier votre email.",
      user: user.toPublicJSON(),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Erreur serveur lors de l’inscription" });
  }
};

// ======================================================
// 🔹 LOGIN
// ======================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });

    const user = await User.findOne({ email }).select("+password +isVerified +verificationToken +role");

    if (!user)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Mot de passe incorrect" });

    const rolesRequiringVerification = ["buyer", "seller", "delivery"];
    if (rolesRequiringVerification.includes(user.role) && user.verificationToken && !user.isVerified) {
      return res.status(403).json({
        message: "Veuillez confirmer votre adresse email avant de vous connecter",
      });
    }

    const token = signToken(user);

    res.json({
      token,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    logger.error("Login error:", err);
    res.status(500).json({ message: "Erreur serveur lors de la connexion" });
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
      return res.status(400).json({ message: "Lien invalide ou expiré" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // 👉 Redirection frontend
    const frontendUrl = process.env.FRONTEND_URL || "https://emarket-web.onrender.com";
    return res.redirect(`${frontendUrl}/email-verified?success=true`);
  } catch (err) {
    logger.error("Verify-email error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ======================================================
// 🔹 RESEND VERIFICATION EMAIL
// ======================================================
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email requis" });

    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    if (user.isVerified) {
      return res.status(400).json({
        message: "Ce compte est déjà vérifié",
      });
    }

    // 🔐 Nouveau token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    user.verificationTokenExpires =
      Date.now() + 24 * 60 * 60 * 1000;

    await user.save();

    const backendUrl =
      process.env.BACKEND_URL || "https://backend-api-m0tf.onrender.com";

    const verificationUrl =
      `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

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

    res.json({
      message: "Email de confirmation renvoyé avec succès",
    });
  } catch (err) {
    logger.error("Resend email error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ======================================================
// 🔹 PROFILE
// ======================================================
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

  res.json({ user: user.toPublicJSON() });
};

exports.updateProfile = async (req, res) => {
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
    await syncSeller(user);
  }

  res.json({ user: user.toPublicJSON() });
};

// ======================================================
// 🔹 UPDATE PROFILE PHOTO (USER ONLY)
// ======================================================
exports.updateProfilePhoto = async (req, res) => {
  try {
    const { photoURL } = req.body;

    if (!photoURL) {
      return res.status(400).json({ message: "photoURL requis" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // Mise à jour des différents champs pour compatibilité frontend/backend
    user.photoURL = photoURL;
    user.avatarUrl = photoURL;
    user.profileImageUrl = photoURL;

    await user.save();

    res.json({
      message: "Photo de profil mise à jour avec succès",
      user: { ...user.toPublicJSON(), photoURL: user.photoURL },
    });
  } catch (err) {
    console.error("❌ PUT /users/me/photo error:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

// ======================================================
// 🔹 SYNC SELLER (création ou mise à jour) - VERSION CORRECTE
// ======================================================
const syncSeller = async (user) => {
  try {
    if (!user || user.role !== "seller") return;

    const prefix = user.prefix || "228";
    const phone = user.phone ? String(user.phone).trim() : "00000000";

    const sellerData = {
      user: user._id, // ✅ clé UNIQUE métier
      name: user.ownerName || user.shopName || user.email.split("@")[0],
      email: user.email,
      phone,
      prefix,
      fullNumber: `${prefix}${phone}`,
      role: "seller",
      payout_method: "MOBILE_MONEY",

      // Champs boutique
      address: user.address || "",
      country: user.country || "",
      shopDescription: user.shopDescription || "",
      logoUrl: user.logoUrl || "",
    };

    const seller = await Seller.findOneAndUpdate(
      { user: user._id }, // ✅ clé correcte
      {
        $set: sellerData,
        $setOnInsert: {
          balance_locked: 0,
          balance_available: 0,
          cinetpay_contact_added: false,
          cinetpay_contact_id: null,
          cinetpay_contact_meta: {},
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log("✅ Seller synced:", seller.email);
  } catch (err) {
    console.error("❌ Seller sync error:", err);
  }
};

// ======================================================
// 🔹 GET USER BY ID
// ======================================================
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    let user = await User.findById(id).lean();
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

    let sellerInfo = {};
    if (user.role === "seller") {
      const seller = await Seller.findById(user._id).lean();
      sellerInfo = {
        shopName: seller?.name || user.shopName || "",
        country: seller?.country || user.country || "",
      };
    }

    res.json({ ...user, ...sellerInfo });
  } catch (err) {
    logger.error("GET /users/:id error:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

// ======================================================
// 🔹 GET USERS BY ROLE
// ======================================================
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const { status } = req.query;

    let query = { role };
    if (status) query.status = status;

    const users = await User.find(query).lean();
    res.json(users);
  } catch (err) {
    logger.error("GET /users/role/:role error:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

// ======================================================
// 🔹 PUBLIC GET USERS BY ROLE
// ======================================================
exports.getUsersByRolePublic = async (req, res) => {
  try {
    const { role } = req.params;
    const { status } = req.query;

    let query = { role };
    if (status) query.status = status;

    const users = await User.find(query).lean();
    if (!users || users.length === 0) return res.status(404).json({ message: "Aucun utilisateur trouvé." });

    res.json(users);
  } catch (err) {
    logger.error("GET /users/role/:role/public error:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

// ======================================================
// 🔹 CREATE ADMINS
// ======================================================
const ADMINS = [
  { role: "admin_general", email: "admin_general@gmail.com", password: "AdminGen123!", fullName: "Admin Général" },
  { role: "admin_seller", email: "admin_seller@gmail.com", password: "AdminSell123!", fullName: "Admin Vendeur" },
  { role: "admin_buyer", email: "admin_buyer@gmail.com", password: "AdminBuy123!", fullName: "Admin Acheteur" },
  { role: "admin_delivery", email: "admin_delivery@gmail.com", password: "AdminDel123!", fullName: "Admin Livreur" },
];

exports.createAdmins = async (req, res) => {
  try {
    const secret = req.headers["x-admin-secret"];
    if (!secret || secret !== process.env.ADMIN_CREATION_SECRET) {
      return res.status(401).json({ message: "Unauthorized: invalid secret" });
    }

    const results = [];
    for (const adminData of ADMINS) {
      const existing = await User.findOne({ email: adminData.email });
      if (existing) {
        results.push({ email: adminData.email, status: "already_exists" });
        continue;
      }

      const newAdmin = await User.create(adminData);
      results.push({ email: adminData.email, status: "created" });
    }

    res.status(201).json({ message: "Admins processing completed", admins: results });
  } catch (err) {
    logger.error("/create-admins error:", err);
    res.status(500).json({ message: err.message });
  }
};
