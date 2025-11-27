const express = require("express");
const router = express.Router();
const DeliveryAssignment = require("../models/DeliveryAssignment");
const User = require("../models/user.model"); // <-- modèle User

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
      clientAddress,
      clientCity,
      clientZone
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
      clientCity: clientCity?.trim() || "",
      clientZone: clientZone?.trim() || "",
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
// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN LIVREUR (avec infos complètes)
//
router.get("/by-delivery-man/:id", async (req, res) => {
  try {
    const deliveryManId = req.params.id;

    const assignments = await DeliveryAssignment.find({ deliveryManId })
      .sort({ assignedAt: -1 })
      .lean();

    const enrichedAssignments = await Promise.all(assignments.map(async (a) => {
      const seller = await User.findById(a.sellerId).lean();
      const client = await User.findById(a.clientId).lean();
      const deliveryMan = await User.findById(a.deliveryManId).lean();

      return {
        ...a,
        seller: seller ? {
          name: seller.fullName,
          phone: seller.phone,
          city: seller.city,
          zone: seller.zone,
          address: seller.address,
        } : {},
        client: client ? {
          name: client.fullName,
          phone: client.phone,
          city: client.city,
          zone: client.zone,
          address: client.address,
        } : {},
        deliveryMan: deliveryMan ? {
          name: deliveryMan.fullName,
          phone: deliveryMan.phone,
          city: deliveryMan.city,
          zone: deliveryMan.zone,
        } : {}
      };
    }));

    return res.json({
      success: true,
      assignments: enrichedAssignments
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
// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN CLIENT (avec infos complètes)
//
router.get("/by-client/:clientId", async (req, res) => {
  try {
    const clientId = req.params.clientId;

    const assignments = await DeliveryAssignment.find({ clientId })
      .sort({ assignedAt: -1 })
      .lean();

    const enrichedAssignments = await Promise.all(assignments.map(async (a) => {
      const seller = await User.findById(a.sellerId).lean();
      const client = await User.findById(a.clientId).lean();
      const deliveryMan = await User.findById(a.deliveryManId).lean();

      return {
        ...a,
        seller: seller ? {
          name: seller.fullName,
          phone: seller.phone,
          city: seller.city,
          zone: seller.zone,
          address: seller.address,
        } : {},
        client: client ? {
          name: client.fullName,
          phone: client.phone,
          city: client.city,
          zone: client.zone,
          address: client.address,
        } : {},
        deliveryMan: deliveryMan ? {
          name: deliveryMan.fullName,
          phone: deliveryMan.phone,
          city: deliveryMan.city,
          zone: deliveryMan.zone,
        } : {}
      };
    }));

    return res.json({
      success: true,
      assignments: enrichedAssignments
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

    const assignment = await DeliveryAssignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignation introuvable."
      });
    }

    // 🚨 Empêcher les transitions illogiques
    if (status === "delivery_completed" && assignment.status !== "client_received") {
      return res.status(400).json({
        success: false,
        message: "Impossible : le client doit d'abord confirmer la réception."
      });
    }

    if (assignment.status === "delivery_completed") {
      return res.status(400).json({
        success: false,
        message: "Cette commande est déjà livrée."
      });
    }

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
