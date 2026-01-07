const mongoose = require("mongoose");

// ======================================
// 🚚 Schéma Delivery (collection delivery)
// Aligné avec enum transportMode de User
// ======================================
const deliverySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      trim: true,
      select: false,
    },

    role: {
      type: String,
      default: "delivery",
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    zone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    plate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    idNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    guarantee: {
      type: String,
      default: "",
      trim: true,
    },

    // ====================================================
    // 🔥 TRANSPORT MODE — ENUM COMPLET ALIGNÉ SUR USER.MODE
    // ====================================================
    transportMode: {
      type: String,

      enum: [
        "Vélo",

        "Moto à 2 roues",
        "Moto à 3 roues",

        "Taxis 5 places",

        "Voiture 9 places",
        "Voiture 15 places",

        "Bus",

        "Camion",

        "Titan",

        "Autre",
      ],

      required: false,

      // ✅ Normalisation tolérante des entrées externes
      set: function (v) {
        if (!v) return v;

        const clean = v.toLowerCase().trim();

        const map = {
          // entrées courtes génériques
          "moto": "Moto à 2 roues",
          "moto 2 roues": "Moto à 2 roues",
          "moto 3 roues": "Moto à 3 roues",

          "voiture": "Voiture 9 places",

          "velo": "Vélo",
          "vélo": "Vélo",

          "taxi": "Taxis 5 places",
          "taxis": "Taxis 5 places",

          "camion": "Camion",
          "titan": "Titan",
          "bus": "Bus",
          "autre": "Autre",
        };

        return map[clean] || v.trim();
      },
    },

    // =========================
    // 📎 Documents identité
    // =========================
    idCardFrontUrl: {
      type: String,
      required: true,
      trim: true,
    },

    idCardBackUrl: {
      type: String,
      required: true,
      trim: true,
    },

    selfieUrl: {
      type: String,
      required: true,
      trim: true,
    },

    // =========================
    // ⏳ Statuts et dates
    // =========================
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================
// ✅ Export du modèle
// ======================================
module.exports = mongoose.model("Delivery", deliverySchema, "delivery");
