const CustomOrder = require("../models/CustomOrder");
const Order = require("../models/Order");
const Conversation = require("../models/Conversation");

/* ======================================================
   VENDEUR crée une commande personnalisée
   Lien avec la conversation client ↔ vendeur
====================================================== */
exports.createCustomOrder = async (req, res) => {
  try {
    const {
      conversationId,
      items,
      shippingFee,
      totalAmount,
      currency
    } = req.body;

    if (!conversationId || !items || items.length === 0 || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Vérifie la conversation pour récupérer client et seller
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    const customOrder = await CustomOrder.create({
      client: conversation.client,
      seller: conversation.seller,
      conversation: conversationId,
      items,
      shippingFee: shippingFee || 0,
      totalAmount,
      currency: currency || "XOF",
      status: "SUBMITTED",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // expire dans 24h
    });

    return res.status(201).json({
      success: true,
      customOrder
    });

  } catch (error) {
    console.error("createCustomOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* ======================================================
   CLIENT clique "PAYER"
   Convertit CustomOrder → Order
   Compatible CinetPay et QosPay existants
====================================================== */
exports.payCustomOrder = async (req, res) => {
  try {
    const customOrder = await CustomOrder.findById(req.params.id);

    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: "Custom order not found"
      });
    }

    if (customOrder.order) {
      return res.status(400).json({
        success: false,
        message: "Already converted to Order"
      });
    }

    if (customOrder.status === "EXPIRED") {
      return res.status(400).json({
        success: false,
        message: "Custom order expired"
      });
    }

    // créer Order compatible escrow existant
    const order = await Order.create({
      client: customOrder.client,
      seller: customOrder.seller,
      items: customOrder.items,
      totalAmount: customOrder.totalAmount,
      shippingFee: customOrder.shippingFee,
      currency: customOrder.currency,
      status: "CREATED", // IMPORTANT pour CinetPay/QosPay flow
      source: "CUSTOM",
      customOrder: customOrder._id
    });

    // lier CustomOrder → Order
    customOrder.order = order._id;
    customOrder.status = "PAYMENT_PENDING";
    await customOrder.save();

    return res.json({
      success: true,
      orderId: order._id
    });

  } catch (error) {
    console.error("payCustomOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* ======================================================
   CLIENT récupère ses commandes personnalisées
   Optionnel : filtrage par conversation
====================================================== */
exports.getClientCustomOrders = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const conversationId = req.query.conversationId;

    const filter = { client: clientId };
    if (conversationId) filter.conversation = conversationId;

    const orders = await CustomOrder.find(filter)
      .populate("seller", "name")
      .populate("order")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error("getClientCustomOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* ======================================================
   VENDEUR récupère ses commandes personnalisées
   Optionnel : filtrage par conversation
====================================================== */
exports.getSellerCustomOrders = async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    const conversationId = req.query.conversationId;

    const filter = { seller: sellerId };
    if (conversationId) filter.conversation = conversationId;

    const orders = await CustomOrder.find(filter)
      .populate("client", "fullName email")
      .populate("order")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error("getSellerCustomOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* ======================================================
   Récupérer toutes les CustomOrders d'une conversation
   Pour affichage côté client dans le chat
====================================================== */
exports.getConversationCustomOrders = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const orders = await CustomOrder.find({ conversation: conversationId })
      .populate("seller", "name")
      .populate("order")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      orders
    });

  } catch (error) {
    console.error("getConversationCustomOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};