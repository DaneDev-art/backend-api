const express = require("express");
const router = express.Router();
const DeliveryAssignment = require("../models/DeliveryAssignment");

//
// 📌 ASSIGNER UN PRODUIT À UN LIVREUR
//
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
      clientId,
      clientName,
      clientPhone,
      clientAddress
    } = req.body;

    // 🔍 Vérification des champs obligatoires
    if (!productId || !sellerId || !deliveryManId || !clientId) {
      return res.status(400).json({
        success: false,
        message: "Certains champs obligatoires sont manquants."
      });
    }

    // 🔍 Empêcher la double assignation du même produit au même livreur
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

    // 📦 Création d'une nouvelle assignation
    const newAssignment = await DeliveryAssignment.create({
      productId,
      productName: productName?.trim(),
      productImage,
      sellerId,
      sellerName: sellerName?.trim(),
      deliveryManId,
      deliveryManName: deliveryManName?.trim(),

      clientId,
      clientName: clientName?.trim(),
      clientPhone: clientPhone?.trim(),
      clientAddress: clientAddress?.trim(),

      assignedAt: new Date()
    });

    return res.status(201).json({
      success: true,
      message: `Produit soumis avec succès au livreur ${deliveryManName}.`,
      assignment: newAssignment
    });

  } catch (err) {
    console.error("Error assigning product:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'assignation."
    });
  }
});

//
// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN LIVREUR
//
router.get("/by-delivery-man/:id", async (req, res) => {
  try {
    const deliveryManId = req.params.id;

    const assignments = await DeliveryAssignment.find({ deliveryManId })
      .sort({ assignedAt: -1 });

    return res.json({
      success: true,
      assignments
    });

  } catch (err) {
    console.error("Error fetching assignments:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des commandes."
    });
  }
});

module.exports = router;
