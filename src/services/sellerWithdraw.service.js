// services/sellerWithdraw.service.js
const mongoose = require("mongoose");
const Seller = require("../models/Seller");
const PayoutTransaction = require("../models/PayoutTransaction");

const QosPayService = require("./QosPayService");
const CinetPayService = require("./CinetPayService");

class SellerWithdrawService {

  static async withdrawAll({
    sellerId,
    provider,   // "QOSPAY" | "CINETPAY"
    operator,   // "TM" | "TG" (QOSPAY)
    phone       // numéro retrait
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const seller = await Seller.findById(sellerId).session(session);
      if (!seller) throw new Error("SELLER_NOT_FOUND");

      const amount = Number(seller.balance_available || 0);
      if (amount <= 0) {
        throw new Error("NO_AVAILABLE_BALANCE");
      }

      // 🔁 IDEMPOTENCE : retrait déjà en cours
      const existing = await PayoutTransaction.findOne({
        seller: sellerId,
        status: "PENDING"
      }).session(session);

      if (existing) {
        throw new Error("WITHDRAW_ALREADY_IN_PROGRESS");
      }

      // 🧾 Création payout PENDING
      const payout = await PayoutTransaction.create([{
        seller: sellerId,
        sellerId,
        amount,
        currency: "XOF",
        prefix: seller.prefix,
        phone: phone || seller.phone,
        status: "PENDING"
      }], { session });

      await session.commitTransaction();
      session.endSession();

      // ===============================
      // 🚀 APPEL PROVIDER (HORS TX DB)
      // ===============================
      let result;

      if (provider === "QOSPAY") {
        result = await QosPayService.createPayOutForSeller({
          sellerId,
          amount,
          operator
        });
      } else if (provider === "CINETPAY") {
        result = await CinetPayService.createPayOutForSeller({
          sellerId,
          amount
        });
      } else {
        throw new Error("INVALID_PROVIDER");
      }

      if (!result?.success) {
        await PayoutTransaction.findByIdAndUpdate(
          payout[0]._id,
          { status: "FAILED", message: "PROVIDER_FAILED" }
        );
        throw new Error("PAYOUT_FAILED");
      }

      // ===============================
      // 🔐 DÉBIT FINAL (TX DB)
      // ===============================
      const finalSession = await mongoose.startSession();
      finalSession.startTransaction();

      seller.balance_available -= amount;
      await seller.save({ session: finalSession });

      await PayoutTransaction.findByIdAndUpdate(
        payout[0]._id,
        {
          status: "SUCCESS",
          sent_amount: amount,
          message: "WITHDRAW_SUCCESS"
        },
        { session: finalSession }
      );

      await finalSession.commitTransaction();
      finalSession.endSession();

      return {
        success: true,
        amount,
        provider,
        transactionId: payout[0]._id
      };

    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }
}

module.exports = SellerWithdrawService;
