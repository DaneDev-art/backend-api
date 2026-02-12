// ==========================================
// src/controllers/subscription.controller.js
// ==========================================
const Seller = require("../models/Seller");
const CinetPayService = require("../services/CinetPayService");

// ==========================================
// 🔹 Helper ajouter 1 an
// ==========================================
const addOneYear = (date) => {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + 1);
  return d;
};

// ==========================================
// 🔹 CREATE SUBSCRIPTION PAYMENT
// ==========================================
exports.createSubscriptionPayment = async (req, res) => {
  try {
    const seller = await Seller.findOne({ user: req.user._id });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Vendeur introuvable",
      });
    }

    const now = new Date();

    // 🔒 Si encore dans la période gratuite
    if (
      seller.subscription?.endAt &&
      now < seller.subscription.endAt
    ) {
      return res.status(400).json({
        success: false,
        message: "Votre période gratuite n'est pas encore expirée.",
      });
    }

    const amount = 10000; // 10 000 FCFA
    const transactionId = `SUB_${seller._id}_${Date.now()}`;

    const paymentData = await CinetPayService.createPayment({
      transactionId,
      amount,
      currency: "XOF",
      description: "Abonnement annuel vendeur",
      customerName: seller.name,
      customerEmail: seller.email,
      customerPhone: seller.fullNumber,
    });

    return res.status(200).json({
      success: true,
      paymentUrl: paymentData.payment_url,
      transactionId,
      amount,
      currency: "XOF",
    });
  } catch (error) {
    console.error("❌ createSubscriptionPayment:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur création paiement abonnement",
      error: error.message,
    });
  }
};

// ==========================================
// 🔹 GET SUBSCRIPTION STATUS (POUR FLUTTER)
// ==========================================
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const seller = await Seller.findOne({ user: req.user._id });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Vendeur introuvable",
      });
    }

    const now = new Date();

    let status = "FREE";
    let remainingDays = null;
    let endAt = seller.subscription?.endAt || null;

    if (!seller.subscription?.firstSaleAt) {
      status = "NO_SALES_YET";
    } else if (seller.subscription.status === "ACTIVE") {
      status = "ACTIVE";
    } else if (
      seller.subscription.endAt &&
      now > seller.subscription.endAt
    ) {
      status = "EXPIRED";
    } else {
      status = "FREE";
    }

    if (seller.subscription?.endAt) {
      const diffMs =
        new Date(seller.subscription.endAt) - now;
      remainingDays = Math.max(
        0,
        Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        status, // FREE | ACTIVE | EXPIRED | NO_SALES_YET
        startAt: seller.subscription?.startAt || null,
        endAt,
        remainingDays,
        firstSaleAt:
          seller.subscription?.firstSaleAt || null,
        lastPaymentAt:
          seller.subscription?.lastPaymentAt || null,
      },
    });
  } catch (error) {
    console.error("❌ getSubscriptionStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur récupération abonnement",
      error: error.message,
    });
  }
};
