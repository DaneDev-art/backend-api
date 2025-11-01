/**
 * Script de migration des vendeurs (role: "seller")
 * de la collection users vers sellers.
 * 
 * ⚠️ À exécuter une seule fois : node src/scripts/migrate_sellers.js
 */

const mongoose = require("mongoose");
const User = require("../models/user.model");
const Seller = require("../models/Seller");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/emarket";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connecté à MongoDB");

    const sellersInUsers = await User.find({ role: "seller" });
    console.log(`🔍 ${sellersInUsers.length} vendeurs trouvés dans 'users'`);

    let created = 0;
    for (const user of sellersInUsers) {
      // Vérifie s'il existe déjà dans sellers
      const existing = await Seller.findOne({ email: user.email });
      if (existing) {
        console.log(`⏩ Déjà migré : ${user.email}`);
        continue;
      }

      const newSeller = new Seller({
        name: user.name || user.fullName || "",
        surname: user.surname || "",
        email: user.email,
        phone: user.phone,
        prefix: user.prefix || user.countryPrefix || "",
        balance_available: user.balance_available || 0,
        balance_locked: user.balance_locked || 0,
        cinetpay_contact_added: user.cinetpay_contact_added || false,
        cinetpay_contact_id: user.cinetpay_contact_id || null,
        cinetpay_contact_meta: user.cinetpay_contact_meta || null,
        payout_method: user.payout_method || "MOBILE_MONEY",
        payout_account: user.payout_account || "",
      });

      await newSeller.save();
      created++;
      console.log(`✅ Migré : ${user.email}`);
    }

    console.log(`\n✅ Migration terminée — ${created} vendeurs créés dans 'sellers'`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur de migration :", err);
    process.exit(1);
  }
})();
