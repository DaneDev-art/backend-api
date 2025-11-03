// scripts/migrateSellers.js
const mongoose = require("mongoose");
const User = require("../src/models/user.model");
const Seller = require("../src/models/Seller");

// ✅ Ton URI Atlas
const MONGO_URI = "mongodb+srv://danielbusiness859_db_user:uhlIgQIXvI2GQSHL@flutterappdb.uuvrexl.mongodb.net/mydb?retryWrites=true&w=majority";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connecté à MongoDB Atlas");

    // Récupère tous les vendeurs depuis la collection "users"
    const users = await User.find({ role: "seller" });
    console.log(`👥 ${users.length} vendeurs trouvés dans 'users'`);

    for (const user of users) {
      // Vérifie si ce vendeur existe déjà dans "sellers"
      const exist = await Seller.findOne({ email: user.email });
      if (exist) {
        console.log(`⚠️ Seller déjà existant pour ${user.email}`);
        continue;
      }

      // Nettoyage du numéro de téléphone
      const phone = user.phone?.startsWith("+")
        ? user.phone.replace("+", "")
        : user.phone;

      const prefix = phone ? phone.slice(0, 3) : "228";

      // Création du nouveau document Seller
      const newSeller = new Seller({
        name: user.shopName || "Nom vendeur",
        surname: user.email?.split("@")[0] || "vendeur",
        email: user.email,
        phone,
        prefix,
        balance_locked: 0,
        balance_available: 0,
        payout_method: "MOBILE_MONEY",
        status: user.status || "approved",
        country: user.country || "Togo",
        address: user.address || "",
        shopName: user.shopName || "",
        avatarUrl: user.avatarUrl || "",
        cinetpay_contact_added: false,
        cinetpay_contact_meta: [],
      });

      await newSeller.save();
      console.log(`✅ Seller créé pour ${user.email}`);
    }

    console.log("🚀 Migration terminée !");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur migration:", err);
    process.exit(1);
  }
})();
