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

    if (!productId || !sellerId || !deliveryManId || !clientId) {
      return res.status(400).json({
        success: false,
        message: "Certains champs obligatoires sont manquants."
      });
    }

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
      assignedAt: new Date(),
      status: "pending"
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

//
// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN CLIENT
//
router.get("/by-client/:clientId", async (req, res) => {
  try {
    const clientId = req.params.clientId;

    const assignments = await DeliveryAssignment.find({ clientId })
      .sort({ assignedAt: -1 });

    return res.json({
      success: true,
      assignments
    });

  } catch (err) {
    console.error("Error fetching assignments by client:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des commandes."
    });
  }
});


//
// 📌 METTRE À JOUR LE STATUT D’UNE ASSIGNATION
//
router.put("/update-status/:id", async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "accepted",
      "in_delivery",
      "client_received",
      "delivery_completed"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Statut invalide."
      });
    }

    // On récupère l'assignation
    const assignment = await DeliveryAssignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignation introuvable."
      });
    }

    //
    // 🚨 LOGIQUE : Empêcher les transitions illogiques
    //

    // 1️⃣ Le livreur NE PEUT PAS mettre "delivery_completed"
    // si le client n’a pas confirmé
    if (status === "delivery_completed" && assignment.status !== "client_received") {
      return res.status(400).json({
        success: false,
        message: "Impossible : le client doit d'abord confirmer la réception."
      });
    }

    // 2️⃣ Une fois livré => bloquer toute modification
    if (assignment.status === "delivery_completed") {
      return res.status(400).json({
        success: false,
        message: "Cette commande est déjà livrée."
      });
    }

    // Mise à jour du statut
    assignment.status = status;
    await assignment.save();

    return res.json({
      success: true,
      message: "Statut mis à jour.",
      assignment
    });

  } catch (err) {
    console.error("Error updating status:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la mise à jour du statut."
    });
  }
});

module.exports = router;
