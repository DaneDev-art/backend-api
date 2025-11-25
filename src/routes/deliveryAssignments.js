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
      sellerName,
      deliveryManId,
      deliveryManName,
      clientId,          // 👈 Nouveau : utilisateur qui soumet le produit
      clientName,        // 👈 nouveau
      clientPhone,       // 👈 nouveau
      clientAddress      // 👈 nouveau
    } = req.body;

    if (!productId || !sellerId || !deliveryManId || !clientId) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    // 🔍 Empêcher les doublons : le même produit ne doit pas être réassigné
    const alreadyAssigned = await DeliveryAssignment.findOne({
      productId,
      deliveryManId
    });

    if (alreadyAssigned) {
      return res.status(200).json({
        success: true,
        message: "Ce produit a déjà été soumis à ce livreur.",
        assignment: alreadyAssigned
      });
    }

    // 📦 Création en base
    const newAssignment = await DeliveryAssignment.create({
      productId,
      productName,
      productImage,
      sellerId,
      sellerName,
      deliveryManId,
      deliveryManName,

      // 🔥 Ajout des données client
      clientId,
      clientName,
      clientPhone,
      clientAddress,

      assignedAt: new Date()
    });

    return res.status(201).json({
      success: true,
      message: `Produit soumis avec succès au livreur ${deliveryManName}.`,
      assignment: newAssignment
    });

  } catch (err) {
    console.error("Error assigning product:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN LIVREUR
router.get("/by-delivery-man/:id", async (req, res) => {
  try {
    const assignments = await DeliveryAssignment.find({
      deliveryManId: req.params.id
    })
    .sort({ assignedAt: -1 });

    return res.json({ success: true, assignments });

  } catch (err) {
    console.error("Error fetching assignments:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
