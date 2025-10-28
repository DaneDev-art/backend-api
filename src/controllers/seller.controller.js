const Seller = require("../models/Seller");

exports.createSeller = async (req, res) => {
  try {
    const { name, surname, email, phone, prefix } = req.body;

    if (!name || !email || !phone || !prefix) {
      return res.status(400).json({ message: "Champs requis manquants" });
    }

    // Vérifie si le vendeur existe déjà
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({ message: "Ce vendeur existe déjà" });
    }

    const seller = new Seller({
      name,
      surname,
      email,
      phone,
      prefix,
      owner: req.user?.id || null, // optionnel si l’auth est activée
    });

    await seller.save();
    res.status(201).json({ success: true, seller });
  } catch (error) {
    console.error("❌ Erreur création seller:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

exports.getSellers = async (req, res) => {
  try {
    const sellers = await Seller.find();
    res.status(200).json({ success: true, sellers });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
