const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Product = require("../models/Product");
const Seller = require("../models/Seller");

/* ======================================================
   🔹 CREATE ORDER BEFORE PAYIN
   - Crée la commande avant que le client ne paye
   - Compatible ESCROW (fonds bloqués)
====================================================== */
exports.createOrderBeforePayIn = async (req, res) => {
  try {
    const {
      items,
      sellerId,
      clientId,
      shippingFee = 0,
      deliveryAddress,
    } = req.body;

    /* ======================================================
       🔹 VALIDATIONS DE BASE
    ====================================================== */
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Panier vide" });
    }

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: "sellerId invalide" });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ message: "Adresse de livraison requise" });
    }

    /* ======================================================
       🔹 VÉRIFICATION VENDEUR
    ====================================================== */
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ message: "Vendeur introuvable" });
    }

    /* ======================================================
       🔹 CHARGEMENT DES PRODUITS (SOURCE UNIQUE DE VÉRITÉ)
    ====================================================== */
    const productIds = items.map((i) => i.productId);

    const products = await Product.find({
      _id: { $in: productIds },
      seller: sellerId,
    })
      .select("_id name price images")
      .lean();

    if (products.length !== items.length) {
      return res
        .status(400)
        .json({ message: "Produit invalide ou supprimé" });
    }

    const productMap = {};
    for (const p of products) {
      productMap[p._id.toString()] = p;
    }

    /* ======================================================
       🔹 SNAPSHOT PRODUITS (IMMUTABLE)
    ====================================================== */
    let productTotal = 0;

    const frozenItems = items.map((item) => {
      const product = productMap[item.productId];
      if (!product) {
        throw new Error("Produit introuvable après mapping");
      }

      const quantity = Number(item.quantity);
      const price = Number(product.price);

      productTotal += price * quantity;

      return {
        product: product._id,
        productId: product._id.toString(),
        productName: product.name,
        productImage: product.images?.[0] || null,
        quantity,
        price,
      };
    });

    const totalAmount = productTotal + Number(shippingFee);

    /* ======================================================
       🔹 CRÉATION DE LA COMMANDE (ESCROW INIT)
    ====================================================== */
    const order = await Order.create({
      client: mongoose.Types.ObjectId.isValid(clientId)
        ? clientId
        : new mongoose.Types.ObjectId(),

      seller: seller._id,

      items: frozenItems,

      totalAmount,
      shippingFee,

      // ⚠️ netAmount sera défini après succès PayIn
      netAmount: 0,

      deliveryAddress,

      // Statut initial compatible ESCROW
      status: "PENDING",
      isConfirmedByClient: false,
    });

    /* ======================================================
       ✅ RÉPONSE AU FRONTEND
    ====================================================== */
    return res.status(201).json({
      success: true,
      orderId: order._id,
      totalAmount: order.totalAmount,
      message: "Commande créée, prête pour paiement",
    });
  } catch (error) {
    console.error("❌ createOrderBeforePayIn:", error);
    return res.status(500).json({
      message: "Erreur création commande",
      error: error.message,
    });
  }
};
