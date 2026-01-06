const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Product = require("../models/Product");
const Seller = require("../models/Seller");
const CinetPayService = require("../services/CinetPayService");

/* ======================================================
   🔹 CREATE ORDER BEFORE PAYIN (ESCROW INIT)
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

    /* ================= VALIDATIONS ================= */
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Panier vide" });
    }

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: "sellerId invalide" });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ message: "Adresse de livraison requise" });
    }

    /* ================= SELLER ================= */
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ message: "Vendeur introuvable" });
    }

    /* ================= PRODUITS ================= */
    const productIds = items.map((i) => i.productId);

    const products = await Product.find({
      _id: { $in: productIds },
      seller: sellerId,
    })
      .select("_id name price images")
      .lean();

    if (products.length !== items.length) {
      return res.status(400).json({
        message: "Produit invalide ou supprimé",
      });
    }

    const productMap = {};
    for (const p of products) {
      productMap[p._id.toString()] = p;
    }

    /* ================= SNAPSHOT PRODUITS ================= */
    let productTotal = 0;

    const frozenItems = items.map((item) => {
      const product = productMap[item.productId];   // ✅

      if (!product) {
        throw new Error("Produit introuvable");
      }

      const quantity = Number(item.quantity);
      const price = Number(product.price);

      productTotal += quantity * price;

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

    /* ================= CREATE ORDER ================= */
    const order = await Order.create({
      client: mongoose.Types.ObjectId.isValid(clientId)
        ? clientId
        : req.user?._id,   // ✅ préférable si authentifié

      seller: seller._id,
      items: frozenItems,

      totalAmount,
      shippingFee: Number(shippingFee),

      // sera recalculé après payin
      netAmount: 0,

      deliveryAddress,

      status: "PAYMENT_PENDING",   // ✅ ALIGNÉ AU SCHEMA

      escrow: {
        isLocked: false,
        lockedAt: null,
        releasedAt: null,
      },

      isConfirmedByClient: false,
      confirmedAt: null,
    });

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

/* ======================================================
   🔹 RELEASE FUNDS (CLIENT CONFIRMS DELIVERY)
====================================================== */
exports.releaseOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const clientId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "orderId invalide" });
    }

    const order = await Order.findById(orderId)
      .populate("seller");

    if (!order) {
      return res.status(404).json({ error: "Commande introuvable" });
    }

    /* ================= AUTH CLIENT ================= */
    if (order.client.toString() !== clientId.toString()) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    /* ================= STATUS ================= */
    const paidStatuses = ["PAID"];

    if (!paidStatuses.includes(order.status)) {
      return res.status(400).json({ error: "Commande non payée" });
    }

    if (!order.escrow?.isLocked) {
      return res.status(400).json({ error: "Fonds non bloqués" });
    }

    if (order.isConfirmedByClient) {
      return res.status(400).json({
        error: "Commande déjà confirmée",
      });
    }

    if (!order.netAmount || order.netAmount <= 0) {
      return res.status(400).json({
        error: "Montant vendeur invalide",
      });
    }

    /* ================= PAYOUT ================= */
    const payout =
      await CinetPayService.createPayOutForSeller({
        sellerId: order.seller._id,
        amount: order.netAmount,
        currency: order.currency || "XOF",
        notifyUrl:
          `${process.env.PLATFORM_BASE_URL}/api/cinetpay/payout/verify`,
      });

    /* ================= UPDATE ORDER ================= */
    order.status = "COMPLETED";
    order.escrow.isLocked = false;
    order.escrow.releasedAt = new Date();

    order.isConfirmedByClient = true;
    order.confirmedAt = new Date();

    await order.save();

    return res.status(200).json({
      success: true,
      message:
        "Commande confirmée, fonds libérés vers le vendeur",
      orderId: order._id,
      releasedAmount: order.netAmount,
      payout,
    });
  } catch (err) {
    console.error("❌ releaseOrder:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};
