// =======================
// src/routes/uploadRoutes.js
// =======================
const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;

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
// - useTempFiles true : crée un fichier temporaire pour éviter les buffers trop lourds
// - tempFileDir : chemin du dossier temporaire (Render ou local)
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
// =======================
router.post("/", async (req, res) => {
  try {
    // ✅ Vérifie si un fichier est bien présent
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Aucun fichier reçu." });
    }

    const file = req.files.file;

    // ✅ Vérification du type MIME (sécurité basique)
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: "Format de fichier non autorisé." });
    }

    console.log(`📤 Upload du fichier : ${file.name} (${file.mimetype})`);

    // ✅ Upload vers Cloudinary
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "delivery_documents",
      resource_type: "auto",
    });

    console.log("✅ Upload réussi :", result.secure_url);

    // ✅ Réponse API
    res.status(200).json({
      message: "✅ Upload réussi",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("❌ Erreur upload Cloudinary :", error);

    // 🔥 Gestion améliorée des erreurs Render / Cloudinary
    if (error.http_code === 401) {
      return res.status(401).json({ message: "Clés Cloudinary invalides ou manquantes." });
    }
    if (error.message && error.message.includes("ENOTFOUND")) {
      return res.status(503).json({ message: "Connexion Cloudinary impossible." });
    }

    res.status(500).json({ message: "Erreur lors de l'upload du fichier.", error: error.message });
  }
});

module.exports = router;
