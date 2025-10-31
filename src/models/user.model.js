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
      select: false, // 🔐 Empêche d’être renvoyé par défaut
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

    // 🔸 Informations vendeur
    ownerName: { type: String, trim: true },
    shopName: { type: String, trim: true, index: true },
    shopDescription: { type: String, trim: true },
    logoUrl: { type: String },
    profileImageUrl: { type: String },

    // ==========================================
    // 🔸 SOLDES & CINETPAY (compatibles controller)
    // ==========================================
    cinetpayId: { type: String },

    // ✅ Harmonisation des noms pour compatibilité
    balance_locked: { type: Number, default: 0 }, // utilisé par le contrôleur
    balance_available: { type: Number, default: 0 },

    // 🔸 Métadonnées CinetPay
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

    // 🔸 Documents d’identité (Cloudinary)
    idCardFrontUrl: { type: String },
    idCardBackUrl: { type: String },
    selfieUrl: { type: String },

    // 🔸 Avatar (pour buyers, admins)
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
// 🔐 Méthode pour comparer les mots de passe
// ==========================================
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ==========================================
// 🧩 Nettoyage de la sortie publique (profil utilisateur)
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
module.exports = mongoose.model("User", userSchema);
