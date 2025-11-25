const express = require("express");
const router = express.Router();
const DeliveryAssignment = require("../models/DeliveryAssignment");

// 📌 ASSIGNER UN PRODUIT À UN LIVREUR
router.post("/assign", async (req, res) => {
  try {
    const {
      productId,
      productName,
      productImage,
      sellerId,
      deliveryManId,
      deliveryManName,
    } = req.body;

    if (!productId || !sellerId || !deliveryManId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const newAssignment = await DeliveryAssignment.create({
      productId,
      productName,
      productImage,
      sellerId,
      deliveryManId,
      deliveryManName,
    });

    return res.status(201).json({
      message: `Produit soumis avec succès au livreur ${deliveryManName}`,
      assignment: newAssignment,
    });
  } catch (err) {
    console.error("Error assigning product:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN LIVREUR
router.get("/by-delivery-man/:id", async (req, res) => {
  try {
    const assignments = await DeliveryAssignment.find({
      deliveryManId: req.params.id,
    }).sort({ assignedAt: -1 });

    return res.json(assignments);
  } catch (err) {
    console.error("Error fetching assignments:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
