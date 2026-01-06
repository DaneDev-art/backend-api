const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Product = require("../models/Product");
const Seller = require("../models/Seller");
const CinetPayService = require("../services/CinetPayService");

/* ======================================================
   🔹 CREATE ORDER BEFORE PAYIN
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

    // ===== VALIDATIONS =====
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Panier vide" });
    }

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: "sellerId invalide" });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ message: "Adresse de livraison requise" });
    }

    // ===== SELLER =====
    const seller = await Seller.findById(sellerId).lean();
    if (!seller) {
      return res.status(404).json({ message: "Vendeur introuvable" });
    }

    // ===== PRODUCTS CHECK =====
    const productIds = items.map((i) => i.productId);

    const products = await Product.find({
      _id: { $in: productIds },
      seller: sellerId,
    })
      .select("_id name price images imageUrl currency") // ajout de imageUrl
      .lean();

    if (products.length !== items.length) {
      return res.status(400).json({
        message: "Produit invalide ou supprimé",
      });
    }

    // map produits
    const productMap = {};
    for (const p of products) {
      productMap[p._id.toString()] = p;
    }

    // ===== SNAPSHOT =====
    let productTotal = 0;

    const frozenItems = items.map((item) => {
      const product = productMap[item.productId];

      const quantity = Number(item.quantity || 1);
      const price = Number(product.price);

      productTotal += quantity * price;

      return {
        product: product._id, // ref mongo
        productId: product._id.toString(),
        productName: product.name,
        productImage:
          product.images?.[0] || // priorité images[0]
          product.imageUrl || // fallback imageUrl
          null,
        quantity,
        price,
        currency: product.currency || "XOF",
      };
    });

    const totalAmount = productTotal + Number(shippingFee);

    // ===== CREATE ORDER =====
    const order = await Order.create({
      client: mongoose.Types.ObjectId.isValid(clientId)
        ? clientId
        : req.user?._id,

      seller: seller._id,

      items: frozenItems,

      totalAmount,
      shippingFee: Number(shippingFee),

      currency: frozenItems[0]?.currency || "XOF",

      netAmount: 0, // calculé après PayIn

      deliveryAddress,

      status: "PAYMENT_PENDING",

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
      totalAmount: order.totalAmount, // alias getter
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
   🔹 LOCK AFTER SUCCESSFUL PAYIN
====================================================== */
exports.lockEscrowAfterPayIn = async ({ orderId, payinResult }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Commande introuvable");

  // frais plateforme si besoin
  const PLATFORM_FEE_RATE = 0.04;

  order.netAmount = Math.floor(
    order.totalAmount * (1 - PLATFORM_FEE_RATE)
  );

  order.status = "PAID";

  order.escrow.isLocked = true;
  order.escrow.lockedAt = new Date();

  order.payment = {
    payinId: payinResult.transaction_id,
    operator: payinResult.operator || "CinetPay",
    paidAt: new Date(),
  };

  await order.save();

  return order;
};

/* ======================================================
   🔹 RELEASE FUNDS → PAYOUT SELLER
====================================================== */
exports.releaseOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const clientId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "orderId invalide" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ error: "Commande introuvable" });
    }

    // ===== AUTH CLIENT =====
    if (order.client.toString() !== clientId.toString()) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    // ===== STATUS CHECK =====
    if (order.status !== "PAID") {
      return res.status(400).json({
        error: "Commande non payée",
      });
    }

    if (!order.escrow?.isLocked) {
      return res.status(400).json({
        error: "Fonds non bloqués",
      });
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

    // ===== PAYOUT =====
    const payout = await CinetPayService.createPayOutForSeller({
      sellerId: order.seller,
      amount: order.netAmount,
      currency: order.currency || "XOF",
      notifyUrl: `${process.env.PLATFORM_BASE_URL}/api/cinetpay/payout/verify`,
    });

    // ===== UPDATE ORDER =====
    await Order.updateOne(
      { _id: orderId },
      {
        status: "COMPLETED",

        "escrow.isLocked": false,
        "escrow.releasedAt": new Date(),

        isConfirmedByClient: true,
        confirmedAt: new Date(),

        payoutInfo: {
          payoutId: payout.payout_id || payout.transaction_id,
          createdAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Commande confirmée, fonds libérés vers le vendeur",
      orderId,
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
