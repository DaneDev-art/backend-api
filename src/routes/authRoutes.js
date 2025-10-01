const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/user.model"); // vérifie le nom exact

const router = express.Router();

// Fonction pour générer le token JWT
const signToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "secretkey",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// -------------------
// REGISTER
// -------------------
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Email invalide"),
    body("password").isLength({ min: 6 }).withMessage("Mot de passe min 6 caractères"),
    body("role").isIn(["buyer", "seller", "delivery"]).withMessage("Role invalide"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { role, email, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: "Cet email est déjà utilisé" });

      let userData = { email, password, role };

      // Champs spécifiques selon le rôle
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
        message: "Utilisateur créé avec succès",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.fullName || user.ownerName || "",
          role: user.role,
        },
      });
    } catch (error) {
      console.error("❌ Erreur register:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

// -------------------
// LOGIN
// -------------------
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email invalide"),
    body("password").exists().withMessage("Mot de passe requis"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ message: "Email ou mot de passe incorrect" });

      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ message: "Email ou mot de passe incorrect" });

      const token = signToken(user);
      res.json({
        message: "Connexion réussie",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.fullName || user.ownerName || "",
          role: user.role,
        },
      });
    } catch (error) {
      console.error("❌ Erreur login:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

module.exports = router;
