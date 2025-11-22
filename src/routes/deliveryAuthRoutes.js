const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const Delivery = require("../models/Delivery"); // Modèle mongoose pour livreurs
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware"); // middlewares

// =======================
// 🔹 REGISTER DELIVERY
// =======================
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Email invalide"),
    body("password").isLength({ min: 6 }).withMessage("Mot de passe trop court"),
    body("fullName").notEmpty().withMessage("Nom requis"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password, fullName, phone, zone, city, country } = req.body;

    try {
      // Vérifier si le livreur existe déjà
      let existing = await Delivery.findOne({ email });
      if (existing) return res.status(400).json({ msg: "Email déjà utilisé" });

      // Hash du mot de passe
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const delivery = new Delivery({
        email,
        password: hashedPassword,
        fullName,
        phone,
        zone,
        city,
        country,
        role: "delivery",
        status: "pending", // Par défaut
      });

      await delivery.save();

      // Générer un token JWT
      const token = jwt.sign(
        { id: delivery._id, role: "delivery" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({ token, user: delivery });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Erreur serveur" });
    }
  }
);

// =======================
// 🔹 LOGIN DELIVERY
// =======================
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email invalide"),
    body("password").notEmpty().withMessage("Mot de passe requis"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const delivery = await Delivery.findOne({ email }).select("+password");
      if (!delivery) return res.status(400).json({ msg: "Utilisateur non trouvé" });

      const isMatch = await bcrypt.compare(password, delivery.password);
      if (!isMatch) return res.status(400).json({ msg: "Mot de passe incorrect" });

      const token = jwt.sign(
        { id: delivery._id, role: "delivery" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({ token, user: delivery });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Erreur serveur" });
    }
  }
);

// =======================
// 🔹 UPDATE DELIVERY STATUS (ADMIN ONLY)
// =======================
router.put(
  "/update-status/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ msg: "Statut invalide" });
      }

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({ msg: "Livreur non trouvé" });
      }

      delivery.status = status;
      await delivery.save();

      res.json({
        msg: `Statut du livreur mis à jour: ${status}`,
        delivery,
      });
    } catch (err) {
      console.error("❌ UPDATE DELIVERY STATUS error:", err.message);
      res.status(500).json({ msg: "Erreur serveur", error: err.message });
    }
  }
);

module.exports = router;
