// src/controllers/seller.controller.js
const Seller = require("../models/Seller");

// -------------------
// CREATE SELLER
// -------------------
exports.createSeller = async (req, res) => {
  try {
    const { name, surname, email, phone, prefix } = req.body;

    if (!name || !email || !phone || !prefix) {
      return res.status(400).json({ message: "Champs requis manquants" });
    }

    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({ message: "Ce vendeur existe déjà" });
    }

    const seller = new Seller({
      name,
      surname: surname || "",
      email,
      phone,
      prefix,
      full_phone: `${prefix}${phone}`,
      role: "seller",
      balance_locked: 0,
      balance_available: 0,
      owner: req.user?.id || null, // optionnel si auth middleware utilisé
    });

    await seller.save();
    res.status(201).json({ success: true, seller });
  } catch (error) {
    console.error("❌ Erreur création seller:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// -------------------
// GET ALL SELLERS
// -------------------
exports.getSellers = async (req, res) => {
  try {
    const sellers = await Seller.find();
    res.status(200).json({ success: true, sellers });
  } catch (error) {
    console.error("❌ Erreur récupération sellers:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// -------------------
// GET SELLER BY ID
// -------------------
exports.getSellerById = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await Seller.findById(id);
    if (!seller) return res.status(404).json({ message: "Seller non trouvé" });

    res.status(200).json({ success: true, seller });
  } catch (error) {
    console.error("❌ Erreur récupération seller:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// -------------------
// UPDATE SELLER
// -------------------
exports.updateSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Si phone ou prefix changent → mettre à jour full_phone
    if (updateData.phone || updateData.prefix) {
      const seller = await Seller.findById(id);
      if (!seller) return res.status(404).json({ message: "Seller non trouvé" });

      const newPhone = updateData.phone || seller.phone;
      const newPrefix = updateData.prefix || seller.prefix;
      updateData.full_phone = `${newPrefix}${newPhone}`;
    }

    const updatedSeller = await Seller.findByIdAndUpdate(id, updateData, { new: true });
    res.status(200).json({ success: true, seller: updatedSeller });
  } catch (error) {
    console.error("❌ Erreur mise à jour seller:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// -------------------
// DELETE SELLER
// -------------------
exports.deleteSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await Seller.findByIdAndDelete(id);
    if (!seller) return res.status(404).json({ message: "Seller non trouvé" });

    res.status(200).json({ success: true, message: "Seller supprimé", seller });
  } catch (error) {
    console.error("❌ Erreur suppression seller:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
