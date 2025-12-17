// =======================
// src/routes/uploadRoutes.js
// =======================
const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
const { verifyToken } = require("../middleware/auth.middleware");
const User = require("../models/user.model");

// =======================
// 🔧 Configuration Cloudinary
// =======================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dddro1iuo",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =======================
// 📦 Middleware upload
// =======================
router.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 10 * 1024 * 1024 }, // max 10 Mo
    abortOnLimit: true,
    createParentPath: true,
  })
);

// =======================
// 🔹 POST /api/upload
// Upload générique (document, image, PDF)
// =======================
router.post("/", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Aucun fichier reçu." });
    }

    const file = req.files.file;

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: "Format de fichier non autorisé." });
    }

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "delivery_documents",
      resource_type: "auto",
    });

    res.status(200).json({
      message: "✅ Upload réussi",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("❌ Erreur upload Cloudinary :", error);
    if (error.http_code === 401) return res.status(401).json({ message: "Clés Cloudinary invalides ou manquantes." });
    if (error.message && error.message.includes("ENOTFOUND")) return res.status(503).json({ message: "Connexion Cloudinary impossible." });
    res.status(500).json({ message: "Erreur lors de l'upload du fichier.", error: error.message });
  }
});

// =======================
// 🔹 POST /api/upload/profile
// Upload photo de profil utilisateur (sécurisé)
// =======================
router.post("/profile", verifyToken, async (req, res) => {
  try {
    if (!req.files || !req.files.file) return res.status(400).json({ message: "Aucun fichier reçu." });

    const file = req.files.file;

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: "Format de fichier non autorisé pour la photo de profil." });
    }

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "user_profiles",
      width: 500,
      height: 500,
      crop: "fill",
    });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });

    user.photoURL = result.secure_url;
    user.avatarUrl = result.secure_url;
    user.profileImageUrl = result.secure_url;
    await user.save();

    res.status(200).json({
      message: "Photo de profil mise à jour avec succès",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("❌ Erreur upload photo profil :", error);
    if (error.http_code === 401) return res.status(401).json({ message: "Clés Cloudinary invalides ou manquantes." });
    if (error.message && error.message.includes("ENOTFOUND")) return res.status(503).json({ message: "Connexion Cloudinary impossible." });
    res.status(500).json({ message: "Erreur lors de l'upload de la photo de profil.", error: error.message });
  }
});

module.exports = router;
