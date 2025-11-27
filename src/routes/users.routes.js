const express = require("express");
const router = express.Router();
const User = require("../models/user.model"); // Assure-toi que le chemin est correct
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware");

// =======================
// 🔹 GET USERS BY ROLE (ADMIN ONLY)
// =======================
router.get("/role/:role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role } = req.params;
    const { status, search, page = 1, limit = 10, sort = "-createdAt" } = req.query;

    const query = { role };
    if (status && status !== "all") query.status = status;

    // Recherche texte sur fullName et email
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    if (sort.startsWith("-")) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const users = await User.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // <-- enlevant select() pour récupérer tous les champs

    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("❌ GET /users/role/:role error:", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// =======================
// 🔹 GET APPROVED DELIVERY MEN (PUBLIC, PAGINATED & SEARCHABLE)
// =======================
router.get("/delivery/approved", async (req, res) => {
  try {
    const { search, page = 1, limit = 10, sort = "-createdAt" } = req.query;

    const query = {
      role: "delivery",
      status: "approved",
    };

    // Recherche optionnelle sur plusieurs champs
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { zone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    if (sort.startsWith("-")) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const livreurs = await User.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // <-- récupère tous les champs pour le front

    const total = await User.countDocuments(query);

    res.json({
      livreurs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("❌ GET /users/delivery/approved error:", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// =======================
// 🔹 GET USERS BY ROLE PUBLIC
// =======================
router.get("/role/:role/public", async (req, res) => {
  try {
    const { role } = req.params;
    const { status, search, page = 1, limit = 10, sort = "-createdAt" } = req.query;

    const query = { role };
    if (status && status !== "all") query.status = status;

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    if (sort.startsWith("-")) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const users = await User.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // <-- récupère tous les champs

    if (!users.length) return res.status(404).json({ message: "Aucun utilisateur trouvé" });

    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("❌ GET /users/role/:role/public error:", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// =======================
// 🔹 UPDATE USER STATUS (ADMIN ONLY)
// =======================
router.put("/update-status/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json({ message: `Utilisateur ${status} avec succès`, user });
  } catch (err) {
    console.error("❌ PUT /users/update-status/:id error:", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
