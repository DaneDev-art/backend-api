const mongoose = require("mongoose");

const DeliveryAssignmentSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    sellerId: { type: String, required: true }, // utilisateur qui soumet
    deliveryManId: { type: String, required: true }, // livreur
    deliveryManName: { type: String, required: true },
    productName: { type: String, required: true },
    productImage: { type: String },
    status: {
      type: String,
      enum: ["assigned", "accepted", "in_progress", "delivered"],
      default: "assigned",
    },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeliveryAssignment", DeliveryAssignmentSchema);
