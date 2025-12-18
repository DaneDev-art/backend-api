const express = require("express");
const router = express.Router();
const User = require("../models/user.model"); // Assure-toi que le chemin est correct
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware");

// =======================
// 🔹 GET USERS BY ROLE (ADMIN ONLY, PAGINATED & SEARCHABLE)
// =======================
router.get("/role/:role", verifyToken, verifyAdmin, async (req, res) => {
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
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      users: users.map(u => ({
        ...u,
        photoURL: u.photoURL || u.avatarUrl || u.profileImageUrl || ""
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
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
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      livreurs: livreurs.map(u => ({
        ...u,
        photoURL: u.photoURL || u.avatarUrl || u.profileImageUrl || ""
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error("❌ GET /users/delivery/approved error:", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// =======================
// 🔹 GET USERS BY ROLE PUBLIC (PAGINATED & SEARCHABLE)
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
      .lean();

    if (!users.length) return res.status(404).json({ message: "Aucun utilisateur trouvé" });

    const total = await User.countDocuments(query);

    res.json({
      users: users.map(u => ({
        ...u,
        photoURL: u.photoURL || u.avatarUrl || u.profileImageUrl || ""
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
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

    res.json({
      message: `Utilisateur ${status} avec succès`,
      user: { ...user.toObject(), photoURL: user.photoURL || user.avatarUrl || user.profileImageUrl || "" },
    });
  } catch (err) {
    console.error("❌ PUT /users/update-status/:id error:", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// =======================
// 🔹 UPDATE PROFILE PHOTO (USER ONLY, via URL)
// =======================
router.put("/me/photo", verifyToken, async (req, res) => {
  try {
    const { photoURL } = req.body;
    if (!photoURL) return res.status(400).json({ message: "photoURL requis" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    user.photoURL = photoURL;
    user.avatarUrl = photoURL;
    user.profileImageUrl = photoURL;
    await user.save();

    res.json({
      message: "Photo de profil mise à jour avec succès",
      user: { ...user.toObject(), photoURL: user.photoURL },
    });
  } catch (err) {
    console.error("❌ PUT /users/me/photo error:", err.message);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// =======================
// 🔹 GET CURRENT USER PROFILE (USER ONLY)
// =======================
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    res.json({
      user: {
        ...user,
        photoURL: user.photoURL || user.avatarUrl || user.profileImageUrl || "",
      },
    });
  } catch (err) {
    console.error("❌ GET /users/me error:", err.message);
    res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

// =======================
// 🔹 UPDATE CURRENT USER PROFILE (USER ONLY)
// =======================
router.put("/me", verifyToken, async (req, res) => {
  try {
    const { displayName, phone, address, city } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // Mise à jour contrôlée
    if (displayName !== undefined) user.fullName = displayName;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;

    user.updatedAt = Date.now();
    await user.save();

    res.json({
      message: "Profil mis à jour avec succès",
      user: {
        ...user.toObject(),
        photoURL: user.photoURL || user.avatarUrl || user.profileImageUrl || "",
      },
    });
  } catch (err) {
    console.error("❌ PUT /users/me error:", err.message);
    res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
    });
  }
});

module.exports = router;
