// ================================
// routes/deliveryAssignments.js
// ================================
const express = require("express");
const router = express.Router();

const DeliveryAssignment = require("../models/DeliveryAssignment");
const User = require("../models/user.model");

// Auth (si nécessaire)
const { verifyToken } = require("../middleware/auth.middleware");

// Trim helper
const s = (v) => (typeof v === "string" ? v.trim() : v);

// =====================================================
// 📌 1) ASSIGNER UN PRODUIT À UN LIVREUR
// =====================================================
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

    // --- Vérification minimale ---
    if (!productId || !sellerId || !deliveryManId || !clientId) {
      return res.status(400).json({
        success: false,
        message:
          "Champs obligatoires manquants (productId, sellerId, deliveryManId, clientId).",
      });
    }

    // --- Empêcher la double-submission ---
    const alreadyAssigned = await DeliveryAssignment.findOne({
      productId,
      deliveryManId,
    });

    if (alreadyAssigned) {
      return res.status(200).json({
        success: true,
        message: "Ce produit est déjà assigné à ce livreur.",
        assignment: alreadyAssigned,
      });
    }

    // --- Chercher les 3 utilisateurs ---
    const [seller, client, deliveryMan] = await Promise.all([
      User.findById(sellerId).lean(),
      User.findById(clientId).lean(),
      User.findById(deliveryManId).lean(),
    ]);

    if (!seller)
      return res.status(404).json({ success: false, message: "Vendeur introuvable." });
    if (!client)
      return res.status(404).json({ success: false, message: "Client introuvable." });
    if (!deliveryMan)
      return res.status(404).json({ success: false, message: "Livreur introuvable." });

    // --- Construction de l'assignation (copie des infos importantes)
    const payload = {
      productId: s(productId),
      productName: s(productName),
      productImage: productImage || null,

      // Seller (copie)
      sellerId: s(sellerId),
      sellerName: s(sellerName) || seller.shopName || seller.fullName || "",
      sellerPhone: seller.phone || "",
      sellerCity: seller.city || "",
      sellerZone: seller.zone || "",
      sellerAddress: seller.address || "",

      // Client
      clientId: s(clientId),
      clientName: s(clientName) || client.fullName || client.email || "",
      clientPhone: s(clientPhone) || client.phone || "",
      clientAddress: s(clientAddress) || client.address || "",
      clientCity: s(clientCity) || client.city || "",
      clientZone: s(clientZone) || client.zone || "",

      // Delivery man
      deliveryManId: s(deliveryManId),
      deliveryManName:
        s(deliveryManName) || deliveryMan.fullName || deliveryMan.email || "",
      deliveryManPhone: deliveryMan.phone || "",
      deliveryManCity: deliveryMan.city || "",
      deliveryManZone: deliveryMan.zone || "",
      deliveryManCountry: deliveryMan.country || "",
      deliveryManAvatar:
        deliveryMan.avatarUrl || deliveryMan.avatar || "",

      // Status
      status: "pending",
      assignedAt: new Date(),
    };

    const newAssignment = await DeliveryAssignment.create(payload);

    return res.status(201).json({
      success: true,
      message: `Produit soumis avec succès au livreur ${payload.deliveryManName}.`,
      assignment: newAssignment,
    });
  } catch (err) {
    console.error("Error assigning product:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'assignation.",
      error: err.message,
    });
  }
});

// =====================================================
// 📌 2) OBTENIR ASSIGNATIONS PAR LIVREUR
// =====================================================
router.get("/by-delivery-man/:id", async (req, res) => {
  try {
    const deliveryManId = req.params.id;
    const { page = 1, limit = 50, search } = req.query;
    const skip = (page - 1) * limit;

    const baseQuery = { deliveryManId };

    if (search) {
      baseQuery.$or = [
        { productName: { $regex: search, $options: "i" } },
        { sellerName: { $regex: search, $options: "i" } },
        { clientName: { $regex: search, $options: "i" } },
      ];
    }

    const assignments = await DeliveryAssignment.find(baseQuery)
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return res.json({
      success: true,
      assignments,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("Error fetching assignments by deliveryMan:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération.",
      error: err.message,
    });
  }
});

// =====================================================
// 📌 3) OBTENIR ASSIGNATIONS PAR CLIENT
// =====================================================
router.get("/by-client/:clientId", async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const assignments = await DeliveryAssignment.find({ clientId })
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return res.json({
      success: true,
      assignments,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("Error fetching assignments by client:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération.",
      error: err.message,
    });
  }
});

// =====================================================
// 📌 4) OBTENIR ASSIGNATIONS PAR VENDEUR
// =====================================================
router.get("/by-seller/:sellerId", async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    const { page = 1, limit = 50, search } = req.query;
    const skip = (page - 1) * limit;

    const baseQuery = { sellerId };

    if (search) {
      baseQuery.$or = [
        { productName: { $regex: search, $options: "i" } },
        { clientName: { $regex: search, $options: "i" } },
        { deliveryManName: { $regex: search, $options: "i" } },
      ];
    }

    const assignments = await DeliveryAssignment.find(baseQuery)
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return res.json({
      success: true,
      assignments,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("Error fetching assignments by seller:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération.",
      error: err.message,
    });
  }
});

// =====================================================
// 📌 5) METTRE À JOUR LE STATUT
// =====================================================
router.put("/update-status/:id", async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "accepted",
      "in_delivery",
      "client_received",
      "delivery_completed",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Statut invalide.",
      });
    }

    const assignment = await DeliveryAssignment.findById(assignmentId);

    if (!assignment)
      return res.status(404).json({
        success: false,
        message: "Assignation introuvable.",
      });

    // Vérifications logiques
    if (
      status === "delivery_completed" &&
      assignment.status !== "client_received"
    ) {
      return res.status(400).json({
        success: false,
        message: "Le client doit d'abord confirmer.",
      });
    }

    assignment.status = status;
    await assignment.save();

    return res.json({
      success: true,
      message: "Statut mis à jour.",
      assignment,
    });
  } catch (err) {
    console.error("Error updating status:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la mise à jour.",
      error: err.message,
    });
  }
});

// =====================================================
// 📌 6) OBTENIR UNE ASSIGNATION PAR ID
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const assignment = await DeliveryAssignment.findById(id).lean();

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignation introuvable.",
      });
    }

    return res.json({
      success: true,
      assignment,
    });
  } catch (err) {
    console.error("Error fetching single assignment:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération.",
      error: err.message,
    });
  }
});


module.exports = router;
