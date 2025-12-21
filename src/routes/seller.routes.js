const express = require("express");
const router = express.Router();
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");
const jwt = require("jsonwebtoken");

// -------------------------
// 🔐 Middleware d'authentification
// -------------------------
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token manquant ou invalide",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { id, email, role }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Token invalide",
    });
  }
};

// ======================================================
// 👤 VENDEUR CONNECTÉ — INFOS GÉNÉRALES
// GET /api/sellers/me
// ======================================================
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const sellerId = req.user.id;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        error: "Vendeur introuvable",
      });
    }

    return res.json({
      success: true,
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        role: seller.role,
        balanceAvailable: seller.balance_available || 0,
        balanceLocked: seller.balance_locked || 0,
      },
    });
  } catch (err) {
    console.error("❌ GET /api/sellers/me:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération vendeur",
    });
  }
});

// ======================================================
// 💰 FONDS DU VENDEUR (POUR FUNDS PAGE)
// GET /api/sellers/me/funds
// ======================================================
router.get("/me/funds", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({
        success: false,
        error: "Accès réservé aux vendeurs",
      });
    }

    const sellerId = req.user.id;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        error: "Vendeur introuvable",
      });
    }

    // 🔹 Transactions PayIn du vendeur uniquement
    const transactions = await PayinTransaction.find({
      sellerId,
      status: { $in: ["SUCCESS", "PENDING"] },
    }).sort({ createdAt: -1 });

    const fundsHistory = transactions.map(tx => ({
      transactionId: tx.transaction_id,
      grossAmount: tx.amount,
      netAmount: tx.netAmount,
      fees: tx.fees,
      currency: tx.currency || "XOF",
      status: tx.status, // SUCCESS / PENDING
      date: tx.createdAt,
    }));

    return res.json({
      success: true,
      balance: {
        available: seller.balance_available || 0,
        locked: seller.balance_locked || 0,
        currency: "XOF",
      },
      history: fundsHistory,
    });
  } catch (err) {
    console.error("❌ GET /api/sellers/me/funds:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération fonds vendeur",
    });
  }
});

// ======================================================
// 🔍 VENDEUR PAR ID (ADMIN / USAGE INTERNE)
// GET /api/sellers/:id
// ======================================================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        error: "Vendeur introuvable",
      });
    }

    // 🔒 Sécurité : seul le vendeur concerné ou un admin
    if (req.user.role !== "admin" && req.user.id !== seller._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Accès non autorisé",
      });
    }

    const transactions = await PayinTransaction.find({
      sellerId: seller._id,
    }).sort({ createdAt: -1 });

    const fundsHistory = transactions.map(tx => ({
      transactionId: tx.transaction_id,
      netAmount: tx.netAmount,
      currency: tx.currency || "XOF",
      status: tx.status,
      date: tx.createdAt,
    }));

    res.json({
      success: true,
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        role: seller.role,
        balanceAvailable: seller.balance_available || 0,
        balanceLocked: seller.balance_locked || 0,
        fundsHistory,
      },
    });
  } catch (err) {
    console.error("❌ GET /api/sellers/:id:", err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération vendeur",
    });
  }
});

module.exports = router;
