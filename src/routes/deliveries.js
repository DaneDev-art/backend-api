const express = require("express");
const router = express.Router();
const Delivery = require("../models/Delivery");
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware");

// =======================
// 🔹 Récupérer tous les livreurs (admin seulement)
// =======================
router.get("/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const deliveries = await Delivery.find();
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =======================
// 🔹 Récupérer les livreurs selon le statut (admin seulement)
// =======================
router.get("/status/:status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const status = req.params.status;
    const deliveries =
      status === "all"
        ? await Delivery.find()
        : await Delivery.find({ status });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =======================
// 🔹 Mettre à jour le statut d’un livreur (admin seulement)
// =======================
router.put("/update-status/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide" });
    }

    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!delivery) {
      return res.status(404).json({ message: "Livreur non trouvé" });
    }

    // 🔹 Optionnel : ici tu peux émettre un événement socket pour notifier le livreur
    // io.to(delivery._id.toString()).emit("statusUpdated", delivery);

    res.json({ message: `Livreur ${status} avec succès`, delivery });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
