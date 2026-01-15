const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Seller = require("../models/Seller");
const User = require("../models/user.model");
const Referral = require("../models/Referral");
const ReferralCommission = require("../models/ReferralCommission");

class ReferralCommissionService {

  /* ======================================================
     🔹 ORDER COMPLETED → SELLER COMMISSION
  ====================================================== */
  static async handleOrderCompleted(orderId) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) return;

    const order = await Order.findById(orderId)
      .populate("seller")
      .lean();

    if (!order || order.status !== "COMPLETED") return;

    // 🔹 Seller → User
    const sellerUserId = order.seller?.user;
    if (!sellerUserId) return;

    // 🔹 Le seller est-il parrainé ?
    const referral = await Referral.findOne({
      referred: sellerUserId,
      status: "ACTIVE",
    }).lean();

    if (!referral) return;

    // 🔒 Anti-duplication
    const exists = await ReferralCommission.exists({
      referrer: referral.referrer,
      sourceId: order._id,
      sourceType: "ORDER",
    });
    if (exists) return;

    const percentage = 1.5;
    const baseAmount = order.totalAmount;
    const commissionAmount = Math.floor(
      baseAmount * percentage / 100
    );

    if (commissionAmount <= 0) return;

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
  }

  /* ======================================================
     🔹 BUYER / DELIVERY GAIN COMMISSION (50%)
     👉 appelé lors de la création du gain
  ====================================================== */
  static async handleUserGain({
    userId,
    gainAmount,
    sourceId,
    sourceType = "USER_GAIN",
  }) {
    if (!gainAmount || gainAmount <= 0) return;

    const referral = await Referral.findOne({
      referred: userId,
      status: "ACTIVE",
    }).lean();

    if (!referral) return;

    // 🔒 Anti-doublon
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
  }
}

module.exports = ReferralCommissionService;
