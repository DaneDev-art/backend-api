const User = require("../models/User");
const Referral = require("../models/Referral");

class ReferralService {
  /**
   * Appliquer un code de parrainage à un utilisateur
   */
  static async applyReferralCode({ userId, referralCode }) {
    if (!referralCode) return null;

    const user = await User.findById(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    // 🔒 Déjà parrainé
    if (user.referredBy) {
      throw new Error("Utilisateur déjà parrainé");
    }

    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      throw new Error("Code de parrainage invalide");
    }

    // 🔒 Auto-parrainage
    if (referrer._id.equals(user._id)) {
      throw new Error("Auto-parrainage interdit");
    }

    // 🔒 Rôle non éligible
    if (!["buyer", "seller", "delivery"].includes(user.role)) {
      throw new Error("Rôle non éligible au parrainage");
    }

    // 🔗 Sauvegarde lien
    const referral = await Referral.create({
      referrer: referrer._id,
      referred: user._id,
      referredRole: user.role,
    });

    user.referredBy = referrer._id;
    await user.save();

    // 📊 Stats rapides
    await User.findByIdAndUpdate(referrer._id, {
      $inc: { "referralStats.totalReferrals": 1 },
    });

    return referral;
  }

  /**
   * Liste des filleuls d'un utilisateur
   */
  static async getUserReferrals(userId) {
    return Referral.find({ referrer: userId })
      .populate("referred", "fullName email role createdAt")
      .sort({ createdAt: -1 });
  }
}

module.exports = ReferralService;
