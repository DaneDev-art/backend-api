// scripts/migrateSellers.js
const mongoose = require("mongoose");
require("dotenv").config();

// 🔹 Charge les modèles
const User = require("../src/models/user.model");
const Seller = require("../src/models/Seller");

// 🔹 Connexion MongoDB
async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/emarket";
  await mongoose.connect(uri);
  console.log("✅ Connecté à MongoDB");
}

async function migrateSellers() {
  await connectDB();

  const users = await User.find({ role: "seller" });
  console.log(`📦 ${users.length} utilisateurs avec role=seller trouvés.`);

  let migrated = 0;
  for (const u of users) {
    const exists = await Seller.findOne({ email: u.email });
    if (exists) {
      console.log(`⚠️ Seller déjà existant pour ${u.email}`);
      continue;
    }

    const newSeller = new Seller({
      name: u.name || u.fullName || u.shopName || "Nom inconnu",
      surname: u.surname || "",
      email: u.email,
      phone: u.phone?.replace(/[^0-9]/g, ""), // nettoie
      prefix: u.prefix || u.countryPrefix || "228", // par défaut Togo
      payout_method: u.payout_method || "MOBILE_MONEY",
      payout_account: u.payout_account || u.phone,
      balance_locked: u.balance_locked || 0,
      balance_available: u.balance_available || 0,
      cinetpay_contact_added: u.cinetpay_contact_added || false,
      cinetpay_contact_id: u.cinetpay_contact_id || null,
      cinetpay_contact_meta: u.cinetpay_contact_meta || null,
    });

    await newSeller.save();
    migrated++;

    console.log(`✅ Migré: ${u.email} → Seller(${newSeller._id})`);
  }

  console.log(`🎉 Migration terminée : ${migrated} vendeurs ajoutés.`);
  await mongoose.disconnect();
}

migrateSellers().catch((err) => {
  console.error("❌ Erreur migration :", err);
  mongoose.disconnect();
});
