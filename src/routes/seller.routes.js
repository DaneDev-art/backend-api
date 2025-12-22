const express = require("express");
const router = express.Router();
const Seller = require("../models/Seller");
const PayinTransaction = require("../models/PayinTransaction");
const jwt = require("jsonwebtoken");

// ======================================================
// 🔐 Middleware d'authentification
// ======================================================
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
    if (req.user.role !== "seller") {
      return res.status(403).json({
        success: false,
        error: "Accès réservé aux vendeurs",
      });
    }

    const seller = await Seller.findById(req.user.id);
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
        balance_available: seller.balance_available || 0,
        balance_locked: seller.balance_locked || 0,
        currency: "XOF",
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
// 💰 FONDS DU VENDEUR (FUNDS PAGE)
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

    // 🔹 Transactions PayIn STRICTEMENT du vendeur connecté
    const transactions = await PayinTransaction.find({
      sellerId: seller._id,
      status: { $in: ["SUCCESS", "PENDING"] },
    }).sort({ createdAt: -1 });

    const history = transactions.map(tx => ({
      orderId: tx._id,
      transactionId: tx.transaction_id,
      type: tx.status === "SUCCESS" ? "LOCKED" : "PENDING",
      amount: tx.netAmount,
      grossAmount: tx.amount,
      fees: tx.fees,
      currency: tx.currency || "XOF",
      status: tx.status,
      date: tx.createdAt,
    }));

    return res.json({
      success: true,
      balance: {
        available: seller.balance_available || 0,
        locked: seller.balance_locked || 0,
        currency: "XOF",
      },
      history,
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
// 🔍 VENDEUR PAR ID (ADMIN UNIQUEMENT)
// GET /api/sellers/:id
// ======================================================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Accès administrateur requis",
      });
    }

    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        error: "Vendeur introuvable",
      });
    }

    const transactions = await PayinTransaction.find({
      sellerId: seller._id,
    }).sort({ createdAt: -1 });

    const fundsHistory = transactions.map(tx => ({
      transactionId: tx.transaction_id,
      netAmount: tx.netAmount,
      grossAmount: tx.amount,
      fees: tx.fees,
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
        balance_available: seller.balance_available || 0,
        balance_locked: seller.balance_locked || 0,
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
