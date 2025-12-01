// routes/deliveryAssignmentRoutes.js
const express = require("express");
const router = express.Router();
const DeliveryAssignment = require("../models/DeliveryAssignment");
const User = require("../models/user.model"); // collection unique pour sellers/buyers/delivery

// Si tu as un middleware d'auth, tu peux le décommenter et l'utiliser.
const { verifyToken } = require("../middleware/auth.middleware");

// -----------------------------
// Helper : safe string trim
// -----------------------------
const s = (v) => (typeof v === "string" ? v.trim() : v);

// -----------------------------
// 📌 ASSIGNER UN PRODUIT À UN LIVREUR
// -----------------------------
router.post("/assign", /* verifyToken, */ async (req, res) => {
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

    // Validation minimale
    if (!productId || !sellerId || !deliveryManId || !clientId) {
      return res.status(400).json({
        success: false,
        message: "Certains champs obligatoires sont manquants (productId / sellerId / deliveryManId / clientId)."
      });
    }

    // Empêcher double-soumission pour même produit / même livreur
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

    // Récupère les utilisateurs (seller, client, deliveryMan) dans la collection users
    // On utilise findById et lean() pour performance
    const [seller, client, deliveryMan] = await Promise.all([
      User.findById(sellerId).lean(),
      User.findById(clientId).lean(),
      User.findById(deliveryManId).lean(),
    ]);

    // Si un des utilisateurs n'existe pas, renvoyer une erreur lisible
    if (!seller) {
      return res.status(404).json({ success: false, message: "Vendeur introuvable." });
    }
    if (!client) {
      return res.status(404).json({ success: false, message: "Client introuvable." });
    }
    if (!deliveryMan) {
      return res.status(404).json({ success: false, message: "Livreur introuvable." });
    }

    // Construire l'objet à créer en copiant les infos importantes de chaque user
    // (Permet d'avoir un historique immuable même si l'utilisateur change ses infos plus tard)
    const payload = {
      productId: s(productId),
      productName: s(productName) || (req.body.productName ?? ""),
      productImage: req.body.productImage || null,

      // Seller (copie des champs utiles)
      sellerId: s(sellerId),
      sellerName: s(sellerName) || (seller.shopName ?? seller.fullName ?? ""),
      sellerPhone: seller.phone ?? "",
      sellerCity: seller.city ?? "",
      sellerZone: seller.zone ?? "",
      sellerAddress: seller.address ?? "",

      // Client (copie)
      clientId: s(clientId),
      clientName: s(clientName) || (client.fullName ?? client.email ?? ""),
      clientPhone: clientPhone ? s(clientPhone) : (client.phone ?? ""),
      clientAddress: clientAddress ? s(clientAddress) : (client.address ?? ""),
      clientCity: clientCity ? s(clientCity) : (client.city ?? ""),
      clientZone: clientZone ? s(clientZone) : (client.zone ?? ""),

      // DeliveryMan (copie)
      deliveryManId: s(deliveryManId),
      deliveryManName: s(deliveryManName) || (deliveryMan.fullName ?? deliveryMan.email ?? ""),
      deliveryManPhone: deliveryMan.phone ?? "",
      deliveryManCity: deliveryMan.city ?? "",
      deliveryManZone: deliveryMan.zone ?? "",
      deliveryManCountry: deliveryMan.country ?? "",
      deliveryManAvatar: deliveryMan.avatarUrl ?? deliveryMan.avatar ?? deliveryMan.avatarUrl ?? "",

      // Statut / dates
      status: "pending",
      assignedAt: new Date()
    };

    // Créer l'assignation
    const newAssignment = await DeliveryAssignment.create(payload);

    return res.status(201).json({
      success: true,
      message: `Produit soumis avec succès au livreur ${payload.deliveryManName}.`,
      assignment: newAssignment
    });
  } catch (err) {
    console.error("Error assigning product:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'assignation.",
      error: err.message
    });
  }
});

// -----------------------------
// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN LIVREUR (infos enrichies)
//    - supporte query params page/limit/search optionally if besoin
// -----------------------------
router.get("/by-delivery-man/:id", /* verifyToken, */ async (req, res) => {
  try {
    const deliveryManId = req.params.id;
    const { page = 1, limit = 50, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const baseQuery = { deliveryManId };

    // Optionnel : support recherche par productName, sellerName, clientName
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

    // Enrichissement : joindre (live) les données utilisateurs actuelles si nécessaire
    // Mais on a déjà copié les infos au moment de la création ; ici on renvoie aussi les objets 'seller', 'client', 'deliveryMan' actuels
    const enriched = await Promise.all(assignments.map(async (a) => {
      const [seller, client, deliveryMan] = await Promise.all([
        User.findById(a.sellerId).lean(),
        User.findById(a.clientId).lean(),
        User.findById(a.deliveryManId).lean(),
      ]);

      return {
        ...a,
        seller: seller ? {
          _id: seller._id,
          name: seller.shopName ?? seller.fullName ?? "",
          phone: seller.phone ?? "",
          city: seller.city ?? "",
          zone: seller.zone ?? "",
          address: seller.address ?? "",
          role: seller.role ?? "seller",
        } : null,
        client: client ? {
          _id: client._id,
          name: client.fullName ?? "",
          phone: client.phone ?? "",
          city: client.city ?? "",
          zone: client.zone ?? "",
          address: client.address ?? "",
          role: client.role ?? "buyer",
        } : null,
        deliveryMan: deliveryMan ? {
          _id: deliveryMan._id,
          name: deliveryMan.fullName ?? "",
          phone: deliveryMan.phone ?? "",
          city: deliveryMan.city ?? "",
          zone: deliveryMan.zone ?? "",
          country: deliveryMan.country ?? "",
          avatar: deliveryMan.avatarUrl ?? deliveryMan.avatar ?? "",
          role: deliveryMan.role ?? "delivery",
        } : null
      };
    }));

    return res.json({
      success: true,
      assignments: enriched,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("Error fetching assignments by deliveryMan:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des commandes.",
      error: err.message
    });
  }
});

// -----------------------------
// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN CLIENT (infos enrichies)
// -----------------------------
router.get("/by-client/:clientId", /* verifyToken, */ async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const assignments = await DeliveryAssignment.find({ clientId })
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const enriched = await Promise.all(assignments.map(async (a) => {
      const [seller, client, deliveryMan] = await Promise.all([
        User.findById(a.sellerId).lean(),
        User.findById(a.clientId).lean(),
        User.findById(a.deliveryManId).lean(),
      ]);

      return {
        ...a,
        seller: seller ? {
          _id: seller._id,
          name: seller.shopName ?? seller.fullName ?? "",
          phone: seller.phone ?? "",
          city: seller.city ?? "",
          zone: seller.zone ?? "",
          address: seller.address ?? "",
          role: seller.role ?? "seller",
        } : null,
        client: client ? {
          _id: client._id,
          name: client.fullName ?? "",
          phone: client.phone ?? "",
          city: client.city ?? "",
          zone: client.zone ?? "",
          address: client.address ?? "",
          role: client.role ?? "buyer",
        } : null,
        deliveryMan: deliveryMan ? {
          _id: deliveryMan._id,
          name: deliveryMan.fullName ?? "",
          phone: deliveryMan.phone ?? "",
          city: deliveryMan.city ?? "",
          zone: deliveryMan.zone ?? "",
          country: deliveryMan.country ?? "",
          avatar: deliveryMan.avatarUrl ?? deliveryMan.avatar ?? "",
          role: deliveryMan.role ?? "delivery",
        } : null
      };
    }));

    return res.json({
      success: true,
      assignments: enriched,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("Error fetching assignments by client:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des commandes.",
      error: err.message
    });
  }
});

// -------------------------------------------------------
// 📌 OBTENIR LES PRODUITS ASSIGNÉS À UN VENDEUR (infos enrichies)
//    Route : GET /by-seller/:sellerId
//    Params optionnels : ?page=1&limit=50&search=...
// -------------------------------------------------------
router.get("/by-seller/:sellerId", /* verifyToken, */ async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    const { page = 1, limit = 50, search } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const baseQuery = { sellerId };

    // Recherche optionnelle par nom produit / client / livreur
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
      .limit(parseInt(limit, 10))
      .lean();

    // Enrichir avec les données utilisateurs actuelles (seller/client/delivery) si besoin
    const enriched = await Promise.all(assignments.map(async (a) => {
      const [seller, client, deliveryMan] = await Promise.all([
        User.findById(a.sellerId).lean(),
        User.findById(a.clientId).lean(),
        User.findById(a.deliveryManId).lean(),
      ]);

      return {
        ...a,
        seller: seller ? {
          _id: seller._id,
          name: seller.shopName ?? seller.fullName ?? "",
          phone: seller.phone ?? "",
          city: seller.city ?? "",
          zone: seller.zone ?? "",
          address: seller.address ?? "",
          role: seller.role ?? "seller",
        } : null,
        client: client ? {
          _id: client._id,
          name: client.fullName ?? client.email ?? "",
          phone: client.phone ?? "",
          city: client.city ?? "",
          zone: client.zone ?? "",
          address: client.address ?? "",
          role: client.role ?? "buyer",
        } : null,
        deliveryMan: deliveryMan ? {
          _id: deliveryMan._id,
          name: deliveryMan.fullName ?? "",
          phone: deliveryMan.phone ?? "",
          city: deliveryMan.city ?? "",
          zone: deliveryMan.zone ?? "",
          country: deliveryMan.country ?? "",
          avatar: deliveryMan.avatarUrl ?? deliveryMan.avatar ?? "",
          role: deliveryMan.role ?? "delivery",
        } : null
      };
    }));

    return res.json({
      success: true,
      assignments: enriched,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) {
    console.error("Error fetching assignments by seller:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des commandes (seller).",
      error: err.message
    });
  }
});


// -----------------------------
// 📌 METTRE À JOUR LE STATUT D’UNE ASSIGNATION
// -----------------------------
router.put("/update-status/:id", /* verifyToken, */ async (req, res) => {
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

    // Empêcher transitions illogiques
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
      message: "Erreur serveur lors de la mise à jour du statut.",
      error: err.message
    });
  }
});

module.exports = router;
