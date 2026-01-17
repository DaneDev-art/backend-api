const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Referral = require("../models/Referral");
const ReferralCommission = require("../models/ReferralCommission");

class ReferralCommissionService {

  /* ======================================================
     🔹 ORDER COMPLETED → SELLER COMMISSION
     👉 appelé UNIQUEMENT quand status = COMPLETED
  ====================================================== */
  static async handleOrderCompleted(order) {
    try {
      // ===== VALIDATION =====
      if (!order || !order._id) {
        console.warn("⚠️ ReferralCommission: order invalide");
        return;
      }

      if (order.status !== "COMPLETED") {
        console.warn(
          `⚠️ ReferralCommission: order ${order._id} status=${order.status}`
        );
        return;
      }

      // ===== LOAD SELLER =====
      const seller = await Seller.findById(order.seller).lean();
      if (!seller || !seller.user) {
        console.warn(
          `⚠️ ReferralCommission: seller introuvable pour order ${order._id}`
        );
        return;
      }

      const sellerUserId = seller.user;

      // ===== CHECK REFERRAL =====
      const referral = await Referral.findOne({
        referred: sellerUserId,
        status: "ACTIVE",
      }).lean();

      if (!referral) {
        return; // vendeur non parrainé → normal
      }

      // ===== ANTI-DUPLICATION =====
      const exists = await ReferralCommission.exists({
        referrer: referral.referrer,
        sourceId: order._id,
        sourceType: "ORDER",
      });

      if (exists) {
        console.warn(
          `⚠️ ReferralCommission: déjà créée pour order ${order._id}`
        );
        return;
      }

      // ===== CALCUL COMMISSION =====
      const percentage = 1.5;

      // 🔥 BASE = netAmount (PAS totalAmount)
      const baseAmount = order.netAmount;
      if (!baseAmount || baseAmount <= 0) {
        console.warn(
          `⚠️ ReferralCommission: baseAmount invalide pour order ${order._id}`
        );
        return;
      }

      const commissionAmount = Math.floor(
        (baseAmount * percentage) / 100
      );

      if (commissionAmount <= 0) return;

      // ===== CREATE COMMISSION =====
      await ReferralCommission.create({
        referrer: referral.referrer,
        referred: sellerUserId,
        sourceId: order._id,
        sourceType: "ORDER",
        amount: commissionAmount,
        percentage,
        commissionType: "SELLER_SALE",
        status: "AVAILABLE",
        availableAt: new Date(),
      });

      console.log(
        `✅ ReferralCommission créée | order=${order._id} | amount=${commissionAmount}`
      );
    } catch (err) {
      console.error(
        "❌ ReferralCommission.handleOrderCompleted:",
        err
      );
    }
  }

  /* ======================================================
     🔹 BUYER / USER GAIN COMMISSION (50%)
     👉 appelé lors de la création d'un gain utilisateur
  ====================================================== */
  static async handleUserGain({
    userId,
    gainAmount,
    sourceId,
    sourceType = "USER_GAIN",
  }) {
    try {
      if (!userId || !gainAmount || gainAmount <= 0) return;

      const referral = await Referral.findOne({
        referred: userId,
        status: "ACTIVE",
      }).lean();

      if (!referral) return;

      // ===== ANTI-DUPLICATION =====
      const exists = await ReferralCommission.exists({
        referrer: referral.referrer,
        sourceId,
        sourceType,
      });
      if (exists) return;

      const percentage = 50;
      const commissionAmount = Math.floor(gainAmount * 0.5);
      if (commissionAmount <= 0) return;

      await ReferralCommission.create({
        referrer: referral.referrer,
        referred: userId,
        sourceId,
        sourceType,
        amount: commissionAmount,
        percentage,
        commissionType: "USER_EARNING",
        status: "AVAILABLE",
        availableAt: new Date(),
      });
    } catch (err) {
      console.error(
        "❌ ReferralCommission.handleUserGain:",
        err
      );
    }
  }
}

module.exports = ReferralCommissionService;
