const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/user.model"); // attention au nom exact du fichier

const router = express.Router();

// 📌 Inscription utilisateur
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Email invalide"),
    body("password").isLength({ min: 6 }).withMessage("Mot de passe min 6 caractères"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password, name } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }

      // Création utilisateur (hash automatique via pre("save"))
      const user = new User({ email, password, name });
      await user.save();

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      res.status(201).json({
        message: "Utilisateur créé avec succès",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("❌ Erreur register:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

// 📌 Connexion utilisateur
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
      if (!user) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      res.json({
        message: "Connexion réussie",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
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
