const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

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
      select: false,
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

    // ⭐️ Vérification email
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
    verificationTokenExpires: {
      type: Date,
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

    // 🔸 Images de profil (Cloudinary)
    profileImageUrl: { type: String }, // legacy
    avatarUrl: { type: String, default: "" }, // legacy
    photoURL: { type: String, trim: true }, // ✅ champ standard (Flutter / API)

    // 🔸 CINETPAY / Soldes
    cinetpayId: { type: String },
    balance_locked: { type: Number, default: 0 },
    balance_available: { type: Number, default: 0 },
    cinetpayContactAdded: { type: Boolean, default: false },
    cinetpayContactMeta: { type: Object, default: {} },

    // 🔸 Infos livreur
    plate: { type: String, trim: true },
    idNumber: { type: String, trim: true },
    guarantee: { type: String, trim: true },
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

    // 🔸 Champs supplémentaires pour sellers
    prefix: { type: String, default: "228" },
    fullNumber: { type: String, default: "" },
  },
  { timestamps: true }
);

// ==========================================
// 🔄 Synchronisation images (compatibilité)
// ==========================================
userSchema.pre("save", function (next) {
  if (this.photoURL) {
    this.avatarUrl = this.photoURL;
    this.profileImageUrl = this.photoURL;
  }
  next();
});

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
// ⚡ Génère un token de vérification email
// ==========================================
userSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");

  this.verificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;

  return token;
};

// ==========================================
// 🔐 Comparaison des mots de passe
// ==========================================
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
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
  delete user.verificationToken;
  delete user.verificationTokenExpires;
  return user;
};

// ==========================================
// 🔍 Index pour les recherches
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
