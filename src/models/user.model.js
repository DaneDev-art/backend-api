const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ==========================================
// 🔹 Définition du schéma utilisateur
// ==========================================
const userSchema = new mongoose.Schema(
  {
    // 🧩 Informations de base
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
      select: false, // 🔐 crucial : à gérer au login
    },

    role: {
      type: String,
      enum: [
        "buyer",
        "seller",
        "delivery",
        "admin_general",
        "admin_seller",
        "admin_buyer",
        "admin_delivery",
      ],
      default: "buyer",
    },

    // 🔸 Informations communes
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    zone: { type: String, trim: true },
    country: { type: String, trim: true },
    city: { type: String, trim: true },

    // 🔸 Infos vendeur
    ownerName: { type: String, trim: true },
    shopName: { type: String, trim: true, index: true },
    shopDescription: { type: String, trim: true },
    logoUrl: { type: String },
    profileImageUrl: { type: String },

    // ==========================================
    // 🔸 SOLDES & CINETPAY
    // ==========================================
    cinetpayId: { type: String },

    balance_locked: { type: Number, default: 0 },
    balance_available: { type: Number, default: 0 },

    cinetpayContactAdded: { type: Boolean, default: false },
    cinetpayContactMeta: { type: Object, default: {} },

    // 🔸 Informations livreur
    plate: { type: String, trim: true },
    idNumber: { type: String, trim: true },
    guarantee: { type: String, trim: true },
    transportMode: {
      type: String,
      enum: ["Moto", "Vélo", "Voiture", "Autre"],
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function () {
        return this.role === "delivery" ? "pending" : "approved";
      },
    },

    // 🔸 Documents d’identité
    idCardFrontUrl: { type: String },
    idCardBackUrl: { type: String },
    selfieUrl: { type: String },

    // 🔸 Avatar
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

// ==========================================
// 🔐 Hash du mot de passe avant sauvegarde
// ==========================================
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 🔐 Comparaison des mots de passe
// ==========================================
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    // arrive si on oublie .select("+password")
    throw new Error("Password not selected in query");
  }

  return bcrypt.compare(candidatePassword, this.password);
};

// ==========================================
// 🧩 Nettoyage du retour public
// ==========================================
userSchema.methods.toPublicJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// ==========================================
// 🔍 Index utile pour les recherches
// ==========================================
userSchema.index({
  email: "text",
  fullName: "text",
  shopName: "text",
  city: "text",
  country: "text",
});

// ==========================================
// ✅ Export du modèle
// ==========================================
module.exports = mongoose.model("User", userSchema, "users");
