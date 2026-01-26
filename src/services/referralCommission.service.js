const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Referral = require("../models/Referral");
const ReferralCommission = require("../models/ReferralCommission");

class ReferralCommissionService {

  /* ======================================================
     🔹 ORDER COMPLETED → COMMISSIONS SELLER (N1 + N2)
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

      // =====================================================
      // 🔹 BASE AMOUNT (NET AMOUNT SAFE)
      // =====================================================
      let baseAmount = Number(order.netAmount || 0);

      if ((!baseAmount || baseAmount <= 0) && order.payinTransaction) {
        baseAmount = Number(order.payinTransaction.netAmount || 0);
      }

      if (!baseAmount || baseAmount <= 0) {
        console.warn(
          `⚠️ ReferralCommission: baseAmount invalide pour order ${order._id}`
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

      // =====================================================
      // 🔹 REFERRAL NIVEAU 1
      // =====================================================
      const referralLevel1 = await Referral.findOne({
        referred: sellerUserId,
        status: "ACTIVE",
      }).lean();

      if (!referralLevel1) return; // vendeur non parrainé

      // =====================================================
      // 🔹 COMMISSION NIVEAU 1 (1%)
      // =====================================================
      const existsLevel1 = await ReferralCommission.exists({
        referrer: referralLevel1.referrer,
        sourceId: order._id,
        sourceType: "ORDER",
        commissionType: "SELLER_SALE",
      });

      const percentageLevel1 = 1; // ✅ NOUVEAU TAUX : 1%
      const commissionLevel1 = Math.floor(
        (baseAmount * percentageLevel1) / 100
      );

      if (!existsLevel1 && commissionLevel1 > 0) {
        await ReferralCommission.create({
          referrer: referralLevel1.referrer,
          referred: sellerUserId,
          sourceId: order._id,
          sourceType: "ORDER",
          amount: commissionLevel1,
          percentage: percentageLevel1,
          commissionType: "SELLER_SALE",
          status: "AVAILABLE",
          availableAt: new Date(),
        });

        console.log(
          `✅ ReferralCommission N1 créée | order=${order._id} | amount=${commissionLevel1}`
        );
      }

      // =====================================================
      // 🔹 REFERRAL NIVEAU 2 (50% du N1 → 0,5%)
      // =====================================================
      const referralLevel2 = await Referral.findOne({
        referred: referralLevel1.referrer,
        status: "ACTIVE",
      }).lean();

      if (!referralLevel2) return;

      const existsLevel2 = await ReferralCommission.exists({
        referrer: referralLevel2.referrer,
        sourceId: order._id,
        sourceType: "ORDER",
        commissionType: "SELLER_SALE_LEVEL2",
      });

      const percentageLevel2 = 0.5; // 50% de 1%
      const commissionLevel2 = Math.floor(
        (baseAmount * percentageLevel2) / 100
      );

      if (!existsLevel2 && commissionLevel2 > 0) {
        await ReferralCommission.create({
          referrer: referralLevel2.referrer,
          referred: referralLevel1.referrer,
          sourceId: order._id,
          sourceType: "ORDER",
          amount: commissionLevel2,
          percentage: percentageLevel2,
          commissionType: "SELLER_SALE_LEVEL2",
          status: "AVAILABLE",
          availableAt: new Date(),
        });

        console.log(
          `✅ ReferralCommission N2 créée | order=${order._id} | amount=${commissionLevel2}`
        );
      }

    } catch (err) {
      console.error("❌ ReferralCommission.handleOrderCompleted:", err);
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
      console.error("❌ ReferralCommission.handleUserGain:", err);
    }
  }
}

module.exports = ReferralCommissionService;
