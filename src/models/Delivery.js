const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "delivery" },

    phone: { type: String, required: true },
    address: { type: String, default: "" },
    zone: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },

    plate: { type: String, required: true }, // immatriculation
    idNumber: { type: String, required: true }, // numéro de carte ID
    guarantee: { type: String, default: "" }, // ex : nom de garant ou somme

    transportMode: { type: String, enum: ["Moto", "Voiture", "Vélo"], required: true },

    idCardFrontUrl: { type: String, required: true },
    idCardBackUrl: { type: String, required: true },
    selfieUrl: { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Delivery", deliverySchema);
